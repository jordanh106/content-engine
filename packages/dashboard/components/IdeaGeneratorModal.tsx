import React, { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  X,
  Send,
  Loader2,
  Sparkles,
  Plus,
  CheckCircle2,
  Lightbulb,
} from "lucide-react";
import type { GeneratedIdea, IdeaCategory, ConversationMessage, FormatId } from "../shared/types.js";
import { cn } from "../utils/cn.js";
import { FormatBadge } from "./ui/FormatBadge.js";

function extractFormatId(raw: string): FormatId | null {
  const match = raw?.trim().match(/^([A-G])\b/);
  return (match ? match[1] : null) as FormatId | null;
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ideas?: GeneratedIdea[];
  isError?: boolean;
};

type IdeaGeneratorModalProps = {
  onClose: () => void;
};

const CATEGORY_COLORS: Record<IdeaCategory, string> = {
  trending: "text-orange-600 bg-orange-50",
  competitor: "text-violet-600 bg-violet-50",
  evergreen: "text-emerald-600 bg-emerald-50",
  audience: "text-sky-600 bg-sky-50",
  personal: "text-pink-600 bg-pink-50",
  archived: "text-slate-500 bg-slate-100",
};

const PRIORITY_COLORS: Record<string, string> = {
  High: "bg-rose-100 text-rose-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-slate-100 text-slate-600",
};

const SUGGESTIONS = [
  "Trending ideas for desk workers",
  "Evergreen content for parents",
  "Quick tips for teens",
  "Myth busters about posture",
  "Patient story ideas for athletes",
  "Pregnancy content ideas",
  "Ideas for senior mobility",
  "Behind-the-scenes practice content",
];

const IdeaPreviewCard: React.FC<{
  idea: GeneratedIdea;
  onAdd: () => void;
  isAdded: boolean;
  isAdding: boolean;
}> = ({ idea, onAdd, isAdded, isAdding }) => (
  <div className="bg-white border border-slate-200 rounded-xl p-3 mt-2">
    <p className="font-medium text-slate-900 text-sm">{idea.topic}</p>
    {idea.hookAngle && (
      <p className="text-xs text-slate-500 mt-1">{idea.hookAngle}</p>
    )}
    <div className="flex items-center justify-between mt-2">
      <div className="flex flex-wrap gap-1.5">
        {idea.suggestedFormat && (() => {
          const fmtId = extractFormatId(idea.suggestedFormat);
          return fmtId
            ? <FormatBadge format={fmtId} />
            : <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{idea.suggestedFormat}</span>;
        })()}
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold",
            CATEGORY_COLORS[idea.category] ?? CATEGORY_COLORS.evergreen,
          )}
        >
          {idea.category}
        </span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold",
            PRIORITY_COLORS[idea.priority] ?? PRIORITY_COLORS.Medium,
          )}
        >
          {idea.priority}
        </span>
      </div>
      <button
        onClick={onAdd}
        disabled={isAdded || isAdding}
        className={cn(
          "flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
          isAdded
            ? "bg-emerald-50 text-emerald-600"
            : isAdding
              ? "bg-slate-100 text-slate-400 cursor-wait"
              : "bg-teal-600 text-white hover:bg-teal-700",
        )}
      >
        {isAdded ? <CheckCircle2 size={12} /> : <Plus size={12} />}
        {isAdded ? "Added" : "Add"}
      </button>
    </div>
  </div>
);

export const IdeaGeneratorModal: React.FC<IdeaGeneratorModalProps> = ({
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [addedTopics, setAddedTopics] = useState<Set<string>>(new Set());
  const [addingTopic, setAddingTopic] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getConversationHistory = useCallback((): ConversationMessage[] => {
    return messages
      .filter((m) => !m.isError)
      .map((m) => ({
        role: m.role,
        content: m.ideas
          ? `${m.content}\n\nIdeas suggested: ${m.ideas.map((i) => i.topic).join(", ")}`
          : m.content,
      }));
  }, [messages]);

  const handleSend = useCallback(
    async (text?: string) => {
      const prompt = (text || input).trim();
      if (!prompt || isGenerating) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setIsGenerating(true);

      try {
        const res = await fetch("/api/ideas-ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            conversationHistory: getConversationHistory().slice(-20),
            existingTopics: [...addedTopics],
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || `Error ${res.status}`);
        }

        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            ideas: data.ideas,
          },
        ]);
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              e instanceof Error ? e.message : "Something went wrong",
            isError: true,
          },
        ]);
      } finally {
        setIsGenerating(false);
      }
    },
    [input, isGenerating, getConversationHistory, addedTopics],
  );

  const handleAddIdea = async (idea: GeneratedIdea) => {
    setAddingTopic(idea.topic);
    try {
      const res = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: [
            {
              topic: idea.topic,
              suggestedFormat: idea.suggestedFormat,
              hookAngle: idea.hookAngle,
              priority: idea.priority,
              source: "AI Idea Generator",
              category: idea.category,
            },
          ],
        }),
      });
      if (res.ok) {
        setAddedTopics((prev) => new Set([...prev, idea.topic]));
        queryClient.invalidateQueries({ queryKey: ["ideas"] });
        queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      }
    } finally {
      setAddingTopic(null);
    }
  };

  const handleAddAll = async (ideas: GeneratedIdea[]) => {
    const unadded = ideas.filter((i) => !addedTopics.has(i.topic));
    if (unadded.length === 0) return;

    setAddingTopic("__all__");
    try {
      const res = await fetch("/api/ideas/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ideas: unadded.map((i) => ({
            topic: i.topic,
            suggestedFormat: i.suggestedFormat,
            hookAngle: i.hookAngle,
            priority: i.priority,
            source: "AI Idea Generator",
            category: i.category,
          })),
        }),
      });
      if (res.ok) {
        setAddedTopics((prev) => {
          const next = new Set(prev);
          unadded.forEach((i) => next.add(i.topic));
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ["ideas"] });
        queryClient.invalidateQueries({ queryKey: ["ideas-summary"] });
      }
    } finally {
      setAddingTopic(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Show 4 random suggestions
  const suggestions = SUGGESTIONS.slice(0, 4);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-[10%] md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl md:max-h-[80vh] bg-white rounded-2xl z-50 flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-violet-500" />
            <h3 className="text-sm font-serif font-bold text-slate-900">
              Idea Generator
            </h3>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">
              AI
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0"
        >
          {messages.length === 0 && !isGenerating && (
            <div className="text-center py-8">
              <Lightbulb size={28} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">
                Describe the kind of content ideas you need
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                e.g. "Quick tips for desk workers" or "Trending pregnancy
                content"
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i}>
              {/* Text bubble */}
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

              {/* Idea preview cards */}
              {msg.ideas && msg.ideas.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.ideas.map((idea, j) => (
                    <IdeaPreviewCard
                      key={`${i}-${j}`}
                      idea={idea}
                      onAdd={() => handleAddIdea(idea)}
                      isAdded={addedTopics.has(idea.topic)}
                      isAdding={addingTopic === idea.topic || addingTopic === "__all__"}
                    />
                  ))}
                  {msg.ideas.some((idea) => !addedTopics.has(idea.topic)) && (
                    <button
                      onClick={() => handleAddAll(msg.ideas!)}
                      disabled={addingTopic !== null}
                      className={cn(
                        "w-full py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors mt-1",
                        addingTopic !== null
                          ? "border border-slate-200 text-slate-400 cursor-wait"
                          : "border border-teal-200 text-teal-600 hover:bg-teal-50",
                      )}
                    >
                      Add All (
                      {msg.ideas.filter((idea) => !addedTopics.has(idea.topic)).length}
                      )
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}

          {isGenerating && (
            <div className="flex items-center gap-2 text-xs text-violet-500 py-1">
              <Loader2 size={12} className="animate-spin" />
              <span>Brainstorming ideas...</span>
            </div>
          )}
        </div>

        {/* Suggestion chips */}
        {messages.length === 0 && !isGenerating && (
          <div className="flex flex-wrap gap-1.5 px-4 pb-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                disabled={isGenerating}
                className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-end gap-2 px-4 pb-4 pt-2 border-t border-slate-100">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What kind of ideas do you need?"
            rows={1}
            disabled={isGenerating}
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 disabled:opacity-50 placeholder:text-slate-400"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isGenerating}
            className={cn(
              "p-2 rounded-lg transition-colors flex-shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center",
              input.trim() && !isGenerating
                ? "bg-violet-600 text-white hover:bg-violet-700"
                : "bg-slate-100 text-slate-400 cursor-not-allowed",
            )}
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    </>
  );
};
