"use client";

import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Google's own "G" mark.
 *
 * The multi-colour G is part of Google's brand guidelines, and the guidelines
 * require the button to carry it rather than a monochrome stand-in. The
 * `Chrome` icon from lucide — which this used to use — is a different logo
 * entirely: it is the browser icon, and a sign-in button wearing it reads as
 * "open in browser", not "sign in with Google".
 *
 * Drawn as inline paths so it needs no network request and cannot flash
 * unstyled. `aria-hidden` because the button's own text already names it.
 */
export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 18"
      className={cn("h-[18px] w-[18px] shrink-0", className)}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.797 2.715v2.258h2.909c1.702-1.567 2.684-3.879 2.684-6.613Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.182l-2.909-2.258c-.806.54-1.835.859-3.047.859-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A8.998 8.998 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.963 10.705A5.41 5.41 0 0 1 3.681 9c0-.592.102-1.168.282-1.705V4.963H.956A8.998 8.998 0 0 0 0 9c0 1.452.347 2.827.956 4.037l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.581c1.321 0 2.506.454 3.44 1.345l2.581-2.581C13.463.892 11.426 0 9 0A8.998 8.998 0 0 0 .956 4.963l3.007 2.332C4.672 5.166 6.656 3.581 9 3.581Z"
      />
    </svg>
  );
}

/**
 * Sign-in button styled the way Google's own documentation specifies: white
 * background, a hairline border, near-black label, and the brand mark at the
 * left. Google publishes hard rules for this button (minimum height, border
 * radius, no all-caps) and apps that invent their own treatment get rejected
 * during OAuth verification, so the classes here follow those rules rather
 * than the site palette.
 */
export function GoogleSignInButton({
  className,
  children = "Continue with Google",
  ...props
}: ComponentProps<"button"> & { children?: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-5 py-3",
        "text-[0.95rem] font-semibold text-slate-700 shadow-sm transition-all duration-200",
        "hover:bg-slate-50 hover:shadow-md hover:-translate-y-px active:translate-y-0",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-leaf-600",
        "disabled:pointer-events-none disabled:opacity-55",
        className,
      )}
      {...props}
    >
      <GoogleMark />
      <span>{children}</span>
    </button>
  );
}

/**
 * The "or" rule between two sign-in choices.
 *
 * `role="separator"` with an `aria-orientation` of horizontal: screen readers
 * otherwise read the dashes as three meaningless hyphens.
 */
export function SignInDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3" role="separator" aria-orientation="horizontal">
      <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
        {children}
      </span>
      <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
    </div>
  );
}
