import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

type FrequencyCardProps = {
  frequency: string;
  keyCue: string;
  theme: Theme;
};

export const FrequencyCard: React.FC<FrequencyCardProps> = ({
  frequency,
  keyCue,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterProgress = spring({ frame, fps, config: { damping: 200 } });
  const badgeProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180 },
    delay: 8,
  });

  const y = interpolate(enterProgress, [0, 1], [40, 0]);
  const badgeScale = interpolate(badgeProgress, [0, 1], [0.5, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.darkBackground,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      {/* Frequency badge */}
      <div
        style={{
          backgroundColor: theme.primaryColor,
          borderRadius: 20,
          padding: "24px 48px",
          transform: `scale(${badgeScale})`,
          opacity: badgeProgress,
          marginBottom: 32,
        }}
      >
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 48,
            fontWeight: "bold",
            color: theme.textColor,
            textAlign: "center",
          }}
        >
          {frequency}
        </div>
      </div>

      {/* Key cue */}
      <div
        style={{
          fontFamily: theme.bodyFont,
          fontSize: 30,
          color: theme.accentColor,
          textAlign: "center",
          lineHeight: 1.5,
          maxWidth: 700,
          opacity: enterProgress,
          transform: `translateY(${y}px)`,
        }}
      >
        {keyCue}
      </div>
    </AbsoluteFill>
  );
};
