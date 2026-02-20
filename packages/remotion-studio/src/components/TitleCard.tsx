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
import { LightSweep } from "./effects/LightSweep";
import { AccentLine } from "./effects/AccentLine";

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
  const t = resolveTheme(theme);

  const titleProgress = spring({ frame, fps, config: { damping: 200 } });
  const subtitleProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 8,
  });

  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);
  const subtitleY = interpolate(subtitleProgress, [0, 1], [30, 0]);

  // Per-character staggered opacity for kinetic text
  const chars = title.split("");

  return (
    <AbsoluteFill>
      <GradientBackground
        variant="spotlight"
        darkBackground={theme.darkBackground}
        primaryColor={theme.primaryColor}
        primaryGradientEnd={t.primaryGradientEnd}
        glowColor={t.glowColor}
      />

      <LightSweep delay={3} />

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
        }}
      >
        {/* Title with per-character stagger */}
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 72,
            fontWeight: "bold",
            color: theme.textColor,
            textAlign: "center",
            lineHeight: 1.2,
            transform: `translateY(${titleY}px)`,
            textShadow: `0 2px 30px rgba(0,0,0,0.4), 0 0 60px ${t.glowColor}15`,
          }}
        >
          {chars.map((char, i) => {
            const charDelay = i * 0.6;
            const charOpacity = interpolate(
              frame,
              [charDelay, charDelay + 8],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return (
              <span key={i} style={{ opacity: charOpacity }}>
                {char}
              </span>
            );
          })}
        </div>

        {/* Accent line with glow */}
        <div style={{ marginTop: 24, marginBottom: 24 }}>
          <AccentLine
            color={theme.primaryColor}
            width={220}
            height={3}
            delay={12}
            glow
          />
        </div>

        {subtitle && (
          <GlassPanel
            surfaceColor={t.surfaceColor}
            borderColor={t.borderColor}
            blur={t.glassBlur}
            borderRadius={16}
            padding="12px 32px"
          >
            <div
              style={{
                fontFamily: theme.bodyFont,
                fontSize: 30,
                color: theme.primaryColor,
                textAlign: "center",
                opacity: subtitleProgress,
                transform: `translateY(${subtitleY}px)`,
                letterSpacing: 3,
                textTransform: "uppercase",
              }}
            >
              {subtitle}
            </div>
          </GlassPanel>
        )}
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
