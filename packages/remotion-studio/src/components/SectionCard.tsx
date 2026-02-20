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
  const t = resolveTheme(theme);

  const labelProgress = spring({ frame, fps, config: { damping: 200 } });
  const barProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 4,
  });
  const textProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 8,
  });

  const labelY = interpolate(labelProgress, [0, 1], [20, 0]);
  const barHeight = interpolate(barProgress, [0, 1], [0, 1]);

  // Staggered word entrance for body text
  const words = text.split(" ");

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
          padding: 60,
        }}
      >
        <GlassPanel
          surfaceColor={t.surfaceColor}
          borderColor={t.borderColor}
          blur={t.glassBlur}
          borderRadius={20}
          padding="40px 48px"
        >
          <div style={{ display: "flex", gap: 24 }}>
            {/* Left accent bar with gradient and glow */}
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  width: 12,
                  top: 0,
                  bottom: 0,
                  background: theme.primaryColor,
                  filter: "blur(8px)",
                  opacity: barProgress * 0.4,
                  borderRadius: 4,
                }}
              />
              <div
                style={{
                  width: 4,
                  background: `linear-gradient(180deg, ${theme.primaryColor}, ${t.primaryGradientEnd})`,
                  borderRadius: 2,
                  transform: `scaleY(${barHeight})`,
                  transformOrigin: "top",
                  opacity: barProgress,
                  alignSelf: "stretch",
                  minHeight: 100,
                }}
              />
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: theme.bodyFont,
                  fontSize: 22,
                  color: theme.primaryColor,
                  textTransform: "uppercase",
                  letterSpacing: 5,
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
                  textShadow: "0 2px 12px rgba(0,0,0,0.2)",
                }}
              >
                {words.map((word, i) => {
                  const wordDelay = 8 + i * 1;
                  const wordOpacity = interpolate(
                    frame,
                    [wordDelay, wordDelay + 6],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  );
                  const wordY = interpolate(
                    frame,
                    [wordDelay, wordDelay + 6],
                    [8, 0],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  );
                  return (
                    <span
                      key={i}
                      style={{
                        opacity: wordOpacity,
                        transform: `translateY(${wordY}px)`,
                        display: "inline-block",
                        marginRight: "0.3em",
                      }}
                    >
                      {word}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </GlassPanel>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
