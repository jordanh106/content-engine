import React from "react";
import type { ShotQuoteCardProps } from "../../schemas/shot";
import { QuoteCard } from "../../components/QuoteCard";
import { ShotWrapper } from "../../components/ShotWrapper";

export const ShotQuoteCard: React.FC<ShotQuoteCardProps> = ({
  quote,
  attribution,
  role,
  theme,
}) => {
  return (
    <ShotWrapper>
      <QuoteCard quote={quote} attribution={attribution} role={role} theme={theme} />
    </ShotWrapper>
  );
};
