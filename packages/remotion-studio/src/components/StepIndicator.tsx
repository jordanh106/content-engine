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

  const slideY = interpolate(enterProgress, [0, 1], [50, 0]);
  const contentY = interpolate(contentProgress, [0, 1], [20, 0]);

  // Progress dots
  const dots = Array.from({ length: totalSteps }, (_, i) => i + 1);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.darkBackground,
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
          gap: 16,
          opacity: enterProgress,
        }}
      >
        {dots.map((dot) => (
          <div
            key={dot}
            style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor:
                dot <= stepNumber ? theme.primaryColor : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
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
            letterSpacing: 4,
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
