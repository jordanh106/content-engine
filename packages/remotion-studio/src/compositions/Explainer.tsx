import React from "react";
import { Series, useVideoConfig } from "remotion";
import type { ExplainerProps } from "../schemas/explainer";
import { TitleCard } from "../components/TitleCard";
import { HookText } from "../components/HookText";
import { SectionCard } from "../components/SectionCard";
import { StatCard } from "../components/StatCard";
import { CallToAction } from "../components/CallToAction";

export const Explainer: React.FC<ExplainerProps> = ({
  title,
  hookText,
  sections,
  stat,
  ctaText,
  theme,
}) => {
  const { fps } = useVideoConfig();

  return (
    <Series>
      {/* Title card */}
      <Series.Sequence durationInFrames={Math.round(2 * fps)}>
        <TitleCard title={title} theme={theme} />
      </Series.Sequence>

      {/* Hook */}
      <Series.Sequence durationInFrames={Math.round(3 * fps)}>
        <HookText text={hookText} theme={theme} />
      </Series.Sequence>

      {/* Content sections */}
      {sections.map((section, i) => (
        <Series.Sequence
          key={i}
          durationInFrames={Math.round(section.durationInSeconds * fps)}
        >
          <SectionCard
            label={section.label}
            text={section.text}
            theme={theme}
          />
        </Series.Sequence>
      ))}

      {/* Stat card (if provided) */}
      {stat && (
        <Series.Sequence durationInFrames={Math.round(3 * fps)}>
          <StatCard value={stat.value} label={stat.label} theme={theme} />
        </Series.Sequence>
      )}

      {/* CTA */}
      <Series.Sequence durationInFrames={Math.round(3 * fps)}>
        <CallToAction text={ctaText} theme={theme} />
      </Series.Sequence>
    </Series>
  );
};
