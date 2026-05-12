import React, { useState, useRef, useEffect } from "react";
import { Plus, X, Send, Loader2, Link2, Sparkles, FileText, Copy, Check, Wand2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tooltip } from "./Tooltip.js";
import { usePanel } from "../context/PanelContext.js";

type Mode = "capture" | "convert";

type ConvertFormat = "reel" | "tiktok" | "short" | "carousel" | "long";

type ConvertResult = {
  title: string;
  hookArchetype: string;
  hook: { visual: string; text: string; spoken: string; audio: string };
  script: string;
  shotList: Array<{ second: number; shot: string; action: string; textOverlay: string | null }>;
  cta: { type: string; phrasing: string; timing: string };
  caption: string;
  complianceNotes: string;
  sourceTitle: string;
  outputLabel: string;
  outputDuration: string;
};

const FORMAT_CHIPS: Array<{ key: ConvertFormat; label: string; emoji: string }> = [
  { key: "reel", label: "Reel", emoji: "📱" },
  { key: "tiktok", label: "TikTok", emoji: "🎵" },
  { key: "short", label: "Short", emoji: "▶️" },
  { key: "carousel", label: "Carousel", emoji: "🎴" },
  { key: "long", label: "Long-form", emoji: "🎬" },
];

export const QuickCaptureFAB: React.FC<{ isHidden?: boolean }> = ({ isHidden = false }) => {
  const { panelCount } = usePanel();
  const hidden = isHidden || panelCount > 0;
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("capture");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  // Convert-mode state
  const [convertSource, setConvertSource] = useState("");
  const [convertFormat, setConvertFormat] = useState<ConvertFormat>("reel");
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (hidden && open) setOpen(false);
  }, [hidden, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open, mode]);

  // Keyboard: N opens capture, C opens convert
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setMode("capture");
        setOpen(true);
      } else if (e.key === "c" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setMode("convert");
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          sourceUrl: sourceUrl.trim() || null,
        }),
      });
      if (!r.ok) throw new Error("Failed to save");
      return r.json();
    },
    onSuccess: () => {
      setContent("");
      setSourceUrl("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ingest/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: convertSource.trim(), outputFormat: convertFormat }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Convert failed");
      }
      return r.json() as Promise<ConvertResult>;
    },
    onSuccess: (data) => setConvertResult(data),
  });

  const copy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1200);
  };

  const closeModal = () => {
    setOpen(false);
    setConvertResult(null);
    setConvertSource("");
  };

  return (
    <>
      {!open && !hidden && (
        <Tooltip content="Quick Capture (N) · Convert (C)" side="left">
          <button
            onClick={() => { setMode("capture"); setOpen(true); }}
            className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-40 w-14 h-14 rounded-full bg-teal-600 text-white shadow-lg hover:bg-teal-700 hover:shadow-xl flex items-center justify-center transition-all active:scale-95 group"
          >
            <Plus size={24} className="group-hover:rotate-90 transition-transform" />
          </button>
        </Tooltip>
      )}

      {open && !hidden && (
        <div className="fixed inset-0 z-50" onClick={closeModal}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className={`fixed bottom-0 inset-x-0 md:bottom-6 md:right-6 md:left-auto bg-surface-elevated rounded-t-2xl md:rounded-2xl border border-themed shadow-2xl p-5 animate-slide-up overflow-y-auto ${
              mode === "convert" ? "md:w-[480px] max-h-[90vh]" : "md:w-96"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center md:hidden mb-1">
              <div className="w-10 h-1 rounded-full bg-themed-muted opacity-40" />
            </div>

            {/* Mode tabs */}
            <div className="flex items-center gap-1 p-1 mb-3 bg-surface-hover rounded-full">
              <button
                onClick={() => { setMode("capture"); setConvertResult(null); }}
                className={`flex-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                  mode === "capture" ? "bg-white text-slate-900 shadow-sm" : "text-themed-tertiary"
                }`}
              >
                <FileText size={11} className="inline mr-1" /> Capture
              </button>
              <button
                onClick={() => { setMode("convert"); }}
                className={`flex-1 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                  mode === "convert" ? "bg-white text-slate-900 shadow-sm" : "text-themed-tertiary"
                }`}
              >
                <Wand2 size={11} className="inline mr-1" /> Convert
              </button>
              <button onClick={closeModal} className="p-1.5 rounded-full text-themed-muted hover:text-themed-secondary">
                <X size={14} />
              </button>
            </div>

            {/* Capture Mode */}
            {mode === "capture" && (
              <div className="space-y-3">
                <textarea
                  ref={inputRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Capture an idea, inspiration, or note..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-themed text-sm text-themed placeholder:text-themed-muted focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 resize-none"
                />
                <div className="relative">
                  <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted" />
                  <input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="Source URL (optional)"
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-surface-hover border border-themed text-[11px] text-themed-secondary placeholder:text-themed-muted focus:outline-none focus:border-teal-500"
                  />
                </div>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!content.trim() || saveMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 disabled:opacity-50 transition-colors"
                >
                  {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Save to Inbox
                </button>
                <p className="text-[9px] text-themed-muted text-center">
                  <kbd className="px-1 py-0.5 bg-surface-hover border border-themed rounded text-[8px] font-mono">N</kbd> capture · <kbd className="px-1 py-0.5 bg-surface-hover border border-themed rounded text-[8px] font-mono">C</kbd> convert
                </p>
              </div>
            )}

            {/* Convert Mode */}
            {mode === "convert" && !convertResult && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Source</label>
                  <textarea
                    ref={inputRef}
                    value={convertSource}
                    onChange={(e) => setConvertSource(e.target.value)}
                    placeholder="Paste URL (YouTube, blog, newsletter) or raw text..."
                    rows={4}
                    className="mt-1 w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-themed text-sm text-themed placeholder:text-themed-muted focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 resize-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Convert to</label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {FORMAT_CHIPS.map((c) => (
                      <button
                        key={c.key}
                        onClick={() => setConvertFormat(c.key)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${
                          convertFormat === c.key
                            ? "bg-teal-600 text-white"
                            : "bg-surface-hover text-themed-secondary hover:bg-surface-elevated"
                        }`}
                      >
                        <span className="mr-1">{c.emoji}</span>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {convertMutation.isError && (
                  <p className="text-[11px] text-rose-600 px-2">{(convertMutation.error as Error).message}</p>
                )}

                <button
                  onClick={() => convertMutation.mutate()}
                  disabled={!convertSource.trim() || convertMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-sm font-bold hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {convertMutation.isPending ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Applying blueprint...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Generate Production-Ready Script
                    </>
                  )}
                </button>
                <p className="text-[9px] text-themed-muted text-center">
                  Auto-applies Master Blueprint · brand voice · hook archetypes
                </p>
              </div>
            )}

            {/* Convert Result */}
            {mode === "convert" && convertResult && (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">{convertResult.outputLabel} · {convertResult.outputDuration}</div>
                    <h4 className="font-serif font-bold text-base text-themed leading-tight mt-0.5">{convertResult.title}</h4>
                  </div>
                  <button onClick={() => setConvertResult(null)} className="px-2 py-1 rounded-full bg-surface-hover text-[9px] font-bold uppercase tracking-widest text-themed-tertiary hover:bg-surface-elevated">
                    New
                  </button>
                </div>

                {/* Hook */}
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 space-y-1.5">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-teal-700">Hook · {convertResult.hookArchetype}</div>
                  <div className="text-[11px] text-slate-700"><span className="font-bold">Visual:</span> {convertResult.hook.visual}</div>
                  <div className="text-[11px] text-slate-700"><span className="font-bold">Text:</span> {convertResult.hook.text}</div>
                  <div className="text-[11px] text-slate-700"><span className="font-bold">Spoken:</span> "{convertResult.hook.spoken}"</div>
                  <div className="text-[11px] text-slate-700"><span className="font-bold">Audio:</span> {convertResult.hook.audio}</div>
                </div>

                {/* Script */}
                <Section title="Script" onCopy={() => copy(convertResult.script, "script")} copied={copiedField === "script"}>
                  <pre className="text-[11px] text-themed whitespace-pre-wrap leading-relaxed">{convertResult.script}</pre>
                </Section>

                {/* Shot List */}
                <Section title="Shot List" onCopy={() => copy(convertResult.shotList.map(s => `[${s.second}s] ${s.shot}: ${s.action}${s.textOverlay ? ` | Text: "${s.textOverlay}"` : ""}`).join("\n"), "shots")} copied={copiedField === "shots"}>
                  <ul className="text-[11px] text-themed space-y-1.5">
                    {convertResult.shotList.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-themed-muted tabular-nums w-8 shrink-0">{s.second}s</span>
                        <span><span className="font-bold">{s.shot}</span> — {s.action}{s.textOverlay && <span className="text-teal-600 italic"> · "{s.textOverlay}"</span>}</span>
                      </li>
                    ))}
                  </ul>
                </Section>

                {/* CTA */}
                <Section title={`CTA · ${convertResult.cta.type.toUpperCase()}`} onCopy={() => copy(convertResult.cta.phrasing, "cta")} copied={copiedField === "cta"}>
                  <p className="text-[11px] text-themed italic">"{convertResult.cta.phrasing}"</p>
                  <p className="text-[10px] text-themed-muted mt-1">{convertResult.cta.timing}</p>
                </Section>

                {/* Caption */}
                <Section title="Social Caption" onCopy={() => copy(convertResult.caption, "caption")} copied={copiedField === "caption"}>
                  <pre className="text-[11px] text-themed whitespace-pre-wrap leading-relaxed">{convertResult.caption}</pre>
                </Section>

                {/* Compliance */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
                  <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-1">Blueprint Notes</div>
                  <p className="text-[11px] text-slate-700 leading-relaxed">{convertResult.complianceNotes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const Section: React.FC<{ title: string; onCopy: () => void; copied: boolean; children: React.ReactNode }> = ({ title, onCopy, copied, children }) => (
  <div className="bg-surface-hover rounded-2xl p-3.5">
    <div className="flex items-center justify-between mb-1.5">
      <div className="text-[9px] font-black uppercase tracking-[0.2em] text-themed-muted">{title}</div>
      <button onClick={onCopy} className="p-1 rounded-full text-themed-muted hover:text-themed-secondary hover:bg-surface-elevated transition-colors">
        {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
      </button>
    </div>
    {children}
  </div>
);
