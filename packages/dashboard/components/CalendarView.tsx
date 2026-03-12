import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Calendar,
  TrendingUp,
} from "lucide-react";
import type { CalendarEntry, CalendarResponse, CalendarGap, FormatId, DashboardView } from "../shared/types.js";
import { FormatBadge } from "./ui/FormatBadge.js";
import { cn } from "../utils/cn.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PLATFORM_LABELS: Record<string, string> = {
  instagram_reels: "IG Reels",
  youtube_shorts: "YT Shorts",
  youtube_long: "YT Long",
  tiktok: "TikTok",
  instagram_stories: "IG Stories",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram_reels: "bg-pink-50 border-pink-200 text-pink-700",
  youtube_shorts: "bg-red-50 border-red-200 text-red-700",
  youtube_long: "bg-red-50 border-red-200 text-red-700",
  tiktok: "bg-slate-50 border-slate-300 text-slate-700",
  instagram_stories: "bg-purple-50 border-purple-200 text-purple-700",
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

type CalendarViewProps = {
  onNavigate?: (view: DashboardView) => void;
};

type ViewMode = "week" | "month";

function getMonthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getMonthLabel(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

const PLATFORM_DOTS: Record<string, string> = {
  instagram_reels: "bg-pink-400",
  youtube_shorts: "bg-red-400",
  youtube_long: "bg-red-600",
  tiktok: "bg-slate-600",
  instagram_stories: "bg-purple-400",
};

export const CalendarView: React.FC<CalendarViewProps> = ({ onNavigate }) => {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [monthStart, setMonthStart] = useState(() => getMonthStart(new Date()));
  const [showAddModal, setShowAddModal] = useState<{ date: string; platform: string } | null>(null);
  const [addVideoCode, setAddVideoCode] = useState("");
  const [addNotes, setAddNotes] = useState("");

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);

  const monthEnd = useMemo(() => {
    const end = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
    return end;
  }, [monthStart]);

  const startStr = viewMode === "week" ? formatDate(weekStart) : formatDate(monthStart);
  const endStr = viewMode === "week" ? formatDate(weekEnd) : formatDate(monthEnd);

  // Fetch calendar entries
  const { data: calendarData } = useQuery<CalendarResponse>({
    queryKey: ["calendar", startStr, endStr],
    queryFn: () => fetch(`/api/calendar?start=${startStr}&end=${endStr}`).then((r) => r.json()),
  });

  // Fetch gaps
  const { data: gapsData } = useQuery<{ gaps: CalendarGap[] }>({
    queryKey: ["calendar-gaps"],
    queryFn: () => fetch("/api/calendar/gaps?weeks=4").then((r) => r.json()),
  });

  // Fetch best posting times
  type BestTime = { day: string; platform: string; avgViews: number; sampleSize: number };
  const { data: bestTimesData } = useQuery<{ bestTimes: BestTime[]; hasEnoughData: boolean }>({
    queryKey: ["best-times"],
    queryFn: () => fetch("/api/analytics/best-times").then((r) => r.json()),
  });

  // Fetch available videos (ASSEMBLED status) for scheduling
  const { data: availableVideos } = useQuery<{ videos: Array<{ code: string; title: string; format: FormatId }> }>({
    queryKey: ["session-available", "assembly"],
    queryFn: () => fetch("/api/sessions/available-videos?type=assembly").then((r) => r.json()),
    enabled: !!showAddModal,
  });

  // Add entry mutation
  const addMutation = useMutation({
    mutationFn: (body: { date: string; platform: string; videoCode?: string; notes?: string }) =>
      fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-gaps"] });
      setShowAddModal(null);
      setAddVideoCode("");
      setAddNotes("");
    },
  });

  // Delete entry mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/calendar/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-gaps"] });
    },
  });

  const platforms = calendarData?.platforms || [];
  const entries = calendarData?.entries || [];

  // Build grid: days x platforms
  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [weekStart]);

  const entriesByCell = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const key = `${e.date}|${e.platform}`;
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [entries]);

  const navigateWeek = (delta: number) => {
    setWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta * 7);
      return next;
    });
  };

  const navigateMonth = (delta: number) => {
    setMonthStart((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  const isToday = (d: Date) => {
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // Build month grid (6 rows x 7 columns, padding with prev/next month days)
  const monthDays = useMemo(() => {
    const firstDay = monthStart.getDay(); // 0=Sun
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Convert to Mon=0
    const daysInMonth = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
    const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const result: Array<{ date: Date; isCurrentMonth: boolean }> = [];
    for (let i = 0; i < totalCells; i++) {
      const d = new Date(monthStart);
      d.setDate(d.getDate() - offset + i);
      result.push({ date: d, isCurrentMonth: d.getMonth() === monthStart.getMonth() });
    }
    return result;
  }, [monthStart]);

  // Month entries grouped by date
  const monthEntriesByDate = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const e of entries) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    return map;
  }, [entries]);

  const totalGaps = gapsData?.gaps?.length ?? 0;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
            Content Calendar
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {entries.length} entries {viewMode === "week" ? "this week" : "this month"}
            {totalGaps > 0 && (
              <FeatureHint id="calendar-gaps" content={FEATURE_HINTS["calendar-gaps"].content} side="bottom">
                <button
                  onClick={() => {
                    const firstGap = gapsData?.gaps?.[0];
                    if (firstGap) {
                      setShowAddModal({ date: formatDate(new Date()), platform: firstGap.platform });
                    } else {
                      onNavigate?.("OPPORTUNITIES");
                    }
                  }}
                  className="text-amber-600 ml-2 hover:text-amber-700 hover:underline transition-colors"
                >
                  <AlertTriangle size={12} className="inline mr-0.5" />
                  {totalGaps} cadence gap{totalGaps !== 1 ? "s" : ""} - schedule now
                </button>
              </FeatureHint>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {totalGaps > 0 && (
            <button
              onClick={() => {
                const gap = gapsData?.gaps?.[0];
                if (gap) setShowAddModal({ date: formatDate(new Date()), platform: gap.platform });
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-teal-700 transition-colors"
            >
              <Plus size={12} />
              Fill Calendar
            </button>
          )}
          {/* View mode toggle */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setViewMode("week")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
                viewMode === "week" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <CalendarDays size={12} /> Week
            </button>
            <button
              onClick={() => setViewMode("month")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors",
                viewMode === "month" ? "bg-white text-teal-700 shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Calendar size={12} /> Month
            </button>
          </div>

          <button
            onClick={() => viewMode === "week" ? navigateWeek(-1) : navigateMonth(-1)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[160px] text-center">
            {viewMode === "week" ? weekLabel : getMonthLabel(monthStart)}
          </span>
          <button
            onClick={() => viewMode === "week" ? navigateWeek(1) : navigateMonth(1)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => {
              if (viewMode === "week") setWeekStart(getMonday(new Date()));
              else setMonthStart(getMonthStart(new Date()));
            }}
            className="text-[10px] font-bold text-teal-600 hover:text-teal-700 ml-2"
          >
            Today
          </button>
        </div>
      </div>

      {/* Best Posting Times */}
      {bestTimesData && bestTimesData.bestTimes.length > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs mb-4">
          <TrendingUp size={14} className="text-emerald-600 shrink-0" />
          <span className="text-emerald-700 font-medium">Best days:</span>
          {bestTimesData.bestTimes.slice(0, 3).map((t, i) => (
            <span key={i} className="text-emerald-600">
              {t.day} on {PLATFORM_LABELS[t.platform] || t.platform}
              {t.sampleSize >= 3 ? ` (${t.avgViews} avg views)` : ""}
              {i < 2 && bestTimesData.bestTimes.length > i + 1 ? " · " : ""}
            </span>
          ))}
          {!bestTimesData.hasEnoughData && (
            <span className="text-emerald-400 italic">Collecting more data...</span>
          )}
        </div>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid gap-1" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
              <div />
              {days.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "text-center py-2 rounded-t-lg",
                    isToday(d) ? "bg-teal-50" : "",
                  )}
                >
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{DAYS[i]}</p>
                  <p className={cn(
                    "text-sm font-bold",
                    isToday(d) ? "text-teal-600" : "text-slate-700",
                  )}>
                    {d.getDate()}
                  </p>
                </div>
              ))}

              {platforms.map((platform) => (
                <React.Fragment key={platform}>
                  <div className="flex items-center px-2">
                    <span className="text-[10px] font-bold text-slate-500 truncate">
                      {PLATFORM_LABELS[platform] || platform}
                    </span>
                  </div>
                  {days.map((d) => {
                    const dateStr = formatDate(d);
                    const cellEntries = entriesByCell.get(`${dateStr}|${platform}`) || [];
                    return (
                      <div
                        key={`${platform}-${dateStr}`}
                        className={cn(
                          "min-h-[60px] border border-slate-100 rounded-lg p-1 relative group",
                          isToday(d) ? "bg-teal-50/30" : "bg-white",
                        )}
                      >
                        {cellEntries.map((entry) => (
                          <div
                            key={entry.id}
                            className={cn(
                              "text-[10px] rounded-md px-1.5 py-1 mb-0.5 border flex items-center gap-1",
                              PLATFORM_COLORS[platform] || "bg-slate-50 border-slate-200 text-slate-700",
                            )}
                          >
                            {entry.videoFormat && <FormatBadge format={entry.videoFormat} />}
                            <span className="font-bold truncate">{entry.videoCode || entry.slotLabel || "TBD"}</span>
                            <button
                              onClick={() => deleteMutation.mutate(entry.id)}
                              className="ml-auto opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setShowAddModal({ date: dateStr, platform })}
                          className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Plus size={14} className="text-slate-300" />
                        </button>
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Month View */}
      {viewMode === "month" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-slate-200">
            {DAYS.map((d) => (
              <div key={d} className="py-2 text-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{d}</span>
              </div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7">
            {monthDays.map(({ date, isCurrentMonth }, i) => {
              const dateStr = formatDate(date);
              const dayEntries = monthEntriesByDate.get(dateStr) || [];
              const platformSet = new Set(dayEntries.map((e) => e.platform));
              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[80px] border-b border-r border-slate-100 p-1.5 relative group cursor-pointer hover:bg-slate-50 transition-colors",
                    !isCurrentMonth && "bg-slate-50/50",
                    isToday(date) && "bg-teal-50/40",
                  )}
                  onClick={() => {
                    if (platforms.length > 0) {
                      setShowAddModal({ date: dateStr, platform: platforms[0] });
                    }
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-xs font-bold",
                      isToday(date) ? "text-teal-600" : isCurrentMonth ? "text-slate-700" : "text-slate-300",
                    )}>
                      {date.getDate()}
                    </span>
                    {dayEntries.length > 0 && (
                      <span className="text-[9px] font-bold text-slate-400">{dayEntries.length}</span>
                    )}
                  </div>
                  {/* Platform dots */}
                  {platformSet.size > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {Array.from(platformSet).map((p) => (
                        <div
                          key={p}
                          className={cn("w-2 h-2 rounded-full", PLATFORM_DOTS[p] || "bg-slate-400")}
                          title={PLATFORM_LABELS[p] || p}
                        />
                      ))}
                    </div>
                  )}
                  {/* Show video codes */}
                  {dayEntries.slice(0, 2).map((entry) => (
                    <div key={entry.id} className="text-[9px] font-medium text-slate-500 truncate mt-0.5">
                      {entry.videoCode || entry.slotLabel || "TBD"}
                    </div>
                  ))}
                  {dayEntries.length > 2 && (
                    <div className="text-[9px] text-slate-400">+{dayEntries.length - 2} more</div>
                  )}
                </div>
              );
            })}
          </div>
          {/* Month summary */}
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-4 flex-wrap">
            {platforms.map((p) => {
              const count = entries.filter((e) => e.platform === p).length;
              return (
                <div key={p} className="flex items-center gap-1.5">
                  <div className={cn("w-2.5 h-2.5 rounded-full", PLATFORM_DOTS[p] || "bg-slate-400")} />
                  <span className="text-[10px] font-bold text-slate-500">
                    {PLATFORM_LABELS[p] || p}: {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Add to {PLATFORM_LABELS[showAddModal.platform] || showAddModal.platform}
              </h3>
              <button onClick={() => setShowAddModal(null)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">{showAddModal.date}</p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Video Code</label>
                <select
                  value={addVideoCode}
                  onChange={(e) => setAddVideoCode(e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                >
                  <option value="">Select a video (optional)</option>
                  {availableVideos?.videos?.map((v) => (
                    <option key={v.code} value={v.code}>{v.code}: {v.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Notes</label>
                <input
                  type="text"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                />
              </div>
              <button
                onClick={() => {
                  addMutation.mutate({
                    date: showAddModal.date,
                    platform: showAddModal.platform,
                    ...(addVideoCode && { videoCode: addVideoCode }),
                    ...(addNotes && { notes: addNotes }),
                  });
                }}
                disabled={addMutation.isPending}
                className="w-full bg-teal-600 text-white rounded-lg py-2 text-sm font-bold hover:bg-teal-700 transition-colors"
              >
                Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {onNavigate && (
        <div className="mt-6">
          <button
            onClick={() => onNavigate("OPPORTUNITIES")}
            className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
          >
            <div>
              <span className="text-sm font-semibold text-teal-800">Need More Content?</span>
              <span className="block text-xs text-teal-600 mt-0.5">Find trending topics to fill calendar gaps</span>
            </div>
            <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
          </button>
        </div>
      )}

      <ViewHelp {...VIEW_HELP.CALENDAR} />
    </div>
  );
};
