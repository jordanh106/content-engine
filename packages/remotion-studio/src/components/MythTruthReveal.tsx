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

type MythTruthRevealProps = {
  text: string;
  type: "myth" | "truth";
  theme: Theme;
};

export const MythTruthReveal: React.FC<MythTruthRevealProps> = ({
  text,
  type,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = resolveTheme(theme);

  const stampProgress = spring({
    frame,
    fps,
    config: { damping: 8, stiffness: 200 },
  });
  const textProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 6,
  });

  const stampScale = interpolate(stampProgress, [0, 1], [3, 1]);
  const stampRotation = interpolate(stampProgress, [0, 1], [-15, -6]);
  const textY = interpolate(textProgress, [0, 1], [30, 0]);

  // Screen shake on stamp land (frames 8-14)
  const shakeX =
    frame >= 8 && frame <= 14
      ? Math.sin(frame * 8) *
        interpolate(frame, [8, 14], [4, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;
  const shakeY =
    frame >= 8 && frame <= 14
      ? Math.cos(frame * 6) *
        interpolate(frame, [8, 14], [2, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  const isMyth = type === "myth";
  const stampColor = isMyth ? "#ef4444" : "#22c55e";
  const stampLabel = isMyth ? "MYTH" : "TRUTH";

  // Color wash flash on stamp land
  const flashOpacity =
    stampProgress > 0.5
      ? interpolate(stampProgress, [0.5, 1], [0.2, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 0;

  // Scan lines during stamp (frames 6-18)
  const scanProgress = interpolate(frame, [6, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scanOpacity = interpolate(frame, [6, 12, 18], [0, 0.15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Radial lines for myth / light burst for truth
  const burstOpacity = interpolate(frame, [8, 12, 20], [0, 0.2, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const burstScale = interpolate(frame, [8, 20], [0.5, 2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{ transform: `translate(${shakeX}px, ${shakeY}px)` }}
    >
      <GradientBackground
        variant="spotlight"
        darkBackground={theme.darkBackground}
        primaryColor={theme.primaryColor}
        primaryGradientEnd={t.primaryGradientEnd}
        glowColor={t.glowColor}
      />

      {/* Color wash flash */}
      <AbsoluteFill
        style={{
          backgroundColor: stampColor,
          opacity: flashOpacity,
        }}
      />

      {/* Scan lines during stamp */}
      <AbsoluteFill
        style={{
          opacity: scanOpacity,
          pointerEvents: "none",
          background: `repeating-linear-gradient(
            0deg,
            transparent 0px,
            transparent 3px,
            ${stampColor}30 3px,
            ${stampColor}30 4px
          )`,
          transform: `translateY(${scanProgress * 100}%)`,
        }}
      />

      {/* Radial burst (myth: crack lines, truth: light burst) */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: isMyth
              ? `radial-gradient(circle, transparent 30%, ${stampColor}20 50%, transparent 70%)`
              : `radial-gradient(circle, ${stampColor}30 0%, ${stampColor}10 30%, transparent 60%)`,
            transform: `scale(${burstScale})`,
            opacity: burstOpacity,
            filter: "blur(4px)",
          }}
        />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
        }}
      >
        {/* Stamp */}
        <div
          style={{
            position: "absolute",
            top: 120,
            right: 80,
            fontFamily: theme.headingFont,
            fontSize: 72,
            fontWeight: "bold",
            color: stampColor,
            border: `6px solid ${stampColor}`,
            borderRadius: 12,
            padding: "8px 24px",
            transform: `scale(${stampScale}) rotate(${stampRotation}deg)`,
            opacity: stampProgress,
            letterSpacing: 6,
            boxShadow: `0 0 30px ${stampColor}40, 0 0 60px ${stampColor}20`,
            textShadow: `0 0 20px ${stampColor}60`,
          }}
        >
          {stampLabel}
        </div>

        {/* Text in glass panel */}
        <GlassPanel
          surfaceColor={t.surfaceColor}
          borderColor={t.borderColor}
          blur={t.glassBlur}
          borderRadius={20}
          padding="32px 48px"
          style={{
            opacity: textProgress,
            transform: `translateY(${textY}px)`,
            maxWidth: 800,
          }}
        >
          <div
            style={{
              fontFamily: theme.bodyFont,
              fontSize: 44,
              color: theme.textColor,
              textAlign: "center",
              lineHeight: 1.5,
              textShadow: "0 2px 12px rgba(0,0,0,0.3)",
            }}
          >
            {text}
          </div>
        </GlassPanel>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity * 1.5} />
    </AbsoluteFill>
  );
};
