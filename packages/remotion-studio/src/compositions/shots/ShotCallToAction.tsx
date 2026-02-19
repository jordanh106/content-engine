import React from "react";
import type { ShotCTAProps } from "../../schemas/shot";
import { CallToAction } from "../../components/CallToAction";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotCallToAction: React.FC<ShotCTAProps> = ({ text, theme }) => {
  return (
    <ShotWrapper>
      <CallToAction text={text} theme={theme} />
    </ShotWrapper>
  );
};
