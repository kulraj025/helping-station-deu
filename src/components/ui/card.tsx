import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardLink({ className, ...props }: ComponentProps<"a">) {
  return <a className={cn("card block transition-transform duration-200 hover:-translate-y-1 hover:shadow-lift", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6", className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-leaf-100 text-leaf-700">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Section({
  className,
  children,
  id,
  ...props
}: ComponentProps<"section">) {
  return (
    <section id={id} className={cn("relative py-16 sm:py-20 lg:py-24", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {eyebrow ? (
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-leaf-100 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-leaf-800">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{description}</p>
      ) : null}
    </div>
  );
}

export function Stat({
  value,
  label,
  hint,
  tone = "leaf",
  className,
}: {
  value: ReactNode;
  label: ReactNode;
  hint?: ReactNode;
  tone?: "leaf" | "azure" | "gold" | "slate";
  className?: string;
}) {
  const tones = {
    leaf: "from-leaf-600 to-leaf-800",
    azure: "from-azure-500 to-azure-600",
    gold: "from-gold-400 to-gold-600",
    slate: "from-slate-700 to-slate-900",
  } as const;

  return (
    <div className={cn("rounded-2xl bg-gradient-to-br p-5 text-white shadow-soft", tones[tone], className)}>
      <div className="font-display text-3xl font-extrabold leading-none sm:text-4xl">{value}</div>
      <div className="mt-1.5 text-sm font-semibold text-white/90">{label}</div>
      {hint ? <div className="mt-0.5 text-xs text-white/70">{hint}</div> : null}
    </div>
  );
}
