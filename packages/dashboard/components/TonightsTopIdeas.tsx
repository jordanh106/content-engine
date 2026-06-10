import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sparkles, ArrowRight, Layers, TrendingUp, Target, Eye, History, Loader2, Zap, Flag } from "lucide-react";
import { Eyebrow } from "./ui/Eyebrow.js";
import { Button } from "./ui/Button.js";
import { cn } from "../utils/cn.js";

type RankedIdea = {
  id: string;
  title: string;
  body: string;
  audienceTags: string[];
  formatHint?: string;
  hookAngle?: string;
  sources: Array<{ source: string; reference: string; recency: "fresh" | "recent" | "stale" }>;
  scores: {
    audienceFit: number;
    viralitySignal: number;
    formatFeasibility: number;
    competitiveGap: number;
    historicalFit: number;
    goalAlignment: number;
    composite: number;
  };
  developCtaKind: string;
};

type AudienceOption = { id: string; label: string };

const AUDIENCE_FILTERS: AudienceOption[] = [
  { id: "all",       label: "All" },
  { id: "prenatal",  label: "Prenatal" },
  { id: "infant",    label: "Infant" },
  { id: "kids",      label: "Kids" },
  { id: "athlete",   label: "Athlete" },
  { id: "adult",     label: "Adult" },
  { id: "senior",    label: "Senior" },
  { id: "general",   label: "General" },
];

const SOURCE_LABELS: Record<string, string> = {
  idea_bank: "Idea bank",
  inspiration_inbox: "Inbox",
  viral_insights: "Viral intel",
  creator_insights: "Creator pattern",
  audience_demand: "Audience demand",
  evergreen: "Evergreen",
};

type Props = {
  onDevelop?: (idea: RankedIdea) => void;
  /** how many cards to show. Defaults to 5. */
  limit?: number;
};

export const TonightsTopIdeas: React.FC<Props> = ({ onDevelop, limit = 5 }) => {
  const [audience, setAudience] = useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);

  const { data, isLoading } = useQuery<{ ideas: RankedIdea[]; total: number }>({
    queryKey: ["ideas-ranked", audience],
    queryFn: () => fetch(`/api/ideas/ranked?audience=${audience}&limit=${limit}`).then((r) => r.json()),
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const runStudio = useMutation({
    mutationFn: () =>
      fetch("/api/studio/run-now", { method: "POST" }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || `Studio trigger failed (${r.status})`);
        return body as { ok: true; message: string };
      }),
    onSuccess: (body) => {
      setToast(body.message || "Studio chain started.");
      setTimeout(() => setToast(null), 6000);
    },
    onError: (err) => {
      setToast(`Studio trigger failed: ${err instanceof Error ? err.message : String(err)}`);
      setTimeout(() => setToast(null), 8000);
    },
  });

  const ideas = data?.ideas ?? [];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-3 px-1 flex-wrap gap-2">
        <div>
          <Eyebrow tone="accent">Tonight's top ideas</Eyebrow>
          <p className="type-meta mt-0.5">Audience-tagged. Source-backed. Pick one and the production tools take it from here.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="hidden md:flex items-center gap-1.5 flex-wrap">
            {AUDIENCE_FILTERS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAudience(a.id)}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors",
                  audience === a.id
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-teal-400 hover:text-teal-700",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => runStudio.mutate()}
            disabled={runStudio.isPending}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors",
              "bg-rose-600 text-white border-rose-600 hover:bg-rose-700",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
            title="Run the Weekly Studio chain now: refresh voice doc, gather signals, seed 10 fresh ideas into the inbox"
          >
            {runStudio.isPending ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
            {runStudio.isPending ? "Triggering…" : "Run Studio"}
          </button>
        </div>
      </div>

      {toast && (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50/60 text-rose-900 text-xs px-3 py-2">
          {toast}
        </div>
      )}

      {/* Mobile audience picker */}
      <div className="md:hidden flex items-center gap-1.5 flex-wrap mb-3">
        {AUDIENCE_FILTERS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAudience(a.id)}
            className={cn(
              "px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors",
              audience === a.id
                ? "bg-teal-600 text-white border-teal-600"
                : "bg-white text-slate-600 border-slate-200",
            )}
          >
            {a.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="surface-secondary !p-5 animate-pulse">
              <div className="h-3 w-20 bg-slate-200 rounded mb-3" />
              <div className="h-5 w-3/4 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-full bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="surface-secondary text-center py-10">
          <Sparkles size={20} className="text-teal-300 mx-auto mb-2" />
          <p className="type-body">No ranked ideas yet for this audience.</p>
          <p className="type-meta mt-1">Add to the idea bank or run /audience-pulse to seed signals.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ideas.map((idea, idx) => (
            <IdeaCard key={idea.id} rank={idx + 1} idea={idea} onDevelop={onDevelop} />
          ))}
        </div>
      )}
    </section>
  );
};

const IdeaCard: React.FC<{ rank: number; idea: RankedIdea; onDevelop?: (idea: RankedIdea) => void }> = ({ rank, idea, onDevelop }) => {
  const primaryAudience = idea.audienceTags[0];
  const primarySource = idea.sources[0];

  return (
    <article className="surface-secondary !p-5 hover:border-teal-200 transition-colors flex flex-col">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-teal-50 text-teal-700 text-[11px] font-bold tabular-nums shrink-0">
            {rank}
          </span>
          {primaryAudience && (
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-600">
              {primaryAudience}
            </span>
          )}
          {idea.audienceTags.length > 1 && (
            <span className="text-[10px] font-medium text-slate-400">+ {idea.audienceTags.length - 1}</span>
          )}
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-bold tabular-nums text-slate-700 shrink-0">
          {idea.scores.composite}
        </span>
      </div>

      <h3 className="type-h4 mb-2 leading-snug">{idea.title}</h3>
      {idea.body && idea.body !== idea.title && (
        <p className="type-meta text-slate-600 mb-3 line-clamp-2">{idea.body}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500 mb-4">
        {idea.formatHint && (
          <span className="inline-flex items-center gap-1">
            <Layers size={11} /> Format {idea.formatHint}
          </span>
        )}
        {primarySource && (
          <span className="inline-flex items-center gap-1" title={primarySource.reference}>
            <TrendingUp size={11} /> {SOURCE_LABELS[primarySource.source] ?? primarySource.source}
          </span>
        )}
      </div>

      <div className="grid grid-cols-6 gap-1.5 mb-4 text-center">
        <ScoreChip label="Goal" value={idea.scores.goalAlignment} icon={<Flag size={10} />} />
        <ScoreChip label="Fit" value={idea.scores.audienceFit} icon={<Target size={10} />} />
        <ScoreChip label="Signal" value={idea.scores.viralitySignal} icon={<TrendingUp size={10} />} />
        <ScoreChip label="Track" value={idea.scores.historicalFit} icon={<History size={10} />} />
        <ScoreChip label="Format" value={idea.scores.formatFeasibility} icon={<Layers size={10} />} />
        <ScoreChip label="Gap" value={idea.scores.competitiveGap} icon={<Eye size={10} />} />
      </div>

      <div className="mt-auto">
        <Button
          variant="primary"
          tone="teal"
          size="sm"
          icon={<ArrowRight />}
          onClick={() => onDevelop?.(idea)}
          disabled={!onDevelop}
        >
          Develop into project
        </Button>
      </div>
    </article>
  );
};

const ScoreChip: React.FC<{ label: string; value: number; icon: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="rounded-lg bg-slate-50/60 border border-slate-100 px-2 py-1.5">
    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-center gap-1">
      {icon} {label}
    </div>
    <div className="text-[12px] font-bold tabular-nums text-slate-700 mt-0.5">{value}</div>
  </div>
);
