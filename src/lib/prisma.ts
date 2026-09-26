/**
 * Prisma client (Prisma 7 + `@prisma/adapter-pg`).
 *
 * A single client is reused across hot reloads in development. The adapter is
 * created from `DATABASE_URL` only — credentials never reach the browser.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.databaseUrl, max: env.dbPoolMax });
  return new PrismaClient({
    adapter,
    log: env.isDevelopment ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
export { Prisma } from "@/generated/prisma/client";
