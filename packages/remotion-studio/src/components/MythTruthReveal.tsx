import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

type MythTruthRevealProps = {
  text: string;
  type: "myth" | "truth";
  theme: Theme;
};

export const MythTruthReveal: React.FC<MythTruthRevealProps> = ({
  text,
  type,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const stampProgress = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 200 },
  });
  const textProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 6,
  });
  const shakeProgress = spring({
    frame,
    fps,
    config: { damping: 30, stiffness: 400 },
    delay: 0,
  });

  const stampScale = interpolate(stampProgress, [0, 1], [3, 1]);
  const stampRotation = interpolate(stampProgress, [0, 1], [-15, -6]);
  const textY = interpolate(textProgress, [0, 1], [30, 0]);

  // Screen shake on stamp land (frames 8-14)
  const shakeX =
    frame >= 8 && frame <= 14
      ? Math.sin(frame * 8) * interpolate(frame, [8, 14], [3, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 0;

  const isMyth = type === "myth";
  const stampColor = isMyth ? "#ef4444" : "#22c55e";
  const stampLabel = isMyth ? "MYTH" : "TRUTH";

  // Color wash flash on stamp land
  const flashOpacity =
    stampProgress > 0.5
      ? interpolate(stampProgress, [0.5, 1], [0.15, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : 0;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
        transform: `translateX(${shakeX}px)`,
      }}
    >
      {/* Color wash flash */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: stampColor,
          opacity: flashOpacity,
        }}
      />

      {/* Stamp */}
      <div
        style={{
          position: "absolute",
          top: 120,
          right: 80,
          fontFamily: theme.headingFont,
          fontSize: 72,
          fontWeight: "bold",
          color: stampColor,
          border: `6px solid ${stampColor}`,
          borderRadius: 12,
          padding: "8px 24px",
          transform: `scale(${stampScale}) rotate(${stampRotation}deg)`,
          opacity: stampProgress,
          letterSpacing: 6,
          boxShadow: `0 0 30px ${stampColor}30`,
        }}
      >
        {stampLabel}
      </div>

      {/* Text */}
      <div
        style={{
          fontFamily: theme.bodyFont,
          fontSize: 44,
          color: theme.textColor,
          textAlign: "center",
          lineHeight: 1.5,
          maxWidth: 800,
          opacity: textProgress,
          transform: `translateY(${textY}px)`,
          textShadow: "0 2px 12px rgba(0,0,0,0.3)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
