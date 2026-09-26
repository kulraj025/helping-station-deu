"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Modal dialog.
 *
 * Built on the native <dialog> element so focus trapping, Escape-to-close and
 * inert background content come from the platform rather than hand-rolled JS.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    node.addEventListener("cancel", handleCancel);
    return () => node.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" } as const;

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      className={cn(
        "w-[calc(100vw-2rem)] rounded-3xl border border-slate-200 bg-white p-0 text-slate-900 shadow-glow backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm",
        widths[size],
      )}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
        <div>
          <h2 id="dialog-title" className="text-xl font-bold text-slate-900">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close dialog"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">{children}</div>
      {footer ? (
        <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 bg-slate-50/80 p-4 sm:p-5">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
