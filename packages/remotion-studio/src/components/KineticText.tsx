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

type KineticWord = {
  text: string;
  delay: number;
  scale?: number;
  color?: string;
};

type KineticTextProps = {
  words: KineticWord[];
  theme: Theme;
};

export const KineticText: React.FC<KineticTextProps> = ({ words, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = resolveTheme(theme);

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
        {/* Central glow */}
        <div
          style={{
            position: "absolute",
            width: 600,
            height: 600,
            borderRadius: "50%",
            backgroundColor: t.glowColor,
            opacity: interpolate(frame, [0, 20], [0, 0.08], {
              extrapolateRight: "clamp",
            }),
            filter: "blur(120px)",
          }}
        />

        {/* Words container */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "baseline",
            gap: "12px 20px",
            maxWidth: 900,
          }}
        >
          {words.map((word, i) => {
            const wordProgress = spring({
              frame,
              fps,
              config: { damping: 10, stiffness: 180 },
              delay: word.delay,
            });

            const targetScale = word.scale ?? 1;
            const entryScale = targetScale * 1.3;
            const wordScale = interpolate(
              wordProgress,
              [0, 1],
              [entryScale, targetScale],
            );
            const wordY = interpolate(wordProgress, [0, 1], [30, 0]);
            const wordOpacity = interpolate(wordProgress, [0, 1], [0, 1]);

            // Subtle glow for emphasized words (scale > 1)
            const glowStrength =
              targetScale > 1
                ? interpolate(wordProgress, [0, 1], [0, 0.6])
                : 0;

            return (
              <span
                key={`${word.text}-${i}`}
                style={{
                  fontFamily: theme.headingFont,
                  fontSize: 72,
                  fontWeight: "bold",
                  color: word.color ?? theme.textColor,
                  transform: `scale(${wordScale}) translateY(${wordY}px)`,
                  opacity: wordOpacity,
                  display: "inline-block",
                  textShadow: glowStrength
                    ? `0 0 40px ${word.color ?? t.glowColor}${Math.round(glowStrength * 100)
                        .toString(16)
                        .padStart(2, "0")}, 0 2px 20px rgba(0,0,0,0.3)`
                    : "0 2px 20px rgba(0,0,0,0.3)",
                  lineHeight: 1.3,
                }}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
