import React from "react";
import type { ShotStepIndicatorProps } from "../../schemas/shot";
import { StepIndicator } from "../../components/StepIndicator";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotStepIndicator: React.FC<ShotStepIndicatorProps> = ({
  stepNumber,
  totalSteps,
  label,
  description,
  theme,
}) => {
  return (
    <ShotWrapper>
      <StepIndicator
        stepNumber={stepNumber}
        totalSteps={totalSteps}
        label={label}
        description={description}
        theme={theme}
      />
    </ShotWrapper>
  );
};
