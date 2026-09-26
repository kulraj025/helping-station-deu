"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

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

/**
 * Scroll reveal wrapper.
 *
 * Uses IntersectionObserver and respects `prefers-reduced-motion` (the CSS
 * already forces the final state, this only avoids the observer cost).
 *
 * The server and the first client render both emit `data-visible="pending"`,
 * so the two agree and hydration is clean. Only the effect flips it to
 * `"true"`, which is why the attribute is React state rather than a direct
 * `dataset` write.
 */

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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || from === "none") return;

    // `data-visible` is rendered by React from state, never written straight to
    // the DOM. Mutating the node behind React's back races hydration: if the
    // attribute changes before React hydrates this subtree, React finds "true"
    // where it expects "pending" and reports a hydration mismatch.
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);

    const backstop = window.setTimeout(() => {
      observer.disconnect();
      setVisible(true);
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
      data-visible={from === "none" ? undefined : visible ? "true" : "pending"}
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
    let raf = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        // Written straight to the text node rather than through state: this
        // updates every frame, and re-rendering the tree 60 times a second to
        // change one number would be the more expensive mistake. It also
        // cannot desync hydration, because the server and the first client
        // render both emit `0`.
        node.textContent = `${Math.round(to * eased)}${suffix}`;
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration, suffix]);

  return (
    <span ref={ref} className={className}>
      0{suffix}
    </span>
  );
}
