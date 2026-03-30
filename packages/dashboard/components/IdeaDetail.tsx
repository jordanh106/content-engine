import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X,
  Wand2,
  Archive,
  Loader2,
  ChevronDown,
  ChevronUp,
  FileText,
  Sparkles,
  Check,
  Copy,
  MessageCircle,
  Send,
  Rocket,
  Bookmark,
  Palette,
  History,
  Lightbulb,
  RefreshCw,
  Shield,
  Zap,
  ChevronRight,
} from "lucide-react";
import type { Idea, IdeaCategory, FormatId, ConversationMessage, VaultHook, VaultStyle, ScriptVersion, IdeaConcept } from "../shared/types.js";
import { FORMATS } from "../shared/types.js";
import { cn } from "../utils/cn.js";

type IdeaDetailProps = {
  idea: Idea;
  onClose: () => void;
  onUpdated: () => void;
  onSelectVideo?: (code: string) => void;
};

const CATEGORY_META: Record<IdeaCategory, { label: string; color: string }> = {
  trending: { label: "Trending", color: "text-orange-600 bg-orange-50" },
  competitor: { label: "Competitor", color: "text-violet-600 bg-violet-50" },
  evergreen: { label: "Evergreen", color: "text-emerald-600 bg-emerald-50" },
  audience: { label: "Audience", color: "text-sky-600 bg-sky-50" },
  personal: { label: "Personal", color: "text-pink-600 bg-pink-50" },
  archived: { label: "Archived", color: "text-slate-500 bg-slate-100" },
};

const PRIORITY_OPTIONS = ["High", "Medium", "Low"] as const;
const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-rose-100 text-rose-700 border-rose-200",
  Medium: "bg-amber-100 text-amber-700 border-amber-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
};

const FORMAT_OPTIONS: { id: FormatId; label: string }[] = Object.entries(FORMATS).map(
  ([id, info]) => ({ id: id as FormatId, label: `${id} (${info.shortName})` }),
);

type Tab = "context" | "script" | "caption";

type CaptionMessage = {
  role: "user" | "assistant";
  content: string;
  captions?: { platform: string; caption: string }[];
  isError?: boolean;
};

const PLATFORM_STYLES: Record<string, { accent: string; bg: string; border: string }> = {
  Instagram: { accent: "text-pink-700", bg: "bg-pink-50", border: "border-pink-200" },
  TikTok: { accent: "text-slate-900", bg: "bg-slate-50", border: "border-slate-300" },
  YouTube: { accent: "text-red-700", bg: "bg-red-50", border: "border-red-200" },
};

// ─── Concept Framework Section ──────────────────────────────────────────────

type ConceptSectionProps = {
  concept: IdeaConcept | null;
  isLoading: boolean;
  isGenerating: boolean;
  isRefining: boolean;
  onGenerate: () => void;
  onRefine: (feedback?: string) => void;
  onApprove: (approved: boolean) => void;
  error: Error | null;
};

const ScoreBar: React.FC<{ label: string; score: number; max?: number }> = ({ label, score, max = 10 }) => {
  const pct = (score / max) * 100;
  const color = score < 5 ? "bg-rose-400" : score < 7 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between">
        <span className="text-[9px] font-bold text-slate-500">{label}</span>
        <span className="text-[9px] font-black text-slate-700">{score}/{max}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ConceptSection: React.FC<ConceptSectionProps> = ({ concept, isLoading, isGenerating, isRefining, onGenerate, onRefine, onApprove, error }) => {
  const [refineFeedback, setRefineFeedback] = useState("");
  const [showRefine, setShowRefine] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
        <p className="text-xs text-violet-400">Loading concept...</p>
      </div>
    );
  }

  if (!concept) {
    return (
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 flex items-center gap-1">
              <Lightbulb size={10} /> Concept Validation
            </p>
            <p className="text-xs text-violet-600 mt-1">Generate a one-sentence concept and validate it before scripting.</p>
          </div>
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 disabled:opacity-50"
          >
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {isGenerating ? "Generating..." : "Generate Concept"}
          </button>
        </div>
        {error && <p className="text-xs text-rose-500 mt-2">{error.message}</p>}
      </div>
    );
  }

  const feedback = concept.aiFeedback ? (() => { try { return JSON.parse(concept.aiFeedback); } catch { return null; } })() as { strengths?: string[]; weaknesses?: string[]; suggestions?: string[] } | null : null;

  return (
    <div className={cn(
      "border rounded-xl p-4 space-y-3",
      concept.approved ? "bg-emerald-50 border-emerald-200" : "bg-violet-50 border-violet-200",
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 flex items-center gap-1 mb-1">
            <Lightbulb size={10} /> One-Sentence Concept
            {concept.approved && (
              <span className="inline-flex items-center gap-0.5 ml-2 px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[8px] font-bold">
                <Shield size={8} /> Approved
              </span>
            )}
          </p>
          <p className="text-sm font-medium text-slate-900">{concept.oneSentence}</p>
        </div>
        {/* Overall score circle */}
        <div className={cn(
          "flex-shrink-0 w-12 h-12 rounded-full flex flex-col items-center justify-center border-2",
          (concept.overallScore ?? 0) >= 7 ? "border-emerald-400 bg-emerald-50 text-emerald-700" :
          (concept.overallScore ?? 0) >= 5 ? "border-amber-400 bg-amber-50 text-amber-700" :
          "border-rose-400 bg-rose-50 text-rose-700",
        )}>
          <span className="text-lg font-black leading-none">{concept.overallScore ?? "?"}</span>
          <span className="text-[7px] font-bold">/10</span>
        </div>
      </div>

      {/* Score bars */}
      <div className="grid grid-cols-2 gap-2">
        <ScoreBar label="Technical Interest" score={concept.technicalInterestScore ?? 0} />
        <ScoreBar label="Emotional Resonance" score={concept.emotionalResonanceScore ?? 0} />
        <ScoreBar label="10s Explainability" score={concept.tenSecondExplainabilityScore ?? 0} />
        <ScoreBar label="Visual Payoff" score={concept.visualPayoffScore ?? 0} />
      </div>

      {/* AI Feedback */}
      {feedback && (
        <div className="space-y-1.5">
          {feedback.strengths && feedback.strengths.length > 0 && (
            <div className="flex gap-1.5 items-start">
              <span className="text-[10px] text-emerald-600 font-bold flex-shrink-0">Strengths:</span>
              <span className="text-[10px] text-slate-600">{feedback.strengths.join(". ")}</span>
            </div>
          )}
          {feedback.weaknesses && feedback.weaknesses.length > 0 && (
            <div className="flex gap-1.5 items-start">
              <span className="text-[10px] text-amber-600 font-bold flex-shrink-0">Improve:</span>
              <span className="text-[10px] text-slate-600">{feedback.weaknesses.join(". ")}</span>
            </div>
          )}
        </div>
      )}

      {/* Refined version suggestion */}
      {concept.refinedVersion && !concept.approved && (
        <div className="bg-white border border-violet-200 rounded-lg p-2.5">
          <p className="text-[9px] font-bold text-violet-500 mb-0.5">AI Suggestion:</p>
          <p className="text-xs text-slate-700 italic">{concept.refinedVersion}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {!concept.approved && (concept.overallScore ?? 0) >= 7 && (
          <button
            onClick={() => onApprove(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700"
          >
            <Check size={10} /> Approve Concept
          </button>
        )}
        {concept.approved && (
          <button
            onClick={() => onApprove(false)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold hover:bg-slate-200"
          >
            Unapprove
          </button>
        )}
        {!concept.approved && (
          <button
            onClick={() => setShowRefine(!showRefine)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold hover:bg-violet-200"
          >
            <RefreshCw size={10} /> Refine
          </button>
        )}
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold hover:bg-slate-200 disabled:opacity-50"
        >
          {isGenerating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
          Regenerate
        </button>
      </div>

      {/* Refine input */}
      {showRefine && (
        <div className="flex gap-2">
          <input
            value={refineFeedback}
            onChange={(e) => setRefineFeedback(e.target.value)}
            placeholder="Optional feedback for refinement..."
            className="flex-1 px-3 py-1.5 rounded-lg border border-violet-200 text-xs text-slate-700 focus:outline-none focus:border-violet-400"
          />
          <button
            onClick={() => { onRefine(refineFeedback || undefined); setShowRefine(false); setRefineFeedback(""); }}
            disabled={isRefining}
            className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[10px] font-bold hover:bg-violet-700 disabled:opacity-50"
          >
            {isRefining ? <Loader2 size={10} className="animate-spin" /> : "Refine"}
          </button>
        </div>
      )}

      {error && <p className="text-xs text-rose-500">{error.message}</p>}
    </div>
  );
};

export const IdeaDetail: React.FC<IdeaDetailProps> = ({ idea, onClose, onUpdated, onSelectVideo }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("context");
  const [editedPriority, setEditedPriority] = useState(idea.priority);
  const [editedFormat, setEditedFormat] = useState(idea.suggestedFormat);
  const [digestExpanded, setDigestExpanded] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  const [captionMessages, setCaptionMessages] = useState<CaptionMessage[]>([]);
  const [captionInput, setCaptionInput] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [customScript, setCustomScript] = useState("");
  const [copiedCaption, setCopiedCaption] = useState<string | null>(null);
  const captionScrollRef = useRef<HTMLDivElement>(null);
  const captionInputRef = useRef<HTMLTextAreaElement>(null);
  const panelContentRef = useRef<HTMLDivElement>(null);

  // Scroll panel to top + lock body scroll on open
  useEffect(() => {
    panelContentRef.current?.scrollTo(0, 0);
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Virality score
  const [viralityScore, setViralityScore] = useState<{ total: number; hook: number; flow: number; platformFit: number; suggestions: string[] } | null>(null);

  // Hook & Style selection
  const [selectedHookId, setSelectedHookId] = useState<number | null>(null);
  const [selectedStyleId, setSelectedStyleId] = useState<number | null>(null);
  const [filledHook, setFilledHook] = useState<string>("");
  const [showHookPicker, setShowHookPicker] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [hookVars, setHookVars] = useState<Record<string, string>>({});

  // Angle Spinner (Kallaway archetypes)
  type AngleVariant = { archetype: string; title: string; description: string; suggestedFormat: string };
  const [angles, setAngles] = useState<AngleVariant[]>([]);
  const [anglesOpen, setAnglesOpen] = useState(false);
  const anglesMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ideas-ai/angles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: idea.topic, hookAngle: idea.hookAngle, format: idea.suggestedFormat }),
      });
      if (!r.ok) { const err = await r.json(); throw new Error(err.error || "Failed"); }
      return r.json();
    },
    onSuccess: (data) => {
      setAngles(data.angles || []);
      setAnglesOpen(true);
    },
  });

  const hasChanges = editedPriority !== idea.priority || editedFormat !== idea.suggestedFormat;
  const hasDigest = idea.source?.toLowerCase().includes("n8n") && idea.dateAdded;

  // Reset edits when idea changes
  useEffect(() => {
    setEditedPriority(idea.priority);
    setEditedFormat(idea.suggestedFormat);
    setActiveTab("context");
    setConfirmArchive(false);
    setCaptionMessages([]);
    setCustomScript("");
    setCaptionInput("");
  }, [idea.topic, idea.priority, idea.suggestedFormat]);

  // Auto-scroll caption messages
  useEffect(() => {
    if (captionScrollRef.current) {
      captionScrollRef.current.scrollTop = captionScrollRef.current.scrollHeight;
    }
  }, [captionMessages, captionLoading]);

  // Fetch digest content
  const { data: digestData } = useQuery<{ markdown: string; date: string }>({
    queryKey: ["digest", idea.dateAdded],
    queryFn: () => fetch(`/api/ideas/digest/${idea.dateAdded}`).then((r) => r.json()),
    enabled: !!hasDigest && digestExpanded,
  });

  // Concept Framework
  const conceptQuery = useQuery<{ concept: IdeaConcept | null }>({
    queryKey: ["idea-concept", idea.topic],
    queryFn: () => fetch(`/api/ideas-ai/concept/${encodeURIComponent(idea.topic)}`).then((r) => r.json()),
  });

  const generateConceptMutation = useMutation({
    mutationFn: async () => {
      const r = await fetch(`/api/ideas-ai/concept/${encodeURIComponent(idea.topic)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hookAngle: idea.hookAngle,
          format: idea.suggestedFormat,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to generate concept");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["idea-concept", idea.topic] });
    },
  });

  const refineConceptMutation = useMutation({
    mutationFn: async (feedback?: string) => {
      const r = await fetch(`/api/ideas-ai/concept/${encodeURIComponent(idea.topic)}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentConcept: conceptQuery.data?.concept?.oneSentence,
          feedback,
        }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Failed to refine concept");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["idea-concept", idea.topic] });
    },
  });

  const approveConceptMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      const r = await fetch(`/api/ideas-ai/concept/${encodeURIComponent(idea.topic)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      if (!r.ok) throw new Error("Failed to update");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["idea-concept", idea.topic] });
    },
  });

  // Vault hooks
  const { data: hooksData } = useQuery<{ hooks: VaultHook[] }>({
    queryKey: ["vault-hooks"],
    queryFn: () => fetch("/api/vault/hooks").then((r) => r.json()),
    enabled: showHookPicker,
  });

  // Vault styles
  const { data: stylesData } = useQuery<{ styles: VaultStyle[] }>({
    queryKey: ["vault-styles"],
    queryFn: () => fetch("/api/vault/styles").then((r) => r.json()),
    enabled: showStylePicker,
  });

  // Script versions
  const { data: versionsData } = useQuery<{ versions: ScriptVersion[] }>({
    queryKey: ["script-versions", idea.topic],
    queryFn: () => fetch(`/api/ideas/script-versions/${encodeURIComponent(idea.topic)}`).then((r) => r.json()),
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ideas/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: idea.topic,
          priority: editedPriority,
          suggestedFormat: editedFormat,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      onUpdated();
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ideas/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: idea.topic }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      onUpdated();
      onClose();
    },
  });

  // Start production mutation
  const startProductionMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ideas/start-production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: idea.topic,
          format: editedFormat || idea.suggestedFormat,
          hookAngle: idea.hookAngle,
          source: idea.source || "Idea Bank",
          generatedScript: developMutation.data?.script || undefined,
          deliveryCues: developMutation.data?.deliveryCues || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{ videoCode: string; success: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ideas"] });
      queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline"] });
    },
  });

  // Develop script mutation
  const developMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ideas/develop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: idea.topic,
          suggestedFormat: editedFormat || idea.suggestedFormat,
          hookAngle: idea.hookAngle,
          priority: editedPriority || idea.priority,
          category: idea.category,
          hookId: selectedHookId && selectedHookId > 0 ? selectedHookId : undefined,
          styleId: selectedStyleId || undefined,
          filledHook: filledHook || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{ script: string; deliveryCues: string[]; versionId: number; version: number }>;
    },
    onSuccess: () => {
      setActiveTab("script");
      queryClient.invalidateQueries({ queryKey: ["script-versions", idea.topic] });
    },
  });

  // Virality score mutation
  const viralityMutation = useMutation({
    mutationFn: async () => {
      const script = developMutation.data?.script;
      if (!script) throw new Error("No script to score");
      const res = await fetch("/api/captions/virality-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          hook: filledHook || undefined,
          platform: "Instagram",
          format: editedFormat || idea.suggestedFormat,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{ total: number; hook: number; flow: number; platformFit: number; suggestions: string[] }>;
    },
    onSuccess: (data) => {
      setViralityScore(data);
    },
  });

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "context", label: "Context", icon: <Sparkles size={16} /> },
    { id: "script", label: "Script", icon: <FileText size={16} /> },
    { id: "caption", label: "Caption", icon: <MessageCircle size={16} /> },
  ];

  const getCaptionHistory = useCallback((): ConversationMessage[] => {
    return captionMessages
      .filter((m) => !m.isError)
      .map((m) => ({
        role: m.role,
        content: m.captions
          ? `${m.content}\n\nCaptions: ${m.captions.map((c) => `${c.platform}: ${c.caption}`).join("\n")}`
          : m.content,
      }));
  }, [captionMessages]);

  const handleCaptionSend = useCallback(
    async (text?: string) => {
      const prompt = (text || captionInput).trim();
      if (!prompt || captionLoading) return;

      setCaptionInput("");
      setCaptionMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setCaptionLoading(true);

      try {
        const scriptContext =
          customScript.trim() ||
          developMutation.data?.script ||
          "";

        const res = await fetch("/api/ideas-ai/caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            conversationHistory: getCaptionHistory().slice(-20),
            context: {
              topic: idea.topic,
              hookAngle: idea.hookAngle,
              suggestedFormat: editedFormat || idea.suggestedFormat,
              category: idea.category,
              script: scriptContext || undefined,
            },
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Error ${res.status}`);
        }

        const data = await res.json();
        setCaptionMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            captions: data.captions,
          },
        ]);
      } catch (e) {
        setCaptionMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: e instanceof Error ? e.message : "Something went wrong",
            isError: true,
          },
        ]);
      } finally {
        setCaptionLoading(false);
      }
    },
    [captionInput, captionLoading, customScript, developMutation.data, getCaptionHistory, idea, editedFormat],
  );

  const handleCaptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCaptionSend();
    }
  };

  const handleCopyCaption = async (text: string, platform: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedCaption(platform);
    setTimeout(() => setCopiedCaption(null), 2000);
  };

  const handleCopyScript = async () => {
    if (developMutation.data?.script) {
      await navigator.clipboard.writeText(developMutation.data.script);
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-[560px] bg-white z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 md:p-6 border-b border-slate-200">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold",
                  CATEGORY_META[idea.category].color,
                )}
              >
                {CATEGORY_META[idea.category].label}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                  PRIORITY_COLORS[idea.priority] ?? PRIORITY_COLORS.Medium,
                )}
              >
                {idea.priority}
              </span>
              {idea.suggestedFormat && (
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {idea.suggestedFormat}
                </span>
              )}
            </div>
            <h2 className="text-lg font-serif font-bold text-slate-900 leading-snug">
              {idea.topic}
            </h2>
            <div className="flex items-center gap-3 mt-1.5">
              {idea.dateAdded && (
                <span className="text-[10px] text-slate-400">{idea.dateAdded}</span>
              )}
              {idea.source && (
                <span className="text-[10px] text-slate-400 truncate max-w-[200px]">
                  {idea.source}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors",
                activeTab === tab.id
                  ? "text-teal-700 border-b-2 border-teal-600"
                  : "text-slate-400 hover:text-slate-600",
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div ref={panelContentRef} className="flex-1 overflow-y-auto">
          {activeTab === "context" && (
            <div className="p-4 md:p-6 space-y-6">
              {/* Concept Framework */}
              <ConceptSection
                concept={conceptQuery.data?.concept ?? null}
                isLoading={conceptQuery.isLoading}
                isGenerating={generateConceptMutation.isPending}
                isRefining={refineConceptMutation.isPending}
                onGenerate={() => generateConceptMutation.mutate()}
                onRefine={(feedback) => refineConceptMutation.mutate(feedback)}
                onApprove={(approved) => approveConceptMutation.mutate(approved)}
                error={(generateConceptMutation.error || refineConceptMutation.error) as Error | null}
              />

              {/* Hook / Angle */}
              {idea.hookAngle && (
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                    Hook / Angle
                  </p>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <p className="text-sm text-slate-700 leading-relaxed">{idea.hookAngle}</p>
                  </div>
                </div>
              )}

              {/* Angle Spinner (Kallaway Archetypes) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Angle Spinner
                  </p>
                  <button
                    onClick={() => anglesMutation.mutate()}
                    disabled={anglesMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 text-violet-600 text-[10px] font-bold uppercase tracking-widest hover:bg-violet-100 transition-colors disabled:opacity-50"
                  >
                    {anglesMutation.isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Zap size={12} />
                    )}
                    {anglesMutation.isPending ? "Spinning..." : angles.length > 0 ? "Respin" : "Spin 6 Angles"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mb-2">Generate 6 alternate video angles using Kallaway's hook archetypes.</p>
                {anglesMutation.isError && (
                  <p className="text-xs text-red-500 mb-2">{(anglesMutation.error as Error)?.message}</p>
                )}
                {anglesOpen && angles.length > 0 && (
                  <div className="space-y-2">
                    {angles.map((angle, i) => (
                      <div key={i} className="p-3 bg-white border border-slate-200 rounded-xl hover:border-violet-200 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700">{angle.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{angle.description}</p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600">
                              {angle.archetype}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-600">
                              {angle.suggestedFormat}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Digest Source */}
              {hasDigest && (
                <div>
                  <button
                    onClick={() => setDigestExpanded(!digestExpanded)}
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 hover:text-teal-700 transition-colors"
                  >
                    Intelligence Digest ({idea.dateAdded})
                    {digestExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {digestExpanded && (
                    <div className="mt-2 bg-teal-50/50 border border-teal-100 rounded-xl p-4 max-h-[300px] overflow-y-auto">
                      {digestData?.markdown ? (
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap font-sans leading-relaxed">
                          {digestData.markdown}
                        </pre>
                      ) : (
                        <p className="text-xs text-slate-400">Loading digest...</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Priority Editor */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Priority
                </p>
                <div className="flex gap-2">
                  {PRIORITY_OPTIONS.map((pri) => (
                    <button
                      key={pri}
                      onClick={() => setEditedPriority(pri)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-bold transition-colors border",
                        editedPriority === pri
                          ? PRIORITY_COLORS[pri]
                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-300",
                      )}
                    >
                      {pri}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format Editor */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Suggested Format
                </p>
                <div className="flex flex-wrap gap-2">
                  {FORMAT_OPTIONS.map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => setEditedFormat(fmt.label)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-bold transition-colors border",
                        editedFormat === fmt.label
                          ? "bg-teal-600 text-white border-teal-600"
                          : "bg-white border-slate-200 text-slate-500 hover:border-slate-300",
                      )}
                    >
                      {fmt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hook Selector */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Opening Hook
                </p>
                {selectedHookId ? (
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-teal-600">Vault Hook Selected</span>
                      <button
                        onClick={() => { setSelectedHookId(null); setFilledHook(""); setHookVars({}); }}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                      >
                        Clear
                      </button>
                    </div>
                    {filledHook && (
                      <p className="text-sm text-teal-800 font-medium">"{filledHook}"</p>
                    )}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowHookPicker(!showHookPicker)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:border-teal-300 hover:text-teal-700 transition-colors"
                  >
                    <Bookmark size={14} />
                    Select Hook from Vault
                  </button>
                )}
                {showHookPicker && !selectedHookId && (
                  <HookPickerInline
                    hooks={hooksData?.hooks ?? []}
                    onSelect={(hook, filled, vars) => {
                      setSelectedHookId(hook.id);
                      setFilledHook(filled);
                      setHookVars(vars);
                      setShowHookPicker(false);
                    }}
                    onClose={() => setShowHookPicker(false)}
                  />
                )}
              </div>

              {/* Style Selector */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                  Writing Style
                </p>
                {selectedStyleId ? (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-violet-600">Style Applied</span>
                      <button
                        onClick={() => setSelectedStyleId(null)}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600"
                      >
                        Clear
                      </button>
                    </div>
                    <p className="text-sm text-violet-800 font-medium">
                      {stylesData?.styles?.find((s) => s.id === selectedStyleId)?.name || `Style #${selectedStyleId}`}
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowStylePicker(!showStylePicker)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:border-violet-300 hover:text-violet-700 transition-colors"
                  >
                    <Palette size={14} />
                    Apply Writing Style
                  </button>
                )}
                {showStylePicker && !selectedStyleId && (
                  <div className="mt-2 border border-slate-200 rounded-xl max-h-[200px] overflow-y-auto">
                    {(stylesData?.styles ?? []).length === 0 ? (
                      <p className="text-xs text-slate-400 p-3">No styles saved yet. Create styles in the Vault.</p>
                    ) : (
                      (stylesData?.styles ?? []).map((style) => (
                        <button
                          key={style.id}
                          onClick={() => { setSelectedStyleId(style.id); setShowStylePicker(false); }}
                          className="w-full text-left px-3 py-2 hover:bg-violet-50 transition-colors border-b border-slate-100 last:border-b-0"
                        >
                          <p className="text-sm font-medium text-slate-900">{style.name}</p>
                          {style.description && (
                            <p className="text-[10px] text-slate-500 mt-0.5">{style.description}</p>
                          )}
                          {style.sourceCreator && (
                            <span className="text-[9px] text-violet-500 font-bold">{style.sourceCreator}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Save Changes */}
              {hasChanges && (
                <button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  className={cn(
                    "w-full py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-colors",
                    updateMutation.isPending
                      ? "bg-slate-100 text-slate-400 cursor-wait"
                      : "bg-teal-600 text-white hover:bg-teal-700",
                  )}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              )}
              {updateMutation.isSuccess && !hasChanges && (
                <p className="text-xs text-emerald-600 text-center">Changes saved.</p>
              )}
            </div>
          )}

          {activeTab === "script" && (
            <div className="p-4 md:p-6 space-y-4">
              {developMutation.isPending && (
                <div className="text-center py-12">
                  <Loader2 size={24} className="animate-spin text-teal-600 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Generating script...</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Using {idea.suggestedFormat || "Explainer"} format template
                  </p>
                </div>
              )}

              {developMutation.isError && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <p className="text-sm text-rose-700">
                    Failed to generate script: {developMutation.error?.message}
                  </p>
                  <button
                    onClick={() => developMutation.mutate()}
                    className="mt-2 text-xs text-rose-600 underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {developMutation.data?.script && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Generated Script
                    </p>
                    <button
                      onClick={handleCopyScript}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[44px]",
                        scriptCopied
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      {scriptCopied ? <Check size={14} /> : <Copy size={14} />}
                      {scriptCopied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans leading-relaxed">
                      {developMutation.data.script}
                    </pre>
                  </div>
                  {developMutation.data.deliveryCues.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">
                        Delivery Cues
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {developMutation.data.deliveryCues.map((cue, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full text-[10px] font-bold"
                          >
                            {cue}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Virality Score */}
                  <div>
                    {viralityScore ? (
                      <div className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center text-lg font-black border-2",
                            viralityScore.total >= 75 ? "border-emerald-400 text-emerald-700 bg-emerald-50" :
                            viralityScore.total >= 50 ? "border-amber-400 text-amber-700 bg-amber-50" :
                            "border-rose-400 text-rose-700 bg-rose-50",
                          )}>
                            {viralityScore.total}
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              Virality Score
                            </p>
                            <p className="text-xs text-slate-500">
                              {viralityScore.total >= 75 ? "Strong viral potential" :
                               viralityScore.total >= 50 ? "Good, room to improve" :
                               "Needs work before publishing"}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          {[
                            { label: "Hook", value: viralityScore.hook, max: 33 },
                            { label: "Flow", value: viralityScore.flow, max: 33 },
                            { label: "Platform Fit", value: viralityScore.platformFit, max: 33 },
                          ].map((dim) => (
                            <div key={dim.label} className="text-center">
                              <div className="relative w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1">
                                <div
                                  className={cn(
                                    "absolute left-0 top-0 h-full rounded-full",
                                    dim.value / dim.max >= 0.75 ? "bg-emerald-500" :
                                    dim.value / dim.max >= 0.5 ? "bg-amber-500" : "bg-rose-500",
                                  )}
                                  style={{ width: `${(dim.value / dim.max) * 100}%` }}
                                />
                              </div>
                              <p className="text-[9px] font-bold text-slate-500">{dim.label}</p>
                              <p className="text-xs font-bold text-slate-700">{dim.value}/{dim.max}</p>
                            </div>
                          ))}
                        </div>
                        {viralityScore.suggestions.length > 0 && (
                          <div>
                            <p className="text-[9px] font-bold uppercase text-slate-400 mb-1">Suggestions</p>
                            {viralityScore.suggestions.map((s, i) => (
                              <p key={i} className="text-xs text-slate-600 mb-0.5">- {s}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => viralityMutation.mutate()}
                        disabled={viralityMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:border-amber-300 hover:text-amber-700 transition-colors"
                      >
                        {viralityMutation.isPending ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Sparkles size={14} />
                        )}
                        {viralityMutation.isPending ? "Scoring..." : "Score Virality (0-99)"}
                      </button>
                    )}
                    {viralityMutation.isError && (
                      <p className="text-xs text-rose-500 mt-1">{(viralityMutation.error as Error).message}</p>
                    )}
                  </div>
                </>
              )}

              {!developMutation.isPending && !developMutation.data && !developMutation.isError && (
                <div className="text-center py-12">
                  <Wand2 size={32} className="text-slate-300 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">
                    Click "Develop Script" below to generate a draft script for this idea.
                  </p>
                </div>
              )}

              {/* Version History */}
              {(versionsData?.versions ?? []).length > 0 && (
                <div>
                  <button
                    onClick={() => setShowVersions(!showVersions)}
                    className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <History size={12} />
                    Version History ({versionsData!.versions.length})
                    {showVersions ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                  </button>
                  {showVersions && (
                    <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
                      {versionsData!.versions.map((v) => (
                        <VersionCard
                          key={v.id}
                          version={v}
                          isCurrent={developMutation.data?.script === v.script}
                          onLoad={(script) => {
                            developMutation.reset();
                            // Trigger a new mutation-like state with this script
                            Object.assign(developMutation, {
                              data: { script, deliveryCues: [], versionId: v.id, version: v.version },
                            });
                            // Force re-render
                            setScriptCopied(false);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "caption" && (
            <div className="flex flex-col h-full">
              {/* Script context area */}
              <div className="px-4 md:px-6 pt-4 pb-2">
                {developMutation.data?.script && !customScript.trim() && (
                  <div className="bg-teal-50/50 border border-teal-100 rounded-lg px-3 py-2 mb-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600 mb-1">
                      Using generated script as context
                    </p>
                    <p className="text-[10px] text-teal-700 line-clamp-2">
                      {developMutation.data.script.slice(0, 150)}...
                    </p>
                  </div>
                )}
                <textarea
                  value={customScript}
                  onChange={(e) => setCustomScript(e.target.value)}
                  placeholder="Paste your own script or notes here (optional)..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 placeholder:text-slate-400"
                />
              </div>

              {/* Caption chat messages */}
              <div
                ref={captionScrollRef}
                className="flex-1 overflow-y-auto px-4 md:px-6 py-2 space-y-3 min-h-[200px]"
              >
                {captionMessages.length === 0 && !captionLoading && (
                  <div className="text-center py-6">
                    <MessageCircle size={24} className="text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">
                      Generate captions for Instagram, TikTok, and YouTube
                    </p>
                    <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                      {[
                        "Generate captions for all platforms",
                        "Write a viral TikTok caption",
                        "Instagram caption with hashtags",
                      ].map((s) => (
                        <button
                          key={s}
                          onClick={() => handleCaptionSend(s)}
                          className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {captionMessages.map((msg, i) => (
                  <div key={i}>
                    <div
                      className={cn(
                        "text-xs rounded-lg px-3 py-2 max-w-[90%]",
                        msg.role === "user"
                          ? "bg-teal-50 text-teal-900 ml-auto"
                          : msg.isError
                            ? "bg-rose-50 text-rose-800 border border-rose-200"
                            : "bg-violet-50 text-violet-900",
                      )}
                    >
                      {msg.content}
                    </div>

                    {msg.captions && msg.captions.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.captions.map((cap, j) => {
                          const style = PLATFORM_STYLES[cap.platform] ?? PLATFORM_STYLES.Instagram;
                          return (
                            <div
                              key={`${i}-${j}`}
                              className={cn("border rounded-xl p-3", style.bg, style.border)}
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span
                                  className={cn(
                                    "text-[10px] font-black uppercase tracking-[0.2em]",
                                    style.accent,
                                  )}
                                >
                                  {cap.platform}
                                </span>
                                <button
                                  onClick={() => handleCopyCaption(cap.caption, cap.platform)}
                                  className={cn(
                                    "inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors",
                                    copiedCaption === cap.platform
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-white/70 text-slate-500 hover:bg-white",
                                  )}
                                >
                                  {copiedCaption === cap.platform ? (
                                    <Check size={10} />
                                  ) : (
                                    <Copy size={10} />
                                  )}
                                  {copiedCaption === cap.platform ? "Copied" : "Copy"}
                                </button>
                              </div>
                              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {cap.caption}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}

                {captionLoading && (
                  <div className="flex items-center gap-2 text-xs text-violet-500 py-1">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Writing captions...</span>
                  </div>
                )}
              </div>

              {/* Caption input */}
              <div className="flex items-end gap-2 px-4 md:px-6 pb-3 pt-2 border-t border-slate-100">
                <textarea
                  ref={captionInputRef}
                  value={captionInput}
                  onChange={(e) => setCaptionInput(e.target.value)}
                  onKeyDown={handleCaptionKeyDown}
                  placeholder="Generate captions or refine..."
                  rows={1}
                  disabled={captionLoading}
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 disabled:opacity-50 placeholder:text-slate-400"
                />
                <button
                  onClick={() => handleCaptionSend()}
                  disabled={!captionInput.trim() || captionLoading}
                  className={cn(
                    "p-2 rounded-lg transition-colors flex-shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center",
                    captionInput.trim() && !captionLoading
                      ? "bg-violet-600 text-white hover:bg-violet-700"
                      : "bg-slate-100 text-slate-400 cursor-not-allowed",
                  )}
                >
                  <Send size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="border-t border-slate-200 p-4 md:px-6 space-y-3">
          {startProductionMutation.isSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
              <p className="text-sm text-emerald-700 font-medium">
                Video {startProductionMutation.data.videoCode} created in content library
              </p>
              <p className="text-xs text-emerald-600 mt-0.5 mb-2">
                Idea archived. Video is now in the Pipeline as SCRIPTED.
              </p>
              {onSelectVideo && (
                <button
                  onClick={() => { onSelectVideo(startProductionMutation.data.videoCode); onClose(); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors"
                >
                  Open Video <ChevronRight size={12} />
                </button>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            {/* Primary action: Develop Script */}
            <button
              onClick={() => developMutation.mutate()}
              disabled={developMutation.isPending}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-colors",
                developMutation.isPending
                  ? "bg-slate-100 text-slate-400 cursor-wait"
                  : "bg-teal-600 text-white hover:bg-teal-700",
              )}
            >
              {developMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              {developMutation.isPending
                ? "Generating..."
                : developMutation.data
                  ? "Regenerate"
                  : "Develop Script"}
            </button>

            {/* Secondary action: Start Production (only after script exists) */}
            {!startProductionMutation.isSuccess && developMutation.data && (
              <button
                onClick={() => startProductionMutation.mutate()}
                disabled={startProductionMutation.isPending}
                className={cn(
                  "flex items-center justify-center gap-2 px-4 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-colors",
                  startProductionMutation.isPending
                    ? "bg-slate-100 text-slate-400 cursor-wait"
                    : "bg-violet-600 text-white hover:bg-violet-700",
                )}
              >
                {startProductionMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Rocket size={14} />
                )}
                {startProductionMutation.isPending ? "Creating..." : "Start Production"}
              </button>
            )}

            {!confirmArchive ? (
              <button
                onClick={() => setConfirmArchive(true)}
                className="flex items-center gap-2 px-4 py-3 rounded-full text-xs font-bold uppercase tracking-widest border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 transition-colors"
              >
                <Archive size={14} />
                Archive
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-3 rounded-full text-xs font-bold uppercase tracking-widest bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                >
                  {archiveMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Archive size={14} />
                  )}
                  Confirm
                </button>
                <button
                  onClick={() => setConfirmArchive(false)}
                  className="px-3 py-3 rounded-full text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// ─── Hook Picker Inline ─────────────────────────────────────────────────────

type HookPickerProps = {
  hooks: VaultHook[];
  onSelect: (hook: VaultHook, filled: string, vars: Record<string, string>) => void;
  onClose: () => void;
};

const HookPickerInline: React.FC<HookPickerProps> = ({ hooks, onSelect, onClose }) => {
  const [selectedHook, setSelectedHook] = useState<VaultHook | null>(null);
  const [vars, setVars] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  const filtered = hooks.filter((h) =>
    !search || h.pattern.toLowerCase().includes(search.toLowerCase()) ||
    (h.category || "").toLowerCase().includes(search.toLowerCase()),
  );

  const fillPattern = (pattern: string, variables: Record<string, string>) => {
    let result = pattern;
    for (const [key, val] of Object.entries(variables)) {
      if (val.trim()) result = result.replace(`[${key}]`, val);
    }
    return result;
  };

  if (selectedHook) {
    const hookVarNames = selectedHook.variables || [];
    const filled = fillPattern(selectedHook.pattern, vars);
    const allFilled = hookVarNames.every((v) => vars[v]?.trim());

    return (
      <div className="mt-2 border border-teal-200 rounded-xl p-3 bg-teal-50/50">
        <p className="text-[10px] font-bold text-teal-600 mb-2">Fill in variables:</p>
        <p className="text-sm text-slate-700 mb-3 font-medium">{filled}</p>
        <div className="space-y-2">
          {hookVarNames.map((v) => (
            <div key={v}>
              <label className="text-[9px] font-bold uppercase text-slate-500">{v}</label>
              <input
                value={vars[v] || ""}
                onChange={(e) => setVars({ ...vars, [v]: e.target.value })}
                placeholder={v.toLowerCase().replace(/_/g, " ")}
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:border-teal-400"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => onSelect(selectedHook, filled, vars)}
            disabled={!allFilled}
            className="px-3 py-1.5 rounded-full bg-teal-600 text-white text-[10px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            Use Hook
          </button>
          <button
            onClick={() => { setSelectedHook(null); setVars({}); }}
            className="px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-500 hover:text-slate-700"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-2 border-b border-slate-100">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search hooks..."
          className="w-full px-2 py-1 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-teal-400"
        />
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-xs text-slate-400 p-3">No hooks found. Create hooks in the Vault.</p>
        ) : (
          filtered.slice(0, 20).map((hook) => (
            <button
              key={hook.id}
              onClick={() => {
                if ((hook.variables || []).length === 0) {
                  onSelect(hook, hook.pattern, {});
                } else {
                  setSelectedHook(hook);
                }
              }}
              className="w-full text-left px-3 py-2 hover:bg-teal-50 transition-colors border-b border-slate-100 last:border-b-0"
            >
              <p className="text-sm text-slate-900">{hook.pattern}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">
                  {hook.category}
                </span>
                {hook.isLibrary && (
                  <span className="text-[9px] text-slate-400">Library</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
      <div className="p-2 border-t border-slate-100">
        <button onClick={onClose} className="text-[10px] font-bold text-slate-400 hover:text-slate-600">
          Cancel
        </button>
      </div>
    </div>
  );
};

// ─── Version Card ────────────────────────────────────────────────────────────

type VersionCardProps = {
  version: ScriptVersion;
  isCurrent: boolean;
  onLoad: (script: string) => void;
};

const VersionCard: React.FC<VersionCardProps> = ({ version, isCurrent, onLoad }) => {
  return (
    <div className={cn(
      "border rounded-xl p-3 transition-colors",
      isCurrent ? "border-teal-200 bg-teal-50/50" : "border-slate-200 hover:border-slate-300",
    )}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">v{version.version}</span>
          {isCurrent && (
            <span className="text-[9px] font-bold text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded">Current</span>
          )}
        </div>
        <span className="text-[10px] text-slate-400">
          {version.createdAt ? new Date(version.createdAt).toLocaleDateString() : ""}
        </span>
      </div>
      {version.changeNote && (
        <p className="text-[10px] text-slate-500 mt-1">{version.changeNote}</p>
      )}
      <p className="text-xs text-slate-600 mt-1 line-clamp-2">{version.script.slice(0, 120)}...</p>
      {!isCurrent && (
        <button
          onClick={() => onLoad(version.script)}
          className="mt-2 text-[10px] font-bold text-teal-600 hover:text-teal-700"
        >
          Load this version
        </button>
      )}
    </div>
  );
};
