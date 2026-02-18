import React from "react";
import { Series, useVideoConfig } from "remotion";
import type { DemoProps } from "../schemas/demo";
import { TitleCard } from "../components/TitleCard";
import { HookText } from "../components/HookText";
import { StepIndicator } from "../components/StepIndicator";
import { FrequencyCard } from "../components/FrequencyCard";
import { CallToAction } from "../components/CallToAction";

export const Demo: React.FC<DemoProps> = ({
  title,
  hookText,
  steps,
  keyCue,
  frequency,
  ctaText,
  theme,
}) => {
  const { fps } = useVideoConfig();

  return (
    <Series>
      {/* Hook */}
      <Series.Sequence durationInFrames={Math.round(3 * fps)}>
        <HookText text={hookText} theme={theme} />
      </Series.Sequence>

      {/* Title */}
      <Series.Sequence durationInFrames={Math.round(2 * fps)}>
        <TitleCard title={title} theme={theme} />
      </Series.Sequence>

      {/* Steps */}
      {steps.map((step, i) => (
        <Series.Sequence key={i} durationInFrames={Math.round(5 * fps)}>
          <StepIndicator
            stepNumber={i + 1}
            totalSteps={steps.length}
            label={step.instruction}
            description=""
            theme={theme}
          />
        </Series.Sequence>
      ))}

      {/* Frequency + key cue */}
      <Series.Sequence durationInFrames={Math.round(4 * fps)}>
        <FrequencyCard
          frequency={frequency}
          keyCue={keyCue}
          theme={theme}
        />
      </Series.Sequence>

      {/* CTA */}
      <Series.Sequence durationInFrames={Math.round(3 * fps)}>
        <CallToAction text={ctaText} theme={theme} />
      </Series.Sequence>
    </Series>
  );
};
