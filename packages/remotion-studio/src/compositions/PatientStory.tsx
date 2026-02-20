import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import {
  TransitionSeries,
  linearTiming,
} from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { PatientStoryProps } from "../schemas/patient-story";
import { HookText } from "../components/HookText";
import { QuoteCard } from "../components/QuoteCard";
import { StatCard } from "../components/StatCard";
import { CallToAction } from "../components/CallToAction";

export const PatientStory: React.FC<PatientStoryProps> = ({
  hookText,
  quote,
  attribution,
  role,
  stat,
  ctaText,
  theme,
}) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <TransitionSeries>
        {/* Hook - personal, warm opener */}
        <TransitionSeries.Sequence durationInFrames={Math.round(4 * fps)}>
          <HookText text={hookText} theme={theme} />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 12 })}
        />

        {/* Patient quote - the core of the story */}
        <TransitionSeries.Sequence durationInFrames={Math.round(8 * fps)}>
          <QuoteCard
            quote={quote}
            attribution={attribution}
            role={role}
            theme={theme}
          />
        </TransitionSeries.Sequence>

        {stat && (
          <>
            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: 12 })}
            />

            {/* Stat to reinforce */}
            <TransitionSeries.Sequence durationInFrames={Math.round(5 * fps)}>
              <StatCard value={stat.value} label={stat.label} theme={theme} />
            </TransitionSeries.Sequence>
          </>
        )}

        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: 12 })}
        />

        {/* CTA */}
        <TransitionSeries.Sequence durationInFrames={Math.round(4 * fps)}>
          <CallToAction text={ctaText} theme={theme} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
