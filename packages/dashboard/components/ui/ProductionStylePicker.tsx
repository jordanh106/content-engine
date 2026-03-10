import React from "react";
import { Video, Wand2, Sparkles, Bot } from "lucide-react";
import type { ProductionStyle } from "../../shared/types.js";
import { PRODUCTION_STYLES, PRODUCTION_STYLE_INFO } from "../../shared/types.js";
import { cn } from "../../utils/cn.js";

const STYLE_ICONS: Record<ProductionStyle, React.ReactNode> = {
  real: <Video size={16} />,
  enhanced: <Wand2 size={16} />,
  heavy_ai: <Sparkles size={16} />,
  full_ai: <Bot size={16} />,
};

type ProductionStylePickerProps = {
  value: ProductionStyle | null;
  onChange: (style: ProductionStyle) => void;
  disabled?: boolean;
};

export const ProductionStylePicker: React.FC<ProductionStylePickerProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {PRODUCTION_STYLES.map((styleId) => {
        const info = PRODUCTION_STYLE_INFO[styleId];
        const isSelected = value === styleId;

        return (
          <button
            key={styleId}
            type="button"
            disabled={disabled}
            onClick={() => onChange(styleId)}
            className={cn(
              "flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center",
              "hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
              isSelected
                ? cn(info.color.border, info.color.bg, "shadow-sm")
                : "border-slate-200 bg-white hover:border-slate-300",
            )}
          >
            <span
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-full",
                isSelected ? cn(info.color.dot, "text-white") : "bg-slate-100 text-slate-500",
              )}
            >
              {STYLE_ICONS[styleId]}
            </span>
            <span
              className={cn(
                "text-[11px] font-black uppercase tracking-widest",
                isSelected ? info.color.text : "text-slate-600",
              )}
            >
              {info.name}
            </span>
            <span className="text-[10px] text-slate-500 leading-tight">
              {info.description}
            </span>
          </button>
        );
      })}
    </div>
  );
};
