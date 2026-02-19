import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

type SectionCardProps = {
  label: string;
  text: string;
  theme: Theme;
};

export const SectionCard: React.FC<SectionCardProps> = ({
  label,
  text,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelProgress = spring({ frame, fps, config: { damping: 200 } });
  const barProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 4,
  });
  const textProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 8,
  });

  const labelY = interpolate(labelProgress, [0, 1], [20, 0]);
  const textY = interpolate(textProgress, [0, 1], [20, 0]);
  const barHeight = interpolate(barProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)`,
        justifyContent: "center",
        padding: 60,
      }}
    >
      <div style={{ display: "flex", gap: 24 }}>
        {/* Left accent bar */}
        <div
          style={{
            width: 4,
            backgroundColor: theme.primaryColor,
            borderRadius: 2,
            transform: `scaleY(${barHeight})`,
            transformOrigin: "top",
            opacity: barProgress,
            alignSelf: "stretch",
          }}
        />

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: theme.bodyFont,
              fontSize: 22,
              color: theme.primaryColor,
              textTransform: "uppercase",
              letterSpacing: 5,
              marginBottom: 16,
              opacity: labelProgress,
              transform: `translateY(${labelY}px)`,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: theme.headingFont,
              fontSize: 46,
              fontWeight: "bold",
              color: theme.textColor,
              lineHeight: 1.4,
              opacity: textProgress,
              transform: `translateY(${textY}px)`,
              textShadow: "0 2px 12px rgba(0,0,0,0.2)",
            }}
          >
            {text}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
