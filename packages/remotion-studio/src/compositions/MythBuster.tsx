import React from "react";
import { Series, useVideoConfig } from "remotion";
import type { MythBusterProps } from "../schemas/myth-buster";
import { MythTruthReveal } from "../components/MythTruthReveal";
import { SectionCard } from "../components/SectionCard";
import { CallToAction } from "../components/CallToAction";

export const MythBuster: React.FC<MythBusterProps> = ({
  mythText,
  truthText,
  explanationText,
  ctaText,
  theme,
}) => {
  const { fps } = useVideoConfig();

  return (
    <Series>
      {/* Myth statement */}
      <Series.Sequence durationInFrames={Math.round(4 * fps)}>
        <MythTruthReveal text={mythText} type="myth" theme={theme} />
      </Series.Sequence>

      {/* Truth reveal */}
      <Series.Sequence durationInFrames={Math.round(4 * fps)}>
        <MythTruthReveal text={truthText} type="truth" theme={theme} />
      </Series.Sequence>

      {/* Explanation */}
      <Series.Sequence durationInFrames={Math.round(4 * fps)}>
        <SectionCard label="Here's why" text={explanationText} theme={theme} />
      </Series.Sequence>

      {/* CTA */}
      <Series.Sequence durationInFrames={Math.round(3 * fps)}>
        <CallToAction text={ctaText} theme={theme} />
      </Series.Sequence>
    </Series>
  );
};
