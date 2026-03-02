import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import type { Idea, IdeaCategory, FormatId } from "../shared/types.js";
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

type Tab = "context" | "script";

export const IdeaDetail: React.FC<IdeaDetailProps> = ({ idea, onClose, onUpdated }) => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("context");
  const [editedPriority, setEditedPriority] = useState(idea.priority);
  const [editedFormat, setEditedFormat] = useState(idea.suggestedFormat);
  const [digestExpanded, setDigestExpanded] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  const hasChanges = editedPriority !== idea.priority || editedFormat !== idea.suggestedFormat;
  const hasDigest = idea.source?.toLowerCase().includes("n8n") && idea.dateAdded;

  // Reset edits when idea changes
  useEffect(() => {
    setEditedPriority(idea.priority);
    setEditedFormat(idea.suggestedFormat);
    setActiveTab("context");
    setConfirmArchive(false);
  }, [idea.topic, idea.priority, idea.suggestedFormat]);

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
  ];

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
