import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles, X, Check, Info, AlertCircle, CreditCard } from "lucide-react";

export type HiggsfieldUseCase = "broll" | "thumbnail" | "carousel" | "hero" | "video";

export type ImageModelInfo = {
  key: string;
  jobSetType: string;
  displayName: string;
  blurb: string;
  bestFor: string;
  estimatedCredits: number;
  paramFamily: "resolution" | "quality";
  defaultParamValue: string;
};

export type VideoModelInfo = {
  key: string;
  jobSetType: string;
  displayName: string;
  blurb: string;
  bestFor: string;
  estimatedCredits: number;
  mediaParam: "medias" | "input_image";
  durations: number[];
  durationType: "int" | "string";
  aspectRatios: string[];
  resolutions?: string[];
};

export type PreflightSelection = {
  modelKey: string;
  aspectRatio: "9:16" | "16:9" | "1:1" | "4:5";
  resolution?: "1k" | "2k" | "4k" | "480p" | "720p" | "1080p";
  quality?: "low" | "medium" | "high" | "basic" | "1.5k" | "2k";
  // Video-only fields
  duration?: number;
  genre?: "auto" | "action" | "horror" | "comedy" | "noir" | "drama" | "epic";
};

type Props = {
  open: boolean;
  onClose: () => void;
  useCase: HiggsfieldUseCase;
  /** How many images this batch will produce — used for cost preview. */
  imageCount: number;
  /** Free-form headline shown above the form (e.g. video title). */
  contextTitle: string;
  /** Called with the user's selection when they click Generate. */
  onConfirm: (selection: PreflightSelection) => void;
  /** Set true while the parent is processing the generation. */
  pending?: boolean;
};

type ModelsResponse = {
  models: (ImageModelInfo | VideoModelInfo)[];
  defaults: Record<string, string>;
};

const isVideoModel = (m: ImageModelInfo | VideoModelInfo): m is VideoModelInfo =>
  "durations" in m && Array.isArray((m as VideoModelInfo).durations);

type StatusResponse = {
  configured: boolean;
  cliInstalled: boolean;
  authenticated: boolean;
  email?: string;
  credits?: number;
  hint?: string;
};

const ASPECT_RATIOS: Array<{ value: "9:16" | "16:9" | "1:1" | "4:5"; label: string }> = [
  { value: "9:16", label: "9:16 Vertical" },
  { value: "1:1", label: "1:1 Square" },
  { value: "4:5", label: "4:5 Portrait" },
  { value: "16:9", label: "16:9 Landscape" },
];

const LS_KEY_PREFIX = "ce-higgsfield-preflight-";

const formatCredits = (n: number) => (n < 1 ? n.toFixed(2) : n.toFixed(2).replace(/\.?0+$/, ""));

export const HiggsfieldPreflight: React.FC<Props> = ({ open, onClose, useCase, imageCount, contextTitle, onConfirm, pending }) => {
  // ── Persisted selection per use case ───────────────────────────────────────
  const lsKey = LS_KEY_PREFIX + useCase;
  const [selection, setSelection] = useState<PreflightSelection>(() => {
    try {
      const stored = localStorage.getItem(lsKey);
      if (stored) return JSON.parse(stored) as PreflightSelection;
    } catch { /* fall through */ }
    return { modelKey: "", aspectRatio: "9:16" };
  });

  // ── Server data ────────────────────────────────────────────────────────────
  const isVideoUseCase = useCase === "video";
  const { data: modelsData, isLoading: modelsLoading } = useQuery<ModelsResponse>({
    queryKey: ["higgsfield-models", isVideoUseCase ? "video" : "image"],
    queryFn: () => fetch(`/api/higgsfield/models?type=${isVideoUseCase ? "video" : "image"}`).then((r) => r.json()),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const { data: status } = useQuery<StatusResponse>({
    queryKey: ["higgsfield-status"],
    queryFn: () => fetch("/api/higgsfield/status").then((r) => r.json()),
    enabled: open,
    refetchInterval: open ? 15_000 : false,
    staleTime: 10_000,
  });

  const models = modelsData?.models || [];
  const defaults = modelsData?.defaults;

  // Default the modelKey to the smart-default for the use case if user hasn't picked one yet
  useEffect(() => {
    if (selection.modelKey || !defaults) return;
    const def = defaults[useCase];
    setSelection((s) => ({ ...s, modelKey: def }));
  }, [defaults, useCase, selection.modelKey]);

  const selectedModel = useMemo(() => models.find((m) => m.key === selection.modelKey), [models, selection.modelKey]);

  // Reset the resolution/quality/duration param when model changes
  useEffect(() => {
    if (!selectedModel) return;
    if (isVideoModel(selectedModel)) {
      // Video model
      setSelection((s) => {
        const next: PreflightSelection = { ...s };
        // Pick valid aspect ratio if current isn't supported
        if (!selectedModel.aspectRatios.includes(s.aspectRatio)) {
          next.aspectRatio = (selectedModel.aspectRatios.includes("9:16") ? "9:16" : selectedModel.aspectRatios[0]) as PreflightSelection["aspectRatio"];
        }
        // Pick valid duration
        if (!s.duration || !selectedModel.durations.includes(s.duration)) {
          next.duration = selectedModel.durations[0];
        }
        // Pick valid resolution (video models use 480p/720p/1080p)
        if (selectedModel.resolutions && (!s.resolution || !selectedModel.resolutions.includes(s.resolution as string))) {
          next.resolution = (selectedModel.resolutions[1] || selectedModel.resolutions[0]) as PreflightSelection["resolution"];
        } else if (!selectedModel.resolutions) {
          next.resolution = undefined;
        }
        next.quality = undefined;
        if (!s.genre) next.genre = "auto";
        return next;
      });
    } else {
      // Image model
      setSelection((s) => {
        if (selectedModel.paramFamily === "resolution") {
          if (s.resolution) return s;
          return { ...s, resolution: selectedModel.defaultParamValue as "1k" | "2k" | "4k", quality: undefined, duration: undefined };
        } else {
          if (s.quality) return s;
          return { ...s, quality: selectedModel.defaultParamValue as "low" | "medium" | "high" | "basic" | "1.5k" | "2k", resolution: undefined, duration: undefined };
        }
      });
    }
  }, [selectedModel]);

  const totalCredits = (selectedModel?.estimatedCredits ?? 0) * imageCount;
  const afterBalance = status?.credits != null ? status.credits - totalCredits : null;
  const canAfford = status?.credits != null ? status.credits >= totalCredits : true;

  const confirm = () => {
    if (!selectedModel) return;
    try { localStorage.setItem(lsKey, JSON.stringify(selection)); } catch { /* ignore */ }
    onConfirm(selection);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
              <Sparkles size={16} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">
                Higgsfield · {useCase === "broll" ? "B-Roll Pack" : useCase === "thumbnail" ? "Thumbnail Pack" : useCase === "carousel" ? "Carousel" : useCase === "video" ? "Animate to Video" : "Hero Image"}
              </div>
              <h3 className="font-serif font-bold text-base text-slate-900 leading-tight">{contextTitle}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {modelsLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading models…
            </div>
          ) : (
            <>
              {/* Model picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Model</div>
                  <div className="text-[10px] text-slate-400">{models.length} options · ranked by quality</div>
                </div>
                <div className="space-y-2">
                  {models.map((m) => {
                    const picked = selection.modelKey === m.key;
                    const total = m.estimatedCredits * imageCount;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setSelection((s) => ({ ...s, modelKey: m.key, resolution: undefined, quality: undefined }))}
                        className={`w-full text-left p-3 rounded-2xl border transition-all ${
                          picked
                            ? "border-violet-500 bg-teal-50 ring-2 ring-violet-200"
                            : "border-slate-200 hover:border-teal-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-bold text-sm text-slate-900">{m.displayName}</span>
                              {defaults?.[useCase] === m.key && (
                                <span className="text-[9px] font-black uppercase tracking-widest text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded">Default for this use</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 leading-snug">{m.blurb}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5 italic">Best for: {m.bestFor}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cost</div>
                            <div className="font-bold text-sm text-slate-900 tabular-nums">{formatCredits(total)} cr</div>
                            <div className="text-[10px] text-slate-400 tabular-nums">
                              {formatCredits(m.estimatedCredits)} × {imageCount}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aspect ratio — filter by model's supported set if video */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Aspect Ratio</div>
                <div className="flex gap-1.5 flex-wrap">
                  {(selectedModel && isVideoModel(selectedModel)
                    ? ASPECT_RATIOS.filter((a) => selectedModel.aspectRatios.includes(a.value))
                    : ASPECT_RATIOS
                  ).map((a) => {
                    const picked = selection.aspectRatio === a.value;
                    return (
                      <button
                        key={a.value}
                        onClick={() => setSelection((s) => ({ ...s, aspectRatio: a.value }))}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                          picked
                            ? "bg-teal-600 text-white"
                            : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-teal-300"
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Video-specific: Duration + Genre */}
              {selectedModel && isVideoModel(selectedModel) && (
                <>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Duration</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {selectedModel.durations.map((d) => {
                        const picked = selection.duration === d;
                        return (
                          <button
                            key={d}
                            onClick={() => setSelection((s) => ({ ...s, duration: d }))}
                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                              picked
                                ? "bg-teal-600 text-white"
                                : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-teal-300"
                            }`}
                          >
                            {d}s
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {selectedModel.resolutions && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Resolution</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {selectedModel.resolutions.map((r) => {
                          const picked = selection.resolution === r;
                          return (
                            <button
                              key={r}
                              onClick={() => setSelection((s) => ({ ...s, resolution: r as PreflightSelection["resolution"] }))}
                              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                                picked
                                  ? "bg-teal-600 text-white"
                                  : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-teal-300"
                              }`}
                            >
                              {r}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedModel.jobSetType === "seedance_2_0" && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">Genre</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {(["auto", "action", "drama", "comedy", "noir", "epic", "horror"] as const).map((g) => {
                          const picked = selection.genre === g;
                          return (
                            <button
                              key={g}
                              onClick={() => setSelection((s) => ({ ...s, genre: g }))}
                              className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                                picked
                                  ? "bg-teal-600 text-white"
                                  : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-teal-300"
                              }`}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Image-only: Resolution or Quality (depends on model) */}
              {selectedModel && !isVideoModel(selectedModel) && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                    {selectedModel.paramFamily === "resolution" ? "Resolution" : "Quality"}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {(selectedModel.paramFamily === "resolution"
                      ? ["1k", "2k", "4k"]
                      : selectedModel.jobSetType === "gpt_image_2"
                      ? ["low", "medium", "high"]
                      : selectedModel.jobSetType === "seedream_v4_5"
                      ? ["basic", "high"]
                      : ["1.5k", "2k"]
                    ).map((v) => {
                      const picked = (selectedModel.paramFamily === "resolution" ? selection.resolution : selection.quality) === v;
                      return (
                        <button
                          key={v}
                          onClick={() =>
                            setSelection((s) =>
                              selectedModel.paramFamily === "resolution"
                                ? { ...s, resolution: v as "1k" | "2k" | "4k", quality: undefined }
                                : { ...s, quality: v as "low" | "medium" | "high" | "basic" | "1.5k" | "2k", resolution: undefined },
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                            picked
                              ? "bg-teal-600 text-white"
                              : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-teal-300"
                          }`}
                        >
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 space-y-3">
          {/* Cost summary */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <CreditCard size={12} />
              <span>
                <span className="font-bold text-slate-900 tabular-nums">{formatCredits(totalCredits)}</span> credits ·{" "}
                {imageCount} image{imageCount > 1 ? "s" : ""} ·{" "}
                <span className={canAfford ? "text-slate-500" : "text-rose-600 font-bold"}>
                  {status?.credits != null ? (
                    <>balance after: <span className="tabular-nums">{afterBalance != null ? formatCredits(afterBalance) : "?"}</span></>
                  ) : (
                    "balance unknown"
                  )}
                </span>
              </span>
            </div>
            <div className="text-[10px] text-slate-400 tabular-nums">
              {status?.credits != null && <>have: {formatCredits(status.credits)}</>}
            </div>
          </div>

          {!canAfford && (
            <div className="flex items-start gap-2 px-3 py-2 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-700">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>Not enough credits. You have {formatCredits(status?.credits || 0)} but this batch needs {formatCredits(totalCredits)}. Top up at higgsfield.ai or pick a cheaper model.</span>
            </div>
          )}

          {!status?.configured && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700">
              <Info size={12} className="shrink-0 mt-0.5" />
              <span>{status?.hint || "Higgsfield CLI not ready."}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirm}
              disabled={!selectedModel || pending || !canAfford || !status?.configured}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 disabled:opacity-40 transition-colors"
            >
              {pending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {pending ? "Generating…" : `Generate · ${formatCredits(totalCredits)} cr`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Compact pill showing current Higgsfield credit balance.
 * Polls /status every 30s while mounted.
 */
export const HiggsfieldCreditPill: React.FC<{ className?: string }> = ({ className }) => {
  const { data } = useQuery<StatusResponse>({
    queryKey: ["higgsfield-status"],
    queryFn: () => fetch("/api/higgsfield/status").then((r) => r.json()),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
  if (!data?.configured) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[10px] font-black uppercase tracking-widest text-teal-700 ${className || ""}`}
      title={`Higgsfield account: ${data.email || "signed in"}`}
    >
      <Sparkles size={11} strokeWidth={2.5} />
      {data.credits != null ? `${formatCredits(data.credits)} cr` : "—"}
    </span>
  );
};
