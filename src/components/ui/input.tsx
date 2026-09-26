import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const controlBase =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-[0.95rem] text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-leaf-500 focus:outline-none focus:ring-4 focus:ring-leaf-500/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlBase, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-28 resize-y", className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(controlBase, "appearance-none bg-[length:1.1rem] pr-10", className)} {...props}>
      {children}
    </select>
  );
}

export function Checkbox({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      type="checkbox"
      className={cn(
        "mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-2 border-slate-300 text-leaf-600 accent-leaf-600 transition focus:ring-4 focus:ring-leaf-500/20",
        className,
      )}
      {...props}
    />
  );
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  optional,
  className,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-3 text-sm font-semibold text-slate-800">
        <span>
          {label}
          {required ? (
            <span className="ml-1 text-red-600" aria-hidden="true">
              *
            </span>
          ) : null}
        </span>
        {optional ? <span className="text-xs font-medium text-slate-400">Optional</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="flex items-start gap-1.5 text-xs font-semibold text-red-600">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export function FormAlert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "error" | "success" | "warning";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const map = {
    info: "border-azure-200 bg-azure-50 text-azure-600",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-leaf-200 bg-leaf-50 text-leaf-800",
    warning: "border-gold-300 bg-amber-50 text-amber-800",
  } as const;
  const icon = { info: "ℹ️", error: "⚠️", success: "✅", warning: "🔒" } as const;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-2xl border p-4 text-sm", map[tone], className)}
    >
      <span aria-hidden="true" className="text-base leading-6">
        {icon[tone]}
      </span>
      <div className="space-y-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

export function FormRow({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("grid gap-5 sm:grid-cols-2", className)} {...props} />;
}
