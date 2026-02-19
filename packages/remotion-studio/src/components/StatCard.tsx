import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

type StatCardProps = {
  value: string;
  label: string;
  theme: Theme;
};

export const StatCard: React.FC<StatCardProps> = ({ value, label, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });
  const labelProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 10,
  });
  const glowProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 6,
  });

  const scale = interpolate(scaleProgress, [0, 1], [0.5, 1]);
  const glowOpacity = interpolate(glowProgress, [0, 1], [0, 0.25]);
  const pulsePhase = Math.sin(frame * 0.06) * 0.05;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)`,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {/* Glow ring behind value */}
      <div
        style={{
          position: "absolute",
          width: 350,
          height: 350,
          borderRadius: 175,
          backgroundColor: theme.primaryColor,
          opacity: glowOpacity + pulsePhase,
          filter: "blur(100px)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 140,
            fontWeight: "bold",
            color: theme.primaryColor,
            lineHeight: 1,
            textShadow: `0 0 40px ${theme.primaryColor}40`,
          }}
        >
          {value}
        </div>

        {/* Accent line */}
        <div
          style={{
            width: interpolate(labelProgress, [0, 1], [0, 120]),
            height: 2,
            backgroundColor: theme.primaryColor,
            marginTop: 20,
            marginBottom: 20,
            borderRadius: 1,
            opacity: labelProgress * 0.6,
          }}
        />

        <div
          style={{
            fontFamily: theme.bodyFont,
            fontSize: 36,
            color: theme.textColor,
            opacity: labelProgress,
            textTransform: "uppercase",
            letterSpacing: 5,
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};
