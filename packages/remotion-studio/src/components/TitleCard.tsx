import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

type TitleCardProps = {
  title: string;
  subtitle?: string;
  theme: Theme;
};

export const TitleCard: React.FC<TitleCardProps> = ({
  title,
  subtitle,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 200 } });
  const subtitleProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 8,
  });

  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const subtitleY = interpolate(subtitleProgress, [0, 1], [30, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.darkBackground,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          fontFamily: theme.headingFont,
          fontSize: 72,
          fontWeight: "bold",
          color: theme.textColor,
          textAlign: "center",
          opacity: titleProgress,
          transform: `translateY(${titleY}px)`,
          lineHeight: 1.2,
        }}
      >
        {title}
      </div>
      {subtitle && (
        <div
          style={{
            fontFamily: theme.bodyFont,
            fontSize: 32,
            color: theme.primaryColor,
            textAlign: "center",
            marginTop: 20,
            opacity: subtitleProgress,
            transform: `translateY(${subtitleY}px)`,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
