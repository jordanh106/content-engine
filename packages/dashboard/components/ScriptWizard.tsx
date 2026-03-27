import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  MessageSquare,
  Search,
  Zap,
  FileText,
  ArrowRight,
  Loader2,
  RefreshCw,
  Check,
  Sparkles,
  X,
} from "lucide-react";
import { ScriptChat } from "./ui/ScriptChat.js";
import { DurationSlider } from "./ui/DurationSlider.js";
import { ScrollReveal } from "./ui/animations.js";

type Tab = "topic" | "research" | "hook" | "script";

const TABS: { key: Tab; label: string; icon: React.ReactNode; step: number }[] = [
  { key: "topic", label: "Topic", icon: <MessageSquare size={14} />, step: 1 },
  { key: "research", label: "Research", icon: <Search size={14} />, step: 2 },
  { key: "hook", label: "Hook", icon: <Zap size={14} />, step: 3 },
  { key: "script", label: "Script", icon: <FileText size={14} />, step: 4 },
];

type HookVariation = {
  text: string;
  type: string;
  prediction: "high" | "medium" | "low";
  inspiration?: string;
};

type ScriptWizardProps = {
  initialTopic?: string;
  initialHook?: string;
  onClose: () => void;
  onSaveScript?: (script: string, topic: string) => void;
  inline?: boolean; // When true, renders as full-page view instead of modal overlay
};

export const ScriptWizard: React.FC<ScriptWizardProps> = ({
  initialTopic = "",
  initialHook = "",
  onClose,
  onSaveScript,
  inline = false,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>(initialTopic ? "hook" : "topic");
  const [topic, setTopic] = useState(initialTopic);
  const [selectedHook, setSelectedHook] = useState<HookVariation | null>(
    initialHook ? { text: initialHook, type: "Custom", prediction: "medium" } : null
  );
  const [hooks, setHooks] = useState<HookVariation[]>([]);
  const [script, setScript] = useState("");
  const [targetDuration, setTargetDuration] = useState(45);
  const [isRefining, setIsRefining] = useState(false);

  // Generate hooks mutation
  const generateHooksMutation = useMutation({
    mutationFn: async (topicText: string) => {
      const r = await fetch("/api/video-director/hooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: topicText, count: 6 }),
      });
      if (!r.ok) {
        // Fallback: generate simple hooks client-side
        return {
          hooks: [
            { text: `Most people don't know this about ${topicText}...`, type: "Pattern Interrupt", prediction: "high" as const },
            { text: `Stop doing this if you're dealing with ${topicText}`, type: "Contrarian", prediction: "high" as const },
            { text: `Here's what actually works for ${topicText}`, type: "Teacher", prediction: "medium" as const },
            { text: `I tried everything for ${topicText}. Here's what changed everything.`, type: "Experimenter", prediction: "medium" as const },
            { text: `3 things nobody tells you about ${topicText}`, type: "Fortune Teller", prediction: "medium" as const },
            { text: `The truth about ${topicText} that your doctor won't tell you`, type: "Investigator", prediction: "low" as const },
          ],
        };
      }
      return r.json();
    },
    onSuccess: (data) => {
      setHooks(data.hooks || []);
      setActiveTab("hook");
    },
  });

  // Generate script mutation
  const generateScriptMutation = useMutation({
    mutationFn: async ({ hookText, topicText, duration }: { hookText: string; topicText: string; duration: number }) => {
      const r = await fetch("/api/video-director/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hook: hookText, topic: topicText, targetSeconds: duration }),
      });
      if (!r.ok) {
        // Fallback
        return {
          script: `[Hook - spoken directly to camera, confident]\n${hookText}\n\n[Context - warm, educational]\nLet me explain what's really going on with ${topicText}...\n\n[Main Point 1]\nFirst, you need to understand that...\n\n[Main Point 2]\nSecond, here's what most people get wrong...\n\n[CTA - warm, inviting]\nIf this helped you, follow for more. And if you're in the area, come see us at Collective Family Chiropractic.`,
        };
      }
      return r.json();
    },
    onSuccess: (data) => {
      setScript(data.script || "");
      setActiveTab("script");
    },
  });

  const handleRefine = async (instruction: string): Promise<string> => {
    if (instruction.startsWith("__UNDO__")) {
      const prev = instruction.slice(8);
      setScript(prev);
      return prev;
    }
    setIsRefining(true);
    try {
      const r = await fetch("/api/video-director/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script, instruction, topic }),
      });
      if (r.ok) {
        const data = await r.json();
        setScript(data.script || script);
        return data.script || script;
      }
      // Fallback: just append the instruction note
      const refined = `${script}\n\n[Note: ${instruction}]`;
      setScript(refined);
      return refined;
    } finally {
      setIsRefining(false);
    }
  };

  const PREDICTION_COLORS: Record<string, string> = {
    high: "bg-emerald-500/15 text-emerald-400",
    medium: "bg-amber-500/15 text-amber-400",
    low: "bg-slate-500/15 text-themed-muted",
  };

  const containerClass = inline
    ? "p-4 md:p-6 max-w-4xl mx-auto pb-24 md:pb-8"
    : "fixed inset-0 z-50 flex items-center justify-center";

  const dialogClass = inline
    ? "bg-surface-elevated rounded-2xl border border-themed shadow-2xl flex flex-col overflow-hidden min-h-[70vh]"
    : "relative w-[95%] max-w-3xl max-h-[85vh] bg-surface-elevated rounded-2xl border border-themed shadow-2xl flex flex-col overflow-hidden";

  return (
    <div className={containerClass}>
      {/* Backdrop (modal only) */}
      {!inline && <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />}

      {/* Dialog */}
      <div className={dialogClass}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-themed">
          <h2 className="text-lg font-bold text-themed font-serif">New Script</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-themed-muted hover:text-themed-secondary hover:bg-surface-hover">
            <X size={18} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-themed px-2">
          {TABS.map((tab) => {
            const isReachable = tab.key === "topic" ||
              (tab.key === "research" && topic.length > 0) ||
              (tab.key === "hook" && topic.length > 0) ||
              (tab.key === "script" && selectedHook !== null);
            return (
              <button
                key={tab.key}
                onClick={() => isReachable && setActiveTab(tab.key)}
                disabled={!isReachable}
                className={`flex items-center gap-1.5 px-4 py-3 text-[11px] font-bold transition-colors border-b-2 disabled:opacity-40 ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-themed-muted hover:text-themed-secondary"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                  activeTab === tab.key ? "bg-blue-500 text-white" : "bg-surface-hover text-themed-muted"
                }`}>
                  {tab.step}
                </span>
                {tab.label}
              </button>
            );
          })}
          <div className="flex-1" />
          {activeTab === "script" && script && (
            <button
              onClick={() => onSaveScript?.(script, topic)}
              className="self-center px-4 py-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold hover:bg-blue-700 transition-colors"
            >
              Save script
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {/* Topic tab */}
          {activeTab === "topic" && (
            <div className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted block mb-2">
                  Describe the topic of the video you want to create
                </label>
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Why forward head posture causes headaches and how to fix it at home..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-surface-hover border border-themed text-sm text-themed placeholder:text-themed-muted focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none"
                  autoFocus
                />
              </div>
              <button
                onClick={() => generateHooksMutation.mutate(topic)}
                disabled={!topic.trim() || generateHooksMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {generateHooksMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Continue
              </button>
            </div>
          )}

          {/* Research tab (placeholder) */}
          {activeTab === "research" && (
            <div className="p-6 text-center py-16 space-y-3">
              <Search size={32} className="text-themed-muted mx-auto" />
              <p className="text-sm text-themed-tertiary">Research panel coming soon.</p>
              <p className="text-[11px] text-themed-muted">Use /last30days to research this topic, then come back to generate hooks.</p>
              <button
                onClick={() => generateHooksMutation.mutate(topic)}
                disabled={generateHooksMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
              >
                {generateHooksMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Skip to Hooks
              </button>
            </div>
          )}

          {/* Hook tab */}
          {activeTab === "hook" && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">
                  Choose a hook ({hooks.length} variations)
                </p>
                <button
                  onClick={() => generateHooksMutation.mutate(topic)}
                  disabled={generateHooksMutation.isPending}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-blue-400 hover:text-blue-300"
                >
                  {generateHooksMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Generate more hooks
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {hooks.map((hook, i) => (
                  <ScrollReveal key={i} delay={i * 60}>
                    <button
                      onClick={() => setSelectedHook(hook)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        selectedHook?.text === hook.text
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-themed hover:border-blue-500/30 bg-surface-hover"
                      }`}
                    >
                      <p className="text-sm font-semibold text-themed leading-snug mb-2">
                        "{hook.text}"
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-surface-elevated text-themed-tertiary">
                          {hook.type}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${PREDICTION_COLORS[hook.prediction]}`}>
                          {hook.prediction === "high" ? "High potential" : hook.prediction === "medium" ? "Medium" : "Experimental"}
                        </span>
                        {selectedHook?.text === hook.text && (
                          <Check size={14} className="text-blue-400 ml-auto" />
                        )}
                      </div>
                    </button>
                  </ScrollReveal>
                ))}
              </div>

              {selectedHook && (
                <div className="pt-2 flex items-center gap-3">
                  <DurationSlider seconds={targetDuration} onChange={setTargetDuration} />
                </div>
              )}

              {selectedHook && (
                <button
                  onClick={() => generateScriptMutation.mutate({
                    hookText: selectedHook.text,
                    topicText: topic,
                    duration: targetDuration,
                  })}
                  disabled={generateScriptMutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {generateScriptMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  Generate Script
                </button>
              )}
            </div>
          )}

          {/* Script tab */}
          {activeTab === "script" && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-auto p-5">
                <div className="bg-surface-hover rounded-xl p-5 text-sm text-themed leading-relaxed whitespace-pre-wrap min-h-[300px]">
                  {generateScriptMutation.isPending ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 size={24} className="text-blue-400 animate-spin" />
                    </div>
                  ) : (
                    script || "Your script will appear here..."
                  )}
                </div>
              </div>

              {script && (
                <ScriptChat
                  script={script}
                  onRefine={handleRefine}
                  isRefining={isRefining}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
