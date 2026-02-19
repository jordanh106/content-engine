import React from "react";
import type { ShotChartCardProps } from "../../schemas/shot";
import { ChartCard } from "../../components/ChartCard";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotChartCard: React.FC<ShotChartCardProps> = ({
  title,
  bars,
  maxValue,
  theme,
}) => {
  return (
    <ShotWrapper>
      <ChartCard title={title} bars={bars} maxValue={maxValue} theme={theme} />
    </ShotWrapper>
  );
};
