import React from "react";
import { Series, useVideoConfig } from "remotion";
import type { WalkthroughProps } from "../schemas/walkthrough";
import { HookText } from "../components/HookText";
import { StepIndicator } from "../components/StepIndicator";
import { SectionCard } from "../components/SectionCard";
import { CallToAction } from "../components/CallToAction";

export const Walkthrough: React.FC<WalkthroughProps> = ({
  title,
  hookText,
  steps,
  reassuranceText,
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

      {/* Steps */}
      {steps.map((step, i) => (
        <Series.Sequence key={i} durationInFrames={Math.round(5 * fps)}>
          <StepIndicator
            stepNumber={step.stepNumber}
            totalSteps={steps.length}
            label={step.label}
            description={step.description}
            theme={theme}
          />
        </Series.Sequence>
      ))}

      {/* Reassurance */}
      <Series.Sequence durationInFrames={Math.round(4 * fps)}>
        <SectionCard
          label={title}
          text={reassuranceText}
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
