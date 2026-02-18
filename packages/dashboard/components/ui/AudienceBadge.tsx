import React from "react";
import { audienceColors } from "../../utils/format-colors.js";
import { cn } from "../../utils/cn.js";

type AudienceBadgeProps = {
  audience: string;
  label: string;
  className?: string;
};

export const AudienceBadge: React.FC<AudienceBadgeProps> = ({
  audience,
  label,
  className,
}) => {
  const colors = audienceColors[audience] || audienceColors.general;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full",
        colors.bg,
        colors.text,
        className,
      )}
    >
      {label}
    </span>
  );
};
