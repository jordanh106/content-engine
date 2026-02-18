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

  const scale = interpolate(scaleProgress, [0, 1], [0.5, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.darkBackground,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
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
          }}
        >
          {value}
        </div>
        <div
          style={{
            fontFamily: theme.bodyFont,
            fontSize: 36,
            color: theme.textColor,
            marginTop: 16,
            opacity: labelProgress,
            textTransform: "uppercase",
            letterSpacing: 4,
          }}
        >
          {label}
        </div>
      </div>
    </AbsoluteFill>
  );
};
