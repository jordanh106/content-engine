import React from "react";
import type { ShotHookTextProps } from "../../schemas/shot";
import { HookText } from "../../components/HookText";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotHookText: React.FC<ShotHookTextProps> = ({ text, theme }) => {
  return (
    <ShotWrapper>
      <HookText text={text} theme={theme} />
    </ShotWrapper>
  );
};
