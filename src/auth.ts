import "server-only";
import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { LIMITS, hashIdentifier, rateLimit } from "@/lib/rate-limit";
import { getClientIpHash } from "@/lib/http";
import { adminLoginSchema, claimCodeLoginSchema, studentLoginSchema } from "@/lib/validation";
import { isRole, type Role } from "@/lib/constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      name: string;
      email: string;
      department: string;
      studentId: string;
    } & DefaultSession["user"];
  }
  interface User {
    role?: Role;
    department?: string;
    studentId?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    userId?: string;
    role?: Role;
    department?: string;
    studentId?: string;
  }
}

export const ADMIN_PROVIDER_ID = "admin";
export const STUDENT_PROVIDER_ID = "student";

async function recordAttempt(
  identifier: string,
  success: boolean,
  reason: string | null,
  ipHash: string,
) {
  try {
    await prisma.loginAttempt.create({ data: { identifier, success, reason, ipHash } });
  } catch {
    // Never let audit bookkeeping break a login.
  }
}

const adminProvider = Credentials({
  id: ADMIN_PROVIDER_ID,
  name: "Organiser account",
  credentials: {
    email: { label: "E-mail", type: "email" },
    password: { label: "Password", type: "password" },
    website: { label: "Website", type: "text" },
  },
  async authorize(raw) {
    const parsed = adminLoginSchema.safeParse(raw);
    if (!parsed.success || parsed.data.website) return null;

    const ipHash = await getClientIpHash();
    const limit = await rateLimit(
      LIMITS.adminLogin.key,
      hashIdentifier(parsed.data.email),
      LIMITS.adminLogin.limit,
      LIMITS.adminLogin.windowSeconds,
    );
    if (!limit.ok) {
      await recordAttempt(parsed.data.email, false, "rate_limited", ipHash);
      return null;
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || !user.isActive) {
      await recordAttempt(parsed.data.email, false, "unknown_user", ipHash);
      return null;
    }
    if (!user.passwordHash || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      await recordAttempt(parsed.data.email, false, "bad_password", ipHash);
      return null;
    }
    if (user.role !== "ADMIN") {
      await recordAttempt(parsed.data.email, false, "not_admin", ipHash);
      return null;
    }

    await recordAttempt(parsed.data.email, true, null, ipHash);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: "ADMIN" as Role,
      department: user.department,
      studentId: user.studentId,
    };
  },
});

const studentProvider = Credentials({
  id: STUDENT_PROVIDER_ID,
  name: "Student account",
  credentials: {
    identifier: { label: "University e-mail", type: "email" },
    password: { label: "Password", type: "password" },
    claimCode: { label: "Claim code", type: "text" },
  },
  async authorize(raw) {
    const identifier = typeof raw?.identifier === "string" ? raw.identifier.trim().toLowerCase() : "";
    const password = typeof raw?.password === "string" ? raw.password : "";
    const claimCode = typeof raw?.claimCode === "string" ? raw.claimCode : "";

    const parsed = claimCode
      ? claimCodeLoginSchema.safeParse({ identifier, claimCode })
      : studentLoginSchema.safeParse({ identifier, password });
    if (!parsed.success) return null;

    const ipHash = await getClientIpHash();
    const limited = await rateLimit(
      LIMITS.login.key,
      hashIdentifier(parsed.data.identifier),
      LIMITS.login.limit,
      LIMITS.login.windowSeconds,
    );
    if (!limited.ok) {
      await recordAttempt(parsed.data.identifier, false, "rate_limited", ipHash);
      return null;
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.identifier } });
    if (!user || !user.isActive || user.role !== "STUDENT") {
      await recordAttempt(parsed.data.identifier, false, "unknown_user", ipHash);
      return null;
    }

    if (claimCode) {
      if (!user.claimCodeHash || !(await bcrypt.compare(claimCode, user.claimCodeHash))) {
        await recordAttempt(parsed.data.identifier, false, "bad_claim_code", ipHash);
        return null;
      }
    } else if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      await recordAttempt(parsed.data.identifier, false, "bad_password", ipHash);
      return null;
    }

    await recordAttempt(parsed.data.identifier, true, null, ipHash);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: "STUDENT" as Role,
      department: user.department,
      studentId: user.studentId,
    };
  },
});

const googleProvider = Google({
  clientId: env.googleClientId,
  clientSecret: env.googleClientSecret,
  authorization: {
    params: {
      scope: "openid email profile",
      prompt: "consent",
      access_type: "offline",
      response_type: "code",
    },
  },
  profile(profile) {
    // Domain enforcement lives in the `signIn` callback so every provider
    // shares one code path; this only normalises the returned identity.
    return {
      id: profile.sub,
      email: profile.email,
      name: profile.name,
      image: profile.picture,
    };
  },
});

/** OAuth providers that may provision a STUDENT account on first sign-in. */
const OAUTH_STUDENT_PROVIDERS = new Set(["google"]);

/** Only university accounts may self-register through OAuth. */
const ALLOWED_EMAIL_DOMAIN = "@deu.ac.kr";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.authSecret,
  trustHost: env.authTrustHost,
  session: { strategy: "jwt", maxAge: env.authMaxAge },
  pages: { signIn: "/login", error: "/login" },
  providers: [
    adminProvider,
    studentProvider,
    ...(env.googleClientId && env.googleClientSecret ? [googleProvider] : []),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      const providerId = account?.provider;
      if (!providerId || !OAUTH_STUDENT_PROVIDERS.has(providerId)) return true;

      const rawProfile = profile as Record<string, unknown> | undefined;
      const email = (user.email ?? "").trim().toLowerCase();

      if (!email) {
        return `/login?error=OAuthEmailMissing&provider=${providerId}`;
      }
      if (!email.endsWith(ALLOWED_EMAIL_DOMAIN)) {
        return `/login?error=OAuthDomainNotAllowed&provider=${providerId}`;
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });

      if (existingUser) {
        // Known account: just refresh the last-seen timestamp.
        await prisma.user.update({
          where: { email },
          data: { lastLoginAt: new Date() },
        });
        return true;
      }

      const oauthId =
        user.id ??
        (typeof rawProfile?.sub === "string" ? rawProfile.sub : undefined) ??
        crypto.randomUUID();
      const name = user.name ?? (typeof rawProfile?.name === "string" ? rawProfile.name : undefined) ?? email.split("@")[0] ?? "Student";

      // First sign-in: provision a passwordless STUDENT account.
      await prisma.user.create({
        data: {
          id: `${providerId}_${oauthId}`,
          email,
          name,
          studentId: `${providerId}_${oauthId.slice(0, 8)}`.toUpperCase(),
          department: "Unknown",
          role: "STUDENT",
          // OAuth accounts authenticate through the provider, never a local password.
          passwordHash: null,
          isActive: true,
          isDemo: false,
        },
      });
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role ?? "STUDENT";
        token.department = user.department;
        token.studentId = user.studentId;
      }
      if (account?.provider && OAUTH_STUDENT_PROVIDERS.has(account.provider)) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId) {
        const role = token.role;
        session.user.id = token.userId;
        session.user.role = role && isRole(role) ? role : "STUDENT";
        session.user.department = token.department ?? "";
        session.user.studentId = token.studentId ?? "";
      }
      return session;
    },
  },
});

