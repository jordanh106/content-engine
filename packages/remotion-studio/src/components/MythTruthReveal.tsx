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

  const stampScale = interpolate(stampProgress, [0, 1], [3, 1]);
  const stampRotation = interpolate(stampProgress, [0, 1], [-15, -6]);
  const textY = interpolate(textProgress, [0, 1], [30, 0]);

  const isMyth = type === "myth";
  const stampColor = isMyth ? "#ef4444" : "#22c55e";
  const stampLabel = isMyth ? "MYTH" : "TRUTH";

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.darkBackground,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
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
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
