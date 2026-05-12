import React, { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  MessageCircle,
  Zap,
  Loader2,
  ArrowRight,
  Check,
  RotateCcw,
  Send,
  Shuffle,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Copy,
  Bookmark,
} from "lucide-react";
import { cn } from "../utils/cn.js";
import type {
  UrlSparkResult,
  LabAdaptation,
  FormatMutation,
  FormedIdea,
  ConversationMessage,
  ScriptDraft,
  CreatorPersona,
} from "../shared/types.js";
import { useCreator } from "./context/CreatorContext.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { FEATURE_HINTS } from "../shared/help-content.js";
import { useOnboarding } from "./OnboardingProvider.js";

const FORMAT_COLORS: Record<string, string> = {
  A: "bg-teal-100 text-teal-800 border-teal-200",
  B: "bg-emerald-100 text-emerald-800 border-emerald-200",
  C: "bg-sky-100 text-sky-800 border-sky-200",
  D: "bg-rose-100 text-rose-800 border-rose-200",
  E: "bg-teal-100 text-teal-800 border-teal-200",
  F: "bg-orange-100 text-orange-800 border-orange-200",
  G: "bg-pink-100 text-pink-800 border-pink-200",
};

const FORMAT_BORDER_ACCENT: Record<string, string> = {
  A: "border-l-teal-400",
  B: "border-l-emerald-400",
  C: "border-l-sky-400",
  D: "border-l-rose-400",
  E: "border-l-violet-400",
  F: "border-l-orange-400",
  G: "border-l-pink-400",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "bg-emerald-50 text-emerald-700",
  Medium: "bg-amber-50 text-amber-700",
  Advanced: "bg-rose-50 text-rose-700",
};

const LOADING_MESSAGES = {
  "spark-url": [
    "Fetching video metadata...",
    "Analyzing structural pattern...",
    "Identifying hook mechanism...",
    "Translating for your niche...",
    "Generating adaptations...",
  ],
  guide: [
    "Thinking through your idea...",
    "Formulating a question...",
    "Shaping your concept...",
  ],
};

const HOOK_STYLES = [
  { id: "question", label: "? Question" },
  { id: "myth_contrarian", label: "✕ Myth" },
  { id: "statistic", label: "# Stat" },
  { id: "story_emotional", label: "▶ Story" },
  { id: "pattern_interrupt", label: "⚡ Interrupt" },
  { id: "did_you_know", label: "💡 Tip" },
];

function extractFormatLetter(raw: string): string {
  const match = raw?.trim().match(/^([A-G])\b/);
  return match ? match[1] : "A";
}

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "your", "my", "our", "their", "is", "are", "was", "were",
  "how", "what", "why", "when", "do", "does", "this", "that", "from",
  "its", "it", "if", "by", "as", "be", "been", "have", "has", "will",
]);

function hasSignificantOverlap(topic: string, existingTopics: string[]): string | null {
  const topicWords = new Set(
    topic.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w))
  );
  if (topicWords.size === 0) return null;
  for (const existing of existingTopics) {
    const existingWords = existing.toLowerCase().split(/\W+/).filter((w) => w.length > 3 && !STOP_WORDS.has(w));
    const overlap = existingWords.filter((w) => topicWords.has(w));
    if (overlap.length >= 2) return existing;
  }
  return null;
}

// ============================================================
// HookRewriterPills
// ============================================================
const HookRewriterPills: React.FC<{
  topic: string;
  currentHook: string;
  audience?: string;
  onHookChange: (newHook: string) => void;
}> = ({ topic, currentHook, audience, onHookChange }) => {
  const [loadingStyle, setLoadingStyle] = useState<string | null>(null);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);

  const handleRewrite = async (style: string) => {
    setLoadingStyle(style);
    try {
      const res = await fetch("/api/idea-lab/rewrite-hook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, currentHook, style, audience }),
      });
      if (!res.ok) return;
      const data = await res.json() as { hookLine: string };
      if (data.hookLine) {
        onHookChange(data.hookLine);
        setActiveStyle(style);
      }
    } catch { /* ignore */ }
    finally {
      setLoadingStyle(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {HOOK_STYLES.map((s) => (
        <button
          key={s.id}
          onClick={() => handleRewrite(s.id)}
          disabled={loadingStyle !== null}
          className={cn(
            "text-[9px] font-bold px-2 py-0.5 rounded-full border transition-all",
            activeStyle === s.id
              ? "bg-teal-600 text-white border-teal-600"
              : "bg-white text-slate-500 border-slate-200 hover:border-teal-400 hover:text-teal-600",
            loadingStyle !== null && "opacity-50 cursor-not-allowed"
          )}
        >
          {loadingStyle === s.id ? (
            <span className="flex items-center gap-0.5">
              <Loader2 size={7} className="animate-spin" />
              {s.label}
            </span>
          ) : s.label}
        </button>
      ))}
    </div>
  );
};

// ============================================================
// ScriptDraftPanel
// ============================================================
const ScriptDraftPanel: React.FC<{
  topic: string;
  hookLine: string;
  format: string;
  audience: string;
}> = ({ topic, hookLine, format, audience }) => {
  const [draft, setDraft] = useState<ScriptDraft | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [scriptMode, setScriptMode] = useState<"original" | "finisher" | "fixer">("original");
  const [rawNotes, setRawNotes] = useState("");
  const [roughDraft, setRoughDraft] = useState("");
  const [showModeSelect, setShowModeSelect] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const { selectedCreatorId } = useCreator();
  const { trackEvent } = useOnboarding();

  // Clear draft when hookLine changes (prevents stale script)
  useEffect(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setDraft(null);
    setError(null);
    setStreaming(false);
    setShowModeSelect(false);
  }, [hookLine]);

  const handleWriteScript = async (mode: "original" | "finisher" | "fixer" = scriptMode) => {
    setStreaming(true);
    setShowModeSelect(false);
    setDraft(null);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, unknown> = { topic, hookLine, format, audience, mode, creatorId: selectedCreatorId ?? undefined };
      if (mode === "finisher") body.rawNotes = rawNotes;
      if (mode === "fixer") body.roughDraft = roughDraft;

      const res = await fetch("/api/idea-lab/script-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setError("Failed to generate script");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; data?: ScriptDraft; message?: string };
            if (event.type === "result" && event.data) {
              setDraft(event.data);
              trackEvent("use-idea-lab");
            } else if (event.type === "error") {
              setError(event.message ?? "Script generation failed");
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Connection failed");
      }
    } finally {
      setStreaming(false);
    }
  };

  const handleCopy = () => {
    if (!draft) return;
    const text = [
      `Hook: "${draft.hookLine}"`,
      "",
      ...draft.keyPoints.map((kp, i) => `${i + 1}. ${kp}`),
      "",
      `CTA: ${draft.cta}`,
      `Duration: ${draft.estimatedDuration}`,
      `Production: ${draft.productionNotes}`,
    ].join("\n");
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const handleCopyAsPrompt = () => {
    if (!draft) return;
    const prompt = [
      `Write a short-form video script with the following parameters:`,
      ``,
      `Topic: ${topic}`,
      `Format: ${format}`,
      `Target Audience: ${audience}`,
      `Hook: "${draft.hookLine}"`,
      ``,
      `Key Points to Cover:`,
      ...draft.keyPoints.map((kp, i) => `${i + 1}. ${kp}`),
      ``,
      `CTA: ${draft.cta}`,
      `Estimated Duration: ${draft.estimatedDuration}`,
      ``,
      `Structure: Hook → Context (setup) → Rehook → Build → Final Hook`,
      ``,
      `Production Notes: ${draft.productionNotes}`,
    ].join("\n");
    navigator.clipboard.writeText(prompt).catch(() => {});
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  if (streaming) {
    return (
      <div className="flex items-center gap-1 text-[10px] text-slate-400">
        <Loader2 size={10} className="animate-spin" />
        Drafting script...
      </div>
    );
  }

  if (error) {
    return (
      <button
        onClick={() => setError(null)}
        className="text-[10px] text-rose-600 hover:underline"
      >
        Script failed — retry
      </button>
    );
  }

  if (draft) {
    const STRUCTURE_SEGMENTS = [
      { label: "Hook", color: "bg-teal-100 text-teal-700 border-teal-200" },
      { label: "Setup", color: "bg-slate-100 text-slate-600 border-slate-200" },
      { label: "Rehook", color: "bg-sky-100 text-sky-700 border-sky-200" },
      { label: "Build", color: "bg-slate-100 text-slate-600 border-slate-200" },
      { label: "Final Hook", color: "bg-teal-100 text-teal-700 border-teal-200" },
    ];

    return (
      <div className="mt-3 p-3 bg-teal-50 border border-teal-200 rounded-xl space-y-2.5 w-full">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">Script Draft</p>
        <p className="text-sm font-bold italic text-slate-800">"{draft.hookLine}"</p>
        <div className="space-y-1.5">
          {draft.keyPoints.map((kp, i) => {
            const cueMatch = kp.match(/^(.*?)(\[.*?\])\s*$/);
            return (
              <div key={i} className="flex gap-2 text-xs">
                <span className="text-slate-400 shrink-0 font-medium">{i + 1}.</span>
                <span>
                  <span className="text-slate-700">{cueMatch ? cueMatch[1].trim() : kp}</span>
                  {cueMatch && <span className="text-slate-400 ml-1 italic">{cueMatch[2]}</span>}
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-1 rounded-lg">{draft.cta}</p>

        {/* Script Structure */}
        <FeatureHint id="script-structure" content={FEATURE_HINTS["script-structure"].content} side="bottom">
        <details className="group">
          <summary className="text-[10px] font-bold text-teal-600 cursor-pointer list-none flex items-center gap-1 select-none">
            <ChevronDown size={10} className="group-open:rotate-180 transition-transform" />
            Script Structure
          </summary>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {STRUCTURE_SEGMENTS.map((seg, i) => (
              <React.Fragment key={seg.label}>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", seg.color)}>
                  {seg.label}
                </span>
                {i < STRUCTURE_SEGMENTS.length - 1 && (
                  <ArrowRight size={8} className="text-slate-300 shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Kallaway: Hook → Dance (Rehook cycles) → Final Hook. Fragility of short-form means every transition must re-earn attention.</p>
        </details>
        </FeatureHint>

        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-400">{draft.estimatedDuration} · {draft.productionNotes}</span>
          <div className="flex items-center gap-1.5">
            <FeatureHint id="copy-as-prompt" content={FEATURE_HINTS["copy-as-prompt"].content} side="top">
            <button
              onClick={handleCopyAsPrompt}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-700 text-white hover:bg-slate-800 transition-colors"
              title="Copy a structured AI prompt for use in Claude or ChatGPT"
            >
              {copiedPrompt ? <Check size={9} /> : <Copy size={9} />}
              {copiedPrompt ? "Copied!" : "Copy as Prompt"}
            </button>
            </FeatureHint>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-600 text-white hover:bg-violet-700 transition-colors"
            >
              {copied ? <Check size={9} /> : <Copy size={9} />}
              {copied ? "Copied!" : "Copy Script"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showModeSelect) {
    const MODES = [
      { id: "original" as const, label: "Original", desc: "Full AI generation from your topic and hook" },
      { id: "finisher" as const, label: "Finisher", desc: "Paste your notes — AI completes the script" },
      { id: "fixer" as const, label: "Fixer", desc: "Paste a rough draft — AI polishes it" },
    ];
    return (
      <div className="mt-2 space-y-2 w-full">
        <FeatureHint id="script-modes" content={FEATURE_HINTS["script-modes"].content} side="bottom">
        <div className="flex items-center gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setScriptMode(m.id)}
              className={cn(
                "flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors text-center",
                scriptMode === m.id
                  ? "bg-teal-600 text-white border-violet-600"
                  : "bg-white text-slate-500 border-slate-200 hover:border-violet-400 hover:text-teal-700"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        </FeatureHint>
        <p className="text-[10px] text-slate-400 italic">{MODES.find((m) => m.id === scriptMode)?.desc}</p>
        {scriptMode === "finisher" && (
          <textarea
            value={rawNotes}
            onChange={(e) => setRawNotes(e.target.value)}
            placeholder="Paste your rough notes, bullet points, or key facts here..."
            rows={4}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 text-slate-800 placeholder-slate-400"
          />
        )}
        {scriptMode === "fixer" && (
          <textarea
            value={roughDraft}
            onChange={(e) => setRoughDraft(e.target.value)}
            placeholder="Paste your rough script draft here..."
            rows={4}
            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 text-slate-800 placeholder-slate-400"
          />
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleWriteScript(scriptMode)}
            disabled={(scriptMode === "finisher" && !rawNotes.trim()) || (scriptMode === "fixer" && !roughDraft.trim())}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold bg-teal-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <FileText size={10} />
            Generate
          </button>
          <button onClick={() => setShowModeSelect(false)} className="text-[10px] text-slate-400 hover:text-slate-600">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowModeSelect(true)}
      className="flex items-center gap-1 text-[10px] font-bold text-teal-700 hover:text-teal-800 transition-colors"
    >
      <FileText size={10} />
      Write Script
    </button>
  );
};

// ============================================================
// AddToIdeaBank
// ============================================================
type AddToLabProps = {
  topic: string;
  hookAngle: string;
  suggestedFormat: string;
  audience: string;
  onAdded?: () => void;
  onIdeaAdded?: (topic: string) => void;
  existingTopics?: string[];
};

const AddToIdeaBank: React.FC<AddToLabProps> = ({
  topic,
  hookAngle,
  suggestedFormat,
  audience,
  onAdded,
  onIdeaAdded,
  existingTopics,
}) => {
  const queryClient = useQueryClient();
  const [added, setAdded] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const matchingTopic = existingTopics ? hasSignificantOverlap(topic, existingTopics) : null;

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: [{ topic, hookAngle, suggestedFormat, priority: "High", source: "Idea Lab", category: "competitor" }],
        }),
      });
      if (!res.ok) throw new Error("Failed to add idea");
      return res.json();
    },
    onSuccess: () => {
      setAdded(true);
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      onAdded?.();
      onIdeaAdded?.(topic);
    },
  });

  if (added) {
    return (
      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full">
        <Check size={10} /> Added to Ideas
      </span>
    );
  }

  if (showWarning) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 max-w-[220px] text-right leading-snug">
          ⚠ Similar idea in bank: "{matchingTopic}"
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowWarning(false)}
            className="px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors"
          >
            {mutation.isPending && <Loader2 size={8} className="animate-spin" />}
            Add Anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        if (matchingTopic) {
          setShowWarning(true);
        } else {
          mutation.mutate();
        }
      }}
      disabled={mutation.isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {mutation.isPending ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}
      Use This Idea
    </button>
  );
};

// ============================================================
// Mode 1: URL Spark
// ============================================================
const AdaptationCard: React.FC<{
  adaptation: LabAdaptation;
  existingTopics?: string[];
  onIdeaAdded?: (topic: string) => void;
}> = ({ adaptation, existingTopics, onIdeaAdded }) => {
  const formatLetter = extractFormatLetter(adaptation.suggestedFormat);
  const formatColor = FORMAT_COLORS[formatLetter] ?? FORMAT_COLORS.A;
  const accentColor = FORMAT_BORDER_ACCENT[formatLetter] ?? FORMAT_BORDER_ACCENT.A;
  const [hookLine, setHookLine] = useState(adaptation.hookLine);
  const [hookSaved, setHookSaved] = useState(false);

  const saveHookToVault = async () => {
    try {
      await fetch("/api/vault/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: hookLine,
          example: hookLine,
          category: "custom",
          sourceCreator: "IdeaLab",
        }),
      });
      setHookSaved(true);
      setTimeout(() => setHookSaved(false), 2000);
    } catch (_) {}
  };

  return (
    <div className={cn("bg-white border border-slate-200 rounded-xl p-4 border-l-4 space-y-3", accentColor)}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 leading-snug">{adaptation.adaptedTopic}</p>
        <div className="flex items-start gap-2 mt-1">
          <p className="text-xs text-slate-600 italic flex-1">"{hookLine}"</p>
          <FeatureHint id="save-hook-vault" content={FEATURE_HINTS["save-hook-vault"].content} side="right">
          <button
            onClick={saveHookToVault}
            title="Save hook to Vault"
            className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-700"
          >
            {hookSaved ? <Check size={10} /> : <Bookmark size={10} />}
            {hookSaved ? "Saved!" : "Save"}
          </button>
          </FeatureHint>
        </div>
        <HookRewriterPills
          topic={adaptation.adaptedTopic}
          currentHook={hookLine}
          audience={adaptation.targetAudience}
          onHookChange={setHookLine}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", formatColor)}>
          {adaptation.suggestedFormat}
        </span>
        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", DIFFICULTY_COLORS[adaptation.difficultyLevel])}>
          {adaptation.difficultyLevel}
        </span>
        <span className="text-[10px] text-slate-400">{adaptation.timeToFilm}</span>
        <span className="text-[10px] text-slate-400">— {adaptation.targetAudience}</span>
      </div>

      <p className="text-xs text-slate-600">{adaptation.whyItWorks}</p>

      <div className="flex items-center justify-between gap-3">
        <ScriptDraftPanel
          topic={adaptation.adaptedTopic}
          hookLine={hookLine}
          format={adaptation.suggestedFormat}
          audience={adaptation.targetAudience}
        />
        <AddToIdeaBank
          topic={adaptation.adaptedTopic}
          hookAngle={hookLine}
          suggestedFormat={adaptation.suggestedFormat}
          audience={adaptation.targetAudience}
          existingTopics={existingTopics}
          onIdeaAdded={onIdeaAdded}
        />
      </div>
    </div>
  );
};

const UrlSparkMode: React.FC<{
  existingTopics?: string[];
  onIdeaAdded?: (topic: string) => void;
  creatorId?: number | null;
}> = ({ existingTopics, onIdeaAdded, creatorId }) => {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [showDescription, setShowDescription] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [result, setResult] = useState<UrlSparkResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setStreaming(true);
    setResult(null);
    setError(null);
    setLoadingMsgIdx(0);

    intervalRef.current = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES["spark-url"].length);
    }, 2800);

    const controller = new AbortController();
    abortRef.current = () => controller.abort();

    try {
      const res = await fetch("/api/idea-lab/spark-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), description: description.trim() || undefined, creatorId: creatorId ?? undefined }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setError("Server error — please try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as { type: string; data?: UrlSparkResult; message?: string };
            if (event.type === "result" && event.data) {
              setResult(event.data);
            } else if (event.type === "error") {
              setError(event.message ?? "Analysis failed");
            }
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("Connection failed — please try again.");
      }
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStreaming(false);
    }
  };

  const handleReset = () => {
    if (abortRef.current) abortRef.current();
    setResult(null);
    setError(null);
    setStreaming(false);
  };

  return (
    <div className="space-y-4">
      {!result && (
        <div className="space-y-3">
          <div className="space-y-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Paste a YouTube, TikTok, or Instagram video URL"
              className="w-full text-sm text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-transparent"
              onKeyDown={(e) => { if (e.key === "Enter") handleAnalyze(); }}
            />
            <button
              onClick={() => setShowDescription((v) => !v)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
            >
              <MessageCircle size={10} />
              {showDescription ? "Hide note" : "+ What did you notice about this video?"}
            </button>
            {showDescription && (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional: describe what caught your attention — the hook, the format, the energy, anything..."
                rows={2}
                className="w-full text-sm text-slate-700 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-teal-300"
              />
            )}
          </div>
          <button
            onClick={handleAnalyze}
            disabled={!url.trim() || streaming}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {streaming ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {LOADING_MESSAGES["spark-url"][loadingMsgIdx]}
              </>
            ) : (
              <>
                <Zap size={13} />
                Analyze Video
              </>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <X size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Pattern Detected</p>
            <p className="text-sm text-slate-800 font-medium">{result.sourcePattern}</p>
            <p className="text-xs text-slate-500">{result.hookMechanism}</p>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">3 Adaptations for Your Audience</p>
            {result.adaptations.map((adaptation, i) => (
              <AdaptationCard
                key={i}
                adaptation={adaptation}
                existingTopics={existingTopics}
                onIdeaAdded={onIdeaAdded}
              />
            ))}
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
          >
            <RotateCcw size={12} /> Analyze Another Video
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Mode 2: Guided
// ============================================================
const FormedIdeaCard: React.FC<{
  formedIdea: FormedIdea;
  existingTopics?: string[];
  onIdeaAdded?: (topic: string) => void;
  onReset: () => void;
}> = ({ formedIdea, existingTopics, onIdeaAdded, onReset }) => {
  const [hookLine, setHookLine] = useState(formedIdea.hookAngle ?? "");

  return (
    <div className="p-4 bg-teal-50 border border-teal-200 rounded-xl space-y-3">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">Here is what you are making</p>
      <div className="space-y-1.5">
        <p className="text-sm font-bold text-slate-800">{formedIdea.topic}</p>
        {hookLine && (
          <>
            <p className="text-xs text-slate-600 italic">"{hookLine}"</p>
            <HookRewriterPills
              topic={formedIdea.topic}
              currentHook={hookLine}
              audience={formedIdea.targetAudience}
              onHookChange={setHookLine}
            />
          </>
        )}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", FORMAT_COLORS[extractFormatLetter(formedIdea.suggestedFormat)])}>
            {formedIdea.suggestedFormat}
          </span>
          {formedIdea.targetAudience && (
            <span className="text-[10px] text-slate-500">{formedIdea.targetAudience}</span>
          )}
        </div>
        {formedIdea.whyItWorks && (
          <p className="text-xs text-slate-600 pt-1">{formedIdea.whyItWorks}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <button
            onClick={onReset}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
          >
            <RotateCcw size={11} /> Start Over
          </button>
          {hookLine && (
            <ScriptDraftPanel
              topic={formedIdea.topic}
              hookLine={hookLine}
              format={formedIdea.suggestedFormat}
              audience={formedIdea.targetAudience ?? ""}
            />
          )}
        </div>
        <AddToIdeaBank
          topic={formedIdea.topic}
          hookAngle={hookLine || formedIdea.hookAngle}
          suggestedFormat={formedIdea.suggestedFormat}
          audience={formedIdea.targetAudience ?? ""}
          existingTopics={existingTopics}
          onIdeaAdded={onIdeaAdded}
        />
      </div>
    </div>
  );
};

const GuidedMode: React.FC<{
  existingTopics?: string[];
  onIdeaAdded?: (topic: string) => void;
  creatorId?: number | null;
}> = ({ existingTopics, onIdeaAdded, creatorId }) => {
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [aiMessages, setAiMessages] = useState<Array<{ response: string; isComplete: boolean; idea: FormedIdea | null }>>([]);
  const [streaming, setStreaming] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  const isComplete = aiMessages.some((m) => m.isComplete);
  const formedIdea = aiMessages.find((m) => m.isComplete)?.idea ?? null;

  const handleSend = async () => {
    if (!input.trim() || streaming) return;

    const userMsg = input.trim();
    setInput("");
    setError(null);

    const newConvo: ConversationMessage[] = [...conversation, { role: "user", content: userMsg }];
    setConversation(newConvo);

    setStreaming(true);
    setLoadingMsgIdx(0);
    intervalRef.current = setInterval(() => {
      setLoadingMsgIdx((i) => (i + 1) % LOADING_MESSAGES.guide.length);
    }, 2500);

    try {
      const res = await fetch("/api/idea-lab/guide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversationHistory: conversation, creatorId: creatorId ?? undefined }),
      });

      if (!res.ok || !res.body) {
        setError("Server error — please try again.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string;
              data?: { response: string; isComplete: boolean; idea: FormedIdea | null };
              message?: string;
            };
            if (event.type === "result" && event.data) {
              const aiReply = event.data;
              setAiMessages((prev) => [...prev, aiReply]);
              setConversation((prev) => [...prev, { role: "assistant", content: aiReply.response }]);
              scrollToBottom();
            } else if (event.type === "error") {
              setError(event.message ?? "Request failed");
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setError("Connection failed — please try again.");
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setStreaming(false);
    }
  };

  const handleReset = () => {
    setConversation([]);
    setAiMessages([]);
    setInput("");
    setError(null);
  };

  return (
    <div className="space-y-4">
      {conversation.length === 0 && (
        <p className="text-sm text-slate-500">
          Describe your idea as loosely as possible. A sentence, a feeling, something you noticed. I will ask one question at a time to help shape it into something you can film.
        </p>
      )}

      {conversation.length > 0 && (
        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {conversation.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-teal-600 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-800 rounded-bl-md"
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {streaming && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-500 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                {LOADING_MESSAGES.guide[loadingMsgIdx]}
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
      )}

      {isComplete && formedIdea && (
        <FormedIdeaCard
          formedIdea={formedIdea}
          existingTopics={existingTopics}
          onIdeaAdded={onIdeaAdded}
          onReset={handleReset}
        />
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <X size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {!isComplete && (
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={conversation.length === 0 ? "Describe your idea..." : "Your answer..."}
            rows={2}
            disabled={streaming}
            className="flex-1 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-teal-300 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || streaming}
            className="p-2.5 rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Mode 3: Quick Spark
// ============================================================
const MutationCard: React.FC<{
  m: FormatMutation;
  isExpanded: boolean;
  onToggle: () => void;
  existingTopics?: string[];
  onIdeaAdded?: (topic: string) => void;
}> = ({ m, isExpanded, onToggle, existingTopics, onIdeaAdded }) => {
  const accentColor = FORMAT_BORDER_ACCENT[m.format] ?? FORMAT_BORDER_ACCENT.A;
  const badgeColor = FORMAT_COLORS[m.format] ?? FORMAT_COLORS.A;
  const [hookLine, setHookLine] = useState(m.adaptedHook);

  return (
    <div className={cn("bg-white border border-slate-200 rounded-xl border-l-4 overflow-hidden", accentColor)}>
      <button
        onClick={onToggle}
        className="w-full text-left p-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded border", badgeColor)}>
                {m.format}
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{m.formatName}</span>
              <span className="text-[10px] text-slate-400">{m.estimatedRuntime}</span>
            </div>
            <p className="text-sm font-semibold text-slate-800 leading-snug">{m.adaptedTopic}</p>
          </div>
          {isExpanded ? <ChevronUp size={14} className="text-slate-400 shrink-0 mt-1" /> : <ChevronDown size={14} className="text-slate-400 shrink-0 mt-1" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <div>
            <p className="text-xs text-slate-600 italic">"{hookLine}"</p>
            <HookRewriterPills
              topic={m.adaptedTopic}
              currentHook={hookLine}
              onHookChange={setHookLine}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", DIFFICULTY_COLORS[m.difficultyLevel])}>
              {m.difficultyLevel}
            </span>
            {m.platformFit.map((p) => (
              <span key={p} className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">{p}</span>
            ))}
          </div>
          <p className="text-xs text-slate-500">{m.whyThisFormat}</p>
          <div className="flex items-center justify-between gap-3 pt-1">
            <ScriptDraftPanel
              topic={m.adaptedTopic}
              hookLine={hookLine}
              format={`${m.format} (${m.formatName})`}
              audience=""
            />
            <AddToIdeaBank
              topic={m.adaptedTopic}
              hookAngle={hookLine}
              suggestedFormat={`${m.format} (${m.formatName})`}
              audience=""
              existingTopics={existingTopics}
              onIdeaAdded={onIdeaAdded}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const QuickSparkMode: React.FC<{
  existingTopics?: string[];
  onIdeaAdded?: (topic: string) => void;
  creatorId?: number | null;
}> = ({ existingTopics, onIdeaAdded, creatorId }) => {
  const [input, setInput] = useState("");
  const [mutations, setMutations] = useState<FormatMutation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedMutation, setExpandedMutation] = useState<string | null>(null);

  const handleMutate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError(null);
    setMutations(null);

    try {
      const res = await fetch("/api/idea-lab/mutate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: input.trim(), creatorId: creatorId ?? undefined }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? "Failed to generate mutations");
        return;
      }
      const data = await res.json() as { mutations: FormatMutation[] };
      setMutations(data.mutations ?? []);
    } catch {
      setError("Connection failed — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMutations(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {!mutations && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Type a rough idea and see it rewritten in all 7 production formats simultaneously. Pick the one that fits best.
          </p>
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleMutate(); }}
              placeholder="e.g. back pain from sitting all day, posture for gamers, benefits of adjustments..."
              className="flex-1 text-sm text-slate-800 placeholder-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-teal-300"
            />
            <button
              onClick={handleMutate}
              disabled={!input.trim() || loading}
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Shuffle size={14} />}
              {loading ? "Generating..." : "7 Ways"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
          <X size={14} className="shrink-0" />
          {error}
        </div>
      )}

      {mutations && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">7 Ways to Make This</p>
            <button
              onClick={handleReset}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors"
            >
              <RotateCcw size={11} /> New Idea
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {mutations.map((m) => (
              <MutationCard
                key={m.format}
                m={m}
                isExpanded={expandedMutation === m.format}
                onToggle={() => setExpandedMutation(expandedMutation === m.format ? null : m.format)}
                existingTopics={existingTopics}
                onIdeaAdded={onIdeaAdded}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// Main IdeaLab Component
// ============================================================
type Mode = "url" | "guide" | "quick" | null;

type IdeaLabProps = {
  onClose: () => void;
  onIdeaAdded?: (topic: string) => void;
  existingTopics?: string[];
};

const AVATAR_COLOR_MAP: Record<string, string> = {
  teal: "bg-teal-600",
  violet: "bg-teal-600",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

export const IdeaLab: React.FC<IdeaLabProps> = ({ onClose, onIdeaAdded, existingTopics }) => {
  const [mode, setMode] = useState<Mode>(null);
  const { selectedCreatorId } = useCreator();

  const { data: personaData } = useQuery<{ personas: CreatorPersona[] }>({
    queryKey: ["personas"],
    queryFn: () => fetch("/api/personas").then((r) => r.json()),
    staleTime: 60_000,
  });
  const activePersona = personaData?.personas?.find((p) => p.id === selectedCreatorId) ?? null;

  const MODES: Array<{
    id: Mode;
    icon: React.ReactNode;
    label: string;
    tagline: string;
    description: string;
    color: string;
    activeColor: string;
  }> = [
    {
      id: "url",
      icon: <Link size={18} />,
      label: "Analyze Video",
      tagline: "Reverse-engineer what works",
      description: "Paste a video you loved. I will reverse-engineer what makes it work and generate 3 niche-specific adaptations for your audience.",
      color: "border-teal-200 hover:border-teal-400 hover:bg-teal-50",
      activeColor: "border-teal-500 bg-teal-50",
    },
    {
      id: "guide",
      icon: <MessageCircle size={18} />,
      label: "Guide Me",
      tagline: "Shape a loose idea",
      description: "Describe a feeling, something you noticed, or a vague notion. I will ask one question at a time to help you shape it into a production-ready concept.",
      color: "border-teal-200 hover:border-violet-400 hover:bg-teal-50",
      activeColor: "border-violet-500 bg-teal-50",
    },
    {
      id: "quick",
      icon: <Shuffle size={18} />,
      label: "7 Ways",
      tagline: "See all formats",
      description: "Type any topic and see it rewritten in all 7 production format templates simultaneously. Pick the one that fits best.",
      color: "border-orange-200 hover:border-orange-400 hover:bg-orange-50",
      activeColor: "border-orange-500 bg-orange-50",
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="border-b border-slate-100">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-amber-500" />
            <span className="text-sm font-black uppercase tracking-widest text-slate-800">Idea Lab</span>
            {mode && (
              <span className="text-xs text-slate-400 ml-1">
                / {MODES.find((m) => m.id === mode)?.label}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        {activePersona && (
          <div className="px-5 pb-3 flex items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Generating as</span>
            <span className={cn("w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0", AVATAR_COLOR_MAP[activePersona.avatarColor ?? "teal"] ?? "bg-teal-600")}>
              {activePersona.initials ?? activePersona.name.slice(0, 2).toUpperCase()}
            </span>
            <span className="text-[10px] font-bold text-slate-700">{activePersona.name}</span>
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(mode === m.id ? null : m.id)}
              className={cn(
                "text-left p-4 border-2 rounded-xl transition-all",
                mode === m.id ? m.activeColor : m.color
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("text-slate-600", mode === m.id && "text-slate-800")}>{m.icon}</span>
                <span className="text-sm font-bold text-slate-800">{m.label}</span>
              </div>
              <p className="text-[11px] font-semibold text-slate-500">{m.tagline}</p>
              {mode === m.id && (
                <p className="mt-2 text-xs text-slate-600">{m.description}</p>
              )}
            </button>
          ))}
        </div>

        {mode === "url" && (
          <div className="border-t border-slate-100 pt-5">
            <UrlSparkMode existingTopics={existingTopics} onIdeaAdded={onIdeaAdded} creatorId={selectedCreatorId} />
          </div>
        )}
        {mode === "guide" && (
          <div className="border-t border-slate-100 pt-5">
            <GuidedMode existingTopics={existingTopics} onIdeaAdded={onIdeaAdded} creatorId={selectedCreatorId} />
          </div>
        )}
        {mode === "quick" && (
          <div className="border-t border-slate-100 pt-5">
            <QuickSparkMode existingTopics={existingTopics} onIdeaAdded={onIdeaAdded} creatorId={selectedCreatorId} />
          </div>
        )}
      </div>

    </div>
  );
};
