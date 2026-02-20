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

type ChecklistOverlayProps = {
  number: number;
  label: string;
  description: string;
  theme: Theme;
};

export const ChecklistOverlay: React.FC<ChecklistOverlayProps> = ({
  number,
  label,
  description,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = resolveTheme(theme);

  const enterProgress = spring({ frame, fps, config: { damping: 200 } });
  const checkProgress = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 200 },
    delay: 12,
  });
  const flashProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 14,
  });

  const slideX = interpolate(enterProgress, [0, 1], [-80, 0]);
  const checkScale = interpolate(checkProgress, [0, 1], [0, 1]);
  const flashOpacity = interpolate(
    flashProgress,
    [0, 0.3, 1],
    [0.4, 0.4, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Checkmark SVG draw-on animation (stroke-dasharray)
  const checkDrawProgress = interpolate(frame, [14, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const checkStrokeDash = 30;

  // Small particle burst on check completion
  const particles = [0, 72, 144, 216, 288];
  const particleBurstFrame = 16;
  const particleProgress = interpolate(
    frame,
    [particleBurstFrame, particleBurstFrame + 12],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

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
          padding="36px 40px"
          style={{
            opacity: enterProgress,
            transform: `translateX(${slideX}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 30,
            }}
          >
            {/* Checkmark circle */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              {/* Flash ring */}
              <div
                style={{
                  position: "absolute",
                  inset: -10,
                  borderRadius: 50,
                  border: `2px solid ${theme.primaryColor}`,
                  opacity: flashOpacity,
                  filter: "blur(2px)",
                }}
              />
              {/* Particle burst */}
              {particles.map((angle, i) => {
                const rad = (angle * Math.PI) / 180;
                const dist = interpolate(particleProgress, [0, 1], [0, 40]);
                const pOpacity = interpolate(particleProgress, [0, 0.5, 1], [0, 0.8, 0]);
                return (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: theme.primaryColor,
                      top: 37 + Math.sin(rad) * dist,
                      left: 37 + Math.cos(rad) * dist,
                      opacity: pOpacity,
                      filter: "blur(1px)",
                    }}
                  />
                );
              })}
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: theme.primaryColor,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  transform: `scale(${checkScale})`,
                  boxShadow: `0 4px 24px ${theme.primaryColor}50`,
                }}
              >
                {/* Animated checkmark SVG */}
                <svg width="36" height="36" viewBox="0 0 36 36">
                  <polyline
                    points="8,18 16,26 28,10"
                    fill="none"
                    stroke={theme.textColor}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={checkStrokeDash}
                    strokeDashoffset={checkStrokeDash * (1 - checkDrawProgress)}
                  />
                </svg>
              </div>
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: theme.headingFont,
                  fontSize: 48,
                  fontWeight: "bold",
                  color: theme.textColor,
                  lineHeight: 1.2,
                  textShadow: "0 2px 12px rgba(0,0,0,0.2)",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  fontFamily: theme.bodyFont,
                  fontSize: 28,
                  color: theme.accentColor,
                  marginTop: 12,
                  lineHeight: 1.4,
                  opacity: 0.85,
                }}
              >
                {description}
              </div>
            </div>
          </div>
        </GlassPanel>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
