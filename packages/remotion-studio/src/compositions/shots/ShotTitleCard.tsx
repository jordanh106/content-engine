import React from "react";
import type { ShotTitleCardProps } from "../../schemas/shot";
import { TitleCard } from "../../components/TitleCard";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotTitleCard: React.FC<ShotTitleCardProps> = ({
  title,
  subtitle,
  theme,
}) => {
  return (
    <ShotWrapper>
      <TitleCard title={title} subtitle={subtitle} theme={theme} />
    </ShotWrapper>
  );
};
