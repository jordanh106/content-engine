import React from "react";
import { Series, useVideoConfig } from "remotion";
import type { ChecklistProps } from "../schemas/checklist";
import { HookText } from "../components/HookText";
import { ChecklistOverlay } from "../components/ChecklistOverlay";
import { TitleCard } from "../components/TitleCard";
import { CallToAction } from "../components/CallToAction";

export const Checklist: React.FC<ChecklistProps> = ({
  title,
  hookText,
  items,
  closingText,
  ctaText,
  theme,
}) => {
  const { fps } = useVideoConfig();

  // Each item gets ~4 seconds, hook and closing get 3 each
  const itemDuration = Math.round(4 * fps);

  return (
    <Series>
      {/* Hook */}
      <Series.Sequence durationInFrames={Math.round(3 * fps)}>
        <HookText text={hookText} theme={theme} />
      </Series.Sequence>

      {/* Checklist items */}
      {items.map((item, i) => (
        <Series.Sequence key={i} durationInFrames={itemDuration}>
          <ChecklistOverlay
            number={item.number}
            label={item.label}
            description={item.description}
            theme={theme}
          />
        </Series.Sequence>
      ))}

      {/* Closing */}
      <Series.Sequence durationInFrames={Math.round(3 * fps)}>
        <TitleCard title={closingText} subtitle={title} theme={theme} />
      </Series.Sequence>

      {/* CTA */}
      <Series.Sequence durationInFrames={Math.round(3 * fps)}>
        <CallToAction text={ctaText} theme={theme} />
      </Series.Sequence>
    </Series>
  );
};
