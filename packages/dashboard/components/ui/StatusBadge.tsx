import React from "react";
import type { ProductionStatus } from "../../shared/types.js";
import { statusColors } from "../../utils/format-colors.js";
import { cn } from "../../utils/cn.js";

type StatusBadgeProps = {
  status: ProductionStatus;
  className?: string;
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const colors = statusColors[status] || statusColors.SCRIPTED;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full",
        colors.bg,
        colors.text,
        className,
      )}
    >
      {status}
    </span>
  );
};
