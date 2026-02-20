import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type ShotWrapperProps = {
  children: React.ReactNode;
};

export const ShotWrapper: React.FC<ShotWrapperProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Entrance: fade in + scale from 0.97 + blur-to-sharp over first 15 frames
  const entranceProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 15,
  });

  // Exit: fade out + slight scale-down + blur over last 15 frames
  const exitStart = durationInFrames - 15;
  const exitFrame = Math.max(0, frame - exitStart);
  const exitProgress =
    frame >= exitStart
      ? interpolate(exitFrame, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        })
      : 0;

  const opacity = interpolate(entranceProgress, [0, 1], [0, 1]) * (1 - exitProgress);
  const entranceScale = interpolate(entranceProgress, [0, 1], [0.97, 1]);
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.98]);
  const scale = entranceScale * exitScale;

  // Blur transitions
  const entranceBlur = interpolate(entranceProgress, [0, 1], [2, 0]);
  const exitBlur = interpolate(exitProgress, [0, 1], [0, 2]);
  const blur = entranceBlur + exitBlur;

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale})`,
        filter: blur > 0.01 ? `blur(${blur}px)` : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
