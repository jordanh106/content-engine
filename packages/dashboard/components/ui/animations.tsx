import React, { useState, useEffect, useRef, useCallback, Children, cloneElement, isValidElement } from "react";
import { useInView } from "react-intersection-observer";

// ─── ScrollReveal ──────────────────────────────────────────────────────────────
// Wraps any element. Starts invisible, animates in when scrolled into viewport.
// Uses IntersectionObserver (triggerOnce) + CSS keyframe animation.

type RevealDirection = "up" | "left" | "right" | "scale";

type ScrollRevealProps = {
  children: React.ReactNode;
  delay?: number;           // ms delay before animation starts
  direction?: RevealDirection;
  duration?: number;        // ms animation duration (default 600)
  threshold?: number;       // 0-1 visibility threshold (default 0.15)
  className?: string;
  as?: keyof JSX.IntrinsicElements;
};

const DIRECTION_KEYFRAME: Record<RevealDirection, string> = {
  up: "reveal-up",
  left: "reveal-left",
  right: "reveal-right",
  scale: "reveal-scale",
};

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  delay = 0,
  direction = "up",
  duration = 600,
  threshold = 0.15,
  className = "",
  as: Tag = "div",
}) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold,
    rootMargin: "0px 0px -40px 0px",
  });

  const El = Tag as React.ElementType;

  return (
    <El
      ref={ref}
      className={className}
      style={{
        opacity: inView ? undefined : 0,
        animation: inView
          ? `${DIRECTION_KEYFRAME[direction]} ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`
          : "none",
      }}
    >
      {children}
    </El>
  );
};


// ─── StaggeredList ─────────────────────────────────────────────────────────────
// Wraps children and applies incremental animation delays for a cascade effect.

type StaggeredListProps = {
  children: React.ReactNode;
  baseDelay?: number;       // delay before first item (default 0)
  stagger?: number;         // ms between each item (default 60)
  direction?: RevealDirection;
  duration?: number;
  className?: string;
};

export const StaggeredList: React.FC<StaggeredListProps> = ({
  children,
  baseDelay = 0,
  stagger = 60,
  direction = "up",
  duration = 500,
  className = "",
}) => {
  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.05,
    rootMargin: "0px 0px -20px 0px",
  });

  return (
    <div ref={ref} className={className}>
      {Children.map(children, (child, i) => {
        if (!isValidElement(child)) return child;
        const delay = baseDelay + i * stagger;
        return (
          <div
            style={{
              opacity: inView ? undefined : 0,
              animation: inView
                ? `${DIRECTION_KEYFRAME[direction]} ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms both`
                : "none",
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
};


// ─── CountUp ───────────────────────────────────────────────────────────────────
// Animates a number from 0 (or startValue) to the target value when in viewport.

type CountUpProps = {
  to: number;
  from?: number;
  duration?: number;        // ms (default 1200)
  decimals?: number;        // decimal places (default 0)
  prefix?: string;
  suffix?: string;
  className?: string;
};

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  duration = 1200,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}) => {
  const [value, setValue] = useState(from);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!inView) return;
    const startTime = performance.now();
    const delta = to - from;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + delta * eased);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [inView, to, from, duration]);

  const display = decimals > 0 ? value.toFixed(decimals) : Math.round(value);

  return (
    <span ref={ref} className={className}>
      {prefix}{display}{suffix}
    </span>
  );
};


// ─── RotatingText ──────────────────────────────────────────────────────────────
// Cycles through an array of strings with a fade transition.

type RotatingTextProps = {
  words: string[];
  interval?: number;        // ms between words (default 2500)
  className?: string;
};

export const RotatingText: React.FC<RotatingTextProps> = ({
  words,
  interval = 2500,
  className = "",
}) => {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (words.length <= 1) return;
    const timer = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % words.length);
        setFading(false);
      }, 250); // fade out duration
    }, interval);
    return () => clearInterval(timer);
  }, [words, interval]);

  return (
    <span
      className={`inline-block transition-all duration-250 ${fading ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"} ${className}`}
    >
      {words[index]}
    </span>
  );
};


// ─── ViewTransition ────────────────────────────────────────────────────────────
// Wraps a view with entrance animation. Key must change to trigger re-animation.

type ViewTransitionProps = {
  children: React.ReactNode;
  viewKey: string;
};

export const ViewTransition: React.FC<ViewTransitionProps> = ({ children, viewKey }) => {
  return (
    <div key={viewKey} className="animate-view-enter">
      {children}
    </div>
  );
};
