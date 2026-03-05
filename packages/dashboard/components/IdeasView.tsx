import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lightbulb, Flame, Users, Leaf, MessageCircle, Sparkles, Archive, RefreshCw } from "lucide-react";
import type { Idea, IdeaCategory } from "../shared/types.js";
import { IdeaDetail } from "./IdeaDetail.js";
import { IdeaGeneratorModal } from "./IdeaGeneratorModal.js";
import { cn } from "../utils/cn.js";
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

export const IdeasView: React.FC = () => {
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

  const ideas = data?.ideas ?? [];
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

      {/* Ideas List */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading ideas...</div>
      ) : ideas.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <Lightbulb size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">
            {activeCategory === "all"
              ? "No ideas yet. Run /viral-scout or /last30days to discover content ideas."
              : `No ${CATEGORY_META[activeCategory as IdeaCategory]?.label.toLowerCase()} ideas yet.`}
          </p>
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
