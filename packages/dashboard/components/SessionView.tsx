import React, { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mic,
  Sparkles,
  Film,
  Play,
  Square,
  Check,
  Clock,
  ChevronRight,
  RotateCcw,
  ArrowRight,
  Zap,
} from "lucide-react";
import type { SessionType, FormatId, ProductionSession, DashboardView } from "../shared/types.js";
import { FormatBadge } from "./ui/FormatBadge.js";
import { AudienceBadge } from "./ui/AudienceBadge.js";
import { cn } from "../utils/cn.js";
import { EmptyState } from "./ui/EmptyState.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";

type Phase = "setup" | "active" | "complete";

type AvailableVideo = {
  code: string;
  title: string;
  format: FormatId;
  audience: string;
  audienceLabel: string;
};

const SESSION_TYPES: Array<{ type: SessionType; label: string; icon: React.ReactNode; description: string; statusFrom: string; isQuickWin?: boolean }> = [
  { type: "quick_win", label: "Quick Win", icon: <Zap size={20} />, description: "20-30 min. Review 1-2 captions or develop one idea. For overwhelmed weeks.", statusFrom: "SCRIPTED", isQuickWin: true },
  { type: "voiceover", label: "Voiceover", icon: <Mic size={20} />, description: "Record scripts for SCRIPTED videos", statusFrom: "SCRIPTED" },
  { type: "generation", label: "Generation", icon: <Sparkles size={20} />, description: "Generate graphics for RECORDING videos", statusFrom: "RECORDING" },
  { type: "assembly", label: "Assembly", icon: <Film size={20} />, description: "Assemble final cuts for GENERATING videos", statusFrom: "GENERATING" },
];

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type SessionViewProps = {
  onNavigate?: (view: DashboardView) => void;
};

export const SessionView: React.FC<SessionViewProps> = ({ onNavigate }) => {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("setup");
  const [selectedType, setSelectedType] = useState<SessionType | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [activeSession, setActiveSession] = useState<ProductionSession | null>(null);
  const [completedCodes, setCompletedCodes] = useState<Set<string>>(new Set());
  const [elapsed, setElapsed] = useState(0);

  // Fetch available videos for selected type
  const { data: availableData } = useQuery<{ videos: AvailableVideo[]; sessionType: SessionType }>({
    queryKey: ["session-available", selectedType],
    queryFn: () => fetch(`/api/sessions/available-videos?type=${selectedType}`).then((r) => r.json()),
    enabled: !!selectedType,
  });

  type BatchRec = { audience: string; videos: Array<{ code: string; title: string; format: string }>; count: number; estimatedMinutes: number; formats: string[]; reason: string };
  const { data: recommendations } = useQuery<{ batches: BatchRec[] }>({
    queryKey: ["session-recommendations", selectedType],
    queryFn: () => fetch(`/api/sessions/recommendations?type=${selectedType}`).then((r) => r.json()),
    enabled: !!selectedType,
  });

  // Fetch past sessions
  const { data: pastSessionsData } = useQuery<{ sessions: Array<{ id: number; sessionType: string; completedAt: string | null; durationMinutes: number | null; itemsCompleted: number; itemsTotal: number }> }>({
    queryKey: ["sessions"],
    queryFn: () => fetch("/api/sessions").then((r) => r.json()),
  });

  // Timer
  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Create session mutation
  const createMutation = useMutation({
    mutationFn: (body: { sessionType: SessionType; videoCodes: string[] }) =>
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      setActiveSession(data.session);
      setPhase("active");
      setElapsed(0);
      setCompletedCodes(new Set());
    },
  });

  // Complete item mutation
  const completeItemMutation = useMutation({
    mutationFn: ({ sessionId, videoCode }: { sessionId: number; videoCode: string }) =>
      fetch(`/api/sessions/${sessionId}/items/${videoCode}/complete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      }).then((r) => r.json()),
    onSuccess: (_data, variables) => {
      setCompletedCodes((prev) => new Set([...prev, variables.videoCode]));
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  // End session mutation
  const endMutation = useMutation({
    mutationFn: (sessionId: number) =>
      fetch(`/api/sessions/${sessionId}/complete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: Math.round(elapsed / 60) }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setPhase("complete");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  const toggleVideo = useCallback((code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!availableData) return;
    setSelectedCodes(new Set(availableData.videos.map((v) => v.code)));
  }, [availableData]);

  const handleStart = () => {
    if (!selectedType || selectedCodes.size === 0) return;
    createMutation.mutate({ sessionType: selectedType, videoCodes: Array.from(selectedCodes) });
  };

  const handleReset = () => {
    setPhase("setup");
    setSelectedType(null);
    setSelectedCodes(new Set());
    setActiveSession(null);
    setElapsed(0);
  };

  const pastSessions = pastSessionsData?.sessions?.filter((s) => s.completedAt) ?? [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
          Session Planner
        </h1>
        <FeatureHint id="session-phases" content={FEATURE_HINTS["session-phases"].content} side="bottom">
          <p className="text-sm text-slate-500 mt-1">
            Batch production sessions with auto-advancing status
          </p>
        </FeatureHint>
      </div>

      {/* SETUP PHASE */}
      {phase === "setup" && (
        <div className="space-y-6">
          {/* Session Type Selection */}
          <section>
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1">
              Session Type
            </h2>
            <div className="space-y-2">
              {/* Quick Win — full-width, visually distinct */}
              {SESSION_TYPES.filter((st) => st.isQuickWin).map((st) => (
                <button
                  key={st.type}
                  onClick={() => { setSelectedType(st.type); setSelectedCodes(new Set()); }}
                  className={cn(
                    "w-full border rounded-2xl p-4 text-left transition-all",
                    selectedType === st.type
                      ? "border-amber-400 bg-amber-50 ring-2 ring-amber-100"
                      : "border-amber-200 bg-amber-50/50 hover:border-amber-300",
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center",
                      selectedType === st.type ? "bg-amber-100 text-amber-600" : "bg-amber-100 text-amber-500",
                    )}>
                      {st.icon}
                    </div>
                    <span className="text-sm font-bold text-slate-900">{st.label}</span>
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">20-30 min</span>
                  </div>
                  <p className="text-xs text-slate-500">{st.description}</p>
                </button>
              ))}
              {/* Standard session types */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {SESSION_TYPES.filter((st) => !st.isQuickWin).map((st) => (
                  <button
                    key={st.type}
                    onClick={() => { setSelectedType(st.type); setSelectedCodes(new Set()); }}
                    className={cn(
                      "border rounded-2xl p-4 text-left transition-all",
                      selectedType === st.type
                        ? "border-teal-400 bg-teal-50 ring-2 ring-teal-100"
                        : "border-slate-200 bg-white hover:border-teal-200",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center",
                        selectedType === st.type ? "bg-teal-100 text-teal-600" : "bg-slate-100 text-slate-500",
                      )}>
                        {st.icon}
                      </div>
                      <span className="text-sm font-bold text-slate-900">{st.label}</span>
                    </div>
                    <p className="text-xs text-slate-500">{st.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Smart Batch Recommendations */}
          {selectedType && recommendations && recommendations.batches.length > 1 && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1 flex items-center gap-1.5">
                <Zap size={12} className="text-amber-500" />
                Smart Batches
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {recommendations.batches.map((batch) => {
                  const isSelected = batch.videos.every((v) => selectedCodes.has(v.code));
                  return (
                    <button
                      key={batch.audience}
                      onClick={() => setSelectedCodes(new Set(batch.videos.map((v) => v.code)))}
                      className={cn(
                        "border rounded-xl p-4 text-left transition-all",
                        isSelected
                          ? "border-amber-300 bg-amber-50"
                          : "border-slate-200 bg-white hover:border-amber-200",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className="text-sm font-bold text-slate-800">{batch.audience}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Clock size={11} className="text-slate-400" />
                          <span className="text-[10px] font-bold text-slate-500">~{batch.estimatedMinutes} min</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-black text-amber-700">{batch.count} video{batch.count !== 1 ? "s" : ""}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[10px] text-slate-500">Formats: {batch.formats.join(", ")}</span>
                      </div>
                      {batch.reason && (
                        <p className="text-[10px] text-slate-500 italic">{batch.reason}</p>
                      )}
                      {isSelected && (
                        <p className="text-[10px] font-bold text-amber-600 mt-1.5">Selected ✓</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Video Selection */}
          {selectedType && availableData && (
            <section>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Select Videos ({selectedCodes.size} of {availableData.videos.length})
                </h2>
                {availableData.videos.length > 0 && (
                  <button onClick={selectAll} className="text-[10px] font-bold text-teal-600 hover:text-teal-700">
                    Select All
                  </button>
                )}
              </div>
              {availableData.videos.length === 0 ? (
                <EmptyState
                  icon={<Film size={24} className="text-slate-400" />}
                  headline="No videos ready"
                  description={`No videos are currently in ${SESSION_TYPES.find((s) => s.type === selectedType)?.statusFrom} status for this session type.`}
                  compact
                />
              ) : (
                <div className="space-y-2">
                  {availableData.videos.map((v) => (
                    <button
                      key={v.code}
                      onClick={() => toggleVideo(v.code)}
                      className={cn(
                        "w-full flex items-center gap-3 border rounded-xl p-3 text-left transition-all",
                        selectedCodes.has(v.code)
                          ? "border-teal-300 bg-teal-50"
                          : "border-slate-200 bg-white hover:border-teal-200",
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0",
                        selectedCodes.has(v.code) ? "border-teal-500 bg-teal-500" : "border-slate-300",
                      )}>
                        {selectedCodes.has(v.code) && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-xs font-bold text-teal-700 font-mono">{v.code}</span>
                      <span className="text-xs text-slate-900 flex-1 truncate">{v.title}</span>
                      <FormatBadge format={v.format} />
                      <AudienceBadge audience={v.audience} label={v.audienceLabel} />
                    </button>
                  ))}
                </div>
              )}

              {selectedCodes.size > 0 && (
                <button
                  onClick={handleStart}
                  disabled={createMutation.isPending}
                  className="mt-4 w-full bg-teal-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Play size={16} />
                  Start {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Session ({selectedCodes.size} videos)
                </button>
              )}
            </section>
          )}

          {/* Past Sessions */}
          {pastSessions.length > 0 && (
            <section>
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3 px-1">
                Past Sessions
              </h2>
              <div className="space-y-2">
                {pastSessions.slice(0, 5).map((s) => (
                  <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700 capitalize">{s.sessionType}</span>
                      <span className="text-[10px] text-slate-400">{s.itemsCompleted}/{s.itemsTotal} completed</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      {s.durationMinutes && <span>{s.durationMinutes}m</span>}
                      <span>{new Date(s.completedAt!).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ACTIVE PHASE */}
      {phase === "active" && activeSession && (
        <div className="space-y-4">
          {/* Timer Bar */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock size={18} />
              <span className="text-2xl font-mono font-bold tabular-nums">{formatDuration(elapsed)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 capitalize">{activeSession.sessionType}</span>
              <span className="text-xs text-slate-400">
                {completedCodes.size}/{activeSession.items.length}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500 rounded-full transition-all duration-300"
              style={{ width: `${activeSession.items.length > 0 ? (completedCodes.size / activeSession.items.length) * 100 : 0}%` }}
            />
          </div>

          {/* Checklist */}
          <div className="space-y-2">
            {activeSession.items.map((item) => {
              const done = completedCodes.has(item.videoCode);
              return (
                <button
                  key={item.videoCode}
                  onClick={() => {
                    if (!done) {
                      completeItemMutation.mutate({ sessionId: activeSession.id, videoCode: item.videoCode });
                    }
                  }}
                  disabled={done || completeItemMutation.isPending}
                  className={cn(
                    "w-full flex items-center gap-3 border rounded-xl p-4 text-left transition-all",
                    done
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-teal-200",
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    done ? "border-emerald-500 bg-emerald-500" : "border-slate-300",
                  )}>
                    {done && <Check size={14} className="text-white" />}
                  </div>
                  <span className={cn("text-xs font-bold font-mono", done ? "text-emerald-700" : "text-teal-700")}>{item.videoCode}</span>
                  <span className={cn("text-sm flex-1 truncate", done ? "text-slate-400 line-through" : "text-slate-900")}>{item.title}</span>
                  <FormatBadge format={item.format} />
                  {!done && <ChevronRight size={14} className="text-slate-300" />}
                </button>
              );
            })}
          </div>

          {/* End Session */}
          <button
            onClick={() => endMutation.mutate(activeSession.id)}
            disabled={endMutation.isPending}
            className="w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2"
          >
            <Square size={14} />
            End Session
          </button>
        </div>
      )}

      {/* COMPLETE PHASE */}
      {phase === "complete" && activeSession && (
        <div className="space-y-6">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center">
            <Check size={32} className="mx-auto mb-3 text-emerald-600" />
            <h2 className="text-lg font-serif font-bold text-slate-900 mb-1">Session Complete</h2>
            <p className="text-sm text-slate-600">
              {completedCodes.size} of {activeSession.items.length} videos completed in {formatDuration(elapsed)}
            </p>
            <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-500">
              <span className="capitalize font-bold">{activeSession.sessionType}</span>
              <span>{Math.round(elapsed / 60)} minutes</span>
              <span>
                ~{activeSession.items.length > 0 ? Math.round(elapsed / activeSession.items.length / 60) : 0}m per video
              </span>
            </div>
            {completedCodes.size > 0 && (
              <div className="mt-4 pt-4 border-t border-emerald-200 text-left space-y-1.5">
                {activeSession.sessionType === "voiceover" && (
                  <p className="text-xs text-emerald-700">
                    <span className="font-bold">{completedCodes.size} video{completedCodes.size !== 1 ? "s" : ""}</span> moved to Recording. Next: Generation Night to create motion graphics.
                  </p>
                )}
                {activeSession.sessionType === "generation" && (
                  <p className="text-xs text-emerald-700">
                    <span className="font-bold">{completedCodes.size} video{completedCodes.size !== 1 ? "s" : ""}</span> moved to Generating. Next: Assembly Night to combine footage and export.
                  </p>
                )}
                {activeSession.sessionType === "assembly" && (
                  <p className="text-xs text-emerald-700">
                    <span className="font-bold">{completedCodes.size} video{completedCodes.size !== 1 ? "s" : ""}</span> are now Assembled and ready to schedule. Add them to your calendar.
                  </p>
                )}
                {activeSession.sessionType === "quick_win" && (
                  <p className="text-xs text-emerald-700">
                    Quick win complete. Momentum maintained. You can always do more later.
                  </p>
                )}
                {!["voiceover", "generation", "assembly", "quick_win"].includes(activeSession.sessionType) && (
                  <p className="text-xs text-emerald-700">
                    <span className="font-bold">{completedCodes.size} video{completedCodes.size !== 1 ? "s" : ""}</span> completed. Check your pipeline for the next step.
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleReset}
            className="w-full bg-teal-600 text-white rounded-xl py-3 text-sm font-bold hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
          >
            <RotateCcw size={14} />
            Start Another Session
          </button>
        </div>
      )}

      {onNavigate && (
        <div className="mt-6">
          <button
            onClick={() => onNavigate("PIPELINE")}
            className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
          >
            <div>
              <span className="text-sm font-semibold text-teal-800">View Updated Pipeline</span>
              <span className="block text-xs text-teal-600 mt-0.5">See your progress in the pipeline</span>
            </div>
            <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
          </button>
        </div>
      )}

      <ViewHelp {...VIEW_HELP.SESSION} />
    </div>
  );
};
