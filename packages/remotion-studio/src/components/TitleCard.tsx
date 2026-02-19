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
  const lineProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 12,
  });

  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const subtitleY = interpolate(subtitleProgress, [0, 1], [30, 0]);
  const lineWidth = interpolate(lineProgress, [0, 1], [0, 200]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      {/* Subtle glow behind title */}
      <div
        style={{
          position: "absolute",
          width: 500,
          height: 500,
          borderRadius: 250,
          backgroundColor: theme.primaryColor,
          opacity: interpolate(titleProgress, [0, 1], [0, 0.06]),
          filter: "blur(120px)",
        }}
      />

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
          textShadow: "0 2px 20px rgba(0,0,0,0.3)",
        }}
      >
        {title}
      </div>

      {/* Teal underline that draws from center */}
      <div
        style={{
          width: lineWidth,
          height: 3,
          backgroundColor: theme.primaryColor,
          marginTop: 20,
          borderRadius: 2,
          opacity: lineProgress,
        }}
      />

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
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          {subtitle}
        </div>
      )}
    </AbsoluteFill>
  );
};
