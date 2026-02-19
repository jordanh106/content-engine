import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { Theme } from "../schemas/theme";

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
  const flashOpacity = interpolate(flashProgress, [0, 0.3, 1], [0.4, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)`,
        justifyContent: "center",
        padding: 60,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 30,
          opacity: enterProgress,
          transform: `translateX(${slideX}px)`,
        }}
      >
        {/* Checkmark circle with flash */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {/* Flash ring on check completion */}
          <div
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: 48,
              border: `2px solid ${theme.primaryColor}`,
              opacity: flashOpacity,
            }}
          />
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
              boxShadow: `0 4px 20px ${theme.primaryColor}40`,
            }}
          >
            <span
              style={{
                fontFamily: theme.headingFont,
                fontSize: 40,
                fontWeight: "bold",
                color: theme.textColor,
              }}
            >
              {number}
            </span>
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
    </AbsoluteFill>
  );
};
