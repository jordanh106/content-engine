import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type AccentLineProps = {
  color: string;
  width?: number;
  height?: number;
  delay?: number;
  glow?: boolean;
  direction?: "horizontal" | "vertical";
};

/**
 * Animated decorative line that draws on from center outward.
 * Optional glow effect for extra visual punch.
 */
export const AccentLine: React.FC<AccentLineProps> = ({
  color,
  width = 200,
  height = 3,
  delay = 0,
  glow = false,
  direction = "horizontal",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 25, stiffness: 120 },
    delay,
  });

  const lineWidth = interpolate(progress, [0, 1], [0, width]);
  const glowOpacity = interpolate(progress, [0, 0.5, 1], [0, 0.6, 0.3]);

  const isHorizontal = direction === "horizontal";
  const w = isHorizontal ? lineWidth : height;
  const h = isHorizontal ? height : lineWidth;

  return (
    <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
      {glow && (
        <div
          style={{
            position: "absolute",
            width: w + 20,
            height: h + 10,
            backgroundColor: color,
            filter: "blur(12px)",
            opacity: glowOpacity,
            borderRadius: 4,
          }}
        />
      )}
      <div
        style={{
          width: w,
          height: h,
          background: `linear-gradient(${isHorizontal ? "90deg" : "180deg"}, transparent 0%, ${color} 30%, ${color} 70%, transparent 100%)`,
          borderRadius: height / 2,
          opacity: progress,
        }}
      />
    </div>
  );
};
