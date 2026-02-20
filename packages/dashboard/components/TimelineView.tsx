import React, { useRef } from "react";
import { Camera, Layers } from "lucide-react";
import type {
  TimelineItem,
  FormatTimingData,
  VibeMotionComponent,
} from "../shared/types.js";
import { cn } from "../utils/cn.js";

// ============================================
// Color map (matches VideoDetail.tsx)
// ============================================

const COMPONENT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  TitleCard:        { bg: "bg-violet-100",  text: "text-violet-700",  border: "border-violet-200" },
  StatCard:         { bg: "bg-blue-100",    text: "text-blue-700",    border: "border-blue-200" },
  SectionCard:      { bg: "bg-teal-100",    text: "text-teal-700",    border: "border-teal-200" },
  HookText:         { bg: "bg-amber-100",   text: "text-amber-700",   border: "border-amber-200" },
  ChecklistOverlay: { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
  MythTruthReveal:  { bg: "bg-rose-100",    text: "text-rose-700",    border: "border-rose-200" },
  StepIndicator:    { bg: "bg-indigo-100",  text: "text-indigo-700",  border: "border-indigo-200" },
  FrequencyCard:    { bg: "bg-cyan-100",    text: "text-cyan-700",    border: "border-cyan-200" },
  CallToAction:     { bg: "bg-orange-100",  text: "text-orange-700",  border: "border-orange-200" },
  ChartCard:        { bg: "bg-sky-100",     text: "text-sky-700",     border: "border-sky-200" },
  QuoteCard:        { bg: "bg-pink-100",    text: "text-pink-700",    border: "border-pink-200" },
};

const DEFAULT_COLORS = { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" };

// ============================================
// Types
// ============================================

type TimelineViewProps = {
  items: TimelineItem[];
  formatTiming: FormatTimingData;
  totalDuration: number;
  onSelectComponent?: (component: VibeMotionComponent) => void;
};

// ============================================
// Timeline View
// ============================================

export const TimelineView: React.FC<TimelineViewProps> = ({
  items,
  formatTiming,
  totalDuration,
  onSelectComponent,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const cinemaShots = items.filter((i) => i.type === "cinema-shot");
  const motionGraphics = items.filter((i) => i.type === "motion-graphic");

  // Pixel width per second (wider = more detail)
  const pxPerSecond = 28;
  const totalWidth = totalDuration * pxPerSecond;

  // Time ruler ticks every 5 seconds
  const tickInterval = 5;
  const ticks: number[] = [];
  for (let t = 0; t <= totalDuration; t += tickInterval) {
    ticks.push(t);
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Timeline
        </p>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1">
            <Camera size={10} />
            {cinemaShots.length} cinema
          </span>
          <span className="flex items-center gap-1">
            <Layers size={10} />
            {motionGraphics.length} graphics
          </span>
          <span>{totalDuration}s total</span>
        </div>
      </div>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto rounded-xl border border-slate-200 bg-white"
      >
        <div
          style={{ width: `${Math.max(totalWidth, 400)}px`, minWidth: "100%" }}
          className="relative"
        >
          {/* Scene zone backgrounds */}
          <div className="relative h-6 border-b border-slate-100">
            {formatTiming.scenes.map((scene, i) => {
              const left = (scene.startTime / totalDuration) * 100;
              const end = scene.endTime ?? scene.startTime + (scene.duration ?? 0);
              const width = ((end - scene.startTime) / totalDuration) * 100;

              return (
                <div
                  key={`scene-${i}`}
                  className={cn(
                    "absolute top-0 h-full flex items-center justify-center overflow-hidden border-r border-slate-100",
                    i % 2 === 0 ? "bg-slate-50/50" : "bg-white",
                  )}
                  style={{ left: `${left}%`, width: `${width}%` }}
                >
                  <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400 truncate px-1">
                    {scene.scene}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Time ruler */}
          <div className="relative h-5 border-b border-slate-200 bg-slate-50/30">
            {ticks.map((t) => {
              const left = (t / totalDuration) * 100;
              return (
                <div
                  key={`tick-${t}`}
                  className="absolute top-0 h-full flex flex-col items-center"
                  style={{ left: `${left}%` }}
                >
                  <div className="w-px h-2 bg-slate-300" />
                  <span className="text-[8px] font-mono text-slate-400 mt-px">
                    {t}s
                  </span>
                </div>
              );
            })}
          </div>

          {/* Cinema lane */}
          <div className="relative h-14 border-b border-slate-100">
            <div className="absolute left-0 top-0 h-full w-full">
              {/* Lane label */}
              <span className="absolute left-1 top-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-300 z-10">
                Cinema
              </span>
              {cinemaShots.map((item) => (
                <TimelineBlock
                  key={item.id}
                  item={item}
                  totalDuration={totalDuration}
                  variant="cinema"
                />
              ))}
            </div>
          </div>

          {/* Motion Graphics lane */}
          <div className="relative h-14">
            <div className="absolute left-0 top-0 h-full w-full">
              {/* Lane label */}
              <span className="absolute left-1 top-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-300 z-10">
                Graphics
              </span>
              {motionGraphics.map((item) => (
                <TimelineBlock
                  key={item.id}
                  item={item}
                  totalDuration={totalDuration}
                  variant="graphic"
                  onClick={() => {
                    if (item.component && onSelectComponent) {
                      onSelectComponent(item.component);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Array.from(new Set(motionGraphics.map((m) => m.component?.componentType).filter(Boolean))).map(
          (type) => {
            const colors = COMPONENT_TYPE_COLORS[type!] ?? DEFAULT_COLORS;
            return (
              <span
                key={type}
                className={cn(
                  "text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                  colors.bg,
                  colors.text,
                )}
              >
                {type}
              </span>
            );
          },
        )}
      </div>
    </div>
  );
};

// ============================================
// Timeline Block
// ============================================

const TimelineBlock: React.FC<{
  item: TimelineItem;
  totalDuration: number;
  variant: "cinema" | "graphic";
  onClick?: () => void;
}> = ({ item, totalDuration, variant, onClick }) => {
  const left = (item.startTime / totalDuration) * 100;
  const width = (item.duration / totalDuration) * 100;

  if (variant === "cinema") {
    return (
      <div
        className="absolute top-2 bottom-1 rounded border border-slate-200 bg-slate-100 overflow-hidden cursor-default group"
        style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
        title={`Shot ${item.shot?.number}: ${item.shot?.prompt ?? item.label} (${item.duration}s)`}
      >
        <div className="flex items-center gap-1 px-1.5 h-full">
          <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[8px] font-bold flex items-center justify-center flex-shrink-0">
            {item.shot?.number}
          </span>
          <span className="text-[8px] text-slate-600 truncate leading-tight">
            {item.label}
          </span>
        </div>
      </div>
    );
  }

  const compType = item.component?.componentType ?? "";
  const colors = COMPONENT_TYPE_COLORS[compType] ?? DEFAULT_COLORS;

  return (
    <div
      className={cn(
        "absolute top-2 bottom-1 rounded border overflow-hidden",
        colors.bg,
        colors.border,
        onClick ? "cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-teal-400" : "cursor-default",
      )}
      style={{ left: `${left}%`, width: `${Math.max(width, 1.5)}%` }}
      title={`${compType}: ${item.label} (${item.duration}s)`}
      onClick={onClick}
    >
      <div className="flex items-center gap-1 px-1.5 h-full">
        <span className={cn("text-[8px] font-bold truncate leading-tight", colors.text)}>
          {compType}
        </span>
        <span className={cn("text-[7px] truncate leading-tight opacity-70", colors.text)}>
          {item.duration}s
        </span>
      </div>
    </div>
  );
};
