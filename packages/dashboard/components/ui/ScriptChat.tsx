import React, { useState, useRef, useEffect } from "react";
import { Send, Loader2, Undo2, Sparkles } from "lucide-react";

type ScriptChatProps = {
  script: string;
  onRefine: (instruction: string) => Promise<string>;
  isRefining?: boolean;
};

const QUICK_SUGGESTIONS = [
  "Make the hook more provocative",
  "Shorten to 30 seconds",
  "Add a CTA at the end",
  "Make it more casual",
  "Add a pattern interrupt",
  "Strengthen the closing",
];

export const ScriptChat: React.FC<ScriptChatProps> = ({
  script,
  onRefine,
  isRefining = false,
}) => {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const instruction = input.trim();
    if (!instruction || isRefining) return;
    setInput("");
    setHistory((prev) => [...prev, script]); // Save for undo
    await onRefine(instruction);
  };

  const handleQuickSuggestion = async (suggestion: string) => {
    if (isRefining) return;
    setHistory((prev) => [...prev, script]);
    await onRefine(suggestion);
  };

  return (
    <div className="border-t border-themed">
      {/* Quick suggestions */}
      <div className="px-4 pt-3 pb-2 flex gap-1.5 flex-wrap">
        {QUICK_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => handleQuickSuggestion(s)}
            disabled={isRefining}
            className="px-2.5 py-1 rounded-full bg-surface-hover border border-themed text-[9px] font-bold text-themed-muted hover:text-blue-400 hover:border-blue-500/30 transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Chat input */}
      <div className="px-4 pb-4 flex gap-2">
        {history.length > 0 && (
          <button
            onClick={() => {
              const prev = history[history.length - 1];
              setHistory((h) => h.slice(0, -1));
              onRefine(`__UNDO__${prev}`);
            }}
            className="p-2.5 rounded-xl bg-surface-hover text-themed-muted hover:text-themed-secondary transition-colors shrink-0"
            title="Undo last change"
          >
            <Undo2 size={16} />
          </button>
        )}
        <div className="relative flex-1">
          <Sparkles size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="What changes would you like to make?"
            disabled={isRefining}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-hover border border-themed text-sm text-themed placeholder:text-themed-muted focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSubmit}
          disabled={isRefining || !input.trim()}
          className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0"
        >
          {isRefining ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
};
