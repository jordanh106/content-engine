import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { cn } from "../../utils/cn.js";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AiChatPanelProps = {
  onSubmit: (prompt: string) => Promise<string | null>;
  isLoading: boolean;
};

const SUGGESTIONS = [
  "Add a chart",
  "Make it more engaging",
  "Add a quote",
  "Simplify this",
];

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  onSubmit,
  isLoading,
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

  const handleSend = useCallback(
    async (text?: string) => {
      const prompt = (text || input).trim();
      if (!prompt || isLoading) return;

      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);

      const aiMessage = await onSubmit(prompt);
      if (aiMessage) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: aiMessage },
        ]);
      }
    },
    [input, isLoading, onSubmit],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
              Describe what you want to change
            </p>
            <p className="text-[10px] text-slate-300 mt-1">
              e.g. "Add an animated chart" or "Change this to a quote"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "text-xs rounded-lg px-3 py-2 max-w-[95%]",
              msg.role === "user"
                ? "bg-teal-50 text-teal-900 ml-auto"
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

      {/* Suggestion chips */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSend(s)}
              disabled={isLoading}
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
          placeholder="Describe changes..."
          rows={1}
          disabled={isLoading}
          className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 disabled:opacity-50 placeholder:text-slate-400"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isLoading}
          className={cn(
            "p-2 rounded-lg transition-colors flex-shrink-0",
            input.trim() && !isLoading
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
