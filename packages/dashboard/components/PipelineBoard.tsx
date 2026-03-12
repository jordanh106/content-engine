import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
} from "@dnd-kit/core";
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { ChevronRight, Filter, CheckSquare, Square, ArrowRight, Zap, AlertTriangle } from "lucide-react";
import type {
  PipelineResponse,
  PipelineVideo,
  ProductionStatus,
  FormatId,
  DashboardView,
} from "../shared/types.js";
import { PRODUCTION_STATUSES, FORMAT_IDS, PRODUCTION_STYLES, PRODUCTION_STYLE_INFO } from "../shared/types.js";
import { statusColors } from "../utils/format-colors.js";
import { cn } from "../utils/cn.js";
import { PipelineCard } from "./ui/PipelineCard.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";
import { useOnboarding } from "./OnboardingProvider.js";
import { QualityGateModal } from "./ui/QualityGateModal.js";

type PipelineBoardProps = {
  onSelectVideo: (code: string) => void;
  onNavigate?: (view: DashboardView) => void;
};

// ============================================
// Draggable card wrapper
// ============================================

const DraggableCard: React.FC<{
  video: PipelineVideo;
  onClick: () => void;
  advanceButton?: React.ReactNode;
}> = ({ video, onClick, advanceButton }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: video.code });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn("cursor-grab active:cursor-grabbing", isDragging && "opacity-30")}
    >
      <PipelineCard
        video={video}
        onClick={onClick}
        isDragging={isDragging}
        advanceButton={advanceButton}
      />
    </div>
  );
};

// ============================================
// Droppable column
// ============================================

const DroppableColumn: React.FC<{
  status: ProductionStatus;
  count: number;
  children: React.ReactNode;
}> = ({ status, count, children }) => {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const colors = statusColors[status] || statusColors.SCRIPTED;

  return (
    <div className="w-64 md:w-72 flex-shrink-0 flex flex-col">
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          {status}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold rounded-full px-2 py-0.5",
            colors.bg,
            colors.text,
          )}
        >
          {count}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "bg-slate-50 rounded-2xl p-2 flex-1 min-h-[200px] space-y-2 transition-colors",
          isOver && "ring-2 ring-teal-200 bg-teal-50/30",
        )}
      >
        {children}
      </div>
    </div>
  );
};

// ============================================
// Mobile accordion section
// ============================================

const AccordionSection: React.FC<{
  status: ProductionStatus;
  videos: PipelineVideo[];
  isOpen: boolean;
  onToggle: () => void;
  onSelectVideo: (code: string) => void;
  onAdvance: (code: string) => void;
  nextStatus: ProductionStatus | null;
}> = ({ status, videos, isOpen, onToggle, onSelectVideo, onAdvance, nextStatus }) => {
  const colors = statusColors[status] || statusColors.SCRIPTED;

  return (
    <section className="border border-slate-200 rounded-2xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 bg-white"
      >
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          {status}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold rounded-full px-2 py-0.5",
            colors.bg,
            colors.text,
          )}
        >
          {videos.length}
        </span>
      </button>
      {isOpen && (
        <div className="p-2 bg-slate-50 space-y-2">
          {videos.map((video) => (
            <PipelineCard
              key={video.code}
              video={video}
              onClick={() => onSelectVideo(video.code)}
              advanceButton={
                nextStatus ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdvance(video.code);
                    }}
                    className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                  >
                    Move to {nextStatus}
                    <ChevronRight size={12} />
                  </button>
                ) : undefined
              }
            />
          ))}
          {videos.length === 0 && (
            <p className="text-xs text-slate-400 text-center py-4">
              No videos in this stage
            </p>
          )}
        </div>
      )}
    </section>
  );
};

// ============================================
// Main PipelineBoard
// ============================================

export const PipelineBoard: React.FC<PipelineBoardProps> = ({
  onSelectVideo,
  onNavigate,
}) => {
  const queryClient = useQueryClient();
  const { trackEvent } = useOnboarding();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<ProductionStatus | null>("SCRIPTED");
  const [formatFilter, setFormatFilter] = useState<FormatId | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<string | null>(null);
  const [styleFilter, setStyleFilter] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<ProductionStatus | null>(null);
  const [gateTarget, setGateTarget] = useState<{ code: string; from: ProductionStatus; to: ProductionStatus } | null>(null);

  const { data, isLoading } = useQuery<PipelineResponse>({
    queryKey: ["pipeline"],
    queryFn: () => fetch("/api/pipeline").then((r) => r.json()),
  });

  const { data: velocityData } = useQuery<{
    transitions: Array<{ fromStatus: string; toStatus: string; avgDays: number; count: number }>;
    bottleneck: { stage: string; avgDays: number } | null;
    completedVideos: number;
  }>({
    queryKey: ["pipeline-velocity"],
    queryFn: () => fetch("/api/analytics/velocity").then((r) => r.json()),
  });

  // Compute unique audiences from pipeline data
  const audiences = useMemo(() => {
    if (!data) return [];
    const set = new Map<string, string>();
    for (const status of PRODUCTION_STATUSES) {
      for (const v of data.stages[status]) {
        set.set(v.audience, v.audienceLabel);
      }
    }
    return Array.from(set.entries()).map(([id, label]) => ({ id, label }));
  }, [data]);

  // Filter stages
  const filteredStages = useMemo(() => {
    if (!data) return null;
    const result: Record<string, PipelineVideo[]> = {};
    for (const status of PRODUCTION_STATUSES) {
      result[status] = data.stages[status].filter((v) => {
        if (formatFilter && v.format !== formatFilter) return false;
        if (audienceFilter && v.audience !== audienceFilter) return false;
        if (styleFilter) {
          if (styleFilter === "none" && v.productionStyle !== null) return false;
          if (styleFilter !== "none" && v.productionStyle !== styleFilter) return false;
        }
        return true;
      });
    }
    return result;
  }, [data, formatFilter, audienceFilter, styleFilter]);

  const toggleSelect = (code: string) => {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedCodes(new Set());
    setBulkTarget(null);
  };

  const bulkMoveMutation = useMutation({
    mutationFn: ({ codes, status }: { codes: string[]; status: ProductionStatus }) =>
      fetch("/api/pipeline/bulk-status", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes, status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
  );

  const moveMutation = useMutation({
    mutationFn: ({
      code,
      status,
    }: {
      code: string;
      status: ProductionStatus;
    }) =>
      fetch(`/api/pipeline/${code}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onMutate: async ({ code, status: newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["pipeline"] });
      const previous = queryClient.getQueryData<PipelineResponse>([
        "pipeline",
      ]);

      if (previous) {
        const updated: PipelineResponse = {
          ...previous,
          stages: { ...previous.stages },
          summary: { ...previous.summary },
        };

        // Find and remove from current stage
        let movedVideo: PipelineVideo | undefined;
        for (const s of PRODUCTION_STATUSES) {
          const idx = updated.stages[s].findIndex((v) => v.code === code);
          if (idx !== -1) {
            movedVideo = updated.stages[s][idx];
            updated.stages[s] = updated.stages[s].filter(
              (v) => v.code !== code,
            );
            updated.summary[s] = updated.stages[s].length;
            break;
          }
        }

        // Add to new stage
        if (movedVideo) {
          updated.stages[newStatus] = [
            ...updated.stages[newStatus],
            { ...movedVideo, daysInStage: 0 },
          ];
          updated.summary[newStatus] = updated.stages[newStatus].length;
        }

        queryClient.setQueryData(["pipeline"], updated);
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["pipeline"], context.previous);
      }
    },
    onSuccess: () => {
      trackEvent("move-video");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["quality-gate"] });
    },
  });

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !data) return;

    const targetStatus = String(over.id) as ProductionStatus;
    if (!PRODUCTION_STATUSES.includes(targetStatus)) return;

    // Find source status
    const code = String(active.id);
    let sourceStatus: ProductionStatus | null = null;
    for (const s of PRODUCTION_STATUSES) {
      if (data.stages[s].some((v) => v.code === code)) {
        sourceStatus = s;
        break;
      }
    }

    if (!sourceStatus || sourceStatus === targetStatus) return;

    setGateTarget({ code, from: sourceStatus, to: targetStatus });
  };

  const handleAdvance = (code: string) => {
    if (!data) return;

    let currentStatus: ProductionStatus | null = null;
    for (const s of PRODUCTION_STATUSES) {
      if (data.stages[s].some((v) => v.code === code)) {
        currentStatus = s;
        break;
      }
    }
    if (!currentStatus) return;

    const idx = PRODUCTION_STATUSES.indexOf(currentStatus);
    if (idx < PRODUCTION_STATUSES.length - 1) {
      setGateTarget({ code, from: currentStatus, to: PRODUCTION_STATUSES[idx + 1] });
    }
  };

  // Find the actively dragged video for overlay
  const activeVideo =
    activeId && data
      ? PRODUCTION_STATUSES.reduce<PipelineVideo | undefined>(
          (found, s) => found || data.stages[s].find((v) => v.code === activeId),
          undefined,
        )
      : undefined;

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 animate-pulse">
        <div className="h-7 bg-slate-200 rounded w-32 mb-2" />
        <div className="h-4 bg-slate-100 rounded w-48 mb-6" />
        <div className="hidden md:flex gap-3 overflow-x-auto pb-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="w-64 flex-shrink-0">
              <div className="h-3 bg-slate-200 rounded w-20 mb-3" />
              <div className="bg-slate-50 rounded-2xl p-2 min-h-[200px] space-y-2">
                {[...Array(i < 1 ? 4 : 1)].map((_, j) => (
                  <div key={j} className="bg-white rounded-xl p-3 space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-16" />
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-5 bg-slate-100 rounded w-12" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-xl md:text-2xl font-serif font-bold text-slate-900">
          Pipeline
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {data.total} videos across {PRODUCTION_STATUSES.length} stages
        </p>
      </div>

      {/* Velocity + Bottleneck banners */}
      {(velocityData?.completedVideos ?? 0) > 0 || velocityData?.bottleneck ? (
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          {(velocityData?.completedVideos ?? 0) > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-teal-50 border border-teal-200 rounded-xl text-xs">
              <Zap size={13} className="text-teal-500 shrink-0" />
              <span className="text-teal-800 font-medium">
                <span className="font-bold">{velocityData!.completedVideos}</span> video{velocityData!.completedVideos !== 1 ? "s" : ""} published all-time
              </span>
            </div>
          )}
          {velocityData?.bottleneck && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs">
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
              <span className="text-amber-800">
                <span className="font-bold">Bottleneck:</span> {velocityData.bottleneck.stage} ({velocityData.bottleneck.avgDays}d avg)
              </span>
              {onNavigate && (
                <button
                  onClick={() => onNavigate("SESSION")}
                  className="ml-auto text-amber-700 font-bold hover:text-amber-900 transition-colors whitespace-nowrap"
                >
                  Start Session →
                </button>
              )}
            </div>
          )}
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Filter size={14} className="text-slate-400" />
        <button
          onClick={() => { setFormatFilter(null); setAudienceFilter(null); setStyleFilter(null); }}
          className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
            !formatFilter && !audienceFilter && !styleFilter
              ? "bg-teal-600 text-white"
              : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300",
          )}
        >
          All
        </button>
        {FORMAT_IDS.map((f) => (
          <button
            key={f}
            onClick={() => setFormatFilter(formatFilter === f ? null : f)}
            className={cn(
              "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
              formatFilter === f
                ? "bg-teal-600 text-white"
                : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300",
            )}
          >
            {f}
          </button>
        ))}
        {audiences.length > 1 && (
          <>
            <span className="w-px h-4 bg-slate-200" />
            {audiences.map((a) => (
              <button
                key={a.id}
                onClick={() => setAudienceFilter(audienceFilter === a.id ? null : a.id)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors truncate max-w-[120px]",
                  audienceFilter === a.id
                    ? "bg-teal-600 text-white"
                    : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300",
                )}
              >
                {a.label}
              </button>
            ))}
          </>
        )}
        <span className="w-px h-4 bg-slate-200" />
        {PRODUCTION_STYLES.map((s) => {
          const info = PRODUCTION_STYLE_INFO[s];
          return (
            <button
              key={s}
              onClick={() => setStyleFilter(styleFilter === s ? null : s)}
              className={cn(
                "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
                styleFilter === s
                  ? cn(info.color.bg, info.color.text, info.color.border, "border")
                  : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300",
              )}
            >
              {info.name}
            </button>
          );
        })}
      </div>

      {/* Bulk Actions Bar */}
      {selectedCodes.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 bg-violet-50 border border-violet-200 rounded-xl">
          <span className="text-xs font-bold text-violet-700">
            {selectedCodes.size} selected
          </span>
          <ArrowRight size={14} className="text-violet-400" />
          <select
            value={bulkTarget ?? ""}
            onChange={(e) => setBulkTarget(e.target.value as ProductionStatus)}
            className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5"
          >
            <option value="">Move to...</option>
            {PRODUCTION_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={() => {
              if (bulkTarget) {
                bulkMoveMutation.mutate({
                  codes: Array.from(selectedCodes),
                  status: bulkTarget,
                });
              }
            }}
            disabled={!bulkTarget || bulkMoveMutation.isPending}
            className={cn(
              "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors",
              bulkTarget
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed",
            )}
          >
            {bulkMoveMutation.isPending ? "Moving..." : "Move"}
          </button>
          <button
            onClick={clearSelection}
            className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-700 transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Desktop: horizontal kanban */}
      <FeatureHint id="pipeline-drag" content={FEATURE_HINTS["pipeline-drag"].content} side="bottom">
        <p className="hidden md:block text-xs text-slate-400 mb-2">Drag cards to advance</p>
      </FeatureHint>
      <div data-tour="pipeline-board" className="hidden md:block">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4">
            {PRODUCTION_STATUSES.map((status) => {
              const stageVideos = filteredStages?.[status] ?? [];
              return (
                <DroppableColumn
                  key={status}
                  status={status}
                  count={stageVideos.length}
                >
                  {stageVideos.map((video) => (
                    <div key={video.code} className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(video.code); }}
                        className="absolute top-2 right-2 z-10 p-0.5 rounded hover:bg-slate-100 transition-colors"
                      >
                        {selectedCodes.has(video.code) ? (
                          <CheckSquare size={14} className="text-violet-600" />
                        ) : (
                          <Square size={14} className="text-slate-300" />
                        )}
                      </button>
                      <DraggableCard
                        video={video}
                        onClick={() => onSelectVideo(video.code)}
                      />
                    </div>
                  ))}
                  {stageVideos.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">
                      Empty
                    </p>
                  )}
                </DroppableColumn>
              );
            })}
          </div>

          <DragOverlay>
            {activeVideo ? (
              <div className="w-72">
                <PipelineCard
                  video={activeVideo}
                  onClick={() => {}}
                  isDragging
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Mobile: accordion layout */}
      <div className="md:hidden space-y-2">
        {PRODUCTION_STATUSES.map((status, idx) => {
          const nextStatus =
            idx < PRODUCTION_STATUSES.length - 1
              ? PRODUCTION_STATUSES[idx + 1]
              : null;
          const stageVideos = filteredStages?.[status] ?? [];
          return (
            <AccordionSection
              key={status}
              status={status}
              videos={stageVideos}
              isOpen={openSection === status}
              onToggle={() =>
                setOpenSection(openSection === status ? null : status)
              }
              onSelectVideo={onSelectVideo}
              onAdvance={handleAdvance}
              nextStatus={nextStatus}
            />
          );
        })}
      </div>

      {/* Contextual CTAs */}
      {onNavigate && (filteredStages?.["SCRIPTED"]?.length ?? 0) >= 3 && (
        <div className="mt-6">
          <button
            onClick={() => onNavigate("SESSION")}
            className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
          >
            <div>
              <span className="text-sm font-semibold text-teal-800">Start Recording Session</span>
              <span className="block text-xs text-teal-600 mt-0.5">Batch record these scripts in one sitting</span>
            </div>
            <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
          </button>
        </div>
      )}
      {onNavigate && (filteredStages?.["ASSEMBLED"]?.length ?? 0) > 0 && (
        <div className="mt-6">
          <button
            onClick={() => onNavigate("CALENDAR")}
            className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
          >
            <div>
              <span className="text-sm font-semibold text-teal-800">Schedule These Videos</span>
              <span className="block text-xs text-teal-600 mt-0.5">Your content is ready to publish</span>
            </div>
            <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
          </button>
        </div>
      )}

      <ViewHelp {...VIEW_HELP.PIPELINE} />

      {gateTarget && (
        <QualityGateModal
          videoCode={gateTarget.code}
          fromStatus={gateTarget.from}
          toStatus={gateTarget.to}
          onConfirm={() => {
            moveMutation.mutate({ code: gateTarget.code, status: gateTarget.to });
            setGateTarget(null);
          }}
          onCancel={() => setGateTarget(null)}
        />
      )}
    </div>
  );
};
