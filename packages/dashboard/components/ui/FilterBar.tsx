import React from "react";
import type { FormatId, Audience } from "../../shared/types.js";
import { FORMAT_IDS, FORMATS } from "../../shared/types.js";
import { cn } from "../../utils/cn.js";
import { formatColors } from "../../utils/format-colors.js";

type FilterBarProps = {
  audiences: Audience[];
  selectedAudience: string | null;
  selectedFormat: FormatId | null;
  onAudienceChange: (audience: string | null) => void;
  onFormatChange: (format: FormatId | null) => void;
};

export const FilterBar: React.FC<FilterBarProps> = ({
  audiences,
  selectedAudience,
  selectedFormat,
  onAudienceChange,
  onFormatChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Audience filter */}
      <select
        value={selectedAudience || ""}
        onChange={(e) => onAudienceChange(e.target.value || null)}
        className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
      >
        <option value="">All Audiences</option>
        {audiences.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>

      {/* Format filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {FORMAT_IDS.map((f) => {
          const colors = formatColors[f];
          const active = selectedFormat === f;
          return (
            <button
              key={f}
              onClick={() => onFormatChange(active ? null : f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors min-h-[36px]",
                active
                  ? `${colors.bg} ${colors.text} ${colors.border}`
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300",
              )}
            >
              {f}: {FORMATS[f].shortName}
            </button>
          );
        })}
      </div>
    </div>
  );
};
