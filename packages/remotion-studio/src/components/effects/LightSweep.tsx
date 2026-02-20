import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type LightSweepProps = {
  delay?: number;
  color?: string;
  duration?: number;
};

/**
 * Cinematic light sweep/flare that crosses the screen diagonally on entrance.
 * A gradient band sweeps from left to right, controlled by a spring animation.
 */
export const LightSweep: React.FC<LightSweepProps> = ({
  delay = 0,
  color = "rgba(255, 255, 255, 0.12)",
  duration = 20,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 80 },
    delay,
  });

  // Sweep position from -30% to 130%
  const x = interpolate(progress, [0, 1], [-30, 130]);
  // Fade out in the last portion
  const opacity = interpolate(
    frame - delay,
    [0, duration * 0.6, duration],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  if (frame - delay < 0 || frame - delay > duration * 1.5) return null;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "-20%",
          left: `${x}%`,
          width: "15%",
          height: "140%",
          background: `linear-gradient(90deg, transparent 0%, ${color} 40%, ${color} 60%, transparent 100%)`,
          transform: "rotate(-20deg)",
          opacity,
          filter: "blur(8px)",
        }}
      />
    </AbsoluteFill>
  );
};
