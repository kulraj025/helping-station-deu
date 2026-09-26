import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Button system.
 *
 * `buttonVariants()` is exported so links and other elements can reuse the exact
 * same visual language without nesting an <a> inside a <button>.
 */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "soft"
  | "azure"
  | "gold"
  | "danger"
  | "dark";

export type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-leaf-600 disabled:pointer-events-none disabled:opacity-55 active:translate-y-px whitespace-nowrap";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-leaf-700 text-white shadow-soft hover:bg-leaf-800 hover:shadow-lift hover:-translate-y-0.5",
  secondary:
    "bg-white text-leaf-800 border border-leaf-200 shadow-soft hover:border-leaf-400 hover:bg-leaf-50 hover:-translate-y-0.5",
  outline:
    "bg-transparent text-leaf-800 border-2 border-leaf-300 hover:bg-leaf-50 hover:border-leaf-500",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900",
  soft: "bg-leaf-100 text-leaf-900 hover:bg-leaf-200",
  azure: "bg-azure-500 text-white shadow-soft hover:bg-azure-600 hover:-translate-y-0.5",
  gold: "bg-gold-500 text-leaf-950 shadow-soft hover:bg-gold-400 hover:-translate-y-0.5",
  danger: "bg-red-600 text-white shadow-soft hover:bg-red-700",
  dark: "bg-slate-900 text-white shadow-soft hover:bg-slate-800 hover:-translate-y-0.5",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-13 px-7 text-base",
  xl: "h-15 px-9 text-lg",
  icon: "h-11 w-11",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonVariants({ variant, size, className })} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize; children: ReactNode }) {
  return (
    <Link className={buttonVariants({ variant, size, className })} {...props}>
      {children}
    </Link>
  );
}

/** Small pill used for tags, statuses and metadata. */
export function Pill({
  className,
  children,
  ...props
}: ComponentProps<"span"> & { children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
