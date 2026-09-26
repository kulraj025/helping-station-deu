import type { ComponentProps, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Loader2 className={cn("h-4 w-4 animate-spin", className)} aria-hidden="true" />
      {label ? <span className="text-sm text-slate-600">{label}</span> : null}
      <span className="sr-only">Loading</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} aria-hidden="true" />;
}

export function TableShell({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[44rem] border-collapse text-left text-sm" {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-slate-200 bg-slate-50/80 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-slate-100 px-4 py-3 align-middle", className)} {...props} />;
}

export function Tr({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-leaf-50/40", className)} {...props} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center",
        className,
      )}
    >
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <p className="text-base font-bold text-slate-800">{title}</p>
      {description ? <p className="max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Horizontal progress meter used by the admin eligibility workflow. */
export function Meter({
  value,
  max,
  label,
  tone = "leaf",
}: {
  value: number;
  max: number;
  label?: string;
  tone?: "leaf" | "azure" | "gold";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const tones = { leaf: "bg-leaf-500", azure: "bg-azure-500", gold: "bg-gold-500" } as const;
  return (
    <div>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-600">
          <span>{label}</span>
          <span>
            {value}/{max}
          </span>
        </div>
      ) : null}
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label ?? "Progress"}
      >
        <div className={cn("h-full rounded-full transition-all duration-500", tones[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
