"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mirrors the inline script in the root layout. The script has to run before
 * first paint to avoid a flash of the wrong theme, and that script cannot
 * tell React anything — so the initial state here starts as `null` and is
 * filled in once we can read the real value off <html>. Rendering nothing
 * until then is what keeps the icon from disagreeing with the page.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    // "system" is dropped on the first manual choice so the toggle is sticky.
    try {
      window.localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Private browsing can refuse storage; the theme still applies for
      // this page view, it just will not be remembered.
    }
    setDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 hover:text-slate-900",
        className,
      )}
    >
      {/* Both icons are rendered and swapped with CSS so the control is
          correct on the very first frame, before this component hydrates. */}
      <Sun className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Moon className="hidden h-5 w-5 dark:block" aria-hidden="true" />
    </button>
  );
}
