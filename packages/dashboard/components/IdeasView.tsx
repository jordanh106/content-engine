import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Flame, Users, Leaf, MessageCircle, Sparkles, Archive, RefreshCw, ArrowRight, Eye, Plus, Check } from "lucide-react";
import type { Idea, IdeaCategory, DashboardView, WatchlistIntelIdea } from "../shared/types.js";
import { IdeaDetail } from "./IdeaDetail.js";
import { IdeaGeneratorModal } from "./IdeaGeneratorModal.js";
import { cn } from "../utils/cn.js";
import { EmptyState } from "./ui/EmptyState.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";

const CATEGORY_META: Record<IdeaCategory, { label: string; icon: React.ReactNode; color: string }> = {
  trending: { label: "Trending", icon: <Flame size={14} />, color: "text-orange-600 bg-orange-50" },
  competitor: { label: "Competitor", icon: <Users size={14} />, color: "text-violet-600 bg-violet-50" },
  evergreen: { label: "Evergreen", icon: <Leaf size={14} />, color: "text-emerald-600 bg-emerald-50" },
  audience: { label: "Audience", icon: <MessageCircle size={14} />, color: "text-sky-600 bg-sky-50" },
  personal: { label: "Personal", icon: <Sparkles size={14} />, color: "text-pink-600 bg-pink-50" },
  archived: { label: "Archived", icon: <Archive size={14} />, color: "text-slate-500 bg-slate-100" },
};

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
};

type IdeasResponse = { ideas: Idea[]; total: number };
type SummaryResponse = { counts: Record<string, number>; total: number };

type IdeasViewProps = {
  onNavigate?: (view: DashboardView) => void;
};

export const IdeasView: React.FC<IdeasViewProps> = ({ onNavigate }) => {
  const [activeCategory, setActiveCategory] = useState<IdeaCategory | "all">("all");
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const queryClient = useQueryClient();

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
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb size={20} className="text-amber-500" />
            <h2 className="text-lg font-serif font-bold text-slate-900">Idea Bank</h2>
          </div>
          <p className="text-sm text-slate-500">
            Content ideas staged for future planning. Click an idea to develop, edit, or archive it.
          </p>
          {syncMessage && (
            <p className="text-xs text-teal-600 mt-1.5">{syncMessage}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setGeneratorOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest bg-violet-600 text-white hover:bg-violet-700 transition-colors"
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
                ? "bg-slate-100 text-slate-400 cursor-wait"
                : "bg-teal-600 text-white hover:bg-teal-700",
            )}
          >
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing..." : "Sync n8n"}
          </button>
          </FeatureHint>
        </div>
      </div>

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
                  : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300",
              )}
            >
              {meta?.icon}
              {cat === "all" ? "All" : meta?.label}
              {count > 0 && (
                <span className={cn(
                  "ml-1 px-1.5 py-0.5 rounded-full text-[10px]",
                  activeCategory === cat ? "bg-teal-700" : "bg-slate-100",
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
        <div className="text-center py-12 text-slate-400 text-sm">Loading ideas...</div>
      ) : ideas.length === 0 ? (
        <div>
          <EmptyState
            icon={<Lightbulb size={24} className="text-slate-400" />}
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
    <div className="bg-violet-50 border border-violet-200 rounded-2xl p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-violet-600" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600">
            Competitor Insights
          </p>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-200 text-violet-700">
            {ideas.length}
          </span>
        </div>
        {intelDate && (
          <p className="text-[10px] text-violet-400">{intelDate}</p>
        )}
      </div>
      <p className="text-xs text-violet-600 mb-3">
        Non-obvious opportunities from watchlist intelligence. Add promising ones to your idea bank.
      </p>
      <div className="space-y-2">
        {displayIdeas.map((idea, i) => {
          const wasAdded = addedTopics.has(idea.topic);
          return (
            <div key={i} className="bg-white border border-violet-100 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{idea.topic}</p>
                  {idea.hookAngle && (
                    <p className="text-xs text-slate-500 mt-0.5">{idea.hookAngle}</p>
                  )}
                  {idea.whyNonObvious && (
                    <p className="text-[11px] text-violet-600 mt-1 italic">"{idea.whyNonObvious}"</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {idea.inspiredBy && (
                      <span className="text-[10px] text-violet-500">Inspired by: {idea.inspiredBy}</span>
                    )}
                    {idea.suggestedFormat && (
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {idea.suggestedFormat}
                      </span>
                    )}
                    {idea.targetAudience && (
                      <span className="text-[10px] text-slate-400">{idea.targetAudience}</span>
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
                      : "bg-violet-100 text-violet-700 hover:bg-violet-200",
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
          className="mt-2 text-xs text-violet-600 hover:text-violet-800 font-medium"
        >
          {expanded ? "Show less" : `Show ${ideas.length - 3} more`}
        </button>
      )}
    </div>
  );
};

const IdeaCard: React.FC<{ idea: Idea; onClick: () => void }> = ({ idea, onClick }) => {
  const meta = CATEGORY_META[idea.category];
  return (
    <div
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 hover:border-teal-300 hover:shadow-sm transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-900 text-sm">{idea.topic}</p>
          {idea.hookAngle && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">{idea.hookAngle}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            {idea.suggestedFormat && (
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                {idea.suggestedFormat}
              </span>
            )}
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
            <p className="text-[10px] text-slate-400">{idea.dateAdded}</p>
          )}
          {idea.source && (
            <p className="text-[10px] text-slate-400 mt-0.5 max-w-[120px] truncate">{idea.source}</p>
          )}
        </div>
      </div>
    </div>
  );
};
