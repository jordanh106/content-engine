import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import type { CreatorGrowthResponse } from "../../shared/types.js";

const LEVEL_COLORS: Record<string, { ring: string; bg: string; text: string; glow: string }> = {
  slate:   { ring: "ring-slate-400",   bg: "bg-slate-100",   text: "text-slate-600",   glow: "" },
  sky:     { ring: "ring-sky-400",     bg: "bg-sky-100",     text: "text-sky-600",     glow: "shadow-sky-200" },
  amber:   { ring: "ring-amber-400",   bg: "bg-amber-100",   text: "text-amber-600",   glow: "shadow-amber-200" },
  emerald: { ring: "ring-emerald-400", bg: "bg-emerald-100", text: "text-emerald-600", glow: "shadow-emerald-200" },
  violet:  { ring: "ring-violet-400",  bg: "bg-teal-100",  text: "text-teal-700",  glow: "shadow-violet-200" },
};

type CreatorLevelBadgeProps = {
  variant?: "sidebar" | "compact" | "home";
};

export const CreatorLevelBadge: React.FC<CreatorLevelBadgeProps> = ({ variant = "sidebar" }) => {
  const { data } = useQuery<CreatorGrowthResponse>({
    queryKey: ["creator-growth"],
    queryFn: () => fetch("/api/growth").then((r) => r.json()),
    staleTime: 30_000,
  });

  if (!data) return null;

  const { currentLevel, xpProgress, progress } = data;
  const colors = LEVEL_COLORS[currentLevel.color] ?? LEVEL_COLORS.slate;

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-5 h-5 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center ring-1 ${colors.ring}`}>
          <span className="text-[9px] font-black">{currentLevel.level}</span>
        </div>
        <span className="text-[10px] font-bold text-themed-secondary">{currentLevel.name}</span>
      </div>
    );
  }

  if (variant === "home") {
    const nextLevelXp = data.nextLevel?.xpRequired ?? currentLevel.xpRequired;
    return (
      <div className={`flex items-center gap-4 px-5 py-5 rounded-2xl border ${colors.bg} border-themed`}>
        <div className={`w-14 h-14 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center ring-2 ${colors.ring} ring-offset-2 ${colors.glow} shadow-md shrink-0`}>
          <span className="text-lg font-black">{currentLevel.level}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-themed">{currentLevel.name}</span>
            <span className="text-[10px] text-themed-muted">Level {currentLevel.level}</span>
          </div>
          <p className="text-xs text-themed-secondary mt-0.5">{currentLevel.description}</p>
          {/* XP progress bar */}
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="flex-1 h-2 bg-surface-hover rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  currentLevel.color === "slate" ? "bg-slate-400" :
                  currentLevel.color === "sky" ? "bg-sky-500" :
                  currentLevel.color === "amber" ? "bg-amber-500" :
                  currentLevel.color === "emerald" ? "bg-emerald-500" :
                  "bg-teal-500"
                }`}
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <span className="text-[10px] font-bold text-themed-muted whitespace-nowrap">{progress.xp} / {nextLevelXp} XP</span>
          </div>
        </div>
      </div>
    );
  }

  // Sidebar variant (default)
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center ring-2 ${colors.ring} ring-offset-1 transition-all`}>
          <span className="text-xs font-black">{currentLevel.level}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-themed">{currentLevel.name}</span>
            <span className="text-[9px] font-mono text-themed-muted">{progress.xp} XP</span>
          </div>
          <div className="mt-1 h-1 bg-surface-hover rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                currentLevel.color === "slate" ? "bg-slate-400" :
                currentLevel.color === "sky" ? "bg-sky-500" :
                currentLevel.color === "amber" ? "bg-amber-500" :
                currentLevel.color === "emerald" ? "bg-emerald-500" :
                "bg-teal-500"
              }`}
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
