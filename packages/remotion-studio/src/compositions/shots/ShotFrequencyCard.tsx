import React from "react";
import type { ShotFrequencyCardProps } from "../../schemas/shot";
import { FrequencyCard } from "../../components/FrequencyCard";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotFrequencyCard: React.FC<ShotFrequencyCardProps> = ({
  frequency,
  keyCue,
  theme,
}) => {
  return (
    <ShotWrapper>
      <FrequencyCard frequency={frequency} keyCue={keyCue} theme={theme} />
    </ShotWrapper>
  );
};
