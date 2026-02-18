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

  const scale = interpolate(progress, [0, 1], [1.2, 1]);
  const y = interpolate(progress, [0, 1], [20, 0]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.darkBackground,
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
      }}
    >
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
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
