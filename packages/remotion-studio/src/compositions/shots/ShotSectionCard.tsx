import React from "react";
import type { ShotSectionCardProps } from "../../schemas/shot";
import { SectionCard } from "../../components/SectionCard";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotSectionCard: React.FC<ShotSectionCardProps> = ({
  label,
  text,
  theme,
}) => {
  return (
    <ShotWrapper>
      <SectionCard label={label} text={text} theme={theme} />
    </ShotWrapper>
  );
};
