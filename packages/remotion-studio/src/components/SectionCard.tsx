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
  const textProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 6,
  });

  const labelY = interpolate(labelProgress, [0, 1], [20, 0]);
  const textY = interpolate(textProgress, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.darkBackground,
        justifyContent: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          fontFamily: theme.bodyFont,
          fontSize: 22,
          color: theme.primaryColor,
          textTransform: "uppercase",
          letterSpacing: 4,
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
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
