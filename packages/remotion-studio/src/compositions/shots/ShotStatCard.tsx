import React from "react";
import type { ShotStatCardProps } from "../../schemas/shot";
import { StatCard } from "../../components/StatCard";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotStatCard: React.FC<ShotStatCardProps> = ({
  value,
  label,
  theme,
}) => {
  return (
    <ShotWrapper>
      <StatCard value={value} label={label} theme={theme} />
    </ShotWrapper>
  );
};
