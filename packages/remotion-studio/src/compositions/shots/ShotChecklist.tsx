import React from "react";
import { Series, useVideoConfig } from "remotion";
import type { ShotChecklistProps } from "../../schemas/shot";
import { ChecklistOverlay } from "../../components/ChecklistOverlay";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotChecklist: React.FC<ShotChecklistProps> = ({
  items,
  theme,
  durationInSeconds,
}) => {
  const { fps } = useVideoConfig();
  const totalFrames = Math.round(durationInSeconds * fps);
  const framesPerItem = Math.max(30, Math.floor(totalFrames / items.length));

  return (
    <ShotWrapper>
      <Series>
        {items.map((item, i) => (
          <Series.Sequence
            key={i}
            durationInFrames={
              i === items.length - 1
                ? totalFrames - framesPerItem * i
                : framesPerItem
            }
          >
            <ChecklistOverlay
              number={item.number}
              label={item.label}
              description={item.description}
              theme={theme}
            />
          </Series.Sequence>
        ))}
      </Series>
    </ShotWrapper>
  );
};
