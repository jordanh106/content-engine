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
import { AccentLine } from "./effects/AccentLine";

type StatCardProps = {
  value: string;
  label: string;
  theme: Theme;
};

/** Extract leading number from a stat value like "87%" or "3x" */
function parseStatNumber(value: string): { num: number; suffix: string } | null {
  const match = value.match(/^([\d,.]+)(.*)/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(/,/g, ""));
  if (isNaN(num)) return null;
  return { num, suffix: match[2] };
}

export const StatCard: React.FC<StatCardProps> = ({ value, label, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = resolveTheme(theme);

  const scaleProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });
  const labelProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 10,
  });
  const glowProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 6,
  });

  const scale = interpolate(scaleProgress, [0, 1], [0.5, 1]);
  const glowOpacity = interpolate(glowProgress, [0, 1], [0, 0.2]);
  const pulsePhase = Math.sin(frame * 0.06) * 0.04;

  // Animated concentric ring pulse
  const ring1Scale = interpolate(frame % 60, [0, 60], [0.8, 1.3]);
  const ring1Opacity = interpolate(frame % 60, [0, 60], [0.15, 0]);
  const ring2Scale = interpolate((frame + 30) % 60, [0, 60], [0.8, 1.3]);
  const ring2Opacity = interpolate((frame + 30) % 60, [0, 60], [0.15, 0]);

  // Number count-up animation
  const parsed = parseStatNumber(value);
  const countUpDuration = 20;
  const countProgress = interpolate(frame, [0, countUpDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const displayValue =
    parsed && countProgress < 1
      ? `${Math.round(parsed.num * countProgress)}${parsed.suffix}`
      : value;

  return (
    <AbsoluteFill>
      <GradientBackground
        variant="mesh"
        darkBackground={theme.darkBackground}
        primaryColor={theme.primaryColor}
        primaryGradientEnd={t.primaryGradientEnd}
        glowColor={t.glowColor}
      />

      <AbsoluteFill
        style={{ justifyContent: "center", alignItems: "center" }}
      >
        {/* Concentric ring pulses */}
        <div
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: `1px solid ${t.glowColor}`,
            transform: `scale(${ring1Scale})`,
            opacity: ring1Opacity * glowProgress,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: `1px solid ${t.glowColor}`,
            transform: `scale(${ring2Scale})`,
            opacity: ring2Opacity * glowProgress,
          }}
        />
        {/* Inner glow */}
        <div
          style={{
            position: "absolute",
            width: 350,
            height: 350,
            borderRadius: "50%",
            backgroundColor: t.glowColor,
            opacity: glowOpacity + pulsePhase,
            filter: "blur(100px)",
          }}
        />

        <GlassPanel
          surfaceColor={t.surfaceColor}
          borderColor={t.borderColor}
          blur={t.glassBlur}
          borderRadius={28}
          padding="48px 64px"
          style={{ transform: `scale(${scale})` }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: theme.headingFont,
                fontSize: 140,
                fontWeight: "bold",
                color: theme.primaryColor,
                lineHeight: 1,
                textShadow: `0 0 40px ${theme.primaryColor}40, 0 0 80px ${theme.primaryColor}20`,
              }}
            >
              {displayValue}
            </div>

            <div style={{ marginTop: 24, marginBottom: 24 }}>
              <AccentLine
                color={theme.primaryColor}
                width={120}
                height={2}
                delay={10}
                glow
              />
            </div>

            <div
              style={{
                fontFamily: theme.bodyFont,
                fontSize: 36,
                color: theme.textColor,
                opacity: labelProgress,
                textTransform: "uppercase",
                letterSpacing: 5,
              }}
            >
              {label}
            </div>
          </div>
        </GlassPanel>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
