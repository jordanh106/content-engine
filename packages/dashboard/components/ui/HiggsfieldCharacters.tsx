import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, X, Users, RefreshCw, Check, Loader2, Trash2 } from "lucide-react";

export type SoulCharacter = {
  id: number;
  name: string;
  soulId: string;
  status: string;
  active: boolean;
  thumbnailUrl: string | null;
  createdAt: string;
};

type CharactersResponse = {
  characters: SoulCharacter[];
  active: { soulId: string; name: string } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export const HiggsfieldCharactersPanel: React.FC<Props> = ({ open, onClose }) => {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<CharactersResponse>({
    queryKey: ["higgsfield-characters"],
    queryFn: () => fetch("/api/higgsfield/characters").then((r) => r.json()),
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });

  const sync = useMutation({
    mutationFn: () => fetch("/api/higgsfield/characters/sync", { method: "POST" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["higgsfield-characters"] }),
  });

  const activate = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/higgsfield/characters/${id}/activate`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["higgsfield-characters"] }),
  });

  const deactivate = useMutation({
    mutationFn: () => fetch(`/api/higgsfield/characters/deactivate`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["higgsfield-characters"] }),
  });

  const remove = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/higgsfield/characters/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["higgsfield-characters"] }),
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[88vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
              <Users size={16} strokeWidth={2.5} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-700">Higgsfield Soul Characters</div>
              <h3 className="font-serif font-bold text-base text-slate-900 leading-tight">Cast lock for every generation</h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              title="Re-sync from CLI"
              className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw size={11} className={sync.isPending ? "animate-spin" : ""} />
              Sync
            </button>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Active banner */}
        {data?.active && (
          <div className="px-6 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Check size={14} className="text-emerald-600" />
              <span className="font-bold text-emerald-800">{data.active.name}</span>
              <span className="text-emerald-700 text-[11px]">is locked in as your active cast</span>
            </div>
            <button
              onClick={() => deactivate.mutate()}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
            >
              Deactivate
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 size={18} className="animate-spin mr-2" /> Loading…
            </div>
          )}

          {!isLoading && (data?.characters?.length || 0) === 0 && (
            <div className="py-12 text-center">
              <Sparkles size={20} className="text-teal-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No trained characters yet</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                Train a Soul character on higgsfield.ai (5+ reference photos), then click <span className="font-bold">Sync</span> to pull them in.
              </p>
            </div>
          )}

          <div className="space-y-2">
            {(data?.characters || []).map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                  c.active
                    ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-200"
                    : "border-slate-200 bg-white hover:border-teal-300"
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-black text-base shrink-0">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 truncate">{c.name}</span>
                    {c.status !== "completed" && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">{c.status}</span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{c.soulId}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {c.active ? (
                    <span className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                      <Check size={11} /> Active
                    </span>
                  ) : (
                    <button
                      onClick={() => activate.mutate(c.id)}
                      disabled={c.status !== "completed" || activate.isPending}
                      className="px-3 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-semibold text-teal-700 hover:bg-teal-100 disabled:opacity-40"
                    >
                      Activate
                    </button>
                  )}
                  <button
                    onClick={() => { if (window.confirm(`Remove ${c.name} from this dashboard? (Stays on higgsfield.ai)`)) remove.mutate(c.id); }}
                    className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="Remove from local list"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 text-[10px] text-slate-500 leading-relaxed">
          The active character gets injected into every Soul V2 / Soul Cinematic generation automatically. Train new characters at higgsfield.ai then click Sync.
        </div>
      </div>
    </div>
  );
};

/** A compact button + status chip for the credit pill area. */
export const HiggsfieldCharacterChip: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { data } = useQuery<CharactersResponse>({
    queryKey: ["higgsfield-characters"],
    queryFn: () => fetch("/api/higgsfield/characters").then((r) => r.json()),
    refetchInterval: 60_000,
  });
  const active = data?.active;
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
        active
          ? "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
      }`}
      title={active ? `Active cast: ${active.name}` : "No active Soul character — click to pick"}
    >
      <Users size={11} strokeWidth={2.5} />
      {active ? active.name : "No cast"}
    </button>
  );
};
