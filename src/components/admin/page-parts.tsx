import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Consistent page heading for every admin screen. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-extrabold text-leaf-950 sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-slate-600">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Page body wrapper with consistent padding. */
export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[100rem] space-y-6 p-4 lg:p-8", className)}>
      {children}
    </div>
  );
}

/** A titled panel with a sticky-friendly header. */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  tone = "default",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "default" | "warning" | "danger" | "success";
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border bg-white shadow-soft",
        tone === "warning" && "border-amber-300",
        tone === "danger" && "border-red-300",
        tone === "success" && "border-leaf-300",
        tone === "default" && "border-slate-200",
        className,
      )}
    >
      {title ? (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-base font-extrabold text-leaf-950">{title}</h2>
            {description ? (
              <p className="mt-1 text-sm text-slate-600">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Small stat tile used across the dashboard and draw console. */
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "leaf" | "gold" | "azure" | "red" | "slate";
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "default" && "border-slate-200 bg-white",
        tone === "leaf" && "border-leaf-200 bg-leaf-50",
        tone === "gold" && "border-gold-300 bg-amber-50",
        tone === "azure" && "border-azure-200 bg-azure-50",
        tone === "red" && "border-red-200 bg-red-50",
        tone === "slate" && "border-slate-200 bg-slate-50",
      )}
    >
      <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest text-slate-500">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 font-display text-2xl font-extrabold text-leaf-950">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

/** Definition row, for compact key/value summaries. */
export function DataRow({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 py-2 last:border-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd
        className={cn(
          "min-w-0 break-all text-sm font-semibold text-slate-800",
          mono && "font-mono text-xs",
        )}
      >
        {children}
      </dd>
    </div>
  );
}
