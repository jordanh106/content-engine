import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Users, ExternalLink } from "lucide-react";
import type { WatchlistCreator } from "../shared/types.js";

type WatchlistResponse = { creators: WatchlistCreator[]; total: number };

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
          Track competitors and inspiration creators. Run <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">/creator-analysis @handle</code> to analyze a creator's content patterns.
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
            Add creators to <code className="bg-slate-100 px-1 py-0.5 rounded">industries/chiropractic/watchlist.md</code> or run <code className="bg-slate-100 px-1 py-0.5 rounded">/creator-analysis</code> to start tracking.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {creators.map((creator) => (
            <CreatorCard key={creator.handle} creator={creator} />
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
          Quick Actions
        </p>
        <div className="space-y-2 text-sm text-slate-600">
          <p>
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">/creator-analysis @handle</code>{" "}
            <span className="text-slate-400">- Deep-dive on a single creator</span>
          </p>
          <p>
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">/creator-analysis --watchlist</code>{" "}
            <span className="text-slate-400">- Analyze all tracked creators</span>
          </p>
          <p>
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">/competitor-research chiropractic</code>{" "}
            <span className="text-slate-400">- Broad landscape analysis</span>
          </p>
          <p>
            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">/viral-scout chiropractic</code>{" "}
            <span className="text-slate-400">- Find top-performing niche content</span>
          </p>
        </div>
      </div>
    </div>
  );
};

const CreatorCard: React.FC<{ creator: WatchlistCreator }> = ({ creator }) => {
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
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          Last Analyzed
        </p>
        <p className={`text-xs ${isStale ? "text-amber-500 font-medium" : "text-slate-500"}`}>
          {isStale ? "Never" : creator.lastAnalyzed}
        </p>
      </div>
    </div>
  );
};
