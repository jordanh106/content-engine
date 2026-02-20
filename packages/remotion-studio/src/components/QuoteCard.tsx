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

type QuoteCardProps = {
  quote: string;
  attribution: string;
  role?: string;
  theme: Theme;
};

export const QuoteCard: React.FC<QuoteCardProps> = ({
  quote,
  attribution,
  role,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = resolveTheme(theme);

  const quoteMarkProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });
  const textProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 8,
  });
  const attrProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 15,
  });

  const pulsePhase = Math.sin(frame * 0.04) * 0.03;
  const quoteMarkScale = interpolate(quoteMarkProgress, [0, 1], [1.5, 1]);
  const quoteMarkOpacity = interpolate(quoteMarkProgress, [0, 1], [0, 0.3]);

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
        {/* Glow behind quotation mark */}
        <div
          style={{
            position: "absolute",
            width: 400,
            height: 400,
            borderRadius: "50%",
            backgroundColor: t.glowColor,
            opacity: interpolate(quoteMarkProgress, [0, 1], [0, 0.1]) + pulsePhase,
            filter: "blur(100px)",
            top: "20%",
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            maxWidth: 900,
          }}
        >
          {/* Large decorative quotation mark */}
          <div
            style={{
              fontFamily: theme.headingFont,
              fontSize: 200,
              lineHeight: 0.8,
              color: theme.primaryColor,
              opacity: quoteMarkOpacity,
              transform: `scale(${quoteMarkScale})`,
              marginBottom: -40,
              textShadow: `0 0 80px ${theme.primaryColor}50`,
            }}
          >
            {"\u201C"}
          </div>

          {/* Quote text in glass panel */}
          <GlassPanel
            surfaceColor={t.surfaceColor}
            borderColor={t.borderColor}
            blur={t.glassBlur}
            borderRadius={20}
            padding="36px 48px"
            style={{
              opacity: textProgress,
              transform: `translateY(${interpolate(textProgress, [0, 1], [20, 0])}px)`,
            }}
          >
            <div
              style={{
                fontFamily: theme.headingFont,
                fontSize: 52,
                fontWeight: "normal",
                fontStyle: "italic",
                color: theme.textColor,
                lineHeight: 1.4,
                textAlign: "center",
                textShadow: "0 2px 20px rgba(0,0,0,0.3)",
              }}
            >
              {quote}
            </div>
          </GlassPanel>

          {/* Accent line */}
          <div style={{ marginTop: 40, marginBottom: 30 }}>
            <AccentLine
              color={theme.primaryColor}
              width={80}
              height={3}
              delay={15}
              glow
            />
          </div>

          {/* Attribution */}
          <div
            style={{
              opacity: attrProgress,
              transform: `translateX(${interpolate(attrProgress, [0, 1], [30, 0])}px)`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                fontFamily: theme.bodyFont,
                fontSize: 32,
                fontWeight: "bold",
                color: theme.textColor,
                textTransform: "uppercase",
                letterSpacing: 4,
              }}
            >
              {attribution}
            </div>
            {role && (
              <div
                style={{
                  fontFamily: theme.bodyFont,
                  fontSize: 24,
                  color: theme.primaryColor,
                  marginTop: 8,
                  letterSpacing: 2,
                }}
              >
                {role}
              </div>
            )}
          </div>
        </div>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
