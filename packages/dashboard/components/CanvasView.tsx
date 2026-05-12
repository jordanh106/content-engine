import React, { useCallback, useState, useMemo, useEffect } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type EdgeChange,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Sparkles,
  Link2,
  Eye,
  FileText,
  Users,
  Plus,
  Wand2,
  Loader2,
  Layers,
  Trash2,
  Info,
  ArrowRight,
  X,
  Copy,
  Check,
  ExternalLink,
  Shuffle,
  Save,
  LayoutGrid,
  RotateCw,
  ClipboardPaste,
  GitBranch,
  Film,
} from "lucide-react";
import type { DashboardView, CreatorVideo, IntelDigest, Idea } from "../shared/types.js";
import { HiggsfieldPreflight, HiggsfieldCreditPill } from "./ui/HiggsfieldPreflight.js";
import { HiggsfieldCharactersPanel, HiggsfieldCharacterChip } from "./ui/HiggsfieldCharacters.js";
import { StorytellingReelStarter } from "./ui/StorytellingReelStarter.js";
import { Button, Pill } from "./ui/index.js";

type CanvasViewProps = {
  onNavigate: (view: DashboardView) => void;
};

// ── Node data types ─────────────────────────────────────────────────────────

type CreatorNodeData = {
  kind: "creator";
  handle: string;
  platform: string;
  videoCount?: number;
};

type VideoNodeData = {
  kind: "video";
  title: string;
  videoUrl: string;
  thumbnailUrl: string | null;
  creator: string;
  views?: number;
  outlierScore?: number;
};

type IdeaNodeData = {
  kind: "idea";
  topic: string;
  format?: string;
  priority?: string;
};

type FullConvertResult = {
  title: string;
  hookArchetype: string;
  hook: { visual: string; text: string; spoken: string; audio: string };
  script: string;
  shotList: Array<{ second: number; shot: string; action: string; textOverlay: string | null }>;
  cta: { type: string; phrasing: string; timing: string };
  caption: string;
  complianceNotes: string;
  outputFormat: string;
  outputLabel: string;
  outputDuration: string;
  sourceUrls?: string[];
  fetchResults?: Array<{ url: string; fetched: boolean; sourceType: string; title: string }>;
  warnings?: string[];
};

type ScriptNodeData = {
  kind: "script";
  title: string;
  hook?: string;
  script: string;
  format: string;
  complianceScore?: number;
  full?: FullConvertResult;
};

type SourceNodeData = {
  kind: "source";
  source: string;
  sourceType: "url" | "text";
};

type BRollNodeData = {
  kind: "broll";
  title: string;
  imageUrl: string | null;
  prompt: string;
  shotIndex: number;
  second?: number;
  shotDescription?: string;
  textOverlay?: string | null;
  status: "pending" | "completed" | "failed";
  error?: string;
  modelKey?: string;
  modelDisplay?: string;
  creditsExact?: number;
  animatedVideoNodeId?: string; // points to a brollVideo child if this image has been animated
};

type BRollVideoNodeData = {
  kind: "brollVideo";
  title: string;
  videoUrl: string | null;
  sourceImageUrl: string;
  prompt: string;
  duration: number;
  status: "pending" | "completed" | "failed";
  error?: string;
  modelKey?: string;
  modelDisplay?: string;
  creditsExact?: number;
};

type CanvasNodeData = CreatorNodeData | VideoNodeData | IdeaNodeData | ScriptNodeData | SourceNodeData | BRollNodeData | BRollVideoNodeData;

// ── Node components ─────────────────────────────────────────────────────────

const NodeShell: React.FC<{
  tone: "teal" | "violet" | "amber" | "rose" | "slate";
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  onDelete?: () => void;
}> = ({ tone, icon, label, children, onDelete }) => {
  const tones = {
    teal: "border-teal-300 bg-teal-50/70",
    violet: "border-teal-300 bg-teal-50/70",
    amber: "border-amber-300 bg-amber-50/70",
    rose: "border-rose-300 bg-rose-50/70",
    slate: "border-slate-300 bg-white",
  };
  const tonesLabel = {
    teal: "text-teal-700",
    violet: "text-teal-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    slate: "text-slate-600",
  };
  return (
    <div className={`relative w-64 rounded-2xl border-2 ${tones[tone]} shadow-lg group`}>
      <Handle type="target" position={Position.Top} className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white" />
      <div className="px-3.5 py-2.5 border-b border-slate-200/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={tonesLabel[tone]}>{icon}</span>
          <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${tonesLabel[tone]}`}>{label}</span>
        </div>
        {onDelete && (
          <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-rose-500">
            <Trash2 size={11} />
          </button>
        )}
      </div>
      <div className="p-3.5">{children}</div>
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white" />
    </div>
  );
};

const CreatorNode: React.FC<NodeProps> = ({ data, id }) => {
  const d = data as unknown as CreatorNodeData & { onDelete?: (id: string) => void };
  return (
    <NodeShell tone="violet" icon={<Users size={12} strokeWidth={2.5} />} label={`Creator · ${d.platform}`} onDelete={() => d.onDelete?.(id)}>
      <p className="font-serif font-bold text-base text-slate-900 leading-tight">@{d.handle}</p>
      {d.videoCount != null && <p className="text-[10px] text-slate-500 mt-1">{d.videoCount} videos tracked</p>}
    </NodeShell>
  );
};

const VideoNode: React.FC<NodeProps> = ({ data, id }) => {
  const d = data as unknown as VideoNodeData & { onDelete?: (id: string) => void };
  return (
    <NodeShell tone="teal" icon={<Eye size={12} strokeWidth={2.5} />} label="Video" onDelete={() => d.onDelete?.(id)}>
      {d.thumbnailUrl && (
        <a href={d.videoUrl} target="_blank" rel="noopener" className="block rounded-lg overflow-hidden bg-black mb-2">
          <img src={d.thumbnailUrl} alt="" className="w-full aspect-[9/16] object-cover" loading="lazy" />
        </a>
      )}
      <p className="text-[12px] font-semibold text-slate-900 leading-snug line-clamp-2">{d.title}</p>
      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-500">
        <span>@{d.creator}</span>
        {d.outlierScore != null && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">{d.outlierScore}x</span>}
      </div>
    </NodeShell>
  );
};

const IdeaNode: React.FC<NodeProps> = ({ data, id }) => {
  const d = data as unknown as IdeaNodeData & {
    onDelete?: (id: string) => void;
    onEdit?: (id: string, newTopic: string) => void;
    isEditing?: boolean;
    onStartEdit?: (id: string) => void;
    onStopEdit?: () => void;
  };
  const [draft, setDraft] = useState(d.topic);
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    if (d.isEditing) {
      setDraft(d.topic);
      // Focus + select after render
      requestAnimationFrame(() => {
        taRef.current?.focus();
        taRef.current?.select();
      });
    }
  }, [d.isEditing, d.topic]);

  const commit = () => {
    const v = draft.trim();
    if (v && v !== d.topic) d.onEdit?.(id, v);
    d.onStopEdit?.();
  };

  const cancel = () => {
    setDraft(d.topic);
    d.onStopEdit?.();
  };

  return (
    <NodeShell tone="amber" icon={<Sparkles size={12} strokeWidth={2.5} />} label="Idea" onDelete={() => d.onDelete?.(id)}>
      {d.isEditing ? (
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
            // Stop ReactFlow keyboard shortcuts (G, L, etc.) from firing while typing
            e.stopPropagation();
          }}
          rows={3}
          placeholder="Type your idea…"
          className="w-full px-2 py-1.5 rounded-lg bg-white border border-amber-300 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none nodrag"
          style={{ minHeight: 60 }}
        />
      ) : (
        <p
          onDoubleClick={(e) => {
            e.stopPropagation();
            d.onStartEdit?.(id);
          }}
          className="font-semibold text-sm text-slate-900 leading-snug cursor-text"
          title="Double-click to edit"
        >
          {d.topic || <span className="text-slate-400 italic">empty idea</span>}
        </p>
      )}
      {(d.format || d.priority) && !d.isEditing && (
        <div className="flex gap-1.5 mt-2">
          {d.format && <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 font-bold">{d.format}</span>}
          {d.priority && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase tracking-wider">{d.priority}</span>}
        </div>
      )}
    </NodeShell>
  );
};

const ScriptNode: React.FC<NodeProps> = ({ data, id }) => {
  const d = data as unknown as ScriptNodeData & { onDelete?: (id: string) => void; onExpand?: (id: string) => void; shipped?: string };
  return (
    <NodeShell tone="rose" icon={<FileText size={12} strokeWidth={2.5} />} label={`Script · ${d.format}`} onDelete={() => d.onDelete?.(id)}>
      <p className="font-serif font-bold text-sm text-slate-900 leading-tight line-clamp-2 mb-2">{d.title}</p>
      {d.hook && <p className="text-[11px] italic text-slate-600 leading-snug line-clamp-2 mb-2">"{d.hook}"</p>}
      <pre className="text-[10px] text-slate-700 whitespace-pre-wrap line-clamp-3 leading-snug mb-2">{d.script}</pre>
      <button
        onClick={(e) => { e.stopPropagation(); d.onExpand?.(id); }}
        className="w-full mt-2 px-3 py-1.5 rounded-full bg-rose-600 text-white text-[9px] font-black uppercase tracking-widest hover:bg-rose-700 transition-colors flex items-center justify-center gap-1.5"
      >
        <ArrowRight size={10} /> Open Script
      </button>
      {d.complianceScore != null && (
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Blueprint</span>
          <span className={`text-[10px] font-black tabular-nums ${d.complianceScore >= 80 ? "text-emerald-600" : d.complianceScore >= 60 ? "text-amber-600" : "text-rose-600"}`}>
            {d.complianceScore}/100
          </span>
        </div>
      )}
      {d.shipped && (
        <div className="mt-2 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700">Shipped</span>
          <span className="text-[10px] font-black text-emerald-700">{d.shipped}</span>
        </div>
      )}
    </NodeShell>
  );
};

const BRollNode: React.FC<NodeProps> = ({ data, id }) => {
  const d = data as unknown as BRollNodeData & { onDelete?: (id: string) => void };
  return (
    <NodeShell tone="violet" icon={<Eye size={12} strokeWidth={2.5} />} label={`B-Roll · Shot ${d.shotIndex + 1}`} onDelete={() => d.onDelete?.(id)}>
      {d.imageUrl ? (
        <a href={d.imageUrl} target="_blank" rel="noopener" className="block rounded-lg overflow-hidden bg-black mb-2 hover:opacity-90 transition-opacity relative">
          <img src={d.imageUrl} alt={d.prompt} className="w-full aspect-[9/16] object-cover" loading="lazy" />
          {d.modelDisplay && (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[8px] font-black uppercase tracking-widest backdrop-blur-sm">
              {d.modelDisplay}
            </span>
          )}
        </a>
      ) : (
        <div className="rounded-lg overflow-hidden bg-teal-100 mb-2 aspect-[9/16] flex items-center justify-center text-teal-700">
          {d.status === "pending" ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600">Failed</span>
          )}
        </div>
      )}
      {typeof d.second === "number" && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-teal-700">{d.second}s in script</span>
          {d.creditsExact != null && (
            <span className="text-[9px] font-bold text-slate-500 tabular-nums">{d.creditsExact.toFixed(2).replace(/\.?0+$/, "")} cr</span>
          )}
        </div>
      )}
      <p className="text-[11px] font-semibold text-slate-900 leading-snug line-clamp-2">{d.shotDescription || d.title}</p>
      {d.textOverlay && <p className="text-[10px] italic text-teal-700 mt-1 line-clamp-1">"{d.textOverlay}"</p>}
    </NodeShell>
  );
};

const SourceNode: React.FC<NodeProps> = ({ data, id }) => {
  const d = data as unknown as SourceNodeData & { onDelete?: (id: string) => void };
  return (
    <NodeShell tone="slate" icon={<Link2 size={12} strokeWidth={2.5} />} label={d.sourceType === "url" ? "URL Source" : "Text Source"} onDelete={() => d.onDelete?.(id)}>
      <p className="text-[11px] text-slate-700 leading-snug line-clamp-4 break-words">{d.source}</p>
    </NodeShell>
  );
};

const BRollVideoNode: React.FC<NodeProps> = ({ data, id }) => {
  const d = data as unknown as BRollVideoNodeData & { onDelete?: (id: string) => void };
  return (
    <NodeShell tone="rose" icon={<Eye size={12} strokeWidth={2.5} />} label={`Video Clip · ${d.duration}s`} onDelete={() => d.onDelete?.(id)}>
      {d.videoUrl ? (
        <div className="block rounded-lg overflow-hidden bg-black mb-2 relative">
          <video
            src={d.videoUrl}
            controls
            playsInline
            loop
            className="w-full aspect-[9/16] object-cover"
            poster={d.sourceImageUrl}
          />
          {d.modelDisplay && (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-white text-[8px] font-black uppercase tracking-widest backdrop-blur-sm">
              {d.modelDisplay}
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden bg-rose-100 mb-2 aspect-[9/16] flex items-center justify-center text-rose-700 relative">
          {d.sourceImageUrl && (
            <img src={d.sourceImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          {d.status === "pending" ? (
            <div className="relative z-10 flex flex-col items-center gap-1.5">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-[9px] font-black uppercase tracking-widest text-rose-700">Animating…</span>
            </div>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600 relative z-10">{d.error || "Failed"}</span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-black uppercase tracking-widest text-rose-700">{d.duration}s clip</span>
        {d.creditsExact != null && (
          <span className="text-[9px] font-bold text-slate-500 tabular-nums">{d.creditsExact.toFixed(2).replace(/\.?0+$/, "")} cr</span>
        )}
      </div>
      <p className="text-[10px] text-slate-600 leading-snug line-clamp-2" title={d.prompt}>{d.prompt}</p>
    </NodeShell>
  );
};

const nodeTypes: import("@xyflow/react").NodeTypes = {
  creator: CreatorNode as React.ComponentType<unknown> as never,
  video: VideoNode as React.ComponentType<unknown> as never,
  idea: IdeaNode as React.ComponentType<unknown> as never,
  script: ScriptNode as React.ComponentType<unknown> as never,
  source: SourceNode as React.ComponentType<unknown> as never,
  broll: BRollNode as React.ComponentType<unknown> as never,
  brollVideo: BRollVideoNode as React.ComponentType<unknown> as never,
};

// ── Main canvas ──────────────────────────────────────────────────────────────

const initialNodes: Node[] = [
  {
    id: "intro",
    type: "idea",
    position: { x: 250, y: 50 },
    data: { kind: "idea", topic: "Drop creators, ideas, and URLs from the left drawer onto the canvas. Connect nodes by dragging from a handle. Right-click anywhere for canvas actions, or select nodes and click Generate Script.", priority: "TIP" },
  },
];

const initialEdges: Edge[] = [];

type ContextMenuState =
  | { kind: "node"; x: number; y: number; nodeId: string }
  | { kind: "pane"; x: number; y: number; flowX: number; flowY: number }
  | null;

const CANVAS_STATE_KEY = "ce-canvas-state-v1";

const CanvasInner: React.FC<CanvasViewProps> = ({ onNavigate }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [activePanel, setActivePanel] = useState<"creators" | "videos" | "ideas" | "source">("creators");
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [expandedScript, setExpandedScript] = useState<FullConvertResult | null>(null);
  const [expandedScriptNodeId, setExpandedScriptNodeId] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [bRollPreflightNodeId, setBRollPreflightNodeId] = useState<string | null>(null);
  const [animatePreflightNodeId, setAnimatePreflightNodeId] = useState<string | null>(null);
  const [charactersOpen, setCharactersOpen] = useState(false);
  const [storytellingOpen, setStorytellingOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const cursorScreenRef = React.useRef<{ x: number; y: number }>({ x: 400, y: 300 });
  const rf = useReactFlow();

  // Data sources
  const { data: outlierVideosData } = useQuery<{ videos: CreatorVideo[] }>({
    queryKey: ["canvas-outlier-videos"],
    queryFn: () => fetch("/api/creator-videos?sort=outlierScore&limit=20").then((r) => r.json()),
  });

  const { data: creatorsData } = useQuery<Array<{ id: number; handle: string; platform: string }>>({
    queryKey: ["canvas-creators"],
    queryFn: () => fetch("/api/creator-videos/blowing-up/creators").then((r) => r.json()),
  });

  const { data: ideasData } = useQuery<{ ideas: Idea[] }>({
    queryKey: ["canvas-ideas"],
    queryFn: () => fetch("/api/ideas").then((r) => r.json()),
  });

  const { data: digestData } = useQuery<{ digest: IntelDigest | null }>({
    queryKey: ["canvas-digest"],
    queryFn: () => fetch("/api/viral-insights/latest").then((r) => r.json()),
  });

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: "#0d9488", strokeWidth: 2 } }, eds)),
    [setEdges],
  );

  const handleDeleteNode = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges],
  );

  const handleExpandScript = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      const d = node.data as unknown as ScriptNodeData;
      if (d.full) {
        setExpandedScript(d.full);
        setExpandedScriptNodeId(id);
      }
    },
    [nodes],
  );

  // ── Inline editing of Idea nodes ───────────────────────────────────────────
  const startEditNode = useCallback((id: string) => setEditingNodeId(id), []);
  const stopEditNode = useCallback(() => setEditingNodeId(null), []);
  const commitNodeEdit = useCallback(
    (id: string, newTopic: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, topic: newTopic } } : n,
        ),
      );
    },
    [setNodes],
  );

  // Add a node helper — declared early so other helpers can reference it
  const addNode = useCallback(
    (
      type: keyof typeof nodeTypes,
      data: CanvasNodeData,
      opts?: { position?: { x: number; y: number }; edit?: boolean; id?: string },
    ): string => {
      const id = opts?.id || `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const position = opts?.position || { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 };
      setNodes((nds) => [
        ...nds,
        {
          id,
          type,
          position,
          data: {
            ...data,
            onDelete: handleDeleteNode,
            onExpand: handleExpandScript,
            onEdit: commitNodeEdit,
            onStartEdit: startEditNode,
            onStopEdit: stopEditNode,
          },
        },
      ]);
      if (opts?.edit) {
        // Defer to next tick so the node is mounted before we mark it as editing
        setTimeout(() => setEditingNodeId(id), 0);
      }
      return id;
    },
    [setNodes, handleDeleteNode, handleExpandScript, commitNodeEdit, startEditNode, stopEditNode],
  );

  // Spawn an empty editable idea node at the canvas position (or last cursor)
  const spawnIdeaAtCursor = useCallback(
    (screenX?: number, screenY?: number) => {
      const x = screenX ?? cursorScreenRef.current.x;
      const y = screenY ?? cursorScreenRef.current.y;
      let pos = { x: 200, y: 200 };
      try {
        pos = rf.screenToFlowPosition({ x, y });
      } catch {
        /* fallback */
      }
      addNode(
        "idea",
        { kind: "idea", topic: "", priority: "Draft" },
        { position: pos, edit: true },
      );
    },
    [rf, addNode],
  );

  // ── Node duplicate ─────────────────────────────────────────────────────────
  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const newId = `${node.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setNodes((nds) => [
        ...nds,
        { ...node, id: newId, position: { x: node.position.x + 40, y: node.position.y + 40 }, selected: false },
      ]);
    },
    [nodes, setNodes],
  );

  // ── Copy node content to clipboard ─────────────────────────────────────────
  const copyNodeContent = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const d = node.data as unknown as CanvasNodeData;
      let text = "";
      if (d.kind === "creator") text = `@${d.handle} (${d.platform})`;
      else if (d.kind === "video") text = `${d.title}\n${d.videoUrl}`;
      else if (d.kind === "idea") text = d.topic;
      else if (d.kind === "script") text = d.script;
      else if (d.kind === "source") text = d.source;
      if (text) navigator.clipboard.writeText(text);
    },
    [nodes],
  );

  // ── Auto-arrange: tier nodes by kind into columns ──────────────────────────
  const autoArrange = useCallback(() => {
    const TIER: Record<CanvasNodeData["kind"], number> = {
      creator: 0,
      source: 0,
      video: 1,
      idea: 2,
      script: 3,
      broll: 4,
      brollVideo: 5,
    };
    const tiers: Record<number, Node[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [] };
    nodes.forEach((n) => {
      const k = (n.data as unknown as CanvasNodeData).kind;
      tiers[TIER[k]].push(n);
    });
    const X_GAP = 320;
    const Y_GAP = 240;
    const updated: Node[] = [];
    Object.entries(tiers).forEach(([tierKey, tierNodes]) => {
      const x = 80 + parseInt(tierKey) * X_GAP;
      tierNodes.forEach((n, i) => {
        updated.push({ ...n, position: { x, y: 80 + i * Y_GAP } });
      });
    });
    setNodes(updated);
  }, [nodes, setNodes]);

  // ── Save / load canvas state ───────────────────────────────────────────────
  const saveCanvasState = useCallback(() => {
    try {
      // Strip handler functions before saving
      const serializableNodes = nodes.map((n) => {
        const { onDelete: _od, onExpand: _oe, ...rest } = n.data as Record<string, unknown>;
        return { ...n, data: rest };
      });
      localStorage.setItem(CANVAS_STATE_KEY, JSON.stringify({ nodes: serializableNodes, edges, savedAt: Date.now() }));
    } catch (e) {
      console.error("Failed to save canvas", e);
    }
  }, [nodes, edges]);

  // Restore canvas state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CANVAS_STATE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { nodes: Node[]; edges: Edge[] };
      if (parsed.nodes && parsed.nodes.length > 0) {
        // Re-inject handlers
        const restored = parsed.nodes.map((n) => ({
          ...n,
          data: {
            ...n.data,
            onDelete: handleDeleteNode,
            onExpand: handleExpandScript,
            onEdit: commitNodeEdit,
            onStartEdit: startEditNode,
            onStopEdit: stopEditNode,
          },
        }));
        setNodes(restored);
        setEdges(parsed.edges || []);
      }
    } catch (e) {
      console.error("Failed to restore canvas", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save on changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (nodes.length > 1 || edges.length > 0) saveCanvasState();
    }, 800);
    return () => clearTimeout(timer);
  }, [nodes, edges, saveCanvasState]);

  // ── Paste at cursor from clipboard ─────────────────────────────────────────
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length < 3) return;
      const trimmed = text.trim();
      const isUrl = /^https?:\/\//i.test(trimmed);
      addNode("source", {
        kind: "source",
        source: trimmed,
        sourceType: isUrl ? "url" : "text",
      });
    } catch (e) {
      console.error("Clipboard read failed", e);
      window.alert("Clipboard access denied. Use the Source panel instead.");
    }
  }, [addNode]);

  // ── Expand idea into format mutations (3 angles or all 7 formats) ──────────
  const expandIdeaMutations = useCallback(
    async (nodeId: string, mode: "angles" | "formats") => {
      const ideaNode = nodes.find((n) => n.id === nodeId);
      if (!ideaNode) return;
      const data = ideaNode.data as unknown as IdeaNodeData;
      if (!data.topic || data.topic.trim().length < 5) {
        window.alert("Idea is too short. Add more detail first.");
        return;
      }
      setGenerating(true);
      try {
        const res = await fetch("/api/idea-lab/mutate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: data.topic }),
        });
        if (!res.ok) throw new Error("Mutate failed");
        const body = (await res.json()) as {
          mutations: Array<{ format: string; formatName: string; adaptedTopic: string; adaptedHook: string; whyThisFormat: string }>;
        };
        const mutations = body.mutations || [];
        if (mutations.length === 0) {
          window.alert("No mutations returned. Try again.");
          return;
        }
        // For "angles" mode, pick top 3 by diversity (different first letters)
        const selected = mode === "angles" ? mutations.slice(0, 3) : mutations.slice(0, 7);
        const baseX = ideaNode.position.x + 320;
        const baseY = ideaNode.position.y - ((selected.length - 1) * 110) / 2;
        const newNodes: Node[] = selected.map((m, i) => {
          const id = `idea-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`;
          return {
            id,
            type: "idea",
            position: { x: baseX, y: baseY + i * 200 },
            data: {
              kind: "idea",
              topic: m.adaptedTopic,
              format: m.format,
              priority: "Variant",
              onDelete: handleDeleteNode,
              onExpand: handleExpandScript,
              onEdit: commitNodeEdit,
              onStartEdit: startEditNode,
              onStopEdit: stopEditNode,
            },
          };
        });
        const newEdges: Edge[] = newNodes.map((n) => ({
          id: `e-${nodeId}-${n.id}`,
          source: nodeId,
          target: n.id,
          animated: true,
          style: { stroke: "#fbbf24", strokeWidth: 2 },
        }));
        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
      } catch (e) {
        console.error("Mutate failed", e);
        window.alert("Could not expand idea. Try again in a moment.");
      } finally {
        setGenerating(false);
      }
    },
    [nodes, handleDeleteNode, handleExpandScript, commitNodeEdit, startEditNode, stopEditNode, setNodes, setEdges],
  );

  // ── Expand creator: fetch top videos and add as connected nodes ────────────
  const expandCreator = useCallback(
    async (nodeId: string) => {
      const creatorNode = nodes.find((n) => n.id === nodeId);
      if (!creatorNode) return;
      const data = creatorNode.data as unknown as CreatorNodeData;
      try {
        const res = await fetch(`/api/creator-videos?handle=${encodeURIComponent(data.handle)}&sort=outlierScore&limit=5`);
        if (!res.ok) throw new Error("Failed to fetch");
        const body = (await res.json()) as { videos?: CreatorVideo[] } | CreatorVideo[];
        const list: CreatorVideo[] = Array.isArray(body) ? body : body.videos || [];
        if (list.length === 0) {
          window.alert(`No tracked videos for @${data.handle}. Add some via the Discover Feed first.`);
          return;
        }
        const baseX = creatorNode.position.x + 320;
        const baseY = creatorNode.position.y - 100;
        const newNodes: Node[] = list.map((v, i) => {
          const id = `video-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`;
          return {
            id,
            type: "video",
            position: { x: baseX, y: baseY + i * 200 },
            data: {
              kind: "video",
              title: v.videoTitle || `@${v.creatorHandle}`,
              videoUrl: v.videoUrl || "",
              thumbnailUrl: v.thumbnailUrl,
              creator: v.creatorHandle,
              views: v.views ?? undefined,
              outlierScore: v.outlierScoreX100 ? v.outlierScoreX100 / 100 : undefined,
              onDelete: handleDeleteNode,
              onExpand: handleExpandScript,
            },
          };
        });
        const newEdges: Edge[] = newNodes.map((n) => ({
          id: `e-${nodeId}-${n.id}`,
          source: nodeId,
          target: n.id,
          animated: true,
          style: { stroke: "#a78bfa", strokeWidth: 2 },
        }));
        setNodes((nds) => [...nds, ...newNodes]);
        setEdges((eds) => [...eds, ...newEdges]);
      } catch (e) {
        console.error("Expand creator failed", e);
        window.alert(`Could not load videos for @${data.handle}`);
      }
    },
    [nodes, handleDeleteNode, handleExpandScript, setNodes, setEdges],
  );

  // ── Score a script's compliance in the background and patch the node ──────
  const scoreScript = useCallback(
    async (nodeId: string, full: FullConvertResult) => {
      try {
        const res = await fetch("/api/blueprint/check-compliance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: full.script,
            format: full.outputFormat,
            duration: parseInt(full.outputDuration) || undefined,
          }),
        });
        if (!res.ok) return;
        const score = await res.json();
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, complianceScore: score.total } } : n)),
        );
      } catch {
        /* silent fail */
      }
    },
    [setNodes],
  );

  // ── Spawn a new script child node from a /api/ingest/convert payload ──────
  const spawnScriptChild = useCallback(
    (parentId: string, parentNode: Node, data: {
      title: string;
      hookArchetype: string;
      hook: { visual: string; text: string; spoken: string; audio: string };
      script: string;
      shotList: Array<{ second: number; shot: string; action: string; textOverlay: string | null }>;
      cta: { type: string; phrasing: string; timing: string };
      caption: string;
      complianceNotes: string;
      outputFormat: string;
      outputLabel: string;
      outputDuration: string;
    }, edgeColor = "#fb7185"): { id: string; full: FullConvertResult } => {
      const full: FullConvertResult = {
        title: data.title,
        hookArchetype: data.hookArchetype,
        hook: data.hook,
        script: data.script,
        shotList: data.shotList || [],
        cta: data.cta,
        caption: data.caption,
        complianceNotes: data.complianceNotes,
        outputFormat: data.outputFormat,
        outputLabel: data.outputLabel,
        outputDuration: data.outputDuration,
      };
      const newId = `script-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const newNode: Node = {
        id: newId,
        type: "script",
        position: { x: parentNode.position.x + 320, y: parentNode.position.y + 80 + Math.random() * 100 },
        data: {
          kind: "script",
          title: data.title,
          hook: data.hook?.spoken,
          script: data.script,
          format: data.outputLabel || "Reel",
          full,
          onDelete: handleDeleteNode,
          onExpand: handleExpandScript,
          onEdit: commitNodeEdit,
          onStartEdit: startEditNode,
          onStopEdit: stopEditNode,
        },
      };
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [
        ...eds,
        { id: `e-${parentId}-${newId}`, source: parentId, target: newId, animated: true, style: { stroke: edgeColor, strokeWidth: 2 } },
      ]);
      // Auto-score in background (Phase 5)
      void scoreScript(newId, full);
      return { id: newId, full };
    },
    [setNodes, setEdges, handleDeleteNode, handleExpandScript, commitNodeEdit, startEditNode, stopEditNode, scoreScript],
  );

  // ── Refine the hook of an existing script to a specific archetype ─────────
  const refineHook = useCallback(
    async (nodeId: string, style: "question" | "myth_contrarian" | "statistic" | "story_emotional" | "pattern_interrupt" | "did_you_know") => {
      const scriptNode = nodes.find((n) => n.id === nodeId);
      if (!scriptNode) return;
      const data = scriptNode.data as unknown as ScriptNodeData;
      if (!data.full) return;
      setGenerating(true);
      try {
        const hookRes = await fetch("/api/idea-lab/rewrite-hook", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: data.full.title,
            currentHook: data.full.hook.spoken,
            style,
          }),
        });
        if (!hookRes.ok) throw new Error("Rewrite hook failed");
        const { hookLine } = (await hookRes.json()) as { hookLine: string };

        // Now ask convert to apply the new hook while keeping the body
        const convertRes = await fetch("/api/ingest/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: `Existing script (KEEP THE TOPIC AND BODY identical, only replace the hook with the new line below):\n\nTitle: ${data.full.title}\n\nOLD HOOK SPOKEN: "${data.full.hook.spoken}"\n\nNEW HOOK SPOKEN: "${hookLine}"\n\nOLD SCRIPT BODY:\n${data.full.script}\n\nGenerate a complete rewritten version that opens with the new hook but preserves all body content and CTA. Adjust visual/text overlay for the new hook only.`,
            outputFormat: data.full.outputFormat || "reel",
          }),
        });
        if (!convertRes.ok) throw new Error("Convert failed");
        const result = await convertRes.json();
        const { id: childId, full } = spawnScriptChild(nodeId, scriptNode, result, "#a78bfa");
        setExpandedScript(full);
        setExpandedScriptNodeId(childId);
      } catch (e) {
        console.error("Refine hook failed", e);
        window.alert("Could not refine hook. Try again.");
      } finally {
        setGenerating(false);
      }
    },
    [nodes, spawnScriptChild],
  );

  // ── Quick refine: apply a free-form instruction to a script ────────────────
  const quickRefine = useCallback(
    async (nodeId: string, instruction: string) => {
      const scriptNode = nodes.find((n) => n.id === nodeId);
      if (!scriptNode) return;
      const data = scriptNode.data as unknown as ScriptNodeData;
      if (!data.full) return;
      setGenerating(true);
      try {
        const res = await fetch("/api/ingest/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: `Refine this existing script with the user's instruction. KEEP THE TOPIC. Apply the instruction tightly. Return a complete rewritten version.\n\nTITLE: ${data.full.title}\n\nORIGINAL HOOK: "${data.full.hook.spoken}"\n\nORIGINAL SCRIPT:\n${data.full.script}\n\nUSER INSTRUCTION: "${instruction}"`,
            outputFormat: data.full.outputFormat || "reel",
          }),
        });
        if (!res.ok) throw new Error("Refine failed");
        const result = await res.json();
        const { id: childId, full } = spawnScriptChild(nodeId, scriptNode, result, "#0d9488");
        setExpandedScript(full);
        setExpandedScriptNodeId(childId);
      } catch (e) {
        console.error("Quick refine failed", e);
        window.alert("Could not refine. Try again.");
      } finally {
        setGenerating(false);
      }
    },
    [nodes, spawnScriptChild],
  );

  // ── Ship script to the production library (creates content-library entry + video_status) ──
  const shipToLibrary = useCallback(
    async (script: FullConvertResult, nodeId: string | null): Promise<{ code: string } | null> => {
      try {
        // Map the canvas format to a library Format letter (A-G) and pick a sensible audience
        const FORMAT_TO_LETTER: Record<string, string> = {
          reel: "A",
          tiktok: "F",
          short: "A",
          carousel: "B",
          long: "E",
        };
        const formatLetter = FORMAT_TO_LETTER[script.outputFormat] || "A";

        const res = await fetch("/api/ideas/start-production", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: script.title,
            format: formatLetter,
            audience: "general",
            hookAngle: script.hook.spoken,
            hookPattern: script.hookArchetype,
            source: "Canvas Ideation",
            generatedScript: script.script,
            targetPlatform: script.outputLabel,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          window.alert(`Ship failed: ${err.error || res.statusText}`);
          return null;
        }
        const data = (await res.json()) as { code?: string };
        if (data.code && nodeId) {
          // Tag the script node as shipped
          setNodes((nds) =>
            nds.map((n) =>
              n.id === nodeId ? { ...n, data: { ...n.data, shipped: data.code } } : n,
            ),
          );
        }
        return data.code ? { code: data.code } : null;
      } catch (e) {
        console.error("Ship failed", e);
        window.alert(`Ship failed: ${e instanceof Error ? e.message : String(e)}`);
        return null;
      }
    },
    [setNodes],
  );

  // ── Auto-fix to pass blueprint compliance ──────────────────────────────────
  const autoFixCompliance = useCallback(
    async (nodeId: string, maxIterations = 2) => {
      let scriptNode = nodes.find((n) => n.id === nodeId);
      if (!scriptNode) return;
      let data = scriptNode.data as unknown as ScriptNodeData;
      if (!data.full) return;
      setGenerating(true);
      try {
        for (let i = 0; i < maxIterations; i++) {
          const scoreRes = await fetch("/api/blueprint/check-compliance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              script: data.full!.script,
              format: data.full!.outputFormat,
              duration: parseInt(data.full!.outputDuration) || undefined,
            }),
          });
          if (!scoreRes.ok) throw new Error("Compliance check failed");
          const score = (await scoreRes.json()) as { total: number; passing: boolean; fixes: string[]; verdict: string };

          // Patch current node with score
          setNodes((nds) =>
            nds.map((n) => (n.id === scriptNode!.id ? { ...n, data: { ...n.data, complianceScore: score.total } } : n)),
          );

          if (score.passing) {
            window.alert(`Compliance passed: ${score.total}/100 (${score.verdict})`);
            break;
          }

          // Apply fixes and regenerate
          const fixesText = score.fixes.map((f, idx) => `${idx + 1}. ${f}`).join("\n");
          const fixRes = await fetch("/api/ingest/convert", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source: `Apply these blueprint compliance fixes to the script below. KEEP THE TOPIC. Apply every fix.\n\nFIXES TO APPLY:\n${fixesText}\n\nCURRENT SCORE: ${score.total}/100\n\nORIGINAL TITLE: ${data.full!.title}\n\nORIGINAL SCRIPT:\n${data.full!.script}`,
              outputFormat: data.full!.outputFormat || "reel",
            }),
          });
          if (!fixRes.ok) throw new Error("Fix attempt failed");
          const fixed = await fixRes.json();
          const { id: newId, full } = spawnScriptChild(scriptNode!.id, scriptNode!, fixed, "#10b981");
          // Move pointer to new child for next iteration
          scriptNode = { ...scriptNode!, id: newId, position: { x: scriptNode!.position.x + 320, y: scriptNode!.position.y + 80 } };
          data = { kind: "script", title: full.title, script: full.script, format: full.outputLabel, full } as ScriptNodeData;
          setExpandedScript(full);
          setExpandedScriptNodeId(newId);
        }
      } catch (e) {
        console.error("Auto-fix failed", e);
        window.alert("Could not auto-fix. Try again.");
      } finally {
        setGenerating(false);
      }
    },
    [nodes, setNodes, spawnScriptChild],
  );

  // ── Regenerate script as different format ──────────────────────────────────
  const regenerateScriptAs = useCallback(
    async (nodeId: string, format: "reel" | "tiktok" | "short" | "carousel" | "long") => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const data = node.data as unknown as ScriptNodeData;
      if (!data.full) return;
      setGenerating(true);
      try {
        const res = await fetch("/api/ingest/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source: `Original script title: ${data.full.title}\n\nOriginal hook: "${data.full.hook.spoken}"\n\nOriginal script:\n${data.full.script}\n\nAdapt this for the new format while keeping the topic identical.`,
            outputFormat: format,
          }),
        });
        if (!res.ok) throw new Error("Regen failed");
        const result = await res.json();
        const full: FullConvertResult = {
          title: result.title,
          hookArchetype: result.hookArchetype,
          hook: result.hook,
          script: result.script,
          shotList: result.shotList || [],
          cta: result.cta,
          caption: result.caption,
          complianceNotes: result.complianceNotes,
          outputFormat: result.outputFormat,
          outputLabel: result.outputLabel,
          outputDuration: result.outputDuration,
        };
        const newId = `script-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const newNode: Node = {
          id: newId,
          type: "script",
          position: { x: node.position.x + 280, y: node.position.y },
          data: {
            kind: "script",
            title: result.title,
            hook: result.hook?.spoken,
            script: result.script,
            format: result.outputLabel || format,
            full,
            onDelete: handleDeleteNode,
            onExpand: handleExpandScript,
          },
        };
        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [
          ...eds,
          { id: `e-${nodeId}-${newId}`, source: nodeId, target: newId, animated: true, style: { stroke: "#fb7185", strokeWidth: 2 } },
        ]);
        setExpandedScript(full);
        setExpandedScriptNodeId(newId);
        void scoreScript(newId, full);
      } catch (e) {
        console.error("Regenerate failed", e);
        window.alert("Could not regenerate. Try again.");
      } finally {
        setGenerating(false);
      }
    },
    [nodes, handleDeleteNode, handleExpandScript, setNodes, setEdges],
  );

  // ── Generate Higgsfield B-Roll Pack from a Script node's shotList ──────────
  // Step 1: open preflight (set pendingBRollScriptId). Step 2: preflight confirm fires runBRollGeneration with the user's model+resolution.
  const runBRollGeneration = useCallback(
    async (nodeId: string, selection: {
      modelKey: string;
      aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
      resolution?: string;
      quality?: string;
    }) => {
      const scriptNode = nodes.find((n) => n.id === nodeId);
      if (!scriptNode) return;
      const data = scriptNode.data as unknown as ScriptNodeData;
      if (!data.full || !data.full.shotList || data.full.shotList.length === 0) {
        window.alert("This script has no shot list to render.");
        return;
      }
      setGenerating(true);
      try {
        const shotsToRender = data.full.shotList.slice(0, 6);
        const baseX = scriptNode.position.x + 340;
        const baseY = scriptNode.position.y - ((shotsToRender.length - 1) * 210) / 2;

        const placeholderIds: string[] = shotsToRender.map(
          (_, i) => `broll-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 5)}`,
        );
        const placeholderNodes: Node[] = shotsToRender.map((shot, i) => ({
          id: placeholderIds[i],
          type: "broll",
          position: { x: baseX, y: baseY + i * 210 },
          data: {
            kind: "broll",
            title: `Shot ${i + 1}`,
            imageUrl: null,
            prompt: "",
            shotIndex: i,
            second: shot.second,
            shotDescription: shot.action || shot.shot,
            textOverlay: shot.textOverlay,
            status: "pending" as const,
            onDelete: handleDeleteNode,
          },
        }));
        const placeholderEdges: Edge[] = placeholderIds.map((id) => ({
          id: `e-${nodeId}-${id}`,
          source: nodeId,
          target: id,
          animated: true,
          style: { stroke: "#8b5cf6", strokeWidth: 2 },
        }));
        setNodes((nds) => [...nds, ...placeholderNodes]);
        setEdges((eds) => [...eds, ...placeholderEdges]);

        const res = await fetch("/api/higgsfield/generate-broll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shotList: data.full.shotList,
            scriptCtx: {
              title: data.full.title,
              hookSpoken: data.full.hook.spoken,
              hookVisual: data.full.hook.visual,
              audience: undefined,
              format: data.full.outputLabel,
            },
            modelKey: selection.modelKey,
            aspectRatio: selection.aspectRatio,
            resolution: selection.resolution,
            quality: selection.quality,
            maxShots: 6,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "B-Roll generation failed");
        }
        const body = (await res.json()) as {
          results: Array<{
            shotIndex: number;
            imageUrl: string | null;
            prompt: string;
            status: "completed" | "failed";
            error?: string;
            second?: number;
            shot?: string;
            action?: string;
            textOverlay?: string | null;
            modelKey?: string;
            modelDisplay?: string;
            creditsExact?: number;
          }>;
        };

        // Patch each placeholder with the real result
        body.results.forEach((r, i) => {
          const placeholderId = placeholderIds[i];
          if (!placeholderId) return;
          setNodes((nds) =>
            nds.map((n) =>
              n.id === placeholderId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      imageUrl: r.imageUrl,
                      prompt: r.prompt,
                      status: r.status,
                      error: r.error,
                      modelKey: r.modelKey,
                      modelDisplay: r.modelDisplay,
                      creditsExact: r.creditsExact,
                    },
                  }
                : n,
            ),
          );
        });
      } catch (e) {
        console.error("Generate B-Roll failed", e);
        window.alert(`Could not generate B-Roll: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setGenerating(false);
      }
    },
    [nodes, handleDeleteNode, setNodes, setEdges],
  );

  // ── Animate a B-Roll image into a Seedance / Kling / Veo motion clip ──────
  const runAnimateBRoll = useCallback(
    async (brollNodeId: string, selection: {
      modelKey: string;
      aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
      resolution?: string;
      quality?: string;
      duration?: number;
      genre?: string;
    }) => {
      const brollNode = nodes.find((n) => n.id === brollNodeId);
      if (!brollNode) return;
      const data = brollNode.data as unknown as BRollNodeData;
      if (!data.imageUrl) {
        window.alert("This B-Roll image hasn't finished generating yet.");
        return;
      }

      // Drop a placeholder brollVideo node connected to the source image
      const videoId = `brollVideo-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      const newNode: Node = {
        id: videoId,
        type: "brollVideo",
        position: { x: brollNode.position.x + 320, y: brollNode.position.y },
        data: {
          kind: "brollVideo",
          title: data.title,
          videoUrl: null,
          sourceImageUrl: data.imageUrl,
          prompt: "",
          duration: selection.duration ?? 5,
          status: "pending" as const,
          onDelete: handleDeleteNode,
        },
      };
      const newEdge: Edge = {
        id: `e-${brollNodeId}-${videoId}`,
        source: brollNodeId,
        target: videoId,
        animated: true,
        style: { stroke: "#f43f5e", strokeWidth: 2 },
      };
      setNodes((nds) => [...nds, newNode]);
      setEdges((eds) => [...eds, newEdge]);

      // Mark the source image as animated
      setNodes((nds) =>
        nds.map((n) =>
          n.id === brollNodeId
            ? { ...n, data: { ...n.data, animatedVideoNodeId: videoId } }
            : n,
        ),
      );

      try {
        setGenerating(true);
        const res = await fetch("/api/higgsfield/animate-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: data.imageUrl,
            sourceImagePrompt: data.prompt,
            shot: {
              second: data.second,
              shot: data.shotDescription,
              action: data.shotDescription,
              textOverlay: data.textOverlay,
            },
            modelKey: selection.modelKey,
            aspectRatio: selection.aspectRatio,
            duration: selection.duration,
            resolution: selection.resolution,
            genre: selection.genre,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || "Animate failed");
        }
        const body = await res.json() as {
          videoUrl: string;
          prompt: string;
          modelKey: string;
          modelDisplay: string;
          creditsExact: number;
          duration: number;
        };
        setNodes((nds) =>
          nds.map((n) =>
            n.id === videoId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    videoUrl: body.videoUrl,
                    prompt: body.prompt,
                    duration: body.duration,
                    modelKey: body.modelKey,
                    modelDisplay: body.modelDisplay,
                    creditsExact: body.creditsExact,
                    status: "completed",
                  },
                }
              : n,
          ),
        );
      } catch (e) {
        console.error("Animate failed", e);
        setNodes((nds) =>
          nds.map((n) =>
            n.id === videoId
              ? { ...n, data: { ...n.data, status: "failed", error: e instanceof Error ? e.message : String(e) } }
              : n,
          ),
        );
      } finally {
        setGenerating(false);
      }
    },
    [nodes, handleDeleteNode, setNodes, setEdges],
  );

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable;
      if (isEditable) return;

      const cmd = e.metaKey || e.ctrlKey;

      // ⌘V — paste at cursor (always allow, even in editable, since browser handles)
      // (we only handle when not editable to avoid double-paste)
      if (cmd && e.key === "v") {
        e.preventDefault();
        handlePasteFromClipboard();
        return;
      }

      // ⌘A — select all
      if (cmd && e.key === "a") {
        e.preventDefault();
        setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
        setSelectedNodes(new Set(nodes.map((n) => n.id)));
        return;
      }

      // ⌘S — save canvas
      if (cmd && e.key === "s") {
        e.preventDefault();
        saveCanvasState();
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 1500);
        return;
      }

      // ⌘D — duplicate selected
      if (cmd && e.key === "d") {
        e.preventDefault();
        selectedNodes.forEach((id) => duplicateNode(id));
        return;
      }

      // Delete / Backspace — delete selected
      if ((e.key === "Delete" || e.key === "Backspace") && selectedNodes.size > 0) {
        e.preventDefault();
        const toDelete = Array.from(selectedNodes);
        setNodes((nds) => nds.filter((n) => !selectedNodes.has(n.id)));
        setEdges((eds) => eds.filter((ed) => !toDelete.includes(ed.source) && !toDelete.includes(ed.target)));
        setSelectedNodes(new Set());
        return;
      }

      // G — generate from selected
      if (e.key === "g" && selectedNodes.size > 0) {
        e.preventDefault();
        generateMutation.mutate();
        return;
      }

      // L — auto-arrange (layout)
      if (e.key === "l" && nodes.length > 1) {
        e.preventDefault();
        autoArrange();
        return;
      }

      // T — drop new editable idea node at cursor
      if (e.key === "t" && !cmd) {
        e.preventDefault();
        spawnIdeaAtCursor();
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, selectedNodes, handlePasteFromClipboard, saveCanvasState, duplicateNode, autoArrange]);

  // Track selection
  const onSelectionChange = useCallback((params: { nodes: Node[] }) => {
    setSelectedNodes(new Set(params.nodes.map((n) => n.id)));
  }, []);

  // Build the canvas context from selected nodes and connected nodes
  const buildContextFromSelected = (): { context: string; urls: string[] } => {
    const selected = nodes.filter((n) => selectedNodes.has(n.id));
    const connected = new Set<string>(selected.map((n) => n.id));
    for (const e of edges) {
      if (selectedNodes.has(e.source)) connected.add(e.target);
      if (selectedNodes.has(e.target)) connected.add(e.source);
    }
    const allRelated = nodes.filter((n) => connected.has(n.id));
    const urls: string[] = [];
    const contextParts: string[] = [];

    for (const n of allRelated) {
      const d = n.data as unknown as CanvasNodeData;
      if (d.kind === "creator") {
        contextParts.push(`Creator: @${d.handle} on ${d.platform}`);
      } else if (d.kind === "video") {
        if (d.videoUrl && /^https?:\/\//i.test(d.videoUrl)) urls.push(d.videoUrl);
        contextParts.push(`Video on canvas: "${d.title}" by @${d.creator}${d.outlierScore != null ? ` · ${d.outlierScore}x outlier` : ""}`);
      } else if (d.kind === "idea") {
        contextParts.push(`Idea: ${d.topic}${d.format ? ` (Format ${d.format})` : ""}${d.priority ? ` [${d.priority}]` : ""}`);
      } else if (d.kind === "script") {
        contextParts.push(`Existing script: ${d.title}\n${d.script.slice(0, 500)}`);
      } else if (d.kind === "source") {
        if (d.sourceType === "url" && /^https?:\/\//i.test(d.source)) {
          urls.push(d.source);
        } else {
          contextParts.push(`User-provided source text:\n${d.source}`);
        }
      }
    }

    return { context: contextParts.join("\n\n"), urls };
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { context, urls } = buildContextFromSelected();
      if (!context && urls.length === 0) throw new Error("Select at least one node first");
      setGenerating(true);
      const res = await fetch("/api/ingest/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: context, sourceUrls: urls, outputFormat: "reel" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const detail = err.hint ? `${err.error}: ${err.hint}` : err.error || "Generation failed";
        throw new Error(detail);
      }
      return res.json();
    },
    onSuccess: (data) => {
      const full: FullConvertResult = {
        title: data.title,
        hookArchetype: data.hookArchetype,
        hook: data.hook,
        script: data.script,
        shotList: data.shotList || [],
        cta: data.cta,
        caption: data.caption,
        complianceNotes: data.complianceNotes,
        outputFormat: data.outputFormat,
        outputLabel: data.outputLabel,
        outputDuration: data.outputDuration,
        sourceUrls: data.sourceUrls,
        fetchResults: data.fetchResults,
        warnings: data.warnings,
      };
      const newId = addNode("script", {
        kind: "script",
        title: data.title,
        hook: data.hook?.spoken,
        script: data.script,
        format: data.outputLabel || "Reel",
        full,
      });
      setExpandedScript(full);
      setExpandedScriptNodeId(newId);
      setGenerating(false);
      // Phase 5: auto-score in background
      void scoreScript(newId, full);
    },
    onError: () => setGenerating(false),
  });

  // Drag-drop URL source
  const [urlInput, setUrlInput] = useState("");
  const addUrlSource = () => {
    if (!urlInput.trim()) return;
    addNode("source", {
      kind: "source",
      source: urlInput.trim(),
      sourceType: /^https?:\/\//i.test(urlInput.trim()) ? "url" : "text",
    });
    setUrlInput("");
  };

  return (
    <div className="h-[calc(100vh-64px)] md:h-[calc(100vh-32px)] flex">
      {/* Asset Drawer */}
      {drawerOpen && (
        <aside className="w-72 shrink-0 border-r border-slate-200 bg-white flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Asset Library</p>
              <p className="text-base font-serif font-bold text-slate-900">Drag to canvas</p>
            </div>
            <button onClick={() => setDrawerOpen(false)} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100">
              <X size={14} />
            </button>
          </div>

          {/* Panel tabs */}
          <div className="flex border-b border-slate-200">
            {([
              { key: "creators", label: "Creators", icon: <Users size={11} /> },
              { key: "videos", label: "Videos", icon: <Eye size={11} /> },
              { key: "ideas", label: "Ideas", icon: <Sparkles size={11} /> },
              { key: "source", label: "Source", icon: <Link2 size={11} /> },
            ] as const).map((p) => (
              <button
                key={p.key}
                onClick={() => setActivePanel(p.key)}
                className={`flex-1 px-2 py-2 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1 ${
                  activePanel === p.key ? "bg-slate-50 text-teal-700 border-b-2 border-teal-500" : "text-slate-500 hover:bg-slate-50"
                }`}
              >
                {p.icon} {p.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {activePanel === "creators" && (creatorsData || []).map((c) => (
              <button
                key={c.id}
                onClick={() => addNode("creator", { kind: "creator", handle: c.handle, platform: c.platform })}
                className="w-full text-left px-3 py-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">@{c.handle}</p>
                    <p className="text-[10px] text-slate-500">{c.platform}</p>
                  </div>
                  <Plus size={12} className="text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            ))}

            {activePanel === "videos" && (outlierVideosData?.videos || []).slice(0, 12).map((v) => (
              <button
                key={v.id}
                onClick={() =>
                  addNode("video", {
                    kind: "video",
                    title: v.videoTitle || `@${v.creatorHandle}`,
                    videoUrl: v.videoUrl || "",
                    thumbnailUrl: v.thumbnailUrl,
                    creator: v.creatorHandle,
                    views: v.views ?? undefined,
                    outlierScore: v.outlierScoreX100 ? v.outlierScoreX100 / 100 : undefined,
                  })
                }
                className="w-full text-left bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl overflow-hidden transition-colors group flex items-center gap-2"
              >
                {v.thumbnailUrl && (
                  <img src={v.thumbnailUrl} alt="" loading="lazy" className="w-14 h-20 object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0 p-2">
                  <p className="text-[11px] font-semibold text-slate-900 leading-snug line-clamp-2">{v.videoTitle || `@${v.creatorHandle}`}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-slate-500">
                    <span>@{v.creatorHandle}</span>
                    {v.outlierScoreX100 != null && (
                      <span className="px-1 rounded bg-amber-200 text-amber-800 font-bold">{(v.outlierScoreX100 / 100).toFixed(1)}x</span>
                    )}
                  </div>
                </div>
              </button>
            ))}

            {activePanel === "ideas" && (ideasData?.ideas || []).slice(0, 20).map((idea, i) => (
              <button
                key={i}
                onClick={() =>
                  addNode("idea", {
                    kind: "idea",
                    topic: idea.topic,
                    format: idea.suggestedFormat,
                    priority: idea.priority,
                  })
                }
                className="w-full text-left px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors group"
              >
                <p className="text-[12px] font-semibold text-slate-900 leading-snug">{idea.topic}</p>
                <div className="flex gap-1.5 mt-1">
                  {idea.suggestedFormat && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white text-teal-700 font-bold">{idea.suggestedFormat}</span>}
                  {idea.priority && <span className="text-[9px] px-1.5 py-0.5 rounded bg-white text-slate-700 font-bold uppercase tracking-wider">{idea.priority}</span>}
                </div>
              </button>
            ))}

            {activePanel === "source" && (
              <div className="space-y-3">
                <p className="text-[11px] text-slate-500 leading-relaxed px-1">Paste any URL (YouTube, blog, newsletter) or raw text. Add it as a source node, then connect it to creators/ideas before generating a script.</p>
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-1">Instagram tip</p>
                  <p className="text-[10px] text-amber-800 leading-relaxed">Instagram blocks server-side fetching. To use an IG post as source, first add it via the <strong>Discover Feed</strong> → that imports the caption via Xpoz. Or paste the post caption as text below.</p>
                </div>
                <textarea
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://... or paste text"
                  rows={4}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:border-teal-500 resize-none"
                />
                <button
                  onClick={addUrlSource}
                  disabled={!urlInput.trim()}
                  className="w-full px-3 py-2 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-40 transition-colors"
                >
                  Add Source to Canvas
                </button>
                {digestData?.digest && digestData.digest.trendingTopics.length > 0 && (
                  <div className="pt-3 border-t border-slate-200">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Trending</p>
                    <div className="flex flex-wrap gap-1.5">
                      {digestData.digest.trendingTopics.slice(0, 5).map((t, i) => (
                        <button
                          key={i}
                          onClick={() => addNode("idea", { kind: "idea", topic: t.topic, priority: "trending" })}
                          className="text-[10px] px-2 py-1 rounded-full bg-teal-50 text-teal-700 font-bold hover:bg-teal-100 transition-colors"
                        >
                          + {t.topic}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Canvas */}
      <div
        className="flex-1 relative"
        style={{ background: "#f8fafc" }}
        onMouseMove={(e) => {
          cursorScreenRef.current = { x: e.clientX, y: e.clientY };
        }}
        onDoubleClick={(e) => {
          // Only trigger if clicking directly on the pane background (not a node)
          const target = e.target as HTMLElement;
          if (target.classList.contains("react-flow__pane") || target.classList.contains("react-flow__viewport")) {
            spawnIdeaAtCursor(e.clientX, e.clientY);
          }
        }}
      >
        {!drawerOpen && (
          <div className="absolute top-4 left-4 z-10">
            <Button variant="secondary" onClick={() => setDrawerOpen(true)} icon={<Layers size={11} />}>
              Assets
            </Button>
          </div>
        )}

        {/* Floating action: generate */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {savedFlash && (
            <Pill variant="success" icon={<Check size={11} />} className="animate-in fade-in">
              Canvas Saved
            </Pill>
          )}
          <HiggsfieldCreditPill />
          <HiggsfieldCharacterChip onClick={() => setCharactersOpen(true)} />
          <Pill variant="info" icon={<Info size={11} />}>
            {selectedNodes.size} selected · {nodes.length} on canvas
          </Pill>
          <Button variant="secondary" tone="amber" onClick={() => spawnIdeaAtCursor()} icon={<Plus size={11} />} title="New idea · T">
            New Idea
          </Button>
          <Button variant="primary" tone="slate-dark" onClick={() => setStorytellingOpen(true)} icon={<Film size={11} />} title="Storytelling Reel Engine">
            Storytelling Reel
          </Button>
          <Button variant="secondary" onClick={autoArrange} disabled={nodes.length < 2} icon={<LayoutGrid size={11} />} title="Auto-arrange · L">
            Arrange
          </Button>
          <Button
            variant="primary"
            onClick={() => generateMutation.mutate()}
            disabled={selectedNodes.size === 0 || generating}
            icon={generating ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
            title="Generate · G"
          >
            Generate Script
          </Button>
        </div>

        {/* Keyboard shortcut hint (bottom left) */}
        <div className="absolute bottom-6 left-6 z-10 px-3 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200 text-[9px] text-slate-500 flex items-center gap-2.5 shadow-sm">
          <span><kbd className="px-1 py-0.5 bg-slate-100 rounded font-mono">T</kbd> new idea</span>
          <span><kbd className="px-1 py-0.5 bg-slate-100 rounded font-mono">G</kbd> generate</span>
          <span><kbd className="px-1 py-0.5 bg-slate-100 rounded font-mono">L</kbd> arrange</span>
          <span><kbd className="px-1 py-0.5 bg-slate-100 rounded font-mono">⌘V</kbd> paste</span>
          <span><kbd className="px-1 py-0.5 bg-slate-100 rounded font-mono">⌘S</kbd> save</span>
        </div>

        <ReactFlow
          nodes={useMemo(
            () => nodes.map((n) => (n.id === editingNodeId ? { ...n, data: { ...n.data, isEditing: true } } : n)),
            [nodes, editingNodeId],
          )}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          onSelectionChange={onSelectionChange}
          onNodeContextMenu={(event, node) => {
            event.preventDefault();
            const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
            setContextMenu({
              kind: "node",
              x: event.clientX - rect.left,
              y: event.clientY - rect.top,
              nodeId: node.id,
            });
          }}
          onPaneContextMenu={(event) => {
            event.preventDefault();
            const ev = event as React.MouseEvent;
            const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
            cursorScreenRef.current = { x: ev.clientX, y: ev.clientY };
            setContextMenu({
              kind: "pane",
              x: ev.clientX - rect.left,
              y: ev.clientY - rect.top,
              flowX: ev.clientX,
              flowY: ev.clientY,
            });
          }}
          onPaneClick={(e) => {
            setContextMenu(null);
            const me = e as unknown as MouseEvent;
            cursorScreenRef.current = { x: me.clientX, y: me.clientY };
          }}
          onNodeDoubleClick={(_, node) => {
            const d = node.data as unknown as CanvasNodeData;
            if (d.kind === "script") {
              const sd = d as ScriptNodeData;
              if (sd.full) setExpandedScript(sd.full);
            } else if (d.kind === "idea") {
              startEditNode(node.id);
            }
          }}
          onMoveStart={() => setContextMenu(null)}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} color="#cbd5e1" />
          <Controls className="!bg-white !border-slate-200 !shadow-md !rounded-xl" />
          <MiniMap
            className="!bg-white !border-slate-200 !rounded-xl"
            nodeColor={(n) => {
              const k = (n.data as unknown as CanvasNodeData).kind;
              return k === "creator" ? "#a78bfa"
                : k === "video" ? "#14b8a6"
                : k === "idea" ? "#fbbf24"
                : k === "script" ? "#fb7185"
                : k === "broll" ? "#8b5cf6"
                : k === "brollVideo" ? "#f43f5e"
                : "#94a3b8";
            }}
            maskColor="rgba(241, 245, 249, 0.6)"
          />
        </ReactFlow>

        {/* Canvas Context Menu */}
        {contextMenu && (
          <CanvasContextMenu
            state={contextMenu}
            onClose={() => setContextMenu(null)}
            nodes={nodes}
            edges={edges}
            selectedNodes={selectedNodes}
            onGenerateFromNode={(nodeId) => {
              setSelectedNodes(new Set([nodeId]));
              setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })));
              generateMutation.mutate();
              setContextMenu(null);
            }}
            onGenerateFromSelected={() => {
              generateMutation.mutate();
              setContextMenu(null);
            }}
            onDeleteNode={(nodeId) => {
              handleDeleteNode(nodeId);
              setContextMenu(null);
            }}
            onDuplicateNode={duplicateNode}
            onClearCanvas={() => {
              setNodes([]);
              setEdges([]);
              setSelectedNodes(new Set());
              setContextMenu(null);
              localStorage.removeItem(CANVAS_STATE_KEY);
            }}
            onAddIdea={() => {
              const x = (contextMenu as { kind: "pane"; flowX: number }).flowX || cursorScreenRef.current.x;
              const y = (contextMenu as { kind: "pane"; flowY: number }).flowY || cursorScreenRef.current.y;
              spawnIdeaAtCursor(x, y);
              setContextMenu(null);
            }}
            onAddSource={() => {
              const text = window.prompt("Paste URL or text:");
              if (text) addNode("source", { kind: "source", source: text, sourceType: /^https?:\/\//i.test(text) ? "url" : "text" });
              setContextMenu(null);
            }}
            onPasteAtCursor={() => {
              handlePasteFromClipboard();
              setContextMenu(null);
            }}
            onSelectAll={() => {
              setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
              setSelectedNodes(new Set(nodes.map((n) => n.id)));
              setContextMenu(null);
            }}
            onArrange={() => {
              autoArrange();
              setContextMenu(null);
            }}
            onSaveCanvas={() => {
              saveCanvasState();
              setContextMenu(null);
              setSavedFlash(true);
              setTimeout(() => setSavedFlash(false), 1500);
            }}
            onOpenUrl={(url) => {
              if (url) window.open(url, "_blank", "noopener");
              setContextMenu(null);
            }}
            onCopyNode={(nodeId) => {
              copyNodeContent(nodeId);
              setContextMenu(null);
            }}
            onExpandScript={(nodeId) => {
              handleExpandScript(nodeId);
              setContextMenu(null);
            }}
            onCheckCompliance={async (nodeId) => {
              setContextMenu(null);
              const scriptNode = nodes.find((n) => n.id === nodeId);
              if (!scriptNode) return;
              const data = scriptNode.data as unknown as ScriptNodeData;
              if (!data.full) return;
              try {
                const res = await fetch("/api/blueprint/check-compliance", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    script: data.full.script,
                    format: data.full.outputFormat,
                    duration: parseInt(data.full.outputDuration) || undefined,
                  }),
                });
                if (!res.ok) throw new Error("Compliance check failed");
                const score = await res.json();
                setNodes((nds) =>
                  nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, complianceScore: score.total } } : n)),
                );
                window.alert(`Blueprint score: ${score.total}/100 ${score.passing ? "✓ passing" : "below threshold"}\n\n${score.verdict}`);
              } catch (e) {
                console.error(e);
                window.alert("Compliance check failed.");
              }
            }}
            onRegenerateAs={(nodeId, format) => {
              regenerateScriptAs(nodeId, format);
              setContextMenu(null);
            }}
            onExpandCreator={(nodeId) => {
              expandCreator(nodeId);
              setContextMenu(null);
            }}
            onExpandIdea={(nodeId, mode) => {
              expandIdeaMutations(nodeId, mode);
              setContextMenu(null);
            }}
            onEditIdea={(nodeId) => {
              startEditNode(nodeId);
              setContextMenu(null);
            }}
            onRefineHook={(nodeId, style) => {
              refineHook(nodeId, style);
              setContextMenu(null);
            }}
            onAutoFix={(nodeId) => {
              autoFixCompliance(nodeId);
              setContextMenu(null);
            }}
            onGenerateBRoll={(nodeId) => {
              setBRollPreflightNodeId(nodeId);
              setContextMenu(null);
            }}
            onAnimateBRoll={(nodeId) => {
              setAnimatePreflightNodeId(nodeId);
              setContextMenu(null);
            }}
            onSelectConnected={(nodeId) => {
              const connected = new Set<string>([nodeId]);
              edges.forEach((e) => {
                if (e.source === nodeId) connected.add(e.target);
                if (e.target === nodeId) connected.add(e.source);
              });
              setSelectedNodes(connected);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: connected.has(n.id) })));
              setContextMenu(null);
            }}
          />
        )}

        {generateMutation.isError && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-rose-50 border border-rose-200 rounded-full text-xs font-semibold text-rose-700 shadow-md">
            {(generateMutation.error as Error).message}
          </div>
        )}

        {/* Script Expansion Drawer */}
        {expandedScript && (
          <ScriptDetailDrawer
            script={expandedScript}
            scriptNodeId={expandedScriptNodeId}
            complianceScore={
              expandedScriptNodeId
                ? ((nodes.find((n) => n.id === expandedScriptNodeId)?.data as unknown as ScriptNodeData)?.complianceScore ?? null)
                : null
            }
            onClose={() => {
              setExpandedScript(null);
              setExpandedScriptNodeId(null);
            }}
            onNavigate={onNavigate}
            onQuickRefine={quickRefine}
            onShip={shipToLibrary}
            refining={generating}
          />
        )}

        {/* Higgsfield B-Roll preflight modal */}
        {bRollPreflightNodeId && (() => {
          const scriptNode = nodes.find((n) => n.id === bRollPreflightNodeId);
          const data = scriptNode?.data as unknown as ScriptNodeData | undefined;
          const shotCount = Math.min(data?.full?.shotList?.length || 0, 6);
          return (
            <HiggsfieldPreflight
              open={true}
              onClose={() => setBRollPreflightNodeId(null)}
              useCase="broll"
              imageCount={shotCount}
              contextTitle={data?.full?.title || "B-Roll Pack"}
              onConfirm={(selection) => {
                const id = bRollPreflightNodeId;
                setBRollPreflightNodeId(null);
                if (id) void runBRollGeneration(id, selection);
              }}
              pending={generating}
            />
          );
        })()}

        {/* Higgsfield Characters panel */}
        <HiggsfieldCharactersPanel open={charactersOpen} onClose={() => setCharactersOpen(false)} />

        {/* Storytelling Reel Engine modal */}
        <StorytellingReelStarter open={storytellingOpen} onClose={() => setStorytellingOpen(false)} />

        {/* Higgsfield Animate-to-Video preflight modal */}
        {animatePreflightNodeId && (() => {
          const brollNode = nodes.find((n) => n.id === animatePreflightNodeId);
          const data = brollNode?.data as unknown as BRollNodeData | undefined;
          return (
            <HiggsfieldPreflight
              open={true}
              onClose={() => setAnimatePreflightNodeId(null)}
              useCase="video"
              imageCount={1}
              contextTitle={data?.shotDescription || data?.title || "Animate B-Roll"}
              onConfirm={(selection) => {
                const id = animatePreflightNodeId;
                setAnimatePreflightNodeId(null);
                if (id) void runAnimateBRoll(id, selection);
              }}
              pending={generating}
            />
          );
        })()}
      </div>
    </div>
  );
};

export const CanvasView: React.FC<CanvasViewProps> = (props) => (
  <ReactFlowProvider>
    <CanvasInner {...props} />
  </ReactFlowProvider>
);

// ── Context Menu ─────────────────────────────────────────────────────────────

type CanvasContextMenuProps = {
  state: ContextMenuState;
  onClose: () => void;
  nodes: Node[];
  edges: Edge[];
  selectedNodes: Set<string>;
  onGenerateFromNode: (nodeId: string) => void;
  onGenerateFromSelected: () => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
  onClearCanvas: () => void;
  onAddIdea: () => void;
  onAddSource: () => void;
  onPasteAtCursor: () => void;
  onSelectAll: () => void;
  onArrange: () => void;
  onSaveCanvas: () => void;
  onOpenUrl: (url: string) => void;
  onCopyNode: (nodeId: string) => void;
  onExpandScript: (nodeId: string) => void;
  onCheckCompliance: (nodeId: string) => void;
  onRegenerateAs: (nodeId: string, format: "reel" | "tiktok" | "short" | "carousel" | "long") => void;
  onExpandCreator: (nodeId: string) => void;
  onExpandIdea: (nodeId: string, mode: "angles" | "formats") => void;
  onEditIdea: (nodeId: string) => void;
  onRefineHook: (nodeId: string, style: "question" | "myth_contrarian" | "statistic" | "story_emotional" | "pattern_interrupt" | "did_you_know") => void;
  onAutoFix: (nodeId: string) => void;
  onGenerateBRoll: (nodeId: string) => void;
  onAnimateBRoll: (nodeId: string) => void;
  onSelectConnected: (nodeId: string) => void;
};

const CanvasContextMenu: React.FC<CanvasContextMenuProps> = ({
  state,
  onClose,
  nodes,
  edges,
  selectedNodes,
  onGenerateFromNode,
  onGenerateFromSelected,
  onDeleteNode,
  onDuplicateNode,
  onClearCanvas,
  onAddIdea,
  onAddSource,
  onPasteAtCursor,
  onSelectAll,
  onArrange,
  onSaveCanvas,
  onOpenUrl,
  onCopyNode,
  onExpandScript,
  onCheckCompliance,
  onRegenerateAs,
  onExpandCreator,
  onExpandIdea,
  onEditIdea,
  onRefineHook,
  onAutoFix,
  onGenerateBRoll,
  onAnimateBRoll,
  onSelectConnected,
}) => {
  const [submenuOpen, setSubmenuOpen] = useState<"format" | "hook" | null>(null);

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!state) return null;

  const isNode = state.kind === "node";
  const node = isNode ? nodes.find((n) => n.id === state.nodeId) : null;
  const data = node ? (node.data as unknown as CanvasNodeData) : null;
  const selectedCount = selectedNodes.size;
  const connectedCount = isNode
    ? edges.filter((e) => e.source === state.nodeId || e.target === state.nodeId).length
    : 0;

  return (
    <div
      className="absolute z-50 min-w-[240px] bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 animate-in fade-in zoom-in-95 duration-100"
      style={{ left: state.x, top: state.y }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isNode && node && data && (
        <>
          <MenuLabel>{data.kind.charAt(0).toUpperCase() + data.kind.slice(1)}</MenuLabel>

          {/* Universal generate */}
          <MenuItem icon={<Wand2 size={12} />} onClick={() => onGenerateFromNode(state.nodeId)} accent="teal">
            Generate Script from This
          </MenuItem>
          {selectedCount > 1 && (
            <MenuItem icon={<Sparkles size={12} />} onClick={onGenerateFromSelected} accent="teal">
              Generate from {selectedCount} Selected
            </MenuItem>
          )}

          {/* Creator-specific */}
          {data.kind === "creator" && (
            <>
              <MenuDivider />
              <MenuItem icon={<Layers size={12} />} onClick={() => onExpandCreator(state.nodeId)} accent="teal">
                Add Top 5 Videos to Canvas
              </MenuItem>
              <MenuItem
                icon={<ExternalLink size={12} />}
                onClick={() => {
                  const url = data.platform === "Instagram"
                    ? `https://instagram.com/${data.handle}`
                    : data.platform === "TikTok"
                    ? `https://tiktok.com/@${data.handle}`
                    : `https://youtube.com/@${data.handle}`;
                  onOpenUrl(url);
                }}
              >
                Open @{data.handle} Profile
              </MenuItem>
            </>
          )}

          {/* Video-specific */}
          {data.kind === "video" && (
            <>
              <MenuDivider />
              {data.videoUrl && (
                <MenuItem icon={<ExternalLink size={12} />} onClick={() => onOpenUrl(data.videoUrl)}>
                  Open Video in New Tab
                </MenuItem>
              )}
              <MenuItem icon={<Copy size={12} />} onClick={() => onCopyNode(state.nodeId)}>
                Copy Title to Clipboard
              </MenuItem>
            </>
          )}

          {/* Idea-specific */}
          {data.kind === "idea" && (
            <>
              <MenuDivider />
              <MenuItem icon={<FileText size={12} />} onClick={() => onEditIdea(state.nodeId)}>
                Edit Topic
              </MenuItem>
              <MenuItem icon={<GitBranch size={12} />} onClick={() => onExpandIdea(state.nodeId, "angles")} accent="teal">
                Brainstorm 3 Angles
              </MenuItem>
              <MenuItem icon={<LayoutGrid size={12} />} onClick={() => onExpandIdea(state.nodeId, "formats")} accent="teal">
                Show Across All 7 Formats
              </MenuItem>
              <MenuItem icon={<Copy size={12} />} onClick={() => onCopyNode(state.nodeId)}>
                Copy Topic
              </MenuItem>
            </>
          )}

          {/* Script-specific */}
          {data.kind === "script" && (
            <>
              <MenuDivider />
              <MenuItem icon={<ArrowRight size={12} />} onClick={() => onExpandScript(state.nodeId)} accent="teal">
                Open Full Script
              </MenuItem>
              <MenuItem icon={<Sparkles size={12} />} onClick={() => onAutoFix(state.nodeId)} accent="teal">
                Auto-Fix to Pass Blueprint
              </MenuItem>
              <MenuItem icon={<Eye size={12} />} onClick={() => onGenerateBRoll(state.nodeId)} accent="teal">
                Generate B-Roll Pack (Higgsfield)
              </MenuItem>
              <MenuItem icon={<Sparkles size={12} />} onClick={() => onCheckCompliance(state.nodeId)}>
                Re-Score Compliance
              </MenuItem>
              <div className="relative" onMouseEnter={() => setSubmenuOpen("hook")} onMouseLeave={() => setSubmenuOpen(null)}>
                <MenuItem icon={<Wand2 size={12} />} onClick={() => {}}>
                  Refine Hook As… <ChevronRight />
                </MenuItem>
                {submenuOpen === "hook" && (
                  <div className="absolute left-full top-0 ml-1 min-w-[200px] bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50">
                    {([
                      ["question", "Question Curiosity"],
                      ["myth_contrarian", "Contrarian Myth"],
                      ["statistic", "Statistic Stop"],
                      ["story_emotional", "Emotional Story"],
                      ["pattern_interrupt", "Pattern Interrupt"],
                      ["did_you_know", "Did You Know"],
                    ] as const).map(([style, label]) => (
                      <MenuItem
                        key={style}
                        icon={<Wand2 size={12} />}
                        onClick={() => onRefineHook(state.nodeId, style)}
                      >
                        {label}
                      </MenuItem>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative" onMouseEnter={() => setSubmenuOpen("format")} onMouseLeave={() => setSubmenuOpen(null)}>
                <MenuItem icon={<Shuffle size={12} />} onClick={() => {}}>
                  Regenerate As… <ChevronRight />
                </MenuItem>
                {submenuOpen === "format" && (
                  <div className="absolute left-full top-0 ml-1 min-w-[180px] bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50">
                    {(["reel", "tiktok", "short", "carousel", "long"] as const).map((fmt) => (
                      <MenuItem
                        key={fmt}
                        icon={<Shuffle size={12} />}
                        onClick={() => onRegenerateAs(state.nodeId, fmt)}
                      >
                        {fmt === "reel" ? "Instagram Reel" : fmt === "tiktok" ? "TikTok" : fmt === "short" ? "YouTube Short" : fmt === "carousel" ? "Carousel" : "YouTube Long-form"}
                      </MenuItem>
                    ))}
                  </div>
                )}
              </div>
              <MenuItem icon={<Copy size={12} />} onClick={() => onCopyNode(state.nodeId)}>
                Copy Full Script
              </MenuItem>
            </>
          )}

          {/* B-Roll-specific (image node) */}
          {data.kind === "broll" && (
            <>
              <MenuDivider />
              <MenuItem icon={<Eye size={12} />} onClick={() => onAnimateBRoll(state.nodeId)} accent="teal">
                Animate to Video (Seedance / Kling / Veo)
              </MenuItem>
              {data.imageUrl && (
                <MenuItem icon={<ExternalLink size={12} />} onClick={() => onOpenUrl(data.imageUrl!)}>
                  Open Image
                </MenuItem>
              )}
            </>
          )}

          {/* B-Roll Video-specific */}
          {data.kind === "brollVideo" && data.videoUrl && (
            <>
              <MenuDivider />
              <MenuItem icon={<ExternalLink size={12} />} onClick={() => onOpenUrl(data.videoUrl!)}>
                Open Video
              </MenuItem>
            </>
          )}

          {/* Source-specific */}
          {data.kind === "source" && (
            <>
              <MenuDivider />
              {data.sourceType === "url" && (
                <MenuItem icon={<ExternalLink size={12} />} onClick={() => onOpenUrl(data.source)}>
                  Open URL in New Tab
                </MenuItem>
              )}
              <MenuItem icon={<Copy size={12} />} onClick={() => onCopyNode(state.nodeId)}>
                Copy Source
              </MenuItem>
            </>
          )}

          {/* Universal node actions */}
          <MenuDivider />
          {connectedCount > 0 && (
            <MenuItem icon={<GitBranch size={12} />} onClick={() => onSelectConnected(state.nodeId)}>
              Select {connectedCount} Connected
            </MenuItem>
          )}
          <MenuItem icon={<Plus size={12} />} onClick={() => onDuplicateNode(state.nodeId)}>
            Duplicate <KbdHint>⌘D</KbdHint>
          </MenuItem>
          <MenuItem icon={<Trash2 size={12} />} onClick={() => onDeleteNode(state.nodeId)} accent="rose">
            Delete <KbdHint>⌫</KbdHint>
          </MenuItem>
        </>
      )}

      {!isNode && (
        <>
          <MenuLabel>Canvas · {nodes.length} nodes</MenuLabel>
          {selectedCount > 0 && (
            <>
              <MenuItem icon={<Wand2 size={12} />} onClick={onGenerateFromSelected} accent="teal">
                Generate from {selectedCount} Selected <KbdHint>G</KbdHint>
              </MenuItem>
              <MenuDivider />
            </>
          )}
          <MenuItem icon={<ClipboardPaste size={12} />} onClick={onPasteAtCursor}>
            Paste URL / Text <KbdHint>⌘V</KbdHint>
          </MenuItem>
          <MenuItem icon={<Sparkles size={12} />} onClick={onAddIdea}>
            Add Idea Node
          </MenuItem>
          <MenuItem icon={<Link2 size={12} />} onClick={onAddSource}>
            Add Source (URL / Text)
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={<LayoutGrid size={12} />} onClick={onArrange}>
            Auto-Arrange Layout
          </MenuItem>
          <MenuItem icon={<Save size={12} />} onClick={onSaveCanvas}>
            Save Canvas <KbdHint>⌘S</KbdHint>
          </MenuItem>
          <MenuDivider />
          <MenuItem icon={<Layers size={12} />} onClick={onSelectAll}>
            Select All <KbdHint>⌘A</KbdHint>
          </MenuItem>
          <MenuItem icon={<Trash2 size={12} />} onClick={onClearCanvas} accent="rose">
            Clear Canvas
          </MenuItem>
        </>
      )}
    </div>
  );
};

const ChevronRight: React.FC = () => <span className="ml-auto text-slate-400">›</span>;
const KbdHint: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="ml-auto text-[9px] font-mono text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded">{children}</span>
);

// ── Script Detail Drawer ─────────────────────────────────────────────────────

type ScriptDetailDrawerProps = {
  script: FullConvertResult;
  scriptNodeId: string | null;
  complianceScore: number | null;
  onClose: () => void;
  onNavigate: (view: DashboardView) => void;
  onQuickRefine: (nodeId: string, instruction: string) => void;
  onShip: (script: FullConvertResult, nodeId: string | null) => Promise<{ code: string } | null>;
  refining: boolean;
};

const ScriptDetailDrawer: React.FC<ScriptDetailDrawerProps> = ({ script, scriptNodeId, complianceScore, onClose, onNavigate, onQuickRefine, onShip, refining }) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saved-idea">("idle");

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const fullScriptText = useMemo(() => {
    const lines = [
      `# ${script.title}`,
      ``,
      `## Hook (${script.hookArchetype})`,
      `Visual: ${script.hook.visual}`,
      `Text: ${script.hook.text}`,
      `Spoken: "${script.hook.spoken}"`,
      `Audio: ${script.hook.audio}`,
      ``,
      `## Script`,
      script.script,
      ``,
      `## Shot List`,
      ...script.shotList.map((s) => `[${s.second}s] ${s.shot} — ${s.action}${s.textOverlay ? ` · Text: "${s.textOverlay}"` : ""}`),
      ``,
      `## CTA (${script.cta.type.toUpperCase()})`,
      `"${script.cta.phrasing}"`,
      script.cta.timing,
      ``,
      `## Social Caption`,
      script.caption,
    ];
    return lines.join("\n");
  }, [script]);

  const saveAsIdea = async () => {
    try {
      await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: [{
            topic: script.title,
            category: "competitor",
            priority: "High",
            suggestedFormat: script.outputFormat,
            hookAngle: script.hook.spoken,
            source: "Canvas Generation",
          }],
        }),
      });
      setSaveState("saved-idea");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const sendToCarouselLab = () => {
    onNavigate("CAROUSEL_LAB");
    onClose();
  };

  const sendToScriptWizard = () => {
    onNavigate("SCRIPT_WIZARD");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <aside className="w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in-right overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <FileText size={16} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600">{script.outputLabel} · {script.outputDuration}</div>
              <h2 className="font-serif font-bold text-lg text-slate-900 leading-tight">{script.title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {complianceScore != null && (
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                complianceScore >= 80
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : complianceScore >= 60
                  ? "bg-amber-100 text-amber-700 border border-amber-200"
                  : "bg-rose-100 text-rose-700 border border-rose-200"
              }`}>
                Blueprint {complianceScore}/100
              </span>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Source provenance / warnings */}
          {(script.sourceUrls && script.sourceUrls.length > 0) && (
            <div className={`rounded-2xl p-4 border ${script.warnings && script.warnings.length > 0 ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
              <div className={`text-[10px] font-black uppercase tracking-[0.2em] mb-2 ${script.warnings && script.warnings.length > 0 ? "text-amber-700" : "text-slate-500"}`}>
                {script.warnings && script.warnings.length > 0 ? "Source Warnings" : "Source URLs"}
              </div>
              <ul className="space-y-1.5">
                {(script.fetchResults || []).map((r, i) => (
                  <li key={i} className="text-[11px] flex items-center gap-2">
                    {r.fetched ? <Check size={11} className="text-emerald-600 shrink-0" /> : <X size={11} className="text-rose-500 shrink-0" />}
                    <a href={r.url} target="_blank" rel="noopener" className="truncate text-slate-700 hover:text-teal-700 underline-offset-2 hover:underline">
                      {r.url}
                    </a>
                    <span className="text-slate-400 ml-auto shrink-0 text-[10px]">{r.fetched ? "fetched" : "skipped"}</span>
                  </li>
                ))}
              </ul>
              {script.warnings && script.warnings.length > 0 && (
                <p className="text-[11px] text-amber-700 mt-2 leading-relaxed">
                  Some sources could not be fetched. The script is grounded only on what was successfully retrieved. For Instagram URLs, add them via the Discover Feed first, or paste the caption as text.
                </p>
              )}
            </div>
          )}

          {/* Hook */}
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 space-y-1.5">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">Hook · {script.hookArchetype}</div>
              <button onClick={() => copy(`Visual: ${script.hook.visual}\nText: ${script.hook.text}\nSpoken: "${script.hook.spoken}"\nAudio: ${script.hook.audio}`, "hook")} className="p-1 rounded-full text-teal-600 hover:bg-teal-100">
                {copiedField === "hook" ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
            <div className="text-xs text-slate-700"><span className="font-bold">Visual:</span> {script.hook.visual}</div>
            <div className="text-xs text-slate-700"><span className="font-bold">Text overlay:</span> {script.hook.text}</div>
            <div className="text-xs text-slate-700"><span className="font-bold">Spoken:</span> "{script.hook.spoken}"</div>
            <div className="text-xs text-slate-700"><span className="font-bold">Audio:</span> {script.hook.audio}</div>
          </div>

          {/* Script */}
          <DrawerSection title="Voiceover Script" onCopy={() => copy(script.script, "script")} copied={copiedField === "script"}>
            <pre className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed font-sans">{script.script}</pre>
          </DrawerSection>

          {/* Shot List */}
          {script.shotList.length > 0 && (
            <DrawerSection
              title={`Shot List · ${script.shotList.length} shots`}
              onCopy={() => copy(script.shotList.map((s) => `[${s.second}s] ${s.shot}: ${s.action}${s.textOverlay ? ` | Text: "${s.textOverlay}"` : ""}`).join("\n"), "shots")}
              copied={copiedField === "shots"}
            >
              <ul className="space-y-2">
                {script.shotList.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="shrink-0 w-12 text-xs font-black tabular-nums text-rose-600 bg-rose-50 rounded-md px-2 py-1 h-fit">{s.second}s</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-slate-900">{s.shot}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{s.action}</p>
                      {s.textOverlay && <p className="text-[11px] text-teal-700 italic mt-0.5">Text: "{s.textOverlay}"</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </DrawerSection>
          )}

          {/* CTA */}
          <DrawerSection title={`CTA · ${script.cta.type.toUpperCase()}`} onCopy={() => copy(script.cta.phrasing, "cta")} copied={copiedField === "cta"}>
            <p className="text-sm text-slate-800 italic font-medium">"{script.cta.phrasing}"</p>
            <p className="text-xs text-slate-500 mt-1.5">{script.cta.timing}</p>
          </DrawerSection>

          {/* Caption */}
          <DrawerSection title="Social Caption" onCopy={() => copy(script.caption, "caption")} copied={copiedField === "caption"}>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed font-sans">{script.caption}</pre>
          </DrawerSection>

          {/* Blueprint notes */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-1.5 flex items-center gap-1.5">
              <Sparkles size={11} /> Blueprint Compliance Notes
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{script.complianceNotes}</p>
          </div>
        </div>

        {/* Action Footer — what to do next */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 space-y-3.5">
          {/* Quick refinements — every click spawns a child node on the canvas */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Quick Refine · spawns new child node</div>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "Make Shorter", instr: "Cut to 15-20 seconds. Keep the most punchy hook and the most surprising fact. Drop everything else." },
                { label: "Make Longer", instr: "Expand to 50-60 seconds. Add an extra re-hook and a deeper context section. Keep pacing tight." },
                { label: "More Contrarian", instr: "Rewrite with a more contrarian, myth-busting angle. Lead with a hard pill to swallow. Be more provocative without being inaccurate." },
                { label: "More Empathetic", instr: "Soften the tone to feel more empathetic and patient-first. Use warmer language, acknowledge the viewer's struggle, reduce harshness." },
                { label: "More Technical", instr: "Add credible technical depth: anatomy terms, biomechanics, evidence-based references. Still patient-facing but smarter." },
                { label: "Tighter Hook", instr: "Rewrite the first 3 seconds to be tighter, more visual, and end with sharper unresolved tension. Cut filler words." },
                { label: "Add Humor", instr: "Insert one deadpan aside or self-aware moment that lands without undercutting the educational value. Jordan-style humor." },
                { label: "Add Statistic", instr: "Lead the hook with a specific statistic or number that surprises the viewer. Make it sound credible and weave it into the body." },
              ].map((r) => (
                <button
                  key={r.label}
                  onClick={() => scriptNodeId && onQuickRefine(scriptNodeId, r.instr)}
                  disabled={refining || !scriptNodeId}
                  className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-bold text-slate-700 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 disabled:opacity-40 disabled:hover:bg-slate-50 disabled:hover:border-slate-200 disabled:hover:text-slate-700 transition-colors"
                >
                  {refining ? <Loader2 size={10} className="inline animate-spin mr-1" /> : null}
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ship to Library — primary CTA */}
          <ShipToLibraryButton script={script} scriptNodeId={scriptNodeId} onShip={onShip} />

          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Next Steps</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => copy(fullScriptText, "all")}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
              >
                {copiedField === "all" ? <Check size={12} /> : <Copy size={12} />}
                {copiedField === "all" ? "Copied" : "Copy Full Brief"}
              </button>
              <button
                onClick={saveAsIdea}
                disabled={saveState === "saved-idea"}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${
                  saveState === "saved-idea"
                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                    : "bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200"
                }`}
              >
                {saveState === "saved-idea" ? <><Check size={12} /> Saved to Ideas</> : <><Sparkles size={12} /> Save as Idea</>}
              </button>
              <button
                onClick={sendToCarouselLab}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-100 text-teal-700 border border-teal-200 hover:bg-teal-200 text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                <Layers size={12} /> Make Carousel
              </button>
              <button
                onClick={sendToScriptWizard}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-100 text-teal-700 border border-teal-200 hover:bg-teal-200 text-[10px] font-black uppercase tracking-widest transition-colors"
              >
                <Wand2 size={12} /> Refine in Wizard
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            Press <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-200 rounded text-[9px] font-mono">esc</kbd> to close.
          </p>
        </div>
      </aside>
    </div>
  );
};

// Ship-to-Library — creates a content-library entry + video_status row
const ShipToLibraryButton: React.FC<{
  script: FullConvertResult;
  scriptNodeId: string | null;
  onShip: (script: FullConvertResult, nodeId: string | null) => Promise<{ code: string } | null>;
}> = ({ script, scriptNodeId, onShip }) => {
  const [state, setState] = useState<"idle" | "shipping" | "shipped">("idle");
  const [code, setCode] = useState<string | null>(null);
  const handle = async () => {
    setState("shipping");
    const result = await onShip(script, scriptNodeId);
    if (result?.code) {
      setCode(result.code);
      setState("shipped");
    } else {
      setState("idle");
    }
  };
  if (state === "shipped" && code) {
    return (
      <div className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200">
        <div className="flex items-center gap-2">
          <Check size={14} className="text-emerald-600" />
          <span className="text-sm font-bold text-emerald-700">Shipped → {code}</span>
        </div>
        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">in production pipeline</span>
      </div>
    );
  }
  return (
    <button
      onClick={handle}
      disabled={state === "shipping"}
      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:from-teal-700 hover:to-emerald-700 disabled:opacity-60 transition-colors shadow-md"
    >
      {state === "shipping" ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
      {state === "shipping" ? "Shipping…" : "Ship to Production Library"}
    </button>
  );
};

const DrawerSection: React.FC<{ title: string; onCopy: () => void; copied: boolean; children: React.ReactNode }> = ({ title, onCopy, copied, children }) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{title}</h3>
      <button onClick={onCopy} className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
        {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      </button>
    </div>
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">{children}</div>
  </div>
);

const MenuLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{children}</div>
);

const MenuDivider: React.FC = () => <div className="my-1 border-t border-slate-100" />;

const MenuItem: React.FC<{
  icon: React.ReactNode;
  onClick: () => void;
  accent?: "teal" | "rose";
  children: React.ReactNode;
}> = ({ icon, onClick, accent, children }) => {
  const accentClass =
    accent === "teal"
      ? "text-teal-700 hover:bg-teal-50"
      : accent === "rose"
      ? "text-rose-700 hover:bg-rose-50"
      : "text-slate-700 hover:bg-slate-50";
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-xs font-semibold flex items-center gap-2.5 transition-colors ${accentClass}`}
    >
      <span className="opacity-70">{icon}</span>
      {children}
    </button>
  );
};
