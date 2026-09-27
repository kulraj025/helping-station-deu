"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * On/off switch.
 *
 * Built on a native `<input type="checkbox">` rather than a `<button>` with
 * `role="switch"`, for three reasons that all matter more than the animation:
 *
 *  - **It works without JavaScript.** The checkbox is a real form control, so it
 *    submits with the form and can be reached and toggled by keyboard alone. A
 *    `div` pretending to be a switch is a dead control if the bundle fails.
 *  - **Space toggles it.** Native checkbox behaviour, for free.
 *  - **It cannot get out of sync with the form.** The visual state is derived
 *    from the input, so there is no second copy of "is this on" to fall out of
 *    date.
 *
 * The input is visually hidden but still focusable, and the focus ring is drawn
 * on the track via `peer-focus-visible`, so keyboard users can see where they
 * are. The whole row is the `<label>`, which means clicking the description
 * toggles it too — a small thing that people expect and are mildly annoyed by
 * when it is missing.
 */
export function Switch({
  name,
  defaultChecked,
  label,
  description,
  disabled,
  className,
}: {
  name: string;
  defaultChecked: boolean;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition",
        "hover:border-slate-300 hover:bg-slate-50",
        disabled && "cursor-not-allowed opacity-60",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        disabled={disabled}
        className="peer sr-only"
      />

      {/* The track. `peer-checked` sets a custom property rather than a colour
          the knob can use, because the knob is *inside* the track and Tailwind's
          `peer-*` variant only reaches siblings. A custom property is inherited,
          so the nested knob can read it — that is the one thing a colour cannot
          do from a parent. */}
      <span
        aria-hidden="true"
        className={cn(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-300 transition-colors duration-200",
          "peer-checked:bg-leaf-700",
          "peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-leaf-600",
          "[--knob-x:0.125rem]",
          "peer-checked:[--knob-x:1.375rem]",
        )}
      >
        <span
          className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200"
          style={{ transform: "translateX(var(--knob-x))" }}
        />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-800">{label}</span>
        {description ? (
          <span className="mt-1 block text-xs leading-relaxed text-slate-600">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  );
}
