import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

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

  // Quotation mark entrance
  const quoteMarkProgress = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  // Quote text entrance (delayed)
  const textProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 8,
  });

  // Attribution entrance (delayed more)
  const attrProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 15,
  });

  // Glow behind quotation mark
  const glowProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 4,
  });

  const pulsePhase = Math.sin(frame * 0.04) * 0.03;

  const quoteMarkScale = interpolate(quoteMarkProgress, [0, 1], [1.5, 1]);
  const quoteMarkOpacity = interpolate(quoteMarkProgress, [0, 1], [0, 0.25]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)`,
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
          borderRadius: 200,
          backgroundColor: theme.primaryColor,
          opacity: interpolate(glowProgress, [0, 1], [0, 0.12]) + pulsePhase,
          filter: "blur(100px)",
          top: "25%",
          left: "50%",
          transform: "translateX(-50%)",
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
            textShadow: `0 0 60px ${theme.primaryColor}40`,
          }}
        >
          {"\u201C"}
        </div>

        {/* Quote text */}
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 52,
            fontWeight: "normal",
            fontStyle: "italic",
            color: theme.textColor,
            lineHeight: 1.4,
            textAlign: "center",
            opacity: textProgress,
            transform: `translateY(${interpolate(textProgress, [0, 1], [20, 0])}px)`,
            textShadow: "0 2px 20px rgba(0,0,0,0.3)",
          }}
        >
          {quote}
        </div>

        {/* Accent line */}
        <div
          style={{
            width: interpolate(attrProgress, [0, 1], [0, 80]),
            height: 3,
            backgroundColor: theme.primaryColor,
            marginTop: 40,
            marginBottom: 30,
            borderRadius: 2,
            opacity: attrProgress * 0.6,
          }}
        />

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
  );
};
