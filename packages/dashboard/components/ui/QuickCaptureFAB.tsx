import React, { useState, useRef, useEffect } from "react";
import { Plus, X, Send, Loader2, Link2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tooltip } from "./Tooltip.js";
import { usePanel } from "../context/PanelContext.js";

export const QuickCaptureFAB: React.FC<{ isHidden?: boolean }> = ({ isHidden = false }) => {
  const { panelCount } = usePanel();
  const hidden = isHidden || panelCount > 0;
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const queryClient = useQueryClient();

  // Close when hidden by panel overlay
  useEffect(() => {
    if (hidden && open) setOpen(false);
  }, [hidden, open]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  // Keyboard shortcut: N for quick capture
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
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

  return (
    <>
      {/* FAB button */}
      {!open && !hidden && (
        <Tooltip content="Quick Capture (N)" side="left">
          <button
            onClick={() => setOpen(true)}
            className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:shadow-xl flex items-center justify-center transition-all active:scale-95 group"
          >
            <Plus size={24} className="group-hover:rotate-90 transition-transform" />
          </button>
        </Tooltip>
      )}

      {/* Capture modal */}
      {open && !hidden && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="fixed bottom-0 inset-x-0 md:bottom-6 md:right-6 md:left-auto md:w-96 bg-surface-elevated rounded-t-2xl md:rounded-2xl border border-themed shadow-2xl p-5 space-y-3 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle bar (mobile) */}
            <div className="flex justify-center md:hidden mb-1">
              <div className="w-10 h-1 rounded-full bg-themed-muted opacity-40" />
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-themed">Quick Capture</h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-themed-muted hover:text-themed-secondary">
                <X size={16} />
              </button>
            </div>

            <textarea
              ref={inputRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Capture an idea, inspiration, or note..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-themed text-sm text-themed placeholder:text-themed-muted focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none"
            />

            <div className="relative">
              <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-themed-muted" />
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Source URL (optional)"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-surface-hover border border-themed text-[11px] text-themed-secondary placeholder:text-themed-muted focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              onClick={() => saveMutation.mutate()}
              disabled={!content.trim() || saveMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Save to Inbox
            </button>

            <p className="text-[9px] text-themed-muted text-center">
              Press <kbd className="px-1 py-0.5 bg-surface-hover border border-themed rounded text-[8px] font-mono">N</kbd> anywhere to open
            </p>
          </div>
        </div>
      )}
    </>
  );
};
