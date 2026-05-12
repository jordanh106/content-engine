import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Flame, Users, Leaf, MessageCircle, Sparkles, Archive, RefreshCw, ArrowRight, Eye, Plus, Check, Shield, Inbox, Link, X, ChevronDown, ChevronUp, Send, Zap } from "lucide-react";
import type { Idea, IdeaCategory, DashboardView, WatchlistIntelIdea, IdeaConcept, FormatId, InboxItem, ResearchIdea } from "../shared/types.js";
import { IdeaDetail } from "./IdeaDetail.js";
import { FormatBadge } from "./ui/FormatBadge.js";
import { IdeaGeneratorModal } from "./IdeaGeneratorModal.js";
import { IdeaLab } from "./IdeaLab.js";
import { cn } from "../utils/cn.js";
import { EmptyState } from "./ui/EmptyState.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";
import { ScrollReveal } from "./ui/animations.js";

const CATEGORY_META: Record<IdeaCategory, { label: string; icon: React.ReactNode; color: string }> = {
  trending: { label: "Trending", icon: <Flame size={14} />, color: "text-orange-600 bg-orange-50" },
  competitor: { label: "Competitor", icon: <Users size={14} />, color: "text-teal-700 bg-teal-50" },
  evergreen: { label: "Evergreen", icon: <Leaf size={14} />, color: "text-emerald-600 bg-emerald-50" },
  audience: { label: "Audience", icon: <MessageCircle size={14} />, color: "text-sky-600 bg-sky-50" },
  personal: { label: "Personal", icon: <Sparkles size={14} />, color: "text-pink-600 bg-pink-50" },
  archived: { label: "Archived", icon: <Archive size={14} />, color: "text-themed-tertiary bg-surface-hover" },
};

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-surface-hover text-themed-secondary",
};

// Extract clean FormatId (A-G) from strings like "C (Demo)" or "D (Myth Buster)"
function extractFormatId(raw: string): FormatId | null {
  const match = raw?.trim().match(/^([A-G])\b/);
  return (match ? match[1] : null) as FormatId | null;
}

type IdeasResponse = { ideas: Idea[]; total: number };
type SummaryResponse = { counts: Record<string, number>; total: number };

type IdeasViewProps = {
  onNavigate?: (view: DashboardView) => void;
};

// ============================================================
// Inspiration Inbox
// ============================================================

const CATEGORY_OPTIONS: { value: IdeaCategory; label: string }[] = [
  { value: "trending", label: "Trending" },
  { value: "competitor", label: "Competitor" },
  { value: "evergreen", label: "Evergreen" },
  { value: "audience", label: "Audience" },
  { value: "personal", label: "Personal" },
];

type DevelopState = { itemId: number; topic: string; category: IdeaCategory; priority: "High" | "Medium" | "Low" } | null;

const InspirationInbox: React.FC = () => {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [input, setInput] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [developing, setDeveloping] = useState<DevelopState>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data } = useQuery<{ items: InboxItem[] }>({
    queryKey: ["inbox"],
    queryFn: () => fetch("/api/inbox").then((r) => r.json()),
  });

  const items = data?.items ?? [];
  const pendingCount = items.filter((i) => i.status === "inbox").length;

  const captureMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim(), sourceUrl: urlInput.trim() || undefined }),
      });
      if (!res.ok) throw new Error("Failed to capture");
    },
    onSuccess: () => {
      setInput("");
      setUrlInput("");
      setShowUrl(false);
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/inbox/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inbox"] }),
  });

  const developMutation = useMutation({
    mutationFn: (dev: NonNullable<DevelopState>) =>
      fetch(`/api/inbox/${dev.itemId}/develop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: dev.topic, category: dev.category, priority: dev.priority }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setDeveloping(null);
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && input.trim()) {
      captureMutation.mutate();
    }
  };

  return (
    <div className="bg-surface-elevated border border-themed rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Inbox size={15} className="text-amber-500" />
          <span className="text-sm font-bold text-themed">Inspiration Inbox</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
              {pendingCount}
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown size={14} className="text-themed-muted" /> : <ChevronUp size={14} className="text-themed-muted" />}
      </button>

      {!collapsed && (
        <div className="border-t border-themed-subtle">
          {/* Capture input */}
          <div className="px-4 py-3 space-y-2">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="What caught your eye? Drop a link, a phrase, a thought... (⌘+Enter to save)"
                rows={2}
                className="w-full text-sm text-themed placeholder-slate-400 bg-surface-hover border border-themed rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-transparent"
              />
            </div>
            {showUrl && (
              <div className="flex items-center gap-2">
                <Link size={12} className="text-themed-muted shrink-0" />
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Source URL (optional)"
                  className="flex-1 text-xs text-themed-secondary placeholder-slate-400 bg-surface-hover border border-themed rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              </div>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowUrl((v) => !v)}
                className="text-[10px] font-bold text-themed-muted hover:text-themed-secondary transition-colors flex items-center gap-1"
              >
                <Link size={10} />
                {showUrl ? "Hide URL" : "+ Add URL"}
              </button>
              <button
                onClick={() => captureMutation.mutate()}
                disabled={!input.trim() || captureMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={10} />
                Capture
              </button>
            </div>
          </div>

          {/* Inbox items */}
          {items.filter((i) => i.status === "inbox").length > 0 && (
            <div className="border-t border-themed-subtle divide-y divide-slate-50">
              {items
                .filter((i) => i.status === "inbox")
                .map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    {developing?.itemId === item.id ? (
                      // Develop form (inline)
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={developing.topic}
                          onChange={(e) => setDeveloping({ ...developing, topic: e.target.value })}
                          className="w-full text-sm text-themed bg-surface-hover border border-themed rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
                          placeholder="Topic for idea bank"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <select
                            value={developing.category}
                            onChange={(e) => setDeveloping({ ...developing, category: e.target.value as IdeaCategory })}
                            className="flex-1 text-xs bg-surface-elevated border border-themed rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300"
                          >
                            {CATEGORY_OPTIONS.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                          <select
                            value={developing.priority}
                            onChange={(e) => setDeveloping({ ...developing, priority: e.target.value as "High" | "Medium" | "Low" })}
                            className="text-xs bg-surface-elevated border border-themed rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300"
                          >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => developMutation.mutate(developing)}
                            disabled={!developing.topic.trim() || developMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 transition-colors"
                          >
                            <Check size={10} />
                            Add to Idea Bank
                          </button>
                          <button
                            onClick={() => setDeveloping(null)}
                            className="px-3 py-1.5 rounded-full text-[10px] font-bold bg-surface-hover text-themed-secondary hover:bg-surface-hover transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // Normal item view
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-themed leading-snug">{item.content}</p>
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-teal-600 hover:underline mt-0.5 block truncate"
                            >
                              {item.sourceUrl}
                            </a>
                          )}
                          <p className="text-[10px] text-themed-muted mt-0.5">
                            {new Date(item.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => setDeveloping({
                              itemId: item.id,
                              topic: item.content.slice(0, 120),
                              category: "personal",
                              priority: "Medium",
                            })}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors"
                          >
                            <Plus size={10} />
                            Develop
                          </button>
                          <button
                            onClick={() => dismissMutation.mutate(item.id)}
                            className="w-6 h-6 rounded-full flex items-center justify-center bg-surface-hover text-themed-muted hover:bg-red-50 hover:text-red-400 transition-colors"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}

          {items.filter((i) => i.status === "inbox").length === 0 && (
            <div className="px-4 py-3 text-center text-xs text-themed-muted border-t border-themed-subtle">
              Inbox empty — capture something above
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================
// Research Suggestions (ideas extracted from research outputs)
// ============================================================

type ResearchSuggestionsResponse = { suggestions: ResearchIdea[]; total: number; newCount: number };

const ResearchSuggestions: React.FC = () => {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("dismissed-research-suggestions");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [addedTopics, setAddedTopics] = useState<Set<string>>(new Set());

  const { data } = useQuery<ResearchSuggestionsResponse>({
    queryKey: ["research-suggestions"],
    queryFn: () => fetch("/api/ideas/research-suggestions").then((r) => r.json()),
    staleTime: 60000,
  });

  const addMutation = useMutation({
    mutationFn: async (idea: ResearchIdea) => {
      const res = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: [{
            topic: idea.topic,
            suggestedFormat: idea.suggestedFormat,
            hookAngle: idea.hookAngle,
            priority: idea.priority,
            source: idea.source,
            category: idea.category as IdeaCategory,
          }],
        }),
      });
      if (!res.ok) throw new Error("Failed to add idea");
      return idea.topic;
    },
    onSuccess: (topic) => {
      setAddedTopics((prev) => new Set([...prev, topic]));
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      queryClient.invalidateQueries({ queryKey: ["research-suggestions"] });
    },
  });

  const handleDismiss = (topic: string) => {
    const next = new Set([...dismissed, topic]);
    setDismissed(next);
    localStorage.setItem("dismissed-research-suggestions", JSON.stringify([...next]));
  };

  const suggestions = (data?.suggestions ?? []).filter(
    (s) => !s.alreadyInBank && !dismissed.has(s.topic) && !addedTopics.has(s.topic),
  );

  if (suggestions.length === 0) return null;

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-between w-full"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-teal-600" />
          <span className="text-[11px] font-black uppercase tracking-[0.15em] text-teal-700">
            From Research
          </span>
          <span className="px-2 py-0.5 rounded-full bg-teal-200 text-teal-800 text-[10px] font-bold">
            {suggestions.length} new
          </span>
        </div>
        {collapsed ? <ChevronDown size={16} className="text-teal-500" /> : <ChevronUp size={16} className="text-teal-500" />}
      </button>

      {!collapsed && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
          {suggestions.slice(0, 12).map((idea) => {
            const isExpanded = expandedTopic === idea.topic;
            const hasContext = idea.context || idea.gapDescription || (idea.platforms && idea.platforms.length > 0);
            return (
            <div
              key={`${idea.sourceFile}-${idea.topic}`}
              className={cn(
                "flex-shrink-0 bg-surface-elevated rounded-xl border border-themed p-3 shadow-sm transition-all",
                isExpanded ? "w-80" : "w-64",
                hasContext ? "cursor-pointer hover:shadow-md hover:border-teal-300" : "hover:shadow-md",
              )}
              onClick={() => hasContext && setExpandedTopic(isExpanded ? null : idea.topic)}
            >
              <h4 className="text-[13px] font-semibold text-themed leading-snug line-clamp-2 mb-2">
                {idea.topic}
              </h4>
              {idea.hookAngle && (
                <p className="text-[10px] text-themed-tertiary line-clamp-1 mb-2 italic">
                  "{idea.hookAngle}"
                </p>
              )}
              <div className="flex items-center gap-1.5 flex-wrap mb-2.5">
                {idea.suggestedFormat && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-teal-100 text-teal-700">
                    {idea.suggestedFormat}
                  </span>
                )}
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-bold",
                  PRIORITY_COLORS[idea.priority] ?? PRIORITY_COLORS.Medium,
                )}>
                  {idea.priority}
                </span>
                {idea.platforms && idea.platforms.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-100 text-sky-700">
                    {idea.platforms.join(" / ")}
                  </span>
                )}
              </div>

              {/* Expanded context preview */}
              {isExpanded && (
                <div className="mb-2.5 space-y-2 border-t border-themed-subtle pt-2">
                  {idea.context && (
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-teal-600">Why it's trending</span>
                      <p className="text-[11px] text-themed-secondary leading-snug mt-0.5">{idea.context}</p>
                    </div>
                  )}
                  {idea.gapDescription && (
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-500">Content gap</span>
                      <p className="text-[11px] text-themed-secondary leading-snug mt-0.5">{idea.gapDescription}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsed hint */}
              {!isExpanded && hasContext && (
                <div className="text-[9px] text-teal-500 mb-2 flex items-center gap-1">
                  <Eye size={10} /> Click to preview context
                </div>
              )}

              <div className="text-[9px] text-themed-muted mb-2.5 truncate">{idea.source}</div>
              <div className="flex gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); addMutation.mutate(idea); }}
                  disabled={addMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-teal-700 transition-colors disabled:opacity-50"
                >
                  <Plus size={11} /> Add
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDismiss(idea.topic); }}
                  className="px-2.5 py-1.5 rounded-lg bg-surface-hover text-themed-muted hover:bg-surface-hover hover:text-themed-secondary transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const IdeasView: React.FC<IdeasViewProps> = ({ onNavigate }) => {
  const [activeCategory, setActiveCategory] = useState<IdeaCategory | "all">("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [highlightedTopic, setHighlightedTopic] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const handleIdeaAdded = useCallback((topic: string) => {
    setLabOpen(false);
    setHighlightedTopic(topic);
    setTimeout(() => {
      const el = document.querySelector(`[data-topic="${CSS.escape(topic)}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    setTimeout(() => setHighlightedTopic(null), 3500);
  }, []);

  const { data: summary } = useQuery<SummaryResponse>({
    queryKey: ["ideas-summary"],
    queryFn: () => fetch("/api/ideas/summary").then((r) => r.json()),
  });

  const { data, isLoading } = useQuery<IdeasResponse>({
    queryKey: ["ideas", activeCategory],
    queryFn: () => {
      const params = activeCategory !== "all" ? `?category=${activeCategory}` : "";
      return fetch(`/api/ideas${params}`).then((r) => r.json());
    },
  });

  const { data: intelData } = useQuery<{ ideas: WatchlistIntelIdea[]; date: string | null }>({
    queryKey: ["watchlist-intel-latest"],
    queryFn: () => fetch("/api/watchlist-intel/latest").then((r) => r.json()),
  });

  const ideas = data?.ideas ?? [];
  const intelIdeas = intelData?.ideas ?? [];
  const existingTopics = new Set((data?.ideas ?? []).map((i) => i.topic.toLowerCase().trim()));
  const unadoptedIntel = intelIdeas.filter((i) => !existingTopics.has(i.topic.toLowerCase().trim()));
  const categories: (IdeaCategory | "all")[] = ["all", "trending", "competitor", "evergreen", "audience", "personal", "archived"];

  return (
    <div className="p-6 md:p-12 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Lightbulb size={24} className="text-amber-500" />
            <h1 className="type-h1">Idea bank</h1>
          </div>
          <p className="type-body">
            Content ideas staged for future planning. Click an idea to develop, edit, or archive it.
          </p>
          {syncMessage && (
            <p className="text-xs text-teal-600 mt-2">{syncMessage}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setLabOpen((v) => !v)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors",
              labOpen
                ? "bg-amber-500 text-white"
                : "bg-amber-100 text-amber-700 hover:bg-amber-200"
            )}
          >
            <Zap size={14} />
            Lab
          </button>
          <button
            onClick={() => setGeneratorOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest bg-teal-600 text-white hover:bg-teal-700 transition-colors"
          >
            <Sparkles size={14} />
            Generate
          </button>
          <FeatureHint id="sync-n8n" content={FEATURE_HINTS["sync-n8n"].content} side="bottom">
          <button
            onClick={async () => {
              setSyncing(true);
              setSyncMessage(null);
              try {
                const res = await fetch("/api/ideas/sync-n8n", { method: "POST" });
                const data = await res.json();
                if (!res.ok) {
                  setSyncMessage(`Sync failed: ${data.error}`);
                } else if (data.synced > 0) {
                  setSyncMessage(`Synced ${data.synced} new idea${data.synced > 1 ? "s" : ""} from n8n`);
                  queryClient.invalidateQueries({ queryKey: ["ideas"] });
                  queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
                } else {
                  setSyncMessage(data.message || "No new ideas to sync");
                }
                setTimeout(() => setSyncMessage(null), 5000);
              } catch {
                setSyncMessage("Failed to connect to server");
                setTimeout(() => setSyncMessage(null), 5000);
              }
              setSyncing(false);
            }}
            disabled={syncing}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-colors",
              syncing
                ? "bg-surface-hover text-themed-muted cursor-wait"
                : "bg-teal-600 text-white hover:bg-teal-700",
            )}
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync n8n"}
          </button>
          </FeatureHint>
        </div>
      </div>

      {/* Idea Lab */}
      {labOpen && (
        <IdeaLab
          onClose={() => setLabOpen(false)}
          onIdeaAdded={handleIdeaAdded}
          existingTopics={ideas.map((i) => i.topic)}
        />
      )}

      {/* Inspiration Inbox */}
      <InspirationInbox />

      {/* Research Suggestions */}
      <ResearchSuggestions />

      {/* Category Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const count = cat === "all"
            ? (summary?.total ?? 0)
            : (summary?.counts[cat] ?? 0);
          const meta = cat === "all" ? null : CATEGORY_META[cat];
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors",
                activeCategory === cat
                  ? "bg-teal-600 text-white"
                  : "bg-surface-elevated border border-themed text-themed-secondary hover:border-themed",
              )}
            >
              {meta?.icon}
              {cat === "all" ? "All" : meta?.label}
              {count > 0 && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px]",
                  activeCategory === cat ? "bg-teal-700" : "bg-surface-hover",
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Competitor Insights from Watchlist Intelligence */}
      {unadoptedIntel.length > 0 && activeCategory !== "archived" && (
        <CompetitorInsights ideas={unadoptedIntel} intelDate={intelData?.date ?? null} />
      )}

      {/* Ideas List */}
      {isLoading ? (
        <div className="text-center py-12 text-themed-muted text-sm">Loading ideas...</div>
      ) : ideas.length === 0 ? (
        <div>
          <EmptyState
            icon={<Lightbulb size={24} className="text-themed-muted" />}
            headline="No ideas yet"
            description={activeCategory === "all"
              ? "Run /viral-scout or /last30days to discover content ideas, or add them manually."
              : `No ${CATEGORY_META[activeCategory as IdeaCategory]?.label.toLowerCase()} ideas yet.`}
          />
          {onNavigate && (
            <div className="mt-6">
              <button
                onClick={() => onNavigate("OPPORTUNITIES")}
                className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
              >
                <div>
                  <span className="text-sm font-semibold text-teal-800">Discover Opportunities</span>
                  <span className="block text-xs text-teal-600 mt-0.5">Generate opportunities from trending topics</span>
                </div>
                <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {ideas.map((idea) => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              onClick={() => setSelectedIdea(idea)}
              highlighted={highlightedTopic === idea.topic}
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selectedIdea && (
        <IdeaDetail
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          onUpdated={() => setSelectedIdea(null)}
        />
      )}

      {/* Generator Modal */}
      {generatorOpen && (
        <IdeaGeneratorModal onClose={() => setGeneratorOpen(false)} />
      )}

      <ViewHelp {...VIEW_HELP.IDEAS} />
    </div>
  );
};

// ============================================
// Competitor Insights from Watchlist Intelligence
// ============================================

const CompetitorInsights: React.FC<{ ideas: WatchlistIntelIdea[]; intelDate: string | null }> = ({ ideas, intelDate }) => {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const [addedTopics, setAddedTopics] = useState<Set<string>>(new Set());

  const addMutation = useMutation({
    mutationFn: async (idea: WatchlistIntelIdea) => {
      const r = await fetch("/api/watchlist-intel/add-idea", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: idea.topic,
          suggestedFormat: idea.suggestedFormat,
          hookAngle: idea.hookAngle,
          priority: idea.priority,
          source: idea.source,
          category: idea.category || "competitor",
          inspiredBy: idea.inspiredBy,
        }),
      });
      if (!r.ok) throw new Error("Failed to add idea");
      return r.json();
    },
    onSuccess: (_data, idea) => {
      setAddedTopics((prev) => new Set(prev).add(idea.topic));
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
    },
  });

  const displayIdeas = expanded ? ideas : ideas.slice(0, 3);

  return (
    <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-teal-700" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">
            Competitor Insights
          </p>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal-200 text-teal-800">
            {ideas.length}
          </span>
        </div>
        {intelDate && (
          <p className="text-[10px] text-teal-500">{intelDate}</p>
        )}
      </div>
      <p className="text-xs text-teal-700 mb-3">
        Non-obvious opportunities from watchlist intelligence. Add promising ones to your idea bank.
      </p>
      <div className="space-y-2">
        {displayIdeas.map((idea, i) => {
          const wasAdded = addedTopics.has(idea.topic);
          return (
            <div key={i} className="bg-surface-elevated border border-teal-100 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-themed">{idea.topic}</p>
                  {idea.hookAngle && (
                    <p className="text-xs text-themed-tertiary mt-0.5">{idea.hookAngle}</p>
                  )}
                  {idea.whyNonObvious && (
                    <p className="text-[11px] text-teal-700 mt-1 italic">"{idea.whyNonObvious}"</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {idea.inspiredBy && (
                      <span className="text-[10px] text-teal-600">Inspired by: {idea.inspiredBy}</span>
                    )}
                    {idea.suggestedFormat && (
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">
                        {idea.suggestedFormat}
                      </span>
                    )}
                    {idea.targetAudience && (
                      <span className="text-[10px] text-themed-muted">{idea.targetAudience}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => !wasAdded && addMutation.mutate(idea)}
                  disabled={wasAdded || addMutation.isPending}
                  className={cn(
                    "shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
                    wasAdded
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-teal-100 text-teal-800 hover:bg-teal-200",
                  )}
                >
                  {wasAdded ? <><Check size={12} /> Added</> : <><Plus size={12} /> Add</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {ideas.length > 3 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-teal-700 hover:text-teal-800 font-medium"
        >
          {expanded ? "Show less" : `Show ${ideas.length - 3} more`}
        </button>
      )}
    </div>
  );
};

const IdeaCard: React.FC<{ idea: Idea; onClick: () => void; highlighted?: boolean }> = ({ idea, onClick, highlighted }) => {
  const meta = CATEGORY_META[idea.category];
  const { data: conceptData } = useQuery<{ concept: IdeaConcept | null }>({
    queryKey: ["idea-concept", idea.topic],
    queryFn: () => fetch(`/api/ideas-ai/concept/${encodeURIComponent(idea.topic)}`).then((r) => r.json()),
    staleTime: 60_000,
  });
  const concept = conceptData?.concept;

  return (
    <div
      onClick={onClick}
      data-topic={idea.topic}
      className={cn(
        "bg-surface-elevated border border-themed rounded-2xl p-4 md:p-5 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer",
        highlighted && "ring-2 ring-teal-400 ring-offset-1 border-teal-300"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-themed text-sm">{idea.topic}</p>
            {concept?.approved && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-bold flex-shrink-0">
                <Shield size={8} /> Concept Ready
              </span>
            )}
            {concept && !concept.approved && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[8px] font-bold flex-shrink-0">
                {concept.overallScore ?? "?"}/10
              </span>
            )}
          </div>
          {idea.hookAngle && (
            <p className="text-xs text-themed-tertiary mt-1 line-clamp-2">{idea.hookAngle}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {idea.suggestedFormat && (() => {
              const fmtId = extractFormatId(idea.suggestedFormat);
              return fmtId
                ? <FormatBadge format={fmtId} />
                : <span className="text-[10px] font-bold uppercase tracking-wider text-themed-muted">{idea.suggestedFormat}</span>;
            })()}
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", meta.color)}>
              {meta.label}
            </span>
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", PRIORITY_COLORS[idea.priority] ?? PRIORITY_COLORS.Medium)}>
              {idea.priority}
            </span>
          </div>
        </div>
        <div className="text-right shrink-0">
          {idea.dateAdded && (
            <p className="text-[10px] text-themed-muted">{idea.dateAdded}</p>
          )}
          {idea.source && (
            <p className="text-[10px] text-themed-muted mt-0.5 max-w-[120px] truncate">{idea.source}</p>
          )}
        </div>
      </div>
    </div>
  );
};
