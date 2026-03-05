import React from "react";
import type { FormatId } from "../../shared/types.js";
import { FORMATS } from "../../shared/types.js";
import { formatColors } from "../../utils/format-colors.js";
import { cn } from "../../utils/cn.js";
import { Tooltip } from "./Tooltip.js";

type FormatBadgeProps = {
  format: FormatId;
  className?: string;
};

export const FormatBadge: React.FC<FormatBadgeProps> = ({ format, className }) => {
  const colors = formatColors[format];
  const info = FORMATS[format];
  return (
    <Tooltip content={`Format ${format}: ${info.name}`} side="top">
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border",
          colors.bg,
          colors.text,
          colors.border,
          className,
        )}
      >
        {format}
        <span className="hidden sm:inline">{info.shortName}</span>
      </span>
    </Tooltip>
  );
};
