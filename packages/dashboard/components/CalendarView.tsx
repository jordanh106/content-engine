import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { CalendarEntry, CalendarResponse, CalendarGap, FormatId } from "../shared/types.js";
import { FormatBadge } from "./ui/FormatBadge.js";
import { cn } from "../utils/cn.js";

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

export const CalendarView: React.FC = () => {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [showAddModal, setShowAddModal] = useState<{ date: string; platform: string } | null>(null);
  const [addVideoCode, setAddVideoCode] = useState("");
  const [addNotes, setAddNotes] = useState("");

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    return end;
  }, [weekStart]);

  const startStr = formatDate(weekStart);
  const endStr = formatDate(weekEnd);

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

  const isToday = (d: Date) => {
    const today = new Date();
    return d.toDateString() === today.toDateString();
  };

  const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

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
            {entries.length} entries this week
            {totalGaps > 0 && (
              <span className="text-amber-600 ml-2">
                <AlertTriangle size={12} className="inline mr-0.5" />
                {totalGaps} cadence gaps
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigateWeek(-1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-medium text-slate-700 min-w-[160px] text-center">{weekLabel}</span>
          <button onClick={() => navigateWeek(1)} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight size={18} />
          </button>
          <button
            onClick={() => setWeekStart(getMonday(new Date()))}
            className="text-[10px] font-bold text-teal-600 hover:text-teal-700 ml-2"
          >
            Today
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Day headers */}
          <div className="grid gap-1" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
            <div /> {/* Platform label column spacer */}
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

            {/* Platform rows */}
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
    </div>
  );
};
