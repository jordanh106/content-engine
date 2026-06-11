/**
 * BoardChat — the AI chat panel wired to board sources (Poppy-parity Phase 2).
 *
 * Collapsible right-side panel on the Canvas. Type @ to reference any canvas
 * node or ingested media asset; referenced sources are expanded server-side
 * (transcripts / extracted text) and ground the model's answer. Every
 * assistant reply has a "Develop" action that pushes it into the Inspiration
 * Inbox, audience-tagged via the persona matcher — chat output feeds the
 * production pipeline instead of dead-ending.
 *
 * The [data-board-chat] attribute on the root opts this subtree out of
 * CanvasView's window-level keyboard shortcuts (Backspace = delete nodes…).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  X, Send, Loader2, Trash2, AtSign, Sparkles, ArrowRight, Check,
  Video, FileText, Image as ImageIcon, Globe, MessageSquare, Music,
} from "lucide-react";
import { IconButton } from "./ui/index.js";
import { cn } from "../utils/cn.js";
import type { BoardChatMessage, BoardChatRef, MediaAsset } from "../shared/types.js";

const BOARD_ID = "canvas-v1";

export type ChatNodeRef = { id: string; kind: string; label: string; text: string };

type Props = {
  open: boolean;
  onClose: () => void;
  /** Serialized summaries of the canvas nodes, for @-autocomplete + grounding. */
  nodeRefs: ChatNodeRef[];
};

type LocalMessage = Pick<BoardChatMessage, "role" | "content" | "model"> & { id?: number; streaming?: boolean };

const KIND_ICON: Record<string, React.ReactNode> = {
  video: <Video size={11} />,
  audio: <Music size={11} />,
  pdf: <FileText size={11} />,
  image: <ImageIcon size={11} />,
  website: <Globe size={11} />,
  tweet: <MessageSquare size={11} />,
};

export const BoardChat: React.FC<Props> = ({ open, onClose, nodeRefs }) => {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState("");
  const [pendingRefs, setPendingRefs] = useState<BoardChatRef[]>([]);
  const [modelId, setModelId] = useState("claude-sonnet-4-6");
  const [streaming, setStreaming] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Keyed by message content (stable across the local→persisted refetch
  // boundary, where ids appear and indexes shift).
  const [developedKeys, setDevelopedKeys] = useState<Set<string>>(new Set());

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: historyData } = useQuery<{ messages: BoardChatMessage[] }>({
    queryKey: ["board-chat", BOARD_ID],
    queryFn: () => fetch(`/api/board-chat/${BOARD_ID}/messages`).then((r) => r.json()),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: modelsData } = useQuery<{ models: Array<{ id: string; label: string; provider: string }>; default: string }>({
    queryKey: ["board-chat-models"],
    queryFn: () => fetch("/api/board-chat/models").then((r) => r.json()),
    staleTime: 10 * 60_000,
  });

  const { data: mediaData } = useQuery<{ assets: MediaAsset[] }>({
    queryKey: ["media-assets-for-chat"],
    queryFn: () => fetch("/api/media?limit=100").then((r) => r.json()),
    enabled: open,
    staleTime: 60_000,
  });

  // Hydrate local messages from persisted history (skip while streaming).
  useEffect(() => {
    if (historyData?.messages && !streaming) {
      setMessages(historyData.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, model: m.model })));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyData]);

  // Autoscroll on new content.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  // Reconcile the selected model once the key-filtered list arrives.
  useEffect(() => {
    if (!modelsData?.models.length) return;
    const { models: list, default: fallback } = modelsData;
    setModelId((current) =>
      list.some((m) => m.id === current)
        ? current
        : list.some((m) => m.id === fallback) ? fallback : list[0].id,
    );
  }, [modelsData]);

  // Abort any in-flight stream when the panel unmounts (e.g. leaving Canvas).
  useEffect(() => () => abortRef.current?.abort(), []);

  // ── @-mention candidates ────────────────────────────────────────────────────
  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    const media: BoardChatRef[] = (mediaData?.assets ?? []).map((a) => ({
      type: "media" as const,
      id: String(a.id),
      label: (a.title || a.sourceUrl || `asset ${a.id}`).slice(0, 60),
    }));
    const nodes: BoardChatRef[] = nodeRefs.map((n) => ({
      type: "node" as const,
      id: n.id,
      label: `${n.kind}: ${n.label}`.slice(0, 60),
      text: n.text,
    }));
    return [...media, ...nodes]
      .filter((c) => !pendingRefs.some((r) => r.type === c.type && r.id === c.id))
      .filter((c) => !q || c.label.toLowerCase().includes(q))
      .slice(0, 8);
  }, [mentionQuery, mediaData, nodeRefs, pendingRefs]);

  const mediaKindById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of mediaData?.assets ?? []) m.set(String(a.id), a.kind);
    return m;
  }, [mediaData]);

  const handleInputChange = (value: string) => {
    setInput(value);
    const caret = textareaRef.current?.selectionStart ?? value.length;
    const before = value.slice(0, caret);
    const match = before.match(/@([\w\s-]{0,30})$/);
    setMentionQuery(match ? match[1] : null);
  };

  const selectMention = (candidate: BoardChatRef) => {
    setPendingRefs((prev) => [...prev, candidate]);
    // Replace the in-progress @query with the chosen label. Replacer fn, not
    // a string — labels containing '$' would otherwise be mangled as
    // replacement patterns.
    const caret = textareaRef.current?.selectionStart ?? input.length;
    const before = input.slice(0, caret).replace(/@([\w\s-]{0,30})$/, () => `@[${candidate.label}] `);
    setInput(before + input.slice(caret));
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  // ── Send (SSE streaming, IdeaLab transport pattern) ─────────────────────────
  const send = async () => {
    const message = input.trim();
    if (!message || streaming) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const refs = pendingRefs;
    setInput("");
    setPendingRefs([]);
    setMentionQuery(null);
    setStreaming(true);
    setMessages((prev) => [...prev, { role: "user", content: message, model: null }, { role: "assistant", content: "", model: modelId, streaming: true }]);

    try {
      const res = await fetch(`/api/board-chat/${BOARD_ID}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, modelId, refs }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: `request failed (${res.status})` }));
        throw new Error((err as { error?: string }).error || "request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.trim();
          if (!line.startsWith("data: ")) continue;
          let event: { type: string; text?: string; error?: string; truncated?: string[]; missing?: string[] };
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }
          if (event.type === "token" && event.text) {
            setMessages((prev) => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.streaming) next[next.length - 1] = { ...last, content: last.content + event.text };
              return next;
            });
          } else if (event.type === "meta" && (event.truncated?.length || event.missing?.length)) {
            const notes: string[] = [];
            if (event.truncated?.length) notes.push(`truncated to fit: ${event.truncated.join(", ")}`);
            if (event.missing?.length) notes.push(`not found: ${event.missing.join(", ")}`);
            setToast(notes.join(" · "));
            setTimeout(() => setToast(null), 6000);
          } else if (event.type === "error") {
            throw new Error(event.error || "stream error");
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.streaming) next[next.length - 1] = { ...last, content: (last.content || "") + `\n⚠ ${(err as Error).message}` };
          return next;
        });
      }
    } finally {
      setStreaming(false);
      setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })));
      void queryClient.invalidateQueries({ queryKey: ["board-chat", BOARD_ID] });
    }
  };

  // ── Develop → Inspiration Inbox ─────────────────────────────────────────────
  const develop = async (msg: LocalMessage) => {
    // Mark optimistically so a double-click can't insert twice; roll back on error.
    setDevelopedKeys((prev) => new Set(prev).add(msg.content));
    try {
      const res = await fetch("/api/board-chat/develop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: msg.content, model: msg.model }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "develop failed");
      setToast(`Added to inbox${body.audienceTags?.length ? ` · tagged ${body.audienceTags.join(", ")}` : ""}`);
      setTimeout(() => setToast(null), 5000);
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    } catch (err) {
      setDevelopedKeys((prev) => {
        const next = new Set(prev);
        next.delete(msg.content);
        return next;
      });
      setToast(`Develop failed: ${(err as Error).message}`);
      setTimeout(() => setToast(null), 6000);
    }
  };

  const clearChat = async () => {
    if (streaming) return; // mid-stream clear would resurrect an orphan row on completion
    await fetch(`/api/board-chat/${BOARD_ID}/messages`, { method: "DELETE" });
    setMessages([]);
    setDevelopedKeys(new Set());
    void queryClient.invalidateQueries({ queryKey: ["board-chat", BOARD_ID] });
  };

  if (!open) return null;

  const models = modelsData?.models ?? [{ id: "claude-sonnet-4-6", label: "Claude Sonnet", provider: "anthropic" }];

  return (
    <aside
      data-board-chat
      className="fixed inset-y-0 right-0 z-40 w-full max-w-md shadow-2xl md:static md:z-auto md:w-96 md:max-w-none md:shadow-none shrink-0 border-l border-slate-200 bg-white flex flex-col"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">Board chat</p>
          <select
            value={modelId}
            onChange={(e) => setModelId(e.target.value)}
            className="mt-0.5 text-sm font-semibold text-slate-900 bg-transparent border-0 outline-none cursor-pointer -ml-1"
            disabled={streaming}
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton icon={<Trash2 />} label="Clear chat" onClick={() => void clearChat()} />
          <IconButton icon={<X />} label="Close chat" onClick={onClose} />
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-12 px-4">
            <Sparkles size={20} className="text-teal-300 mx-auto mb-2" />
            <p className="text-sm text-slate-600">Ask anything. Type <span className="font-mono bg-slate-100 px-1 rounded">@</span> to reference a video, PDF, website, or canvas node — answers get grounded in the actual source.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={m.id ?? `local-${i}`} className={cn("rounded-xl p-3 text-sm leading-relaxed whitespace-pre-wrap", m.role === "user" ? "bg-slate-100 ml-8 text-slate-800" : "bg-teal-50 mr-8 text-slate-800")}>
            {m.content || (m.streaming ? <Loader2 size={14} className="animate-spin text-teal-500" /> : "")}
            {m.role === "assistant" && !m.streaming && m.content && (
              <div className="mt-2 pt-2 border-t border-teal-100 flex items-center justify-between">
                <span className="text-[10px] text-slate-400">{m.model}</span>
                <button
                  onClick={() => void develop(m)}
                  disabled={developedKeys.has(m.content)}
                  className={cn(
                    "inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2 py-0.5 transition-colors",
                    developedKeys.has(m.content) ? "text-emerald-700 bg-emerald-50" : "text-teal-700 hover:bg-teal-100",
                  )}
                >
                  {developedKeys.has(m.content) ? <><Check size={11} /> In inbox</> : <><ArrowRight size={11} /> Develop</>}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {toast && (
        <div className="mx-4 mb-2 rounded-lg border border-teal-200 bg-teal-50/70 text-teal-900 text-xs px-3 py-2">{toast}</div>
      )}

      {/* Pending refs */}
      {pendingRefs.length > 0 && (
        <div className="px-4 pb-1 flex flex-wrap gap-1.5">
          {pendingRefs.map((r) => (
            <span key={`${r.type}-${r.id}`} className="inline-flex items-center gap-1 text-[11px] bg-slate-100 text-slate-700 rounded-full pl-2 pr-1 py-0.5">
              {r.type === "media" ? (KIND_ICON[mediaKindById.get(r.id) ?? ""] ?? <AtSign size={11} />) : <AtSign size={11} />}
              {r.label}
              <button onClick={() => setPendingRefs((prev) => prev.filter((p) => !(p.type === r.type && p.id === r.id)))} className="p-0.5 rounded-full hover:bg-slate-200">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Mention popover */}
      <div className="relative">
        {mentionQuery !== null && mentionCandidates.length > 0 && (
          <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-20">
            {mentionCandidates.map((c) => (
              <button
                key={`${c.type}-${c.id}`}
                onClick={() => selectMention(c)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 flex items-center gap-2"
              >
                {c.type === "media" ? (KIND_ICON[mediaKindById.get(c.id) ?? ""] ?? <AtSign size={11} />) : <AtSign size={11} />}
                <span className="truncate">{c.label}</span>
                <span className="ml-auto text-[10px] text-slate-400 shrink-0">{c.type}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="px-4 pb-4 pt-1 border-t border-slate-200">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  // Only divert Enter when the popover is actually visible —
                  // the loose @-regex also matches emails and "open @ 9am".
                  if (mentionQuery !== null && mentionCandidates.length > 0) {
                    selectMention(mentionCandidates[0]);
                  } else {
                    void send();
                  }
                }
                if (e.key === "Escape") setMentionQuery(null);
              }}
              placeholder="Message… (@ to reference a source)"
              rows={2}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm bg-white text-slate-800 resize-none placeholder:text-slate-400"
            />
            <button
              onClick={() => void send()}
              disabled={!input.trim() || streaming}
              className="p-2.5 rounded-full bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Send (Enter)"
            >
              {streaming ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
