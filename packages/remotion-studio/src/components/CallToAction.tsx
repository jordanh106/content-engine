import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

type CallToActionProps = {
  text: string;
  theme: Theme;
};

export const CallToAction: React.FC<CallToActionProps> = ({ text, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scaleProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180 },
  });
  const glowProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 10,
  });

  const scale = interpolate(scaleProgress, [0, 1], [0.8, 1]);
  const glowOpacity = interpolate(glowProgress, [0, 1], [0, 0.3]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.darkBackground,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      {/* Glow behind */}
      <div
        style={{
          position: "absolute",
          width: 400,
          height: 400,
          borderRadius: 200,
          backgroundColor: theme.primaryColor,
          opacity: glowOpacity,
          filter: "blur(80px)",
        }}
      />

      <div
        style={{
          fontFamily: theme.headingFont,
          fontSize: 52,
          fontWeight: "bold",
          color: theme.textColor,
          textAlign: "center",
          lineHeight: 1.4,
          maxWidth: 800,
          transform: `scale(${scale})`,
          opacity: scaleProgress,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
