import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, Users, ExternalLink, ChevronDown, ChevronUp, Radar, Sparkles, TrendingUp, UserPlus, RefreshCw } from "lucide-react";
import type { WatchlistCreator, CreatorInsight, RisingCreator, WatchlistIntelIdea } from "../shared/types.js";
import { SkillButton } from "./ui/SkillButton.js";
import { cn } from "../utils/cn.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP } from "../shared/help-content.js";

type EnrichedCreator = WatchlistCreator & { hasInsight?: boolean };
type WatchlistResponse = { creators: EnrichedCreator[]; total: number };
type IntelResponse = {
  date: string | null;
  ideas: WatchlistIntelIdea[];
  risingCreators: RisingCreator[];
  selfImprovementNotes: { bestQueries: string[]; mostActionableCreators: string[]; nextScanFocus: string } | null;
  previousTopics: string[];
};

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: "bg-slate-900 text-white",
  Instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  YouTube: "bg-red-600 text-white",
  Twitter: "bg-sky-500 text-white",
  X: "bg-slate-900 text-white",
};

export const WatchlistView: React.FC = () => {
  const { data, isLoading } = useQuery<WatchlistResponse>({
    queryKey: ["watchlist"],
    queryFn: () => fetch("/api/watchlist").then((r) => r.json()),
  });

  const { data: intelData } = useQuery<IntelResponse>({
    queryKey: ["watchlist-intel"],
    queryFn: () => fetch("/api/watchlist-intel/latest").then((r) => r.json()),
  });

  const queryClient = useQueryClient();
  const syncMutation = useMutation({
    mutationFn: () => fetch("/api/watchlist-intel/sync-n8n", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist-intel"] });
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
    },
  });

  const [expandedHandle, setExpandedHandle] = useState<string | null>(null);
  const creators = data?.creators ?? [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Eye size={20} className="text-violet-500" />
          <h2 className="text-lg font-serif font-bold text-slate-900">Creator Watchlist</h2>
        </div>
        <p className="text-sm text-slate-500">
          Track competitors and inspiration creators. Analyze their patterns directly from here.
        </p>
      </div>

      {/* Creator Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading watchlist...</div>
      ) : creators.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
          <Users size={32} className="text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-2">
            No creators on your watchlist yet.
          </p>
          <p className="text-slate-400 text-xs">
            Add creators to <code className="bg-slate-100 px-1 py-0.5 rounded">watchlist.md</code>
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {creators.map((creator) => (
            <CreatorCard
              key={creator.handle}
              creator={creator}
              isExpanded={expandedHandle === creator.handle}
              onToggle={() => setExpandedHandle(expandedHandle === creator.handle ? null : creator.handle)}
            />
          ))}
        </div>
      )}

      {/* Latest Intelligence */}
      {intelData?.date ? (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Watchlist Intelligence
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400">{intelData.date}</span>
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-700 disabled:opacity-50"
                  title="Sync latest report from n8n"
                >
                  <RefreshCw size={12} className={syncMutation.isPending ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{intelData.ideas?.length || 0}</p>
                <p className="text-[10px] text-slate-500 font-medium">Ideas Found</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{intelData.risingCreators?.length || 0}</p>
                <p className="text-[10px] text-slate-500 font-medium">Rising Creators</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{intelData.previousTopics?.length || 0}</p>
                <p className="text-[10px] text-slate-500 font-medium">Topics Tracked</p>
              </div>
            </div>

            {/* Non-Obvious Ideas */}
            {intelData.ideas?.length > 0 && (
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Non-Obvious Opportunities
                </p>
                <div className="space-y-2">
                  {intelData.ideas.slice(0, 5).map((idea, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-medium text-slate-900">{idea.topic}</p>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-bold flex-shrink-0",
                          idea.priority === "High" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-600",
                        )}>
                          {idea.priority}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-1">{idea.whyNonObvious}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        {idea.suggestedFormat && <span className="font-mono">{idea.suggestedFormat}</span>}
                        {idea.inspiredBy && <span>via {idea.inspiredBy}</span>}
                        {idea.targetAudience && <span>{idea.targetAudience}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rising Creators */}
            {intelData.risingCreators?.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Rising Creators
                </p>
                <div className="space-y-2">
                  {intelData.risingCreators.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                      <div className="flex items-center gap-2">
                        <UserPlus size={12} className="text-teal-500" />
                        <span className="text-sm font-medium text-slate-900">{c.handle}</span>
                        <span className="text-[10px] text-slate-400">{c.platform}</span>
                        {c.followers && <span className="text-[10px] text-slate-400">{c.followers}</span>}
                      </div>
                      <span className="text-xs text-slate-500 text-right max-w-[200px] truncate">{c.whyWatch}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Self-Improvement Focus */}
            {intelData.selfImprovementNotes?.nextScanFocus && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={12} className="text-teal-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Next Scan Focus</p>
                </div>
                <p className="text-xs text-slate-500">{intelData.selfImprovementNotes.nextScanFocus}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-slate-300" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Watchlist Intelligence
              </p>
            </div>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={syncMutation.isPending ? "animate-spin" : ""} />
              {syncMutation.isPending ? "Syncing..." : "Sync from n8n"}
            </button>
          </div>
          {syncMutation.isSuccess && (syncMutation.data as { synced: boolean })?.synced === false && (
            <p className="text-xs text-slate-500 mt-2">{(syncMutation.data as { message?: string })?.message || "No data found"}</p>
          )}
          {syncMutation.isError && (
            <p className="text-xs text-rose-500 mt-2">Sync failed. Check n8n connection.</p>
          )}
          {!syncMutation.isPending && !syncMutation.isSuccess && (
            <p className="text-xs text-slate-400 mt-2">
              Run the Watchlist Intelligence workflow in n8n, then sync to pull the report.
            </p>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
          Quick Actions
        </p>
        <div className="flex flex-wrap gap-2">
          <SkillButton skill="/competitor-research" args="chiropractic" label="Competitor Research" icon={<Radar size={14} />} />
          <SkillButton skill="/viral-scout" args="chiropractic" label="Viral Scout" icon={<Radar size={14} />} />
        </div>
      </div>

      <ViewHelp {...VIEW_HELP.WATCHLIST} />
    </div>
  );
};

type CreatorCardProps = {
  creator: EnrichedCreator;
  isExpanded: boolean;
  onToggle: () => void;
};

const CreatorCard: React.FC<CreatorCardProps> = ({ creator, isExpanded, onToggle }) => {
  const platformColor = PLATFORM_COLORS[creator.platform] ?? "bg-slate-200 text-slate-700";
  const isStale = !creator.lastAnalyzed || creator.lastAnalyzed.trim() === "";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-medium text-slate-900 text-sm flex items-center gap-1.5">
            {creator.handle}
            <ExternalLink size={12} className="text-slate-400" />
          </p>
          {creator.followers && (
            <p className="text-xs text-slate-500 mt-0.5">{creator.followers} followers</p>
          )}
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${platformColor}`}>
          {creator.platform}
        </span>
      </div>

      {creator.whyTracking && (
        <p className="text-xs text-slate-600 mb-2">{creator.whyTracking}</p>
      )}

      <div className="flex flex-wrap gap-2 text-[10px]">
        {creator.contentStyle && (
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {creator.contentStyle}
          </span>
        )}
        {creator.frequency && (
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
            {creator.frequency}
          </span>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkillButton
            skill="/creator-analysis"
            args={creator.handle}
            label="Analyze"
            icon={<Radar size={12} />}
            variant="secondary"
          />
          {creator.hasInsight && (
            <button
              onClick={onToggle}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-600 hover:text-violet-700"
            >
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {isExpanded ? "Hide" : "View"} Analysis
            </button>
          )}
        </div>
        <p className={cn("text-xs", isStale ? "text-amber-500 font-medium" : "text-slate-500")}>
          {isStale ? "Never analyzed" : creator.lastAnalyzed}
        </p>
      </div>

      {/* Expanded Insight Panel */}
      {isExpanded && creator.hasInsight && (
        <CreatorInsightPanel handle={creator.handle} />
      )}
    </div>
  );
};

const CreatorInsightPanel: React.FC<{ handle: string }> = ({ handle }) => {
  const cleanHandle = handle.replace("@", "").toLowerCase();
  const { data, isLoading } = useQuery<{ available: boolean; insight: CreatorInsight | null }>({
    queryKey: ["creator-insight", cleanHandle],
    queryFn: () => fetch(`/api/watchlist/${cleanHandle}/insights`).then((r) => r.json()),
  });

  if (isLoading) return <div className="mt-3 text-xs text-slate-400">Loading analysis...</div>;
  if (!data?.insight) return null;

  const insight = data.insight;

  return (
    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
      {insight.keyTakeaways.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Key Takeaways</p>
          <ul className="space-y-1">
            {insight.keyTakeaways.map((t, i) => (
              <li key={i} className="text-xs text-slate-600 flex gap-1.5">
                <span className="text-teal-500 mt-0.5">-</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insight.contentPatterns.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Content Patterns</p>
          <div className="flex flex-wrap gap-1">
            {insight.contentPatterns.slice(0, 6).map((p, i) => (
              <span key={i} className="bg-teal-50 text-teal-700 text-[10px] px-2 py-0.5 rounded-full">{p}</span>
            ))}
          </div>
        </div>
      )}

      {insight.hookStyles.length > 0 && (
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Hook Styles</p>
          <div className="flex flex-wrap gap-1">
            {insight.hookStyles.slice(0, 6).map((h, i) => (
              <span key={i} className="bg-violet-50 text-violet-700 text-[10px] px-2 py-0.5 rounded-full">{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
