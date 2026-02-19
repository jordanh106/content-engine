import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

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

  // Progress dots
  const dots = Array.from({ length: totalSteps }, (_, i) => i + 1);

  // Progress bar fill width
  const progressFraction = stepNumber / totalSteps;
  const barFillWidth = interpolate(barProgress, [0, 1], [0, progressFraction * 100]);

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)`,
        justifyContent: "center",
        alignItems: "center",
        padding: 60,
      }}
    >
      {/* Progress dots at top with connecting bar */}
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
        <div style={{ display: "flex", gap: 16 }}>
          {dots.map((dot) => (
            <div
              key={dot}
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor:
                  dot <= stepNumber ? theme.primaryColor : "rgba(255,255,255,0.15)",
                boxShadow: dot <= stepNumber ? `0 0 8px ${theme.primaryColor}60` : "none",
                transition: "none",
              }}
            />
          ))}
        </div>

        {/* Progress bar below dots */}
        <div
          style={{
            width: totalSteps * 32,
            height: 3,
            backgroundColor: "rgba(255,255,255,0.1)",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${barFillWidth}%`,
              height: "100%",
              backgroundColor: theme.primaryColor,
              borderRadius: 2,
            }}
          />
        </div>
      </div>

      {/* Step content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: enterProgress,
          transform: `translateY(${slideY}px)`,
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
    </AbsoluteFill>
  );
};
