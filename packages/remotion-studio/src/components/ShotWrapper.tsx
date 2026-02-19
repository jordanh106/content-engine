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

  // Entrance: fade in + scale from 0.97 over first 15 frames
  const entranceProgress = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: 15,
  });

  // Exit: fade out over last 15 frames
  const exitFrame = Math.max(0, frame - (durationInFrames - 15));
  const exitProgress =
    frame >= durationInFrames - 15
      ? interpolate(exitFrame, [0, 15], [0, 1], {
          extrapolateRight: "clamp",
        })
      : 0;

  const opacity = interpolate(entranceProgress, [0, 1], [0, 1]) * (1 - exitProgress);
  const scale = interpolate(entranceProgress, [0, 1], [0.97, 1]);

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
