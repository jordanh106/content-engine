import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, ShieldCheck, ShieldAlert, ShieldX, CheckCircle2, AlertCircle, Sparkles, X } from "lucide-react";

export type ComplianceScore = {
  total: number;
  passing: boolean;
  threshold: number;
  categories: {
    hookArchitecture: { score: number; max: number; notes: string };
    bodyStructure: { score: number; max: number; notes: string };
    visualProduction: { score: number; max: number; notes: string };
    ctaEngagement: { score: number; max: number; notes: string };
    pillarAlignment: { score: number; max: number; notes: string };
    antiPatternCheck: { score: number; max: number; notes: string };
  };
  strengths: string[];
  fixes: string[];
  verdict: string;
  blueprintVersion: string;
};

type Props = {
  script: string;
  format?: string;
  duration?: number;
  audience?: string;
  pillar?: string;
  compact?: boolean;
};

const tierFor = (score: number) => {
  if (score >= 90) return { label: "Outlier", tone: "emerald" as const, Icon: Sparkles };
  if (score >= 80) return { label: "Strong", tone: "teal" as const, Icon: ShieldCheck };
  if (score >= 70) return { label: "Marginal", tone: "amber" as const, Icon: ShieldAlert };
  if (score >= 60) return { label: "Weak", tone: "orange" as const, Icon: ShieldAlert };
  return { label: "Reject", tone: "rose" as const, Icon: ShieldX };
};

const toneClasses = {
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  teal: "bg-teal-50 text-teal-700 border-teal-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  orange: "bg-orange-50 text-orange-700 border-orange-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

const categoryLabels: Record<string, string> = {
  hookArchitecture: "Hook Architecture",
  bodyStructure: "Body Structure",
  visualProduction: "Visual & Production",
  ctaEngagement: "CTA & Engagement",
  pillarAlignment: "Pillar Alignment",
  antiPatternCheck: "Anti-Pattern Check",
};

export const ComplianceBadge: React.FC<Props> = ({ script, format, duration, audience, pillar, compact = false }) => {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ComplianceScore | null>(null);

  const mutation = useMutation({
    mutationFn: async (): Promise<ComplianceScore> => {
      const res = await fetch("/api/blueprint/check-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, format, duration, audience, pillar }),
      });
      if (!res.ok) throw new Error("Compliance check failed");
      return res.json();
    },
    onSuccess: (data) => {
      setResult(data);
      setOpen(true);
    },
  });

  if (!result && !mutation.isPending) {
    return (
      <button
        onClick={() => mutation.mutate()}
        disabled={!script || script.trim().length < 20}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-40"
        title="Score this script against the Master Blueprint"
      >
        <ShieldCheck size={12} strokeWidth={2.5} />
        Check Compliance
      </button>
    );
  }

  if (mutation.isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
        <Loader2 size={12} className="animate-spin" />
        Auditing
      </span>
    );
  }

  if (mutation.isError && !result) {
    return (
      <button
        onClick={() => mutation.mutate()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-[10px] font-black uppercase tracking-widest text-rose-700"
      >
        <AlertCircle size={12} />
        Retry
      </button>
    );
  }

  if (!result) return null;

  const tier = tierFor(result.total);
  const Icon = tier.Icon;
  const toneClass = toneClasses[tier.tone];

  if (compact) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${toneClass}`}
      >
        <Icon size={12} strokeWidth={2.5} />
        {result.total}/100
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full border text-[10px] font-black uppercase tracking-widest ${toneClass}`}
      >
        <Icon size={13} strokeWidth={2.5} />
        Blueprint {result.total}/100 · {tier.label}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full md:max-w-2xl max-h-[88vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center ${toneClass}`}>
                  <Icon size={18} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Master Blueprint v{result.blueprintVersion}</div>
                  <div className="font-serif font-bold text-xl text-slate-900">{result.total}/100 · {tier.label}</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            {/* Verdict */}
            <div className="px-6 py-4 border-b border-slate-100">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Verdict</div>
              <p className="text-sm text-slate-700 leading-relaxed">{result.verdict}</p>
            </div>

            {/* Category breakdown */}
            <div className="px-6 py-4 border-b border-slate-100 space-y-3">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Score Breakdown</div>
              {Object.entries(result.categories).map(([key, cat]) => {
                const pct = (cat.score / cat.max) * 100;
                const barTone = pct >= 80 ? "bg-teal-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700">{categoryLabels[key] || key}</span>
                      <span className="text-xs font-bold text-slate-900 tabular-nums">{cat.score}/{cat.max}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${barTone} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                    {cat.notes && <p className="text-[11px] text-slate-500 mt-1 leading-snug">{cat.notes}</p>}
                  </div>
                );
              })}
            </div>

            {/* Strengths */}
            {result.strengths.length > 0 && (
              <div className="px-6 py-4 border-b border-slate-100">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Strengths
                </div>
                <ul className="space-y-1.5">
                  {result.strengths.map((s, i) => (
                    <li key={i} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-emerald-500 font-bold">✓</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Fixes */}
            {result.fixes.length > 0 && (
              <div className="px-6 py-4">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600 mb-2 flex items-center gap-1.5">
                  <AlertCircle size={12} /> Fixes To Pass
                </div>
                <ol className="space-y-2">
                  {result.fixes.map((fix, i) => (
                    <li key={i} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-rose-500 font-bold tabular-nums">{i + 1}.</span>
                      <span>{fix}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Re-audit footer */}
            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between">
              <span className="text-[10px] text-slate-400">Passing threshold: {result.threshold}/100</span>
              <button
                onClick={() => { setResult(null); mutation.mutate(); }}
                className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-slate-700 transition-colors"
              >
                Re-audit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
