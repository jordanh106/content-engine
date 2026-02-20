import React from "react";
import type { ShotKineticTextProps } from "../../schemas/shot";
import { KineticText } from "../../components/KineticText";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotKineticText: React.FC<ShotKineticTextProps> = ({
  words,
  theme,
}) => {
  return (
    <ShotWrapper>
      <KineticText words={words} theme={theme} />
    </ShotWrapper>
  );
};
