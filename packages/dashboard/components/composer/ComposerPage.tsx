import React, { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Loader2,
  Layers,
  Play,
} from "lucide-react";
import type {
  VideoDetailResponse,
  ShotsResponse,
  VibeMotionComponent,
  ComposerAiRequest,
  ComposerAiResponse,
  ComponentOperation,
} from "../../shared/types.js";
import { COMPONENT_REGISTRY } from "./component-registry.js";
import { ComposerPlayer } from "./ComposerPlayer.js";
import { ComponentList } from "./ComponentList.js";
import { PropEditor } from "./PropEditor.js";
import { AddComponentModal } from "./AddComponentModal.js";
import { AiChatPanel } from "./AiChatPanel.js";
import { cn } from "../../utils/cn.js";

type ComposerPageProps = {
  videoCode: string;
  onBack: () => void;
};

export const ComposerPage: React.FC<ComposerPageProps> = ({
  videoCode,
  onBack,
}) => {
  // ==========================================
  // Data fetching
  // ==========================================

  const { data: video } = useQuery<VideoDetailResponse>({
    queryKey: ["video", videoCode],
    queryFn: () => fetch(`/api/videos/${videoCode}`).then((r) => r.json()),
  });

  const { data: shotsData } = useQuery<ShotsResponse>({
    queryKey: ["shots", videoCode],
    queryFn: () =>
      fetch(`/api/renders/${videoCode}/shots`).then((r) => r.json()),
  });

  // ==========================================
  // Local state
  // ==========================================

  const [components, setComponents] = useState<VibeMotionComponent[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // Initialize components from API data
  useEffect(() => {
    if (shotsData?.components && !initialized) {
      setComponents(shotsData.components);
      if (shotsData.components.length > 0) {
        setSelectedIndex(0);
      }
      setInitialized(true);
    }
  }, [shotsData, initialized]);

  // ==========================================
  // Mutations
  // ==========================================

  const renderSelectedMutation = useMutation({
    mutationFn: async () => {
      if (selectedIndex === null) return;
      const comp = components[selectedIndex];
      const response = await fetch(`/api/renders/${videoCode}/composer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          components: [
            {
              compositionId: comp.compositionId,
              props: comp.props,
              durationInSeconds: comp.durationInSeconds,
            },
          ],
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Render failed" }));
        throw new Error(data.error || "Render failed");
      }
      return response.json();
    },
  });

  const renderAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/renders/${videoCode}/composer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          components: components.map((c) => ({
            compositionId: c.compositionId,
            props: c.props,
            durationInSeconds: c.durationInSeconds,
          })),
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: "Render failed" }));
        throw new Error(data.error || "Render failed");
      }
      return response.json();
    },
  });

  // ==========================================
  // Handlers
  // ==========================================

  const selectedComponent =
    selectedIndex !== null ? components[selectedIndex] : null;

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleReorder = useCallback((newComponents: VibeMotionComponent[]) => {
    setComponents(newComponents);
  }, []);

  const handleRemove = useCallback(
    (index: number) => {
      const newComponents = components.filter((_, i) => i !== index);
      setComponents(newComponents);

      if (selectedIndex === index) {
        setSelectedIndex(
          newComponents.length > 0
            ? Math.min(index, newComponents.length - 1)
            : null,
        );
      } else if (selectedIndex !== null && selectedIndex > index) {
        setSelectedIndex(selectedIndex - 1);
      }
    },
    [components, selectedIndex],
  );

  const handleAddComponent = useCallback(
    (componentType: string) => {
      const entry = COMPONENT_REGISTRY[componentType];
      if (!entry) return;

      const newComponent: VibeMotionComponent = {
        id: `${componentType.toLowerCase()}-${Date.now()}`,
        componentType: entry.type,
        compositionId: entry.compositionId,
        durationInSeconds:
          (entry.defaultProps.durationInSeconds as number) ?? 3,
        props: { ...entry.defaultProps },
        label: entry.label,
      };

      const newComponents = [...components, newComponent];
      setComponents(newComponents);
      setSelectedIndex(newComponents.length - 1);
    },
    [components],
  );

  const handlePropsChange = useCallback(
    (updatedProps: Record<string, unknown>) => {
      if (selectedIndex === null) return;
      setComponents((prev) =>
        prev.map((c, i) =>
          i === selectedIndex
            ? {
                ...c,
                props: { ...c.props, ...updatedProps },
                label: inferLabel(c.componentType, updatedProps),
              }
            : c,
        ),
      );
    },
    [selectedIndex],
  );

  const handleDurationChange = useCallback(
    (duration: number) => {
      if (selectedIndex === null) return;
      setComponents((prev) =>
        prev.map((c, i) =>
          i === selectedIndex
            ? {
                ...c,
                durationInSeconds: duration,
                props: { ...c.props, durationInSeconds: duration },
              }
            : c,
        ),
      );
    },
    [selectedIndex],
  );

  // ==========================================
  // AI prompt handler
  // ==========================================

  const handleAiPrompt = useCallback(
    async (prompt: string): Promise<string | null> => {
      setAiLoading(true);
      try {
        const requestBody: ComposerAiRequest = {
          prompt,
          components,
          selectedIndex,
          videoContext: {
            code: videoCode,
            title: video?.title || "",
            format: video?.formatName || "",
            script: video?.script || "",
            audience: video?.audienceLabel || "",
            tags: video?.tags || [],
          },
        };

        const response = await fetch("/api/composer/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "AI request failed" }));
          return `Error: ${errorData.error || "Something went wrong"}`;
        }

        const data: ComposerAiResponse = await response.json();

        // Apply operations
        applyOperations(data.operations);

        return data.message;
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "AI request failed";
        return `Error: ${msg}`;
      } finally {
        setAiLoading(false);
      }
    },
    [components, selectedIndex, videoCode, video],
  );

  const applyOperations = useCallback(
    (operations: ComponentOperation[]) => {
      let updatedComponents = [...components];
      let newSelectedIndex = selectedIndex;

      for (const op of operations) {
        switch (op.action) {
          case "add":
            updatedComponents = [...updatedComponents, op.component];
            newSelectedIndex = updatedComponents.length - 1;
            break;

          case "replace":
            if (op.index >= 0 && op.index < updatedComponents.length) {
              updatedComponents = updatedComponents.map((c, i) =>
                i === op.index ? op.component : c,
              );
              newSelectedIndex = op.index;
            }
            break;

          case "modify":
            if (op.index >= 0 && op.index < updatedComponents.length) {
              updatedComponents = updatedComponents.map((c, i) =>
                i === op.index
                  ? {
                      ...c,
                      props: { ...c.props, ...op.props },
                      durationInSeconds:
                        op.durationInSeconds ?? c.durationInSeconds,
                      label: inferLabel(c.componentType, {
                        ...c.props,
                        ...op.props,
                      }),
                    }
                  : c,
              );
              newSelectedIndex = op.index;
            }
            break;

          case "remove":
            if (op.index >= 0 && op.index < updatedComponents.length) {
              updatedComponents = updatedComponents.filter(
                (_, i) => i !== op.index,
              );
              if (newSelectedIndex === op.index) {
                newSelectedIndex =
                  updatedComponents.length > 0
                    ? Math.min(op.index, updatedComponents.length - 1)
                    : null;
              } else if (
                newSelectedIndex !== null &&
                newSelectedIndex > op.index
              ) {
                newSelectedIndex = newSelectedIndex - 1;
              }
            }
            break;

          case "reorder":
            if (op.order && op.order.length === updatedComponents.length) {
              const reordered = op.order.map((i) => updatedComponents[i]);
              updatedComponents = reordered;
              newSelectedIndex =
                newSelectedIndex !== null
                  ? op.order.indexOf(newSelectedIndex)
                  : null;
            }
            break;
        }
      }

      setComponents(updatedComponents);
      setSelectedIndex(newSelectedIndex);
    },
    [components, selectedIndex],
  );

  // ==========================================
  // Render
  // ==========================================

  const selectedEntry = selectedComponent
    ? COMPONENT_REGISTRY[selectedComponent.componentType]
    : null;

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-teal-700 font-mono">
                {videoCode}
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Composer
              </span>
            </div>
            {video && (
              <p className="text-sm text-slate-600 truncate max-w-md">
                {video.title}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {renderSelectedMutation.error && (
            <span className="text-xs text-rose-600 mr-2">
              {(renderSelectedMutation.error as Error).message}
            </span>
          )}
          {renderAllMutation.error && (
            <span className="text-xs text-rose-600 mr-2">
              {(renderAllMutation.error as Error).message}
            </span>
          )}

          <button
            onClick={() => renderSelectedMutation.mutate()}
            disabled={
              selectedIndex === null || renderSelectedMutation.isPending
            }
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors",
              selectedIndex === null || renderSelectedMutation.isPending
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-slate-600 text-white hover:bg-slate-700",
            )}
          >
            {renderSelectedMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Play size={12} />
            )}
            Render Selected
          </button>

          <button
            onClick={() => renderAllMutation.mutate()}
            disabled={
              components.length === 0 || renderAllMutation.isPending
            }
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors",
              components.length === 0 || renderAllMutation.isPending
                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                : "bg-teal-600 text-white hover:bg-teal-700",
            )}
          >
            {renderAllMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Layers size={12} />
            )}
            Render All
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Player preview */}
        <div className="flex-[3] flex items-center justify-center p-6 bg-slate-100">
          {selectedComponent ? (
            <div className="w-full max-w-xs">
              <ComposerPlayer
                componentType={selectedComponent.componentType}
                componentProps={selectedComponent.props}
                durationInSeconds={selectedComponent.durationInSeconds}
              />
            </div>
          ) : (
            <div className="text-center text-slate-400">
              <p className="text-sm">Select a component to preview</p>
              <p className="text-xs mt-1">
                or add one with the + button
              </p>
            </div>
          )}
        </div>

        {/* Right: Component list + Prop editor */}
        <div className="flex-[2] bg-white border-l border-slate-200 flex flex-col overflow-hidden min-w-[320px] max-w-[440px]">
          {/* Component list */}
          <div className="border-b border-slate-200 flex-shrink-0">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Components ({components.length})
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-700 uppercase tracking-wider"
              >
                <Plus size={14} />
                Add
              </button>
            </div>
            <div className="px-3 pb-3 max-h-[40vh] overflow-auto">
              <ComponentList
                components={components}
                selectedIndex={selectedIndex}
                onSelect={handleSelect}
                onReorder={handleReorder}
                onRemove={handleRemove}
              />
            </div>
          </div>

          {/* AI Chat panel */}
          <div className="border-b border-slate-200 h-[240px] flex-shrink-0">
            <AiChatPanel onSubmit={handleAiPrompt} isLoading={aiLoading} />
          </div>

          {/* Prop editor */}
          <div className="flex-1 overflow-auto px-4 py-4">
            {selectedComponent && selectedEntry ? (
              <>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                  Edit: {selectedEntry.label}
                </p>
                <PropEditor
                  fields={selectedEntry.fields}
                  values={selectedComponent.props}
                  durationInSeconds={selectedComponent.durationInSeconds}
                  onChange={handlePropsChange}
                  onDurationChange={handleDurationChange}
                />
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                Select a component to edit
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add component modal */}
      {showAddModal && (
        <AddComponentModal
          onAdd={handleAddComponent}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
};

// ==========================================
// Helper: infer label from props
// ==========================================

function inferLabel(
  componentType: string,
  props: Record<string, unknown>,
): string {
  const text =
    (props.title as string) ||
    (props.text as string) ||
    (props.quote as string) ||
    (props.value as string) ||
    (props.label as string) ||
    (props.frequency as string) ||
    "";

  if (text.length > 40) return `${text.slice(0, 37)}...`;
  return text || COMPONENT_REGISTRY[componentType]?.label || componentType;
}
