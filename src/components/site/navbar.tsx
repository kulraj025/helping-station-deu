"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Leaf, Menu, X, UserRound, ShieldCheck, Ticket, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const links = [
  { href: "/", label: "Home" },
  { href: "/event", label: "Event" },
  { href: "/draw", label: "Lucky Draw" },
  { href: "/winners", label: "Winners" },
  { href: "/rules", label: "Rules" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteNavbar({ role, name }: { role: "STUDENT" | "ADMIN" | null; name?: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        "no-print sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-slate-200/80 bg-white/85 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="container-page flex h-16 items-center justify-between gap-4 sm:h-18" aria-label="Main">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-leaf-700 text-white shadow-soft transition group-hover:scale-105">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-[0.95rem] font-extrabold tracking-tight text-leaf-900">
              Helping Station DEU
            </span>
            <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-slate-500">
              Serving Beyond Borders
            </span>
          </span>
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "rounded-full px-3.5 py-2 text-sm font-semibold transition",
                  isActive(link.href)
                    ? "bg-leaf-100 text-leaf-800"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {role === "ADMIN" ? (
            <Link href="/admin" className={buttonVariants({ variant: "soft", size: "sm" })}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          ) : null}

          {role ? (
            <Link href="/account" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span className="hidden max-w-24 truncate sm:inline">{name ?? "Account"}</span>
            </Link>
          ) : (
            <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Sign in
            </Link>
          )}

          <Link href="/register" className={buttonVariants({ variant: "primary", size: "sm" })}>
            <Ticket className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Register</span>
          </Link>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open ? (
        <div id="mobile-menu" className="border-t border-slate-200 bg-white lg:hidden">
          <ul className="container-page grid gap-1 py-4">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-4 py-3 text-base font-semibold",
                    isActive(link.href) ? "bg-leaf-100 text-leaf-800" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  {link.label}
                  {isActive(link.href) ? <span aria-hidden="true">•</span> : null}
                </Link>
              </li>
            ))}
            {role === "ADMIN" ? (
              <li>
                <Link href="/admin" className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold text-leaf-800 hover:bg-leaf-50">
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> Organiser dashboard
                </Link>
              </li>
            ) : null}
            {!role ? (
              <li>
                <Link href="/login" className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50">
                  <UserRound className="h-4 w-4" aria-hidden="true" /> Sign in
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
