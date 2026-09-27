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
      <nav className="container-page flex h-16 items-center justify-between gap-3 sm:h-18 sm:gap-4" aria-label="Main">
        {/*
          The brand block is the only part of the header allowed to shrink, and
          it is given `min-w-0` so that it actually can: a flex item's default
          `min-width: auto` refuses to go below its content, which is what made
          this row wider than a phone. With the tagline hidden below `sm` and
          `truncate` on the wordmark, the header now fits at 320px instead of
          overflowing by roughly 200px and pushing the page into a sideways
          scroll.
        */}
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-700 text-white shadow-soft transition group-hover:scale-105">
            <Leaf className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-sm font-extrabold tracking-tight text-leaf-900 sm:text-[0.95rem]">
              Helping Station DEU
            </span>
            <span className="hidden truncate text-[0.68rem] font-semibold uppercase tracking-[0.13em] text-slate-500 sm:block">
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

        {/*
          Below `sm` the header carries only the brand, the primary call to
          action, and the menu button. Everything else a signed-in visitor needs
          is already in that menu, so repeating it here as a row of icon-only
          buttons cost roughly 120px of a 360px screen and left the site name
          truncated to "Helping…". One rule, applied consistently: a control that
          appears in the menu does not also appear in the bar.
        */}
        <div className="flex shrink-0 items-center gap-2">
          {role === "ADMIN" ? (
            <Link
              href="/admin"
              className={cn(buttonVariants({ variant: "soft", size: "sm" }), "hidden sm:inline-flex")}
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          ) : null}

          {role ? (
            <Link
              href="/account"
              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "hidden sm:inline-flex")}
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <span className="hidden max-w-24 truncate sm:inline">{name ?? "Account"}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
            >
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
        /*
         * The panel is inside a `sticky` header, so without a cap it grows to
         * the full height of the menu and — being sticky — stays there, hiding
         * the page behind it. `dvh` is measured against the *visible* viewport,
         * which is the one that shrinks when a mobile browser's address bar
         * slides away; the `overflow-y-auto` then means a long menu scrolls
         * instead of being clipped off the bottom of the screen.
         */
        <div
          id="mobile-menu"
          className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-slate-200 bg-white lg:hidden"
        >
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
            {role ? (
              /*
               * Reached from here rather than from the bar on phones, where the
               * account button is hidden to make room for the site name. Without
               * this, a signed-in visitor on a phone would have no way to reach
               * their own registration at all.
               */
              <li>
                <Link
                  href="/account"
                  className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <UserRound className="h-4 w-4" aria-hidden="true" /> My account
                </Link>
              </li>
            ) : (
              <li>
                <Link href="/login" className="flex items-center gap-2 rounded-xl px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50">
                  <UserRound className="h-4 w-4" aria-hidden="true" /> Sign in
                </Link>
              </li>
            )}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
