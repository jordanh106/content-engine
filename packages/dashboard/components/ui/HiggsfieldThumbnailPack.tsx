import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles, X, Check, Download, AlertCircle, Copy, RefreshCw } from "lucide-react";
import { HiggsfieldPreflight, type PreflightSelection } from "./HiggsfieldPreflight.js";

export type ThumbnailVariant = {
  angle: string;
  prompt: string;
  imageUrl: string | null;
  requestId: string | null;
  status: "completed" | "failed";
  error?: string;
  modelKey?: string;
  modelDisplay?: string;
  creditsExact?: number;
};

type Props = {
  title: string;
  hookSpoken?: string;
  hookVisual?: string;
  audience?: string;
  format?: string;
  /** Called when user picks a variant as the primary thumbnail. */
  onSelectVariant?: (variant: ThumbnailVariant) => void;
};

const formatCredits = (n: number) => (n < 1 ? n.toFixed(2) : n.toFixed(2).replace(/\.?0+$/, ""));

export const HiggsfieldThumbnailPack: React.FC<Props> = ({
  title,
  hookSpoken,
  hookVisual,
  audience,
  format,
  onSelectVariant,
}) => {
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [variants, setVariants] = useState<ThumbnailVariant[]>([]);
  const [resultModel, setResultModel] = useState<string | undefined>(undefined);
  const [selected, setSelected] = useState<number | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [lastSelection, setLastSelection] = useState<PreflightSelection | null>(null);

  const mutation = useMutation({
    mutationFn: async (selection: PreflightSelection): Promise<{ variants: ThumbnailVariant[]; modelDisplay?: string }> => {
      const body: Record<string, unknown> = {
        title,
        hookSpoken,
        hookVisual,
        audience,
        format,
        aspectRatio: selection.aspectRatio,
        modelKey: selection.modelKey,
      };
      if (selection.resolution) body.resolution = selection.resolution;
      if (selection.quality) body.quality = selection.quality;
      const res = await fetch("/api/higgsfield/thumbnail-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setVariants(data.variants);
      setResultModel(data.modelDisplay);
      setPreflightOpen(false);
      setResultsOpen(true);
    },
  });

  const copyPrompt = (idx: number) => {
    navigator.clipboard.writeText(variants[idx].prompt);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1200);
  };

  const totalCredits = variants.reduce((sum, v) => sum + (v.creditsExact || 0), 0);

  return (
    <>
      <button
        onClick={() => {
          if (variants.length > 0) {
            setResultsOpen(true);
          } else {
            setPreflightOpen(true);
          }
        }}
        disabled={mutation.isPending}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-60 transition-colors"
        title="Pick a model, see cost, then generate 4 A/B-ready thumbnail variants"
      >
        {mutation.isPending ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
        {mutation.isPending ? "Generating Thumbnails…" : variants.length > 0 ? "View Thumbnail Pack" : "Generate Thumbnail Pack"}
      </button>

      {mutation.isError && (
        <p className="text-[10px] text-rose-600 mt-1">{(mutation.error as Error).message}</p>
      )}

      {/* Preflight model + cost picker */}
      <HiggsfieldPreflight
        open={preflightOpen}
        onClose={() => setPreflightOpen(false)}
        useCase="thumbnail"
        imageCount={4}
        contextTitle={title}
        onConfirm={(selection) => {
          setLastSelection(selection);
          mutation.mutate(selection);
        }}
        pending={mutation.isPending}
      />

      {resultsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setResultsOpen(false)}>
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[88vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
                  <Sparkles size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">Higgsfield Thumbnail Pack</div>
                  <h3 className="font-serif font-bold text-base text-slate-900 leading-tight">{title}</h3>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setResultsOpen(false); setPreflightOpen(true); }}
                  disabled={mutation.isPending}
                  className="text-[10px] font-black uppercase tracking-widest text-teal-700 hover:text-teal-700 disabled:opacity-40 flex items-center gap-1"
                  title="Pick a different model and regenerate"
                >
                  <RefreshCw size={10} />
                  {mutation.isPending ? "Regenerating…" : "Regenerate"}
                </button>
                <button onClick={() => setResultsOpen(false)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {variants.map((v, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl border-2 transition-all ${
                      selected === i ? "border-violet-500 shadow-lg" : "border-slate-200 hover:border-teal-300"
                    } bg-white overflow-hidden`}
                  >
                    {/* Image */}
                    {v.imageUrl ? (
                      <a href={v.imageUrl} target="_blank" rel="noopener" className="block bg-black aspect-[9/16] relative">
                        <img
                          src={v.imageUrl}
                          alt={v.angle}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        {/* Model attribution overlay */}
                        {v.modelDisplay && (
                          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[9px] font-black uppercase tracking-widest backdrop-blur-sm">
                            {v.modelDisplay}
                          </span>
                        )}
                      </a>
                    ) : (
                      <div className="aspect-[9/16] bg-rose-50 flex flex-col items-center justify-center gap-2 p-4 text-center">
                        <AlertCircle size={20} className="text-rose-500" />
                        <p className="text-[10px] text-rose-700 font-bold">{v.error || "Failed"}</p>
                      </div>
                    )}

                    {/* Meta */}
                    <div className="px-3 py-2.5 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-black uppercase tracking-widest text-teal-700">{v.angle}</p>
                        {v.creditsExact != null && (
                          <span className="text-[9px] font-bold text-slate-500 tabular-nums">{formatCredits(v.creditsExact)} cr</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-snug line-clamp-2 mt-1" title={v.prompt}>
                        {v.prompt}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex border-t border-slate-100">
                      <button
                        onClick={() => copyPrompt(i)}
                        className="flex-1 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1"
                      >
                        {copiedIdx === i ? <Check size={10} className="text-emerald-500" /> : <Copy size={10} />}
                        Prompt
                      </button>
                      {v.imageUrl && (
                        <a
                          href={v.imageUrl}
                          download
                          target="_blank"
                          rel="noopener"
                          className="flex-1 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1 border-l border-slate-100"
                        >
                          <Download size={10} /> Save
                        </a>
                      )}
                      {v.imageUrl && onSelectVariant && (
                        <button
                          onClick={() => {
                            setSelected(i);
                            onSelectVariant(v);
                          }}
                          className={`flex-1 px-2 py-2 text-[9px] font-black uppercase tracking-widest border-l border-slate-100 transition-colors flex items-center justify-center gap-1 ${
                            selected === i ? "bg-teal-600 text-white" : "text-teal-700 hover:bg-teal-50"
                          }`}
                        >
                          {selected === i ? <><Check size={10} /> Picked</> : "Pick"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[10px] text-slate-500">
              <span>{variants.length} variants · {lastSelection?.aspectRatio || "9:16"} · {resultModel || "—"}</span>
              <span>Higgsfield credits consumed: <span className="font-bold text-slate-700 tabular-nums">{formatCredits(totalCredits)} cr</span></span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
