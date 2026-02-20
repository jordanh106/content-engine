import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { QuickTipProps } from "../schemas/quick-tip";
import { HookText } from "../components/HookText";
import { KineticText } from "../components/KineticText";
import { CallToAction } from "../components/CallToAction";
import { VhsOverlay } from "../components/effects/VhsOverlay";

export const QuickTip: React.FC<QuickTipProps> = ({
  hookText,
  tipWords,
  ctaText,
  theme,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <TransitionSeries>
        {/* Hook - first 2 seconds, fast grab */}
        <TransitionSeries.Sequence durationInFrames={Math.round(2 * fps)}>
          <HookText text={hookText} theme={theme} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 8 })}
        />

        {/* Tip content via kinetic typography */}
        <TransitionSeries.Sequence durationInFrames={Math.round(8 * fps)}>
          <KineticText words={tipWords} theme={theme} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 8 })}
        />

        {/* CTA */}
        <TransitionSeries.Sequence durationInFrames={Math.round(3 * fps)}>
          <CallToAction text={ctaText} theme={theme} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* VHS effect when enabled */}
      {theme.vhsOverlay && <VhsOverlay />}
    </AbsoluteFill>
  );
};
