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
} from "lucide-react";
import type { VaultHook, VaultStyle } from "../shared/types.js";
import { cn } from "../utils/cn.js";

type Tab = "hooks" | "styles";

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

export const VaultView: React.FC = () => {
  const [tab, setTab] = useState<Tab>("hooks");
  const [hooks, setHooks] = useState<VaultHook[]>([]);
  const [styles, setStyles] = useState<VaultStyle[]>([]);
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

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchHooks(), fetchStyles()]).finally(() => setLoading(false));
  }, [fetchHooks, fetchStyles]);

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
              onClick={() => setShowAddHook(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium hover:bg-teal-700 transition-colors shrink-0"
            >
              <Plus size={16} />
              Add Hook
            </button>
          </div>

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
    </div>
  );
};
