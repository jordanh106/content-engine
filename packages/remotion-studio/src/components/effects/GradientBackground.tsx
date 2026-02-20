import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type GradientVariant = "ambient" | "spotlight" | "mesh";

type GradientBackgroundProps = {
  variant?: GradientVariant;
  darkBackground: string;
  primaryColor: string;
  primaryGradientEnd?: string;
  glowColor?: string;
};

/**
 * Rich multi-stop animated background replacement for the flat radial-gradient
 * that every component currently shares. Three variants:
 *
 * - "ambient": Subtle centered glow with slow drift
 * - "spotlight": Directional light from upper-right, cinematic feel
 * - "mesh": Multi-point gradient with two glow sources
 */
export const GradientBackground: React.FC<GradientBackgroundProps> = ({
  variant = "ambient",
  darkBackground,
  primaryColor,
  primaryGradientEnd,
  glowColor,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const gradEnd = primaryGradientEnd ?? primaryColor;
  const glow = glowColor ?? primaryColor;

  // Slow drift over the full duration
  const drift = interpolate(frame, [0, durationInFrames], [0, 20], {
    extrapolateRight: "clamp",
  });

  const baseStyle: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  if (variant === "spotlight") {
    return (
      <AbsoluteFill>
        {/* Base dark gradient */}
        <div
          style={{
            ...baseStyle,
            background: `linear-gradient(160deg, ${darkBackground} 0%, #0a0a18 50%, #0f0f1e 100%)`,
          }}
        />
        {/* Primary glow - upper right */}
        <div
          style={{
            ...baseStyle,
            background: `radial-gradient(ellipse at ${70 + drift * 0.3}% ${20 + drift * 0.2}%, ${glow}18 0%, transparent 60%)`,
          }}
        />
        {/* Secondary glow - lower left */}
        <div
          style={{
            ...baseStyle,
            background: `radial-gradient(ellipse at ${25 - drift * 0.2}% ${80 - drift * 0.15}%, ${gradEnd}10 0%, transparent 50%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  if (variant === "mesh") {
    return (
      <AbsoluteFill>
        <div
          style={{
            ...baseStyle,
            background: `linear-gradient(180deg, ${darkBackground} 0%, #0a0a18 100%)`,
          }}
        />
        {/* Glow source 1 - top center */}
        <div
          style={{
            ...baseStyle,
            background: `radial-gradient(circle at ${50 + drift * 0.4}% ${30 + drift * 0.2}%, ${glow}15 0%, transparent 45%)`,
          }}
        />
        {/* Glow source 2 - bottom right */}
        <div
          style={{
            ...baseStyle,
            background: `radial-gradient(circle at ${65 - drift * 0.3}% ${70 - drift * 0.15}%, ${gradEnd}12 0%, transparent 40%)`,
          }}
        />
        {/* Glow source 3 - left center */}
        <div
          style={{
            ...baseStyle,
            background: `radial-gradient(circle at ${20 + drift * 0.2}% ${50 + drift * 0.1}%, ${primaryColor}0a 0%, transparent 35%)`,
          }}
        />
      </AbsoluteFill>
    );
  }

  // Default: "ambient" - centered glow with slow drift
  return (
    <AbsoluteFill>
      <div
        style={{
          ...baseStyle,
          background: `radial-gradient(ellipse at ${50 + drift * 0.3}% ${50 + drift * 0.2}%, ${darkBackground} 0%, #0a0a18 70%, #0f0f1e 100%)`,
        }}
      />
      {/* Subtle primary glow */}
      <div
        style={{
          ...baseStyle,
          background: `radial-gradient(circle at ${50 - drift * 0.2}% ${45 + drift * 0.15}%, ${glow}12 0%, transparent 50%)`,
        }}
      />
    </AbsoluteFill>
  );
};
