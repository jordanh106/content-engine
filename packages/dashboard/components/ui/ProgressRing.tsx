import React, { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";

type ProgressRingProps = {
  value: number;          // 0-100
  size?: number;          // px (default 80)
  strokeWidth?: number;   // px (default 6)
  color?: string;         // CSS color (default teal)
  bgColor?: string;       // track color
  label?: string;         // center text
  sublabel?: string;      // smaller text below label
  animated?: boolean;     // animate on enter (default true)
  duration?: number;      // ms (default 1000)
};

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 80,
  strokeWidth = 6,
  color = "var(--accent)",
  bgColor = "var(--surface-border)",
  label,
  sublabel,
  animated = true,
  duration = 1000,
}) => {
  const [progress, setProgress] = useState(animated ? 0 : value);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.3 });

  useEffect(() => {
    if (!animated || !inView) return;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease out cubic
      setProgress(value * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, value, animated, duration]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);
  const center = size / 2;

  return (
    <div ref={ref} className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: animated ? "none" : `stroke-dashoffset ${duration}ms ease-out` }}
        />
      </svg>
      {/* Center text */}
      {(label || sublabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {label && (
            <span className="text-themed font-bold" style={{ fontSize: size * 0.22 }}>
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-themed-muted" style={{ fontSize: size * 0.12 }}>
              {sublabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
