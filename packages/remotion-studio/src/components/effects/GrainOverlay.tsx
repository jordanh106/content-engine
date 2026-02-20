import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";

type GrainOverlayProps = {
  opacity?: number;
};

/**
 * Film grain/noise overlay that adds subtle organic texture.
 * Uses an SVG feTurbulence filter with frame-based seed shifting
 * so the grain animates slightly each frame.
 */
export const GrainOverlay: React.FC<GrainOverlayProps> = ({
  opacity = 0.03,
}) => {
  const frame = useCurrentFrame();
  // Shift seed every 2 frames for subtle grain movement
  const seed = Math.floor(frame / 2);

  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay" }}>
      <svg width="100%" height="100%" style={{ opacity }}>
        <filter id={`grain-${seed}`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.65"
            numOctaves="3"
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter={`url(#grain-${seed})`}
          opacity="1"
        />
      </svg>
    </AbsoluteFill>
  );
};
