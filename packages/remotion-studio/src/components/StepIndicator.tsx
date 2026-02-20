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

type StepIndicatorProps = {
  stepNumber: number;
  totalSteps: number;
  label: string;
  description: string;
  theme: Theme;
};

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  stepNumber,
  totalSteps,
  label,
  description,
  theme,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = resolveTheme(theme);

  const enterProgress = spring({ frame, fps, config: { damping: 200 } });
  const contentProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 8,
  });
  const barProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    delay: 4,
  });

  const slideY = interpolate(enterProgress, [0, 1], [50, 0]);
  const contentY = interpolate(contentProgress, [0, 1], [20, 0]);

  const dots = Array.from({ length: totalSteps }, (_, i) => i + 1);
  const progressFraction = stepNumber / totalSteps;
  const barFillWidth = interpolate(barProgress, [0, 1], [0, progressFraction * 100]);

  // Pulsing ring on active dot
  const pulsePhase = Math.sin(frame * 0.1) * 0.3 + 0.7;

  // Animated connecting line between dots
  const lineDrawProgress = interpolate(barProgress, [0, 1], [0, 100]);

  return (
    <AbsoluteFill>
      <GradientBackground
        variant="mesh"
        darkBackground={theme.darkBackground}
        primaryColor={theme.primaryColor}
        primaryGradientEnd={t.primaryGradientEnd}
        glowColor={t.glowColor}
      />

      {/* Large translucent watermark number */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: theme.headingFont,
            fontSize: 500,
            fontWeight: "bold",
            color: theme.primaryColor,
            opacity: 0.04 * enterProgress,
            lineHeight: 1,
          }}
        >
          {stepNumber}
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          padding: 60,
        }}
      >
        {/* Progress dots at top */}
        <div
          style={{
            position: "absolute",
            top: 100,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            opacity: enterProgress,
          }}
        >
          <div style={{ display: "flex", gap: 16, position: "relative" }}>
            {/* Connecting line behind dots */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 8,
                right: 8,
                height: 2,
                backgroundColor: "rgba(255,255,255,0.08)",
                transform: "translateY(-50%)",
              }}
            >
              <div
                style={{
                  width: `${lineDrawProgress}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${theme.primaryColor}, ${t.primaryGradientEnd})`,
                  borderRadius: 1,
                }}
              />
            </div>
            {dots.map((dot) => {
              const isActive = dot === stepNumber;
              const isCompleted = dot <= stepNumber;
              return (
                <div key={dot} style={{ position: "relative" }}>
                  {/* Pulsing ring on active dot */}
                  {isActive && (
                    <div
                      style={{
                        position: "absolute",
                        inset: -6,
                        borderRadius: 14,
                        border: `2px solid ${theme.primaryColor}`,
                        opacity: pulsePhase * 0.5,
                      }}
                    />
                  )}
                  <div
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: isCompleted
                        ? theme.primaryColor
                        : "rgba(255,255,255,0.15)",
                      boxShadow: isCompleted
                        ? `0 0 12px ${theme.primaryColor}60`
                        : "none",
                      position: "relative",
                      zIndex: 1,
                    }}
                  />
                </div>
              );
            })}
          </div>

          <div
            style={{
              width: totalSteps * 32,
              height: 3,
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${barFillWidth}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${theme.primaryColor}, ${t.primaryGradientEnd})`,
                borderRadius: 2,
              }}
            />
          </div>
        </div>

        {/* Step content in glass panel */}
        <GlassPanel
          surfaceColor={t.surfaceColor}
          borderColor={t.borderColor}
          blur={t.glassBlur}
          borderRadius={24}
          padding="40px 48px"
          style={{
            opacity: enterProgress,
            transform: `translateY(${slideY}px)`,
          }}
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
                fontFamily: theme.bodyFont,
                fontSize: 24,
                color: theme.primaryColor,
                textTransform: "uppercase",
                letterSpacing: 5,
                marginBottom: 16,
              }}
            >
              Step {stepNumber}
            </div>
            <div
              style={{
                fontFamily: theme.headingFont,
                fontSize: 56,
                fontWeight: "bold",
                color: theme.textColor,
                textAlign: "center",
                lineHeight: 1.2,
                textShadow: "0 2px 16px rgba(0,0,0,0.3)",
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: theme.bodyFont,
                fontSize: 30,
                color: theme.accentColor,
                textAlign: "center",
                marginTop: 20,
                lineHeight: 1.5,
                maxWidth: 700,
                opacity: contentProgress,
                transform: `translateY(${contentY}px)`,
              }}
            >
              {description}
            </div>
          </div>
        </GlassPanel>
      </AbsoluteFill>

      <GrainOverlay opacity={t.noiseOpacity} />
    </AbsoluteFill>
  );
};
