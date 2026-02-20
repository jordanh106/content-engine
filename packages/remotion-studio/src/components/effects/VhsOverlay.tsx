import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

type VhsOverlayProps = {
  scanlineOpacity?: number;
  colorBleed?: number;
  warmShift?: number;
};

export const VhsOverlay: React.FC<VhsOverlayProps> = ({
  scanlineOpacity = 0.04,
  colorBleed = 0.3,
  warmShift = 0.2,
}) => {
  const frame = useCurrentFrame();

  // Subtle chromatic aberration offset that drifts over time
  const offsetX = Math.sin(frame * 0.1) * colorBleed * 2;
  const offsetY = Math.cos(frame * 0.07) * colorBleed * 0.5;

  // Scanline seed shifts every 3 frames for subtle flicker
  const scanlineSeed = Math.floor(frame / 3);

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Scanlines via repeating linear gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(0, 0, 0, ${scanlineOpacity}) 3px,
            rgba(0, 0, 0, ${scanlineOpacity}) 4px
          )`,
          opacity: 0.8 + Math.sin(scanlineSeed * 0.5) * 0.2,
        }}
      />

      {/* Chromatic aberration - red channel offset */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(255, 0, 0, ${colorBleed * 0.02})`,
          mixBlendMode: "screen",
          transform: `translate(${offsetX}px, ${offsetY}px)`,
        }}
      />

      {/* Chromatic aberration - cyan channel offset */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(0, 200, 255, ${colorBleed * 0.015})`,
          mixBlendMode: "screen",
          transform: `translate(${-offsetX}px, ${-offsetY}px)`,
        }}
      />

      {/* Warm color shift overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: `rgba(255, 180, 80, ${warmShift * 0.03})`,
          mixBlendMode: "overlay",
        }}
      />

      {/* Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0, 0, 0, 0.15) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};
