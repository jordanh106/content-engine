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

  const slideX = interpolate(enterProgress, [0, 1], [-80, 0]);
  const checkScale = interpolate(checkProgress, [0, 1], [0, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.darkBackground,
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
        {/* Checkmark circle */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: theme.primaryColor,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexShrink: 0,
            transform: `scale(${checkScale})`,
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

        {/* Text */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: theme.headingFont,
              fontSize: 48,
              fontWeight: "bold",
              color: theme.textColor,
              lineHeight: 1.2,
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
