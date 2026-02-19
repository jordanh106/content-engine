import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

type HookTextProps = {
  text: string;
  theme: Theme;
};

export const HookText: React.FC<HookTextProps> = ({ text, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 200 },
  });
  const glowProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 8,
  });

  const scale = interpolate(progress, [0, 1], [1.2, 1]);
  const y = interpolate(progress, [0, 1], [20, 0]);
  const glowOpacity = interpolate(glowProgress, [0, 1], [0, 0.08]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
      {/* Background radial pulse */}
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: 300,
          backgroundColor: theme.primaryColor,
          opacity: glowOpacity,
          filter: "blur(140px)",
        }}
      />

      <div
        style={{
          fontFamily: theme.headingFont,
          fontSize: 64,
          fontWeight: "bold",
          color: theme.textColor,
          textAlign: "center",
          lineHeight: 1.3,
          transform: `scale(${scale}) translateY(${y}px)`,
          opacity: progress,
          textShadow: "0 2px 20px rgba(0,0,0,0.3)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
