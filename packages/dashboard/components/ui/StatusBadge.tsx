import React from "react";
import type { ProductionStatus } from "../../shared/types.js";
import { statusColors } from "../../utils/format-colors.js";
import { cn } from "../../utils/cn.js";
import { Tooltip } from "./Tooltip.js";

const STATUS_DESCRIPTIONS: Record<ProductionStatus, string> = {
  SCRIPTED: "Script written, ready for voiceover",
  RECORDING: "Voiceover or filming in progress",
  GENERATING: "AI graphics and Cinema Studio shots",
  ASSEMBLED: "Edited in CapCut, ready to schedule",
  SCHEDULED: "Publishing date set on calendar",
  PUBLISHED: "Live on platform",
};

type StatusBadgeProps = {
  status: ProductionStatus;
  className?: string;
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const colors = statusColors[status] || statusColors.SCRIPTED;
  return (
    <Tooltip content={STATUS_DESCRIPTIONS[status]} side="bottom">
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
    </Tooltip>
  );
};
