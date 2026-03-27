import React, { useState, useEffect } from "react";
import { SlidersHorizontal, X, Save, RotateCcw } from "lucide-react";

type FilterValues = {
  platform: string;
  sort: string;
  dateRange: string;
  minOutlier: number;
  maxOutlier: number;
  minViews: number;
  maxViews: number;
  minEngagement: number;
  maxEngagement: number;
  keyword: string;
  channel: string;
};

const DEFAULT_FILTERS: FilterValues = {
  platform: "all",
  sort: "dateAdded",
  dateRange: "all",
  minOutlier: 0,
  maxOutlier: 100,
  minViews: 0,
  maxViews: 10000000,
  minEngagement: 0,
  maxEngagement: 100,
  keyword: "",
  channel: "",
};

type FilterSidebarProps = {
  filters: FilterValues;
  onChange: (filters: FilterValues) => void;
  channels?: string[];
};

const RangeSlider: React.FC<{
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}> = ({ label, min, max, value, onChange, formatValue }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <span className="text-[10px] font-bold text-themed-muted uppercase tracking-wider">{label}</span>
      <span className="text-[10px] font-bold text-themed-secondary">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-1.5 bg-surface-hover rounded-full appearance-none cursor-pointer accent-blue-500
        [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md"
    />
  </div>
);

export const FilterSidebar: React.FC<FilterSidebarProps> = ({ filters, onChange, channels = [] }) => {
  const update = (key: keyof FilterValues, value: string | number) => {
    onChange({ ...filters, [key]: value });
  };

  const isDefault = JSON.stringify(filters) === JSON.stringify(DEFAULT_FILTERS);

  const saveFilter = () => {
    const name = prompt("Name this filter preset:");
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem("discover-filters") || "{}");
    saved[name] = filters;
    localStorage.setItem("discover-filters", JSON.stringify(saved));
  };

  return (
    <div className="w-52 shrink-0 space-y-5 pr-4 border-r border-themed">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted flex items-center gap-1.5">
          <SlidersHorizontal size={12} />
          Filters
        </h3>
        {!isDefault && (
          <button
            onClick={() => onChange({ ...DEFAULT_FILTERS })}
            className="text-[9px] font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Channel */}
      <div>
        <label className="text-[10px] font-bold text-themed-muted uppercase tracking-wider block mb-1.5">Channels</label>
        <select
          value={filters.channel}
          onChange={(e) => update("channel", e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-hover border border-themed text-[11px] text-themed-secondary focus:outline-none focus:border-blue-500"
        >
          <option value="">All channels</option>
          {channels.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Outlier Score */}
      <RangeSlider
        label="Outlier score"
        min={0}
        max={100}
        value={filters.minOutlier}
        onChange={(v) => update("minOutlier", v)}
        formatValue={(v) => v === 0 ? "Any" : `${v}x+`}
      />

      {/* Views */}
      <RangeSlider
        label="Views"
        min={0}
        max={10000000}
        value={filters.minViews}
        onChange={(v) => update("minViews", v)}
        formatValue={(v) => {
          if (v === 0) return "Any";
          if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M+`;
          if (v >= 1000) return `${(v / 1000).toFixed(0)}K+`;
          return `${v}+`;
        }}
      />

      {/* Engagement */}
      <RangeSlider
        label="Engagement"
        min={0}
        max={100}
        value={filters.minEngagement}
        onChange={(v) => update("minEngagement", v)}
        formatValue={(v) => v === 0 ? "Any" : `${v}%+`}
      />

      {/* Posted in last */}
      <div>
        <label className="text-[10px] font-bold text-themed-muted uppercase tracking-wider block mb-1.5">Posted in last</label>
        <div className="flex gap-1.5">
          <input
            type="number"
            min={0}
            max={24}
            value={filters.dateRange === "all" ? "" : filters.dateRange}
            placeholder="0"
            onChange={(e) => update("dateRange", e.target.value || "all")}
            className="w-16 px-2 py-1.5 rounded-lg bg-surface-hover border border-themed text-[11px] text-themed-secondary focus:outline-none focus:border-blue-500"
          />
          <span className="text-[11px] text-themed-muted self-center">Months</span>
        </div>
      </div>

      {/* Platform */}
      <div>
        <label className="text-[10px] font-bold text-themed-muted uppercase tracking-wider block mb-1.5">Platform</label>
        <select
          value={filters.platform}
          onChange={(e) => update("platform", e.target.value)}
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-hover border border-themed text-[11px] text-themed-secondary focus:outline-none focus:border-blue-500"
        >
          <option value="all">All platforms</option>
          <option value="TikTok">TikTok</option>
          <option value="Instagram">Instagram</option>
          <option value="YouTube">YouTube</option>
        </select>
      </div>

      {/* Keywords */}
      <div>
        <label className="text-[10px] font-bold text-themed-muted uppercase tracking-wider block mb-1.5">Keywords</label>
        <input
          type="text"
          value={filters.keyword}
          onChange={(e) => update("keyword", e.target.value)}
          placeholder="Search captions and titles"
          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-hover border border-themed text-[11px] text-themed-secondary placeholder:text-themed-muted focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Save filter button */}
      <button
        onClick={saveFilter}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold uppercase tracking-wider transition-colors"
      >
        <Save size={12} />
        Save filter
      </button>
    </div>
  );
};

export type { FilterValues };
export { DEFAULT_FILTERS };
