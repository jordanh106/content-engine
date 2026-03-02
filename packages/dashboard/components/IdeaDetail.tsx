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
} from "lucide-react";
import type { Idea, IdeaCategory, FormatId, ConversationMessage } from "../shared/types.js";
import { FORMATS } from "../shared/types.js";
import { cn } from "../utils/cn.js";

type IdeaDetailProps = {
  idea: Idea;
  onClose: () => void;
  onUpdated: () => void;
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

export const IdeaDetail: React.FC<IdeaDetailProps> = ({ idea, onClose, onUpdated }) => {
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
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json() as Promise<{ script: string; deliveryCues: string[] }>;
    },
    onSuccess: () => {
      setActiveTab("script");
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
        <div className="flex-1 overflow-y-auto">
          {activeTab === "context" && (
            <div className="p-4 md:p-6 space-y-6">
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
        <div className="border-t border-slate-200 p-4 md:px-6 flex items-center gap-3">
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
                ? "Regenerate Script"
                : "Develop Script"}
          </button>

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
    </>
  );
};
