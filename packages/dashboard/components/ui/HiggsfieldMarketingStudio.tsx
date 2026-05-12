import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Sparkles, X, Check, Download, AlertCircle, Copy, ExternalLink } from "lucide-react";

type AdFormat = {
  id: string;
  name: string;
  type: string;
  priority?: number;
  media?: { thumbnail_url?: string; url?: string };
};

type BrandKit = {
  id: string;
  name?: string;
};

type GenerateResponse = {
  imageUrl: string;
  requestId: string;
  formatId: string;
  brandKitId?: string;
};

type Props = {
  title: string;
  defaultPrompt?: string;
};

export const HiggsfieldMarketingStudio: React.FC<Props> = ({ title, defaultPrompt }) => {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(defaultPrompt || title);
  const [formatId, setFormatId] = useState<string | null>(null);
  const [brandKitId, setBrandKitId] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "4:5" | "16:9">("9:16");
  const [quality, setQuality] = useState<"low" | "medium" | "high">("high");
  const [resolution, setResolution] = useState<"1k" | "2k" | "4k">("2k");
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: formatsData, isLoading: formatsLoading } = useQuery<{ items: AdFormat[] }>({
    queryKey: ["hf-ad-formats"],
    queryFn: () => fetch("/api/higgsfield/marketing-studio/ad-formats").then((r) => r.json()),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const { data: kitsData } = useQuery<{ items: BrandKit[] }>({
    queryKey: ["hf-brand-kits"],
    queryFn: () => fetch("/api/higgsfield/marketing-studio/brand-kits").then((r) => r.json()),
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  const formats = formatsData?.items || [];
  const formatsByType = useMemo(() => {
    const groups: Record<string, AdFormat[]> = {};
    for (const f of formats) {
      (groups[f.type] ||= []).push(f);
    }
    return groups;
  }, [formats]);

  const kits = kitsData?.items || [];

  const generate = useMutation({
    mutationFn: async (): Promise<GenerateResponse> => {
      if (!formatId) throw new Error("Pick an ad format first");
      const res = await fetch("/api/higgsfield/marketing-studio/generate-ad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, formatId, brandKitId: brandKitId || undefined, aspectRatio, quality, resolution }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Generation failed");
      }
      return res.json();
    },
    onSuccess: (data) => setResult(data),
  });

  const selectedFormat = formats.find((f) => f.id === formatId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors"
        title="Generate a branded DTC ad via Higgsfield Marketing Studio"
      >
        <Sparkles size={11} />
        DTC Ad
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
                  <Sparkles size={16} strokeWidth={2.5} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-700">Marketing Studio · DTC Ad</div>
                  <h3 className="font-serif font-bold text-base text-slate-900 leading-tight">{title}</h3>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Prompt */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Brief</div>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 resize-none"
                  placeholder="Describe the ad — subject, scene, mood, call-to-action…"
                />
              </div>

              {/* Brand kit (optional) */}
              {kits.length > 0 ? (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Brand Kit (optional)</div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setBrandKitId(null)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                        brandKitId === null
                          ? "bg-rose-600 text-white"
                          : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-rose-300"
                      }`}
                    >
                      No kit
                    </button>
                    {kits.map((k) => (
                      <button
                        key={k.id}
                        onClick={() => setBrandKitId(k.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          brandKitId === k.id
                            ? "bg-rose-600 text-white"
                            : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-rose-300"
                        }`}
                      >
                        {k.name || k.id.slice(0, 8)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 flex items-start gap-2">
                  <AlertCircle size={12} className="shrink-0 mt-0.5" />
                  <span>No Brand Kits yet. Create one at <a href="https://higgsfield.ai" target="_blank" rel="noopener" className="font-bold underline">higgsfield.ai → Marketing Studio</a> for branded output. (Generation still works without one.)</span>
                </div>
              )}

              {/* Ad Format picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Ad Format</div>
                  <div className="text-[10px] text-slate-400">{formats.length} presets</div>
                </div>
                {formatsLoading && (
                  <div className="flex items-center text-slate-500 text-xs">
                    <Loader2 size={14} className="animate-spin mr-2" /> Loading formats…
                  </div>
                )}
                {Object.entries(formatsByType).map(([type, list]) => (
                  <div key={type} className="mb-3">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1.5">{type}</p>
                    <div className="grid grid-cols-3 gap-2">
                      {list.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setFormatId(f.id)}
                          className={`text-left rounded-xl overflow-hidden border-2 transition-all ${
                            formatId === f.id
                              ? "border-rose-500 ring-2 ring-rose-200"
                              : "border-slate-200 hover:border-rose-300"
                          } bg-white`}
                        >
                          {f.media?.url ? (
                            <div className="bg-slate-100 aspect-video overflow-hidden">
                              <img src={f.media.url} alt={f.name} loading="lazy" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="bg-slate-100 aspect-video" />
                          )}
                          <div className="px-2 py-1.5">
                            <p className="text-[11px] font-bold text-slate-900 truncate">{f.name}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Aspect / Quality / Resolution */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Aspect</div>
                  <div className="flex gap-1 flex-wrap">
                    {(["9:16", "1:1", "4:5", "16:9"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setAspectRatio(v)}
                        className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors ${
                          aspectRatio === v ? "bg-rose-600 text-white" : "bg-slate-50 border border-slate-200 text-slate-700"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Quality</div>
                  <div className="flex gap-1 flex-wrap">
                    {(["low", "medium", "high"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setQuality(v)}
                        className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors ${
                          quality === v ? "bg-rose-600 text-white" : "bg-slate-50 border border-slate-200 text-slate-700"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Resolution</div>
                  <div className="flex gap-1 flex-wrap">
                    {(["1k", "2k", "4k"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setResolution(v)}
                        className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors ${
                          resolution === v ? "bg-rose-600 text-white" : "bg-slate-50 border border-slate-200 text-slate-700"
                        }`}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Result */}
              {result && (
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/50 overflow-hidden">
                  <div className="px-4 py-2 border-b border-emerald-200 flex items-center justify-between bg-emerald-50">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">
                      <Check size={12} /> Generated
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { navigator.clipboard.writeText(result.imageUrl); setCopied(true); setTimeout(() => setCopied(false), 1200); }}
                        className="p-1.5 rounded-full text-emerald-700 hover:bg-emerald-100"
                        title="Copy URL"
                      >
                        {copied ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <a
                        href={result.imageUrl}
                        target="_blank"
                        rel="noopener"
                        className="p-1.5 rounded-full text-emerald-700 hover:bg-emerald-100"
                        title="Open"
                      >
                        <ExternalLink size={12} />
                      </a>
                      <a
                        href={result.imageUrl}
                        download
                        className="p-1.5 rounded-full text-emerald-700 hover:bg-emerald-100"
                        title="Download"
                      >
                        <Download size={12} />
                      </a>
                    </div>
                  </div>
                  <img src={result.imageUrl} alt="DTC Ad" className="w-full max-h-[400px] object-contain bg-black" />
                </div>
              )}

              {generate.isError && (
                <div className="px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700">
                  {(generate.error as Error).message}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                {selectedFormat
                  ? <>Using: <span className="font-bold text-slate-900">{selectedFormat.name}</span></>
                  : "Pick an ad format above"}
              </div>
              <button
                onClick={() => generate.mutate()}
                disabled={!formatId || !prompt.trim() || generate.isPending}
                className="px-4 py-2.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-40 transition-colors flex items-center gap-2"
              >
                {generate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {generate.isPending ? "Generating…" : "Generate Ad"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
