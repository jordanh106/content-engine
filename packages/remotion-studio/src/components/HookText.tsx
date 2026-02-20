import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";
import { resolveTheme } from "../schemas/theme";
import { GradientBackground } from "./effects/GradientBackground";
import { GrainOverlay } from "./effects/GrainOverlay";

type HookTextProps = {
  text: string;
  theme: Theme;
};

export const HookText: React.FC<HookTextProps> = ({ text, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = resolveTheme(theme);

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

  const scale = interpolate(progress, [0, 1], [1.15, 1]);
  const y = interpolate(progress, [0, 1], [20, 0]);
  const glowOpacity = interpolate(glowProgress, [0, 1], [0, 0.12]);

  // Text reveal via clip-path expanding from center
  const revealProgress = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const clipInset = interpolate(revealProgress, [0, 1], [50, 0]);

  // Pulsing glow ring
  const pulsePhase = Math.sin(frame * 0.08) * 0.04;
  const ringScale = interpolate(frame, [0, 60], [0.8, 1.1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <GradientBackground
        variant="ambient"
        darkBackground={theme.darkBackground}
        primaryColor={theme.primaryColor}
        primaryGradientEnd={t.primaryGradientEnd}
        glowColor={t.glowColor}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 80,
        }}
      >
        {/* Animated glow ring */}
        <div
          style={{
            position: "absolute",
            width: 500,
            height: 500,
            borderRadius: "50%",
            border: `2px solid ${t.glowColor}`,
            opacity: glowOpacity + pulsePhase,
            transform: `scale(${ringScale})`,
            filter: "blur(2px)",
          }}
        />
        {/* Inner glow */}
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            backgroundColor: t.glowColor,
            opacity: glowOpacity * 0.5,
            filter: "blur(120px)",
          }}
        />

        {/* Text with clip-path reveal */}
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
            clipPath: `inset(${clipInset}% ${clipInset}% ${clipInset}% ${clipInset}%)`,
            textShadow: `0 2px 30px rgba(0,0,0,0.4), 0 0 60px ${t.glowColor}15`,
          }}
        >
          {text}
        </div>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
