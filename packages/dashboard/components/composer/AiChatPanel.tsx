import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "../../utils/cn.js";
import type { ConversationMessage, VibeMotionComponent } from "../../shared/types.js";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  isError?: boolean;
};

type AiChatPanelProps = {
  onSubmit: (
    prompt: string,
    history: ConversationMessage[],
  ) => Promise<string | null>;
  isLoading: boolean;
  disabled?: boolean;
  components: VibeMotionComponent[];
  format: string;
};

function computeSuggestions(
  components: VibeMotionComponent[],
  format: string,
): string[] {
  const suggestions: string[] = [];
  const types = components.map((c) => c.componentType);
  const totalDuration = components.reduce(
    (sum, c) => sum + c.durationInSeconds,
    0,
  );

  if (components.length === 0) {
    suggestions.push("Generate full composition from script");
    suggestions.push("Add an opening hook");
    return suggestions;
  }

  if (!types.includes("HookText")) {
    suggestions.push("Add an opening hook");
  }

  if (!types.includes("CallToAction")) {
    suggestions.push("Add a call to action");
  }

  const chartCount = types.filter(
    (t) => t === "ChartCard" || t === "StatCard",
  ).length;
  if (chartCount === 0) {
    suggestions.push("Add a chart");
  }

  if (!types.includes("QuoteCard")) {
    suggestions.push("Add a quote");
  }

  if (totalDuration > 60) {
    suggestions.push("Trim to fit social media");
  } else if (totalDuration < 15 && components.length > 0) {
    suggestions.push("Add more shots");
  }

  if (components.length > 3) {
    suggestions.push("Make it more engaging");
  }

  // Platform optimization - show when composition has content
  if (components.length >= 2 && totalDuration > 34) {
    suggestions.push("Optimize for TikTok (21-34s)");
  }
  if (components.length >= 2 && totalDuration > 30) {
    suggestions.push("Optimize for Reels (15-30s)");
  }
  if (components.length >= 2 && totalDuration > 58) {
    suggestions.push("Optimize for Shorts (30-58s)");
  }

  // Return at most 4
  return suggestions.slice(0, 4);
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  onSubmit,
  isLoading,
  disabled = false,
  components,
  format,
}) => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Build conversation history from messages (excluding errors)
  const getConversationHistory = useCallback((): ConversationMessage[] => {
    return messages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  const handleSend = useCallback(
    async (text?: string) => {
      const prompt = (text || input).trim();
      if (!prompt || isLoading || disabled) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);

      const history = getConversationHistory();
      const aiMessage = await onSubmit(prompt, history);
      if (aiMessage) {
        const isError = aiMessage.startsWith("Error:");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: isError ? aiMessage.replace(/^Error:\s*/, "") : aiMessage,
            isError,
          },
        ]);
      }
    },
    [input, isLoading, disabled, onSubmit, getConversationHistory],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = computeSuggestions(components, format);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-200">
        <Sparkles size={13} className="text-violet-500" />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
          AI Assistant
        </p>
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto px-3 py-2 space-y-2 min-h-0"
      >
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-4">
            <p className="text-xs text-slate-400">
              {disabled
                ? "Loading video data..."
                : "Describe what you want to change"}
            </p>
            {!disabled && (
              <p className="text-[10px] text-slate-300 mt-1">
                e.g. &quot;Add an animated chart&quot; or &quot;Change this to a
                quote&quot;
              </p>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "text-xs rounded-lg px-3 py-2 max-w-[95%]",
              msg.role === "user"
                ? "bg-teal-50 text-teal-900 ml-auto"
                : msg.isError
                  ? "bg-rose-50 text-rose-800 border border-rose-200"
                  : "bg-violet-50 text-violet-900",
            )}
          >
            {msg.content}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-violet-500 py-1">
            <Loader2 size={12} className="animate-spin" />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      {/* Suggestion chips - show always, dynamic based on composition state */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              disabled={isLoading || disabled}
              className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 hover:bg-violet-100 hover:text-violet-700 transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="flex items-end gap-2 px-3 pb-3 pt-1">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "Loading..." : "Describe changes..."}
          rows={1}
          disabled={isLoading || disabled}
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 disabled:opacity-50 placeholder:text-slate-400"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading || disabled}
          className={cn(
            "p-2 rounded-lg transition-colors flex-shrink-0",
            input.trim() && !isLoading && !disabled
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-slate-100 text-slate-400 cursor-not-allowed",
          )}
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
};
