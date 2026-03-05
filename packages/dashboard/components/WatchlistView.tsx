import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Users, ExternalLink, ChevronDown, ChevronUp, Radar } from "lucide-react";
import type { WatchlistCreator, CreatorInsight } from "../shared/types.js";
import { SkillButton } from "./ui/SkillButton.js";
import { cn } from "../utils/cn.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { VIEW_HELP } from "../shared/help-content.js";

type EnrichedCreator = WatchlistCreator & { hasInsight?: boolean };
type WatchlistResponse = { creators: EnrichedCreator[]; total: number };

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
