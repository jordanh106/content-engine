import React from "react";
import type { ShotMythTruthProps } from "../../schemas/shot";
import { MythTruthReveal } from "../../components/MythTruthReveal";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotMythTruth: React.FC<ShotMythTruthProps> = ({
  text,
  type,
  theme,
}) => {
  return (
    <ShotWrapper>
      <MythTruthReveal text={text} type={type} theme={theme} />
    </ShotWrapper>
  );
};
