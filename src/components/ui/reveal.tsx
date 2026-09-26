"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Scroll reveal wrapper.
 *
 * Uses IntersectionObserver and respects `prefers-reduced-motion` (the CSS
 * already forces the final state, this only avoids the observer cost).
 */
/**
 * How long to wait for IntersectionObserver before revealing anyway.
 *
 * A reveal that never fires leaves the content at `opacity: 0`, which is far
 * worse than an animation that did not play. Some environments — embedded
 * webviews, headless browsers, aggressive privacy tooling, a throttled
 * background tab — accept an observer and then never deliver a callback. This
 * is the backstop that makes the animation strictly optional.
 */
const REVEAL_BACKSTOP_MS = 1500;

export function Reveal({
  children,
  delay = 0,
  from = "up",
  className,
  id,
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  from?: "up" | "left" | "right" | "zoom" | "none";
  className?: string;
  /** Anchor target, so a section can be linked to directly. */
  id?: string;
  as?: "div" | "section" | "li" | "article" | "span";
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || from === "none") return;

    // Marks the element as owned by JavaScript, which is what arms the hidden
    // state in CSS. Without this attribute the element is simply visible.
    const reveal = () => {
      node.dataset.visible = "true";
    };

    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      reveal();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            reveal();
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);

    const backstop = window.setTimeout(() => {
      observer.disconnect();
      reveal();
    }, REVEAL_BACKSTOP_MS);

    return () => {
      observer.disconnect();
      window.clearTimeout(backstop);
    };
  }, [from]);

  return (
    <Tag
      // @ts-expect-error -- generic element ref
      ref={ref}
      data-reveal={from === "none" ? undefined : from}
      data-visible={from === "none" ? undefined : "pending"}
      id={id}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}

/** Counts up to a target number once scrolled into view. */
export function CountUp({
  to,
  duration = 1400,
  suffix = "",
  className,
}: {
  to: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.textContent = `${to}${suffix}`;
      return;
    }
    let frame = 0;
    let raf = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        node.textContent = `${Math.round(to * eased)}${suffix}`;
        if (progress < 1) raf = requestAnimationFrame(tick);
        frame = window.setTimeout(() => {}, 0);
      };
      raf = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(frame);
    };
  }, [to, duration, suffix]);

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}
