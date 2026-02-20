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
import { GlassPanel } from "./effects/GlassPanel";

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
  const t = resolveTheme(theme);

  const enterProgress = spring({ frame, fps, config: { damping: 200 } });
  const badgeProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 180 },
    delay: 8,
  });

  const y = interpolate(enterProgress, [0, 1], [40, 0]);
  const badgeScale = interpolate(badgeProgress, [0, 1], [0.5, 1]);

  // Animated border glow
  const borderAngle = (frame * 1.5) % 360;

  return (
    <AbsoluteFill>
      <GradientBackground
        variant="spotlight"
        darkBackground={theme.darkBackground}
        primaryColor={theme.primaryColor}
        primaryGradientEnd={t.primaryGradientEnd}
        glowColor={t.glowColor}
      />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
        }}
      >
        {/* Frequency badge with animated gradient border */}
        <div
          style={{
            padding: 2,
            borderRadius: 22,
            background: `conic-gradient(from ${borderAngle}deg, ${theme.primaryColor}, ${t.primaryGradientEnd}, ${theme.primaryColor})`,
            transform: `scale(${badgeScale})`,
            opacity: badgeProgress,
            marginBottom: 32,
          }}
        >
          <GlassPanel
            surfaceColor={theme.primaryColor}
            borderColor="transparent"
            blur={0}
            borderRadius={20}
            padding="24px 48px"
          >
            <div
              style={{
                fontFamily: theme.headingFont,
                fontSize: 48,
                fontWeight: "bold",
                color: theme.textColor,
                textAlign: "center",
                textShadow: "0 2px 12px rgba(0,0,0,0.2)",
              }}
            >
              {frequency}
            </div>
          </GlassPanel>
        </div>

        {/* Key cue in glass panel */}
        <GlassPanel
          surfaceColor={t.surfaceColor}
          borderColor={t.borderColor}
          blur={t.glassBlur}
          borderRadius={16}
          padding="20px 36px"
          style={{
            opacity: enterProgress,
            transform: `translateY(${y}px)`,
          }}
        >
          <div
            style={{
              fontFamily: theme.bodyFont,
              fontSize: 30,
              color: theme.accentColor,
              textAlign: "center",
              lineHeight: 1.5,
              maxWidth: 700,
            }}
          >
            {keyCue}
          </div>
        </GlassPanel>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
