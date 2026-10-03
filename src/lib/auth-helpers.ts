import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role } from "./constants";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  studentId: string;
}

/** Session user, or null. Safe to call from any server component. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    role: (session.user.role ?? "STUDENT") as Role,
    department: session.user.department ?? "",
    studentId: session.user.studentId ?? "",
  };
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "ADMIN";
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

/** Guard for `/admin/*`: redirects to the login page with a return path. */
export async function requireAdmin(returnTo = "/admin"): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    // `mode=organiser` opens the login form on the tab that can actually
    // authenticate an organiser. Without it the form defaults to Student, the
    // organiser's valid credentials are rejected by the student provider, and
    // the failure is reported as if the password were wrong.
    redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}&reason=auth&mode=organiser`);
  }
  if (user.role !== "ADMIN") {
    redirect("/account?error=forbidden");
  }
  return user;
}

/** Guard for student-only pages. Admins are allowed too (they organise). */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}&reason=auth`);
  }
  return user;
}
