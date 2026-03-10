import React from "react";
import { Video, Wand2, Sparkles, Bot } from "lucide-react";
import type { ProductionStyle } from "../../shared/types.js";
import { PRODUCTION_STYLE_INFO } from "../../shared/types.js";
import { cn } from "../../utils/cn.js";
import { Tooltip } from "./Tooltip.js";

const STYLE_ICONS: Record<ProductionStyle, React.ReactNode> = {
  real: <Video size={10} />,
  enhanced: <Wand2 size={10} />,
  heavy_ai: <Sparkles size={10} />,
  full_ai: <Bot size={10} />,
};

type ProductionStyleBadgeProps = {
  style: ProductionStyle | null;
  className?: string;
  showLabel?: boolean;
};

export const ProductionStyleBadge: React.FC<ProductionStyleBadgeProps> = ({
  style,
  className,
  showLabel = true,
}) => {
  if (!style) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border border-dashed border-slate-300 text-slate-400",
          className,
        )}
      >
        No style
      </span>
    );
  }

  const info = PRODUCTION_STYLE_INFO[style];
  return (
    <Tooltip content={info.description} side="top">
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full border",
          info.color.bg,
          info.color.text,
          info.color.border,
          className,
        )}
      >
        {STYLE_ICONS[style]}
        {showLabel && <span>{info.name}</span>}
      </span>
    </Tooltip>
  );
};
