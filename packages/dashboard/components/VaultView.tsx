import React, { useState, useEffect, useCallback } from "react";
import {
  Bookmark,
  Plus,
  Sparkles,
  Copy,
  Check,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  Search,
  Palette,
  Zap,
  X,
  BarChart3,
  Trophy,
  AlertCircle,
  Eye,
  Layers,
} from "lucide-react";
import type { VaultHook, VaultStyle, VaultVisualStyle } from "../shared/types.js";
import { cn } from "../utils/cn.js";

type Tab = "hooks" | "styles" | "visual";

const HOOK_CATEGORIES = [
  { key: "all", label: "All" },
  { key: "question", label: "Question" },
  { key: "statistic", label: "Statistic" },
  { key: "myth", label: "Myth" },
  { key: "emotional", label: "Emotional" },
  { key: "didyouknow", label: "Did You Know" },
  { key: "pattern_interrupt", label: "Pattern Interrupt" },
  { key: "mystery", label: "Mystery" },
  { key: "list", label: "List" },
  { key: "problem", label: "Problem" },
  { key: "shock", label: "Shock" },
  { key: "callout", label: "Call-Out" },
  { key: "transformation", label: "Transformation" },
  { key: "exclusivity", label: "Exclusivity" },
  { key: "controversial", label: "Controversial" },
  { key: "fomo", label: "FOMO" },
  { key: "urgency", label: "Urgency" },
  { key: "cta", label: "CTA" },
  { key: "custom", label: "Custom" },
];

const CATEGORY_COLORS: Record<string, string> = {
  question: "bg-sky-100 text-sky-700",
  statistic: "bg-violet-100 text-violet-700",
  myth: "bg-rose-100 text-rose-700",
  emotional: "bg-pink-100 text-pink-700",
  didyouknow: "bg-amber-100 text-amber-700",
  pattern_interrupt: "bg-orange-100 text-orange-700",
  mystery: "bg-indigo-100 text-indigo-700",
  list: "bg-emerald-100 text-emerald-700",
  problem: "bg-red-100 text-red-700",
  shock: "bg-fuchsia-100 text-fuchsia-700",
  callout: "bg-cyan-100 text-cyan-700",
  transformation: "bg-teal-100 text-teal-700",
  exclusivity: "bg-purple-100 text-purple-700",
  controversial: "bg-rose-100 text-rose-700",
  fomo: "bg-yellow-100 text-yellow-700",
  urgency: "bg-red-100 text-red-700",
  cta: "bg-green-100 text-green-700",
  custom: "bg-slate-100 text-slate-700",
};

function highlightVariables(pattern: string): React.ReactNode {
  const parts = pattern.split(/(\[[A-Z][A-Z0-9_ ]*\])/g);
  return parts.map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <span key={i} className="bg-teal-100 text-teal-700 px-1 rounded font-mono text-xs">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

// Hook Adaptation Button Component
type Adaptation = { pattern: string; example: string; whyItWorks: string };

const HookAdaptButton: React.FC<{ hookId: number }> = ({ hookId }) => {
  const [adaptations, setAdaptations] = useState<Adaptation[] | null>(null);
  const [showAdapt, setShowAdapt] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const adaptMutation = {
    isPending: false,
    mutate: async () => {
      try {
        const r = await fetch(`/api/vault/hooks/${hookId}/adapt`, { method: "POST", headers: { "Content-Type": "application/json" } });
        if (!r.ok) return;
        const data = await r.json();
        setAdaptations(data.adaptations);
        setShowAdapt(true);
      } catch { /* ignore */ }
    },
  };

  const handleCopyAdapt = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (showAdapt && adaptations) {
    return (
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-teal-600">Adapted for your niche:</span>
          <button onClick={() => setShowAdapt(false)} className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
        </div>
        <div className="space-y-1.5">
          {adaptations.map((a, i) => (
            <div key={i} className="bg-teal-50 rounded-lg p-2 flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-800">{a.example}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{a.whyItWorks}</p>
              </div>
              <button onClick={() => handleCopyAdapt(a.example, i)} className="shrink-0 p-1 rounded hover:bg-teal-100">
                {copiedIdx === i ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-slate-400" />}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => adaptMutation.mutate()}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 rounded-lg text-xs font-medium hover:bg-teal-100 transition-colors"
    >
      <Zap size={12} />
      Adapt
    </button>
  );
};

const SynthesizeStyleModal: React.FC<{
  onClose: () => void;
  onCreated: (style: VaultVisualStyle) => void;
}> = ({ onClose, onCreated }) => {
  const [breakdowns, setBreakdowns] = useState<Array<{ id: number; creatorHandle: string; videoUrl: string | null; topic: string | null; oneSentenceConcept: string | null }>>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [synthesizing, setSynthesizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch breakdowns that have deep DNA
    fetch("/api/creator-videos")
      .then((r) => r.json())
      .then(async (data) => {
        // For each video, check if it has a breakdown with DNA fields
        const allBreakdowns: typeof breakdowns = [];
        for (const v of (data.videos || []).slice(0, 50)) {
          const bRes = await fetch(`/api/creator-videos/${v.id}/breakdown`);
          const bData = await bRes.json();
          if (bData.breakdown && (bData.breakdown.colorPalette || bData.breakdown.storyStructure)) {
            allBreakdowns.push({
              id: bData.breakdown.id,
              creatorHandle: v.creatorHandle,
              videoUrl: v.videoUrl,
              topic: bData.breakdown.topic,
              oneSentenceConcept: bData.breakdown.oneSentenceConcept,
            });
          }
        }
        setBreakdowns(allBreakdowns);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSynthesize = async () => {
    if (selected.size === 0) return;
    setSynthesizing(true);
    setError(null);
    try {
      const r = await fetch("/api/vault/visual-styles/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ breakdownIds: [...selected], name: name || undefined }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Synthesis failed");
      }
      const data = await r.json();
      onCreated(data.style);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
    setSynthesizing(false);
  };

  return (
    <div className="bg-white border border-violet-200 rounded-2xl p-5 mb-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-serif font-bold text-slate-900">Synthesize Visual Style</h3>
        <button onClick={onClose}><X size={18} className="text-slate-400" /></button>
      </div>
      <p className="text-xs text-slate-500 mb-3">Select 1-5 analyzed videos to blend their visual DNA into your own composite style.</p>
      <div className="mb-3">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">Style Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jordan's Chiro Cut" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
      </div>
      {loading ? (
        <p className="text-xs text-slate-400 py-4 text-center">Loading analyzed videos...</p>
      ) : breakdowns.length === 0 ? (
        <p className="text-xs text-slate-400 py-4 text-center">No deep-analyzed videos found. Use Deep Analyze on creator videos first.</p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto mb-3">
          {breakdowns.map((b) => (
            <label key={b.id} className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors", selected.has(b.id) ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-slate-300")}>
              <input type="checkbox" checked={selected.has(b.id)} onChange={() => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(b.id)) next.delete(b.id); else if (next.size < 5) next.add(b.id);
                  return next;
                });
              }} className="accent-violet-600" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900">{b.creatorHandle}</p>
                <p className="text-xs text-slate-500 truncate">{b.oneSentenceConcept || b.topic || "Analyzed video"}</p>
              </div>
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-rose-500 mb-2">{error}</p>}
      <button onClick={handleSynthesize} disabled={selected.size === 0 || synthesizing} className={cn("w-full py-2.5 rounded-xl text-sm font-bold transition-colors", selected.size === 0 || synthesizing ? "bg-slate-100 text-slate-400" : "bg-violet-600 text-white hover:bg-violet-700")}>
        {synthesizing ? "Synthesizing..." : `Synthesize from ${selected.size} Source${selected.size !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
};

const VisualStyleCard: React.FC<{
  style: VaultVisualStyle;
  onDelete: (id: number) => void;
}> = ({ style, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const colors = typeof style.colorPalette === "string" ? (() => { try { return JSON.parse(style.colorPalette); } catch { return null; } })() : style.colorPalette;
  const typography = typeof style.typographySystem === "string" ? (() => { try { return JSON.parse(style.typographySystem); } catch { return null; } })() : style.typographySystem;
  const transitions = style.transitionRules ? (typeof style.transitionRules === "string" ? (() => { try { return JSON.parse(style.transitionRules); } catch { return null; } })() : style.transitionRules) : null;
  const setDesign = style.setDesignRules ? (typeof style.setDesignRules === "string" ? (() => { try { return JSON.parse(style.setDesignRules); } catch { return null; } })() : style.setDesignRules) : null;
  const doNotList = style.doNot ? (typeof style.doNot === "string" ? (() => { try { return JSON.parse(style.doNot); } catch { return []; } })() : style.doNot) : [];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-serif font-bold text-slate-900">{style.name}</h3>
          {style.description && <p className="text-xs text-slate-500 mt-0.5">{style.description}</p>}
          {style.sourceCreator && <p className="text-[10px] text-violet-500 mt-1">Source: {style.sourceCreator}</p>}
        </div>
        <div className="flex items-center gap-2">
          {style.usageCount > 0 && <span className="text-[10px] text-slate-400">{style.usageCount} uses</span>}
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-600">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Color Swatches */}
      {colors && (
        <div className="flex items-center gap-2 mb-3">
          {["primary", "secondary", "accent"].map((key) => colors[key] && (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full border border-slate-200" style={{ backgroundColor: colors[key] }} />
              <span className="text-[10px] text-slate-400">{colors[key]}</span>
            </div>
          ))}
          {colors.mood && <span className="text-[10px] text-slate-400 ml-2">{colors.mood}</span>}
        </div>
      )}

      {expanded && (
        <div className="space-y-3 mt-3 pt-3 border-t border-slate-100">
          {typography && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Typography</p>
              <div className="text-xs text-slate-600 space-y-0.5">
                {Object.entries(typography).map(([k, v]) => <p key={k}><span className="font-medium text-slate-700">{k}:</span> {String(v)}</p>)}
              </div>
            </div>
          )}
          {transitions && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Transitions</p>
              <div className="text-xs text-slate-600 space-y-0.5">
                {Object.entries(transitions).map(([k, v]) => <p key={k}><span className="font-medium text-slate-700">{k}:</span> {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}</p>)}
              </div>
            </div>
          )}
          {setDesign && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Set Design</p>
              <div className="text-xs text-slate-600 space-y-0.5">
                {Object.entries(setDesign).map(([k, v]) => <p key={k}><span className="font-medium text-slate-700">{k}:</span> {Array.isArray(v) ? (v as string[]).join(", ") : String(v)}</p>)}
              </div>
            </div>
          )}
          {Array.isArray(doNotList) && doNotList.length > 0 && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 mb-1">Do Not</p>
              <ul className="text-xs text-rose-600 list-disc list-inside">{doNotList.map((item: string, i: number) => <li key={i}>{item}</li>)}</ul>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2">
            <button onClick={() => onDelete(style.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs font-medium ml-auto">
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const VaultView: React.FC = () => {
  const [tab, setTab] = useState<Tab>("hooks");
  const [hooks, setHooks] = useState<VaultHook[]>([]);
  const [styles, setStyles] = useState<VaultStyle[]>([]);
  const [visualStyles, setVisualStyles] = useState<VaultVisualStyle[]>([]);
  const [showSynthesizeModal, setSynthesizeModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedHookId, setExpandedHookId] = useState<number | null>(null);
  const [expandedStyleId, setExpandedStyleId] = useState<number | null>(null);
  const [showAddHook, setShowAddHook] = useState(false);
  const [showExtractStyle, setShowExtractStyle] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add Hook form state
  const [newHookText, setNewHookText] = useState("");
  const [extractedPattern, setExtractedPattern] = useState<{
    pattern: string;
    variables: string[];
    category: string;
    optimizes: string | null;
  } | null>(null);
  const [extracting, setExtracting] = useState(false);

  // Extract Style form state
  const [styleTranscript, setStyleTranscript] = useState("");
  const [styleName, setStyleName] = useState("");
  const [styleCreator, setStyleCreator] = useState("");
  const [extractingStyle, setExtractingStyle] = useState(false);

  // Variable fill-in state
  const [filledVariables, setFilledVariables] = useState<Record<string, string>>({});

  // Performance view state
  const [showPerformance, setShowPerformance] = useState(false);
  const [perfData, setPerfData] = useState<{
    categories: Array<{ category: string; videoCount: number; platforms: string[]; avgViews: number; avgEngagement: number; totalViews: number; totalEngagement: number }>;
    untestedCategories: Array<{ category: string; hookCount: number }>;
    totalLinked: number;
  } | null>(null);

  useEffect(() => {
    if (showPerformance && !perfData) {
      fetch("/api/vault/hooks/performance")
        .then((r) => r.json())
        .then(setPerfData)
        .catch(() => {});
    }
  }, [showPerformance, perfData]);

  const fetchHooks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (searchQuery) params.set("search", searchQuery);
      const res = await fetch(`/api/vault/hooks?${params}`);
      const data = await res.json();
      setHooks(data.hooks || []);
    } catch (e) {
      console.error("Failed to fetch hooks:", e);
    }
  }, [categoryFilter, searchQuery]);

  const fetchStyles = useCallback(async () => {
    try {
      const res = await fetch("/api/vault/styles");
      const data = await res.json();
      setStyles(data.styles || []);
    } catch (e) {
      console.error("Failed to fetch styles:", e);
    }
  }, []);

  const fetchVisualStyles = useCallback(async () => {
    try {
      const res = await fetch("/api/vault/visual-styles");
      const data = await res.json();
      setVisualStyles(data.styles || []);
    } catch (e) {
      console.error("Failed to fetch visual styles:", e);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchHooks(), fetchStyles(), fetchVisualStyles()]).finally(() => setLoading(false));
  }, [fetchHooks, fetchStyles, fetchVisualStyles]);

  // Seed hooks on first load if empty
  useEffect(() => {
    if (!loading && hooks.length === 0 && tab === "hooks") {
      fetch("/api/vault/hooks/seed", { method: "POST" })
        .then((r) => r.json())
        .then((data) => {
          if (data.seeded) fetchHooks();
        })
        .catch(() => {});
    }
  }, [loading, hooks.length, tab, fetchHooks]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExtractHook = async () => {
    if (!newHookText.trim()) return;
    setExtracting(true);
    try {
      const res = await fetch("/api/vault/hooks/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newHookText }),
      });
      const data = await res.json();
      if (data.pattern) {
        setExtractedPattern(data);
      }
    } catch (e) {
      console.error("Extract failed:", e);
    } finally {
      setExtracting(false);
    }
  };

  const handleSaveHook = async () => {
    if (!extractedPattern) return;
    try {
      await fetch("/api/vault/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: extractedPattern.pattern,
          example: newHookText,
          category: extractedPattern.category,
          optimizes: extractedPattern.optimizes,
        }),
      });
      setShowAddHook(false);
      setNewHookText("");
      setExtractedPattern(null);
      fetchHooks();
    } catch (e) {
      console.error("Save hook failed:", e);
    }
  };

  const handleDeleteHook = async (id: number) => {
    try {
      await fetch(`/api/vault/hooks/${id}`, { method: "DELETE" });
      fetchHooks();
    } catch (e) {
      console.error("Delete hook failed:", e);
    }
  };

  const handleExtractStyle = async () => {
    if (!styleTranscript.trim()) return;
    setExtractingStyle(true);
    try {
      const res = await fetch("/api/vault/styles/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: styleTranscript,
          name: styleName || undefined,
          sourceCreator: styleCreator || undefined,
        }),
      });
      const data = await res.json();
      if (data.style) {
        setShowExtractStyle(false);
        setStyleTranscript("");
        setStyleName("");
        setStyleCreator("");
        fetchStyles();
      }
    } catch (e) {
      console.error("Extract style failed:", e);
    } finally {
      setExtractingStyle(false);
    }
  };

  const handleDeleteStyle = async (id: number) => {
    try {
      await fetch(`/api/vault/styles/${id}`, { method: "DELETE" });
      fetchStyles();
    } catch (e) {
      console.error("Delete style failed:", e);
    }
  };

  const fillPattern = (pattern: string, vars: Record<string, string>): string => {
    let result = pattern;
    for (const [key, value] of Object.entries(vars)) {
      if (value) result = result.replace(`[${key}]`, value);
    }
    return result;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 md:py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Bookmark size={24} className="text-teal-600" />
            <h1 className="text-2xl font-serif font-bold text-slate-900">The Vault</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Save and reuse viral hooks and writing styles
          </p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("hooks")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "hooks"
              ? "bg-white text-teal-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <Zap size={16} />
          Hooks
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
            {hooks.length}
          </span>
        </button>
        <button
          onClick={() => setTab("styles")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "styles"
              ? "bg-white text-teal-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <Palette size={16} />
          Styles
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
            {styles.length}
          </span>
        </button>
        <button
          onClick={() => setTab("visual")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            tab === "visual"
              ? "bg-white text-teal-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          <Eye size={16} />
          Visual
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full">
            {visualStyles.length}
          </span>
        </button>
      </div>

      {/* ===================== HOOKS TAB ===================== */}
      {tab === "hooks" && (
        <>
          {/* Actions Row */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search hooks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>
            <button
              onClick={() => setShowPerformance(!showPerformance)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors shrink-0",
                showPerformance
                  ? "bg-violet-100 text-violet-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              )}
            >
              <BarChart3 size={16} />
              Performance
            </button>
            <button
              onClick={() => setShowAddHook(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shrink-0"
            >
              <Plus size={16} />
              Add Hook
            </button>
          </div>

          {/* Hook Performance Heatmap */}
          {showPerformance && (
            <div className="mb-5 bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={16} className="text-violet-600" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Hook Performance by Category
                </p>
              </div>
              {!perfData ? (
                <p className="text-sm text-slate-400 text-center py-4">Loading...</p>
              ) : perfData.categories.length === 0 ? (
                <div className="text-center py-6">
                  <AlertCircle size={24} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-sm text-slate-500">No performance data yet.</p>
                  <p className="text-xs text-slate-400 mt-1">Link hooks to scripts via the Script Writer, then add metrics for those videos.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Proven Winners */}
                  <div className="space-y-1.5">
                    {perfData.categories.map((cat) => {
                      const maxEng = perfData.categories[0]?.avgEngagement || 1;
                      const barWidth = Math.max(8, (cat.avgEngagement / maxEng) * 100);
                      const catLabel = HOOK_CATEGORIES.find((c) => c.key === cat.category)?.label || cat.category;
                      return (
                        <div key={cat.category} className="flex items-center gap-3">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 w-28 text-center truncate",
                            CATEGORY_COLORS[cat.category] || "bg-slate-100 text-slate-700",
                          )}>
                            {catLabel}
                          </span>
                          <div className="flex-1 bg-slate-50 rounded-full h-6 relative overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-teal-400 to-teal-600 rounded-full flex items-center justify-end pr-2 transition-all"
                              style={{ width: `${barWidth}%` }}
                            >
                              {barWidth > 30 && (
                                <span className="text-[10px] font-bold text-white">{cat.avgEngagement}%</span>
                              )}
                            </div>
                            {barWidth <= 30 && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{cat.avgEngagement}%</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 shrink-0 w-16 text-right">
                            {cat.videoCount} video{cat.videoCount !== 1 ? "s" : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">
                      <Trophy size={12} className="inline mr-1 text-amber-500" />
                      {perfData.totalLinked} video{perfData.totalLinked !== 1 ? "s" : ""} linked to hooks
                    </span>
                    {perfData.untestedCategories.length > 0 && (
                      <span className="text-[10px] text-slate-400">
                        {perfData.untestedCategories.length} untested categor{perfData.untestedCategories.length !== 1 ? "ies" : "y"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Category Filters */}
          <div className="flex flex-wrap gap-1.5 mb-5 overflow-x-auto pb-1">
            {HOOK_CATEGORIES.map((cat) => {
              const count =
                cat.key === "all"
                  ? hooks.length
                  : hooks.filter((h) => h.category === cat.key).length;
              if (cat.key !== "all" && count === 0) return null;
              return (
                <button
                  key={cat.key}
                  onClick={() => setCategoryFilter(cat.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                    categoryFilter === cat.key
                      ? "bg-teal-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {cat.label}
                  {count > 0 && (
                    <span className="ml-1 opacity-70">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Add Hook Modal */}
          {showAddHook && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-slate-900">Add Hook to Vault</h3>
                <button onClick={() => { setShowAddHook(false); setExtractedPattern(null); setNewHookText(""); }}>
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">
                    Raw Hook Text
                  </label>
                  <input
                    type="text"
                    value={newHookText}
                    onChange={(e) => setNewHookText(e.target.value)}
                    placeholder="e.g., Why your chiropractor is lying about posture"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <button
                  onClick={handleExtractHook}
                  disabled={extracting || !newHookText.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {extracting ? "Extracting..." : "AI Extract Pattern"}
                </button>

                {extractedPattern && (
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 space-y-2">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">
                        Extracted Pattern
                      </span>
                      <p className="text-sm mt-1">{highlightVariables(extractedPattern.pattern)}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", CATEGORY_COLORS[extractedPattern.category] || CATEGORY_COLORS.custom)}>
                        {extractedPattern.category}
                      </span>
                      {extractedPattern.optimizes && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                          Optimizes: {extractedPattern.optimizes}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={handleSaveHook}
                        className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700"
                      >
                        <Bookmark size={14} />
                        Save to Vault
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hook Cards */}
          {loading ? (
            <div className="text-center py-12 text-slate-400">Loading vault...</div>
          ) : hooks.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Bookmark size={32} className="mx-auto mb-2 opacity-50" />
              <p>No hooks yet. Add your first hook or wait for templates to load.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {hooks.map((hook) => {
                const isExpanded = expandedHookId === hook.id;
                return (
                  <div
                    key={hook.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-shadow hover:shadow-sm"
                  >
                    <button
                      onClick={() => {
                        setExpandedHookId(isExpanded ? null : hook.id);
                        setFilledVariables({});
                      }}
                      className="w-full text-left p-4 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {highlightVariables(hook.pattern)}
                        </p>
                        {hook.example && (
                          <p className="text-xs text-slate-500 mt-1 truncate">
                            e.g., "{hook.example}"
                          </p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                              CATEGORY_COLORS[hook.category] || CATEGORY_COLORS.custom,
                            )}
                          >
                            {hook.category}
                          </span>
                          {hook.bestFormat && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                              Format {hook.bestFormat}
                            </span>
                          )}
                          {hook.platform && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500">
                              {hook.platform}
                            </span>
                          )}
                          {hook.isLibrary && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-500">
                              Library
                            </span>
                          )}
                          {hook.usageCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-600">
                              Used {hook.usageCount}x
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-slate-400 mt-1 shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400 mt-1 shrink-0" />
                      )}
                    </button>

                    {/* Expanded: Fill in variables */}
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                        {hook.variables.length > 0 && (
                          <div className="space-y-2 mb-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              Fill in Variables
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {hook.variables.map((v) => (
                                <div key={v}>
                                  <label className="text-xs text-slate-500 mb-0.5 block">[{v}]</label>
                                  <input
                                    type="text"
                                    value={filledVariables[v] || ""}
                                    onChange={(e) =>
                                      setFilledVariables((prev) => ({
                                        ...prev,
                                        [v]: e.target.value,
                                      }))
                                    }
                                    placeholder={v.toLowerCase().replace(/_/g, " ")}
                                    className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Preview filled hook */}
                        {Object.values(filledVariables).some((v) => v) && (
                          <div className="bg-slate-50 rounded-xl p-3 mb-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                              Preview
                            </span>
                            <p className="text-sm font-medium text-slate-900">
                              {fillPattern(hook.pattern, filledVariables)}
                            </p>
                          </div>
                        )}

                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const filled = fillPattern(hook.pattern, filledVariables);
                              handleCopy(filled, `hook-${hook.id}`);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"
                          >
                            {copiedId === `hook-${hook.id}` ? (
                              <Check size={12} className="text-green-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                            {copiedId === `hook-${hook.id}` ? "Copied" : "Copy"}
                          </button>
                          <HookAdaptButton hookId={hook.id} />
                          {hook.optimizes && (
                            <span className="flex items-center text-xs text-slate-400 px-2">
                              Optimizes: {hook.optimizes}
                            </span>
                          )}
                          {!hook.isLibrary && (
                            <button
                              onClick={() => handleDeleteHook(hook.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs font-medium ml-auto"
                            >
                              <Trash2 size={12} />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===================== STYLES TAB ===================== */}
      {tab === "styles" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowExtractStyle(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              <Sparkles size={16} />
              Extract Style
            </button>
          </div>

          {/* Extract Style Modal */}
          {showExtractStyle && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-serif font-bold text-slate-900">Extract Writing Style</h3>
                <button onClick={() => { setShowExtractStyle(false); setStyleTranscript(""); }}>
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Paste a transcript from a creator whose writing style you want to replicate.
                AI will extract concrete rules you can apply to future scripts.
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">
                      Style Name
                    </label>
                    <input
                      type="text"
                      value={styleName}
                      onChange={(e) => setStyleName(e.target.value)}
                      placeholder="e.g., River Cody Deadpan"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">
                      Source Creator
                    </label>
                    <input
                      type="text"
                      value={styleCreator}
                      onChange={(e) => setStyleCreator(e.target.value)}
                      placeholder="e.g., @rivercody"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1 block">
                    Transcript
                  </label>
                  <textarea
                    value={styleTranscript}
                    onChange={(e) => setStyleTranscript(e.target.value)}
                    placeholder="Paste the video transcript here..."
                    rows={6}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 resize-none"
                  />
                </div>
                <button
                  onClick={handleExtractStyle}
                  disabled={extractingStyle || !styleTranscript.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  {extractingStyle ? "Analyzing style..." : "Extract & Save Style"}
                </button>
              </div>
            </div>
          )}

          {/* Style Cards */}
          {styles.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Palette size={32} className="mx-auto mb-2 opacity-50" />
              <p>No styles yet. Extract a writing style from a transcript.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {styles.map((style) => {
                const isExpanded = expandedStyleId === style.id;
                return (
                  <div
                    key={style.id}
                    className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-shadow hover:shadow-sm"
                  >
                    <button
                      onClick={() => setExpandedStyleId(isExpanded ? null : style.id)}
                      className="w-full text-left p-4 flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                        <Palette size={16} className="text-violet-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">{style.name}</p>
                        {style.description && (
                          <p className="text-xs text-slate-500 mt-0.5">{style.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {style.sourceCreator && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-violet-50 text-violet-500">
                              {style.sourceCreator}
                            </span>
                          )}
                          {style.styleRules.techniques?.slice(0, 2).map((t, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500"
                            >
                              {t.length > 25 ? t.slice(0, 25) + "..." : t}
                            </span>
                          ))}
                          {style.usageCount > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-600">
                              Used {style.usageCount}x
                            </span>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp size={16} className="text-slate-400 mt-1 shrink-0" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400 mt-1 shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                              Sentence Length
                            </span>
                            <p className="text-sm text-slate-700">{style.styleRules.sentenceLength}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                              Tone
                            </span>
                            <p className="text-sm text-slate-700">{style.styleRules.tone}</p>
                          </div>
                        </div>
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                            Structure
                          </span>
                          <p className="text-sm text-slate-700">{style.styleRules.structure}</p>
                        </div>
                        {style.styleRules.techniques?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                              Techniques
                            </span>
                            <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5">
                              {style.styleRules.techniques.map((t, i) => (
                                <li key={i}>{t}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {style.styleRules.doNot?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400 block mb-1">
                              Avoid
                            </span>
                            <ul className="text-sm text-slate-700 list-disc list-inside space-y-0.5">
                              {style.styleRules.doNot.map((d, i) => (
                                <li key={i}>{d}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {style.exampleScript && (
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block mb-1">
                              Example Script
                            </span>
                            <div className="bg-slate-50 rounded-xl p-3">
                              <p className="text-sm text-slate-700 italic">{style.exampleScript}</p>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => {
                              const rules = JSON.stringify(style.styleRules, null, 2);
                              handleCopy(rules, `style-${style.id}`);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200"
                          >
                            {copiedId === `style-${style.id}` ? (
                              <Check size={12} className="text-green-600" />
                            ) : (
                              <Copy size={12} />
                            )}
                            {copiedId === `style-${style.id}` ? "Copied" : "Copy Rules"}
                          </button>
                          <button
                            onClick={() => handleDeleteStyle(style.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-rose-500 hover:bg-rose-50 rounded-lg text-xs font-medium ml-auto"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ===================== VISUAL TAB ===================== */}
      {tab === "visual" && (
        <>
          <div className="flex justify-end mb-4 gap-2">
            <button
              onClick={() => setSynthesizeModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-xl text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              <Layers size={16} />
              Synthesize from Analyses
            </button>
          </div>

          {/* Synthesize Modal */}
          {showSynthesizeModal && (
            <SynthesizeStyleModal
              onClose={() => setSynthesizeModal(false)}
              onCreated={(style) => {
                setVisualStyles((prev) => [style, ...prev]);
                setSynthesizeModal(false);
              }}
            />
          )}

          {visualStyles.length === 0 ? (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-2xl">
              <Eye size={24} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500">No visual styles yet</p>
              <p className="text-xs text-slate-400 mt-1">Use "Synthesize from Analyses" to blend creator DNA into your own visual identity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visualStyles.map((style) => (
                <VisualStyleCard
                  key={style.id}
                  style={style}
                  onDelete={async (id) => {
                    await fetch(`/api/vault/visual-styles/${id}`, { method: "DELETE" });
                    setVisualStyles((prev) => prev.filter((s) => s.id !== id));
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
