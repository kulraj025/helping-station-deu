"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Lightweight toast system (no dependency).
 * Messages are announced politely so screen readers pick them up.
 */

type ToastTone = "success" | "error" | "info" | "warning";

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastApi {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const toneStyles: Record<ToastTone, { wrap: string; icon: ReactNode }> = {
  success: { wrap: "border-leaf-200 bg-white text-leaf-800", icon: <CheckCircle2 className="h-5 w-5 text-leaf-600" aria-hidden="true" /> },
  error: { wrap: "border-red-200 bg-white text-red-700", icon: <TriangleAlert className="h-5 w-5 text-red-600" aria-hidden="true" /> },
  warning: { wrap: "border-gold-300 bg-white text-amber-800", icon: <TriangleAlert className="h-5 w-5 text-gold-500" aria-hidden="true" /> },
  info: { wrap: "border-azure-200 bg-white text-azure-600", icon: <Info className="h-5 w-5 text-azure-500" aria-hidden="true" /> },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = Date.now() + Math.floor(Math.random() * 1000);
      setToasts((current) => [...current.slice(-3), { id, tone, title, description }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push("success", title, description),
      error: (title, description) => push("error", title, description),
      info: (title, description) => push("info", title, description),
      warning: (title, description) => push("warning", title, description),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
        role="region"
        aria-label="Notifications"
      >
        <div aria-live="polite" aria-atomic="false" className="contents">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm animate-[rise_0.35s_cubic-bezier(0.22,1,0.36,1)_both] items-start gap-3 rounded-2xl border p-4 shadow-lift",
                toneStyles[toast.tone].wrap,
              )}
            >
              {toneStyles[toast.tone].icon}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold">{toast.title}</p>
                {toast.description ? (
                  <p className="mt-0.5 text-sm text-slate-600">{toast.description}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const context = useContext(ToastContext);
  if (!context) {
    // Safe fallback so components can be rendered in isolation (e.g. tests).
    return { success: () => {}, error: () => {}, info: () => {}, warning: () => {} };
  }
  return context;
}

/** Copy-to-clipboard button with inline feedback. */
export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
      className="rounded-full border border-leaf-300 bg-white px-4 py-2 text-xs font-bold text-leaf-700 transition hover:bg-leaf-50"
    >
      {copied ? "✓ Copied" : label}
    </button>
  );
}
