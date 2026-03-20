import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Loader2, Check, Wand2, Eye } from "lucide-react";
import { cn } from "../utils/cn.js";
import type { CreatorPersona } from "../shared/types.js";

const AVATAR_COLORS = [
  { id: "teal", label: "Teal", cls: "bg-teal-600" },
  { id: "violet", label: "Violet", cls: "bg-violet-600" },
  { id: "amber", label: "Amber", cls: "bg-amber-500" },
  { id: "rose", label: "Rose", cls: "bg-rose-500" },
  { id: "sky", label: "Sky", cls: "bg-sky-500" },
];

const HOOK_STYLE_OPTIONS = [
  { id: "question", label: "? Question" },
  { id: "myth_contrarian", label: "✕ Myth / Contrarian" },
  { id: "statistic", label: "# Statistic" },
  { id: "story_emotional", label: "▶ Story / Emotional" },
  { id: "pattern_interrupt", label: "⚡ Pattern Interrupt" },
  { id: "did_you_know", label: "💡 Did You Know" },
];

type PersonaPanelProps = {
  onClose: () => void;
};

type EditState = {
  mode: "list" | "edit" | "create";
  personaId?: number;
};

type FormData = Omit<CreatorPersona, "id" | "isActive" | "createdAt" | "updatedAt" | "vaultStyleId">;

const EMPTY_FORM: FormData = {
  name: "",
  role: "",
  initials: "",
  avatarColor: "teal",
  voiceTone: "",
  humorStyle: "",
  sentenceStyle: "",
  contentStrengths: [],
  audienceAffinities: [],
  hookPreferences: [],
  doNot: [],
  exampleLines: ["", "", ""],
};

function personaToForm(p: CreatorPersona): FormData {
  return {
    name: p.name,
    role: p.role ?? "",
    initials: p.initials ?? "",
    avatarColor: p.avatarColor ?? "teal",
    voiceTone: p.voiceTone ?? "",
    humorStyle: p.humorStyle ?? "",
    sentenceStyle: p.sentenceStyle ?? "",
    contentStrengths: p.contentStrengths,
    audienceAffinities: p.audienceAffinities,
    hookPreferences: p.hookPreferences,
    doNot: p.doNot,
    exampleLines: [...p.exampleLines, "", "", ""].slice(0, 3),
  };
}

// Pill input: comma-separated string → array of removable pills
const PillInput: React.FC<{
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}> = ({ label, values, onChange, placeholder }) => {
  const [inputVal, setInputVal] = useState("");

  const addItem = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInputVal("");
  };

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</label>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
              {v}
              <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-slate-400 hover:text-rose-500 transition-colors">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <input
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } if (e.key === ",") { e.preventDefault(); addItem(); } }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-300 text-slate-800 placeholder-slate-400"
        />
        <button onClick={addItem} className="px-2.5 py-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors text-xs font-bold">
          Add
        </button>
      </div>
    </div>
  );
};

const PersonaEditor: React.FC<{
  personaId?: number;
  onBack: () => void;
}> = ({ personaId, onBack }) => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saved, setSaved] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [previewTopic, setPreviewTopic] = useState("");
  const [previewHook, setPreviewHook] = useState("");
  const [previewing, setPreviewing] = useState(false);

  const { data } = useQuery<{ persona: CreatorPersona }>({
    queryKey: ["persona", personaId],
    queryFn: () => fetch(`/api/personas/${personaId}`).then((r) => r.json()),
    enabled: !!personaId,
  });

  useEffect(() => {
    if (data?.persona) {
      setForm(personaToForm(data.persona));
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        ...form,
        exampleLines: form.exampleLines.filter((l) => l.trim()),
      };
      const url = personaId ? `/api/personas/${personaId}` : "/api/personas";
      const method = personaId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] });
      if (personaId) queryClient.invalidateQueries({ queryKey: ["persona", personaId] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleExtract = async () => {
    if (!transcript.trim() || !personaId) return;
    setExtracting(true);
    try {
      const res = await fetch(`/api/personas/${personaId}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) return;
      const data = await res.json() as { extracted: Partial<FormData> };
      const e = data.extracted;
      setForm((prev) => ({
        ...prev,
        voiceTone: (e.voiceTone as string) || prev.voiceTone,
        humorStyle: (e.humorStyle as string) || prev.humorStyle,
        sentenceStyle: (e.sentenceStyle as string) || prev.sentenceStyle,
        contentStrengths: (e.contentStrengths as string[])?.length ? (e.contentStrengths as string[]) : prev.contentStrengths,
        hookPreferences: (e.hookPreferences as string[])?.length ? (e.hookPreferences as string[]) : prev.hookPreferences,
        doNot: (e.doNot as string[])?.length ? (e.doNot as string[]) : prev.doNot,
        exampleLines: (e.exampleLines as string[])?.length
          ? [...(e.exampleLines as string[]), "", "", ""].slice(0, 3)
          : prev.exampleLines,
      }));
    } catch { /* ignore */ }
    finally {
      setExtracting(false);
    }
  };

  const handlePreview = async () => {
    if (!previewTopic.trim() || !personaId) return;
    setPreviewing(true);
    setPreviewHook("");
    try {
      const res = await fetch(`/api/personas/${personaId}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: previewTopic }),
      });
      if (!res.ok) return;
      const data = await res.json() as { hookLine: string };
      setPreviewHook(data.hookLine);
    } catch { /* ignore */ }
    finally {
      setPreviewing(false);
    }
  };

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Sub-header */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100">
        <button onClick={onBack} className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors">
          ← Back
        </button>
        <span className="text-sm font-bold text-slate-800">
          {personaId ? `Edit ${form.name || "Persona"}` : "New Creator"}
        </span>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Name + Role */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Name *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Dr. Jordan"
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300 text-slate-800 placeholder-slate-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Role</label>
            <input
              value={form.role ?? ""}
              onChange={(e) => set("role", e.target.value)}
              placeholder="Chiropractor, Content Lead"
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300 text-slate-800 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Initials + Avatar Color */}
        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Initials *</label>
            <input
              value={form.initials ?? ""}
              onChange={(e) => set("initials", e.target.value.slice(0, 3).toUpperCase())}
              placeholder="JH"
              maxLength={3}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300 text-slate-800 placeholder-slate-400"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Avatar Color</label>
            <div className="flex gap-2 pt-1">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => set("avatarColor", c.id)}
                  className={cn("w-6 h-6 rounded-full transition-all", c.cls, form.avatarColor === c.id && "ring-2 ring-offset-1 ring-slate-400")}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Voice fields */}
        {(["voiceTone", "humorStyle", "sentenceStyle"] as const).map((field) => {
          const labels = { voiceTone: "Voice Tone", humorStyle: "Humor Style", sentenceStyle: "Sentence Style" };
          const placeholders = {
            voiceTone: "Deadpan authority with dry humor. Serious content that earns a laugh.",
            humorStyle: "Brief dry asides, fourth-wall breaks, CTA as comedy. Never mugging.",
            sentenceStyle: "Short. Punchy. Direct. Vary length deliberately. One-word sentences land.",
          };
          return (
            <div key={field} className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{labels[field]}</label>
              <textarea
                value={form[field] ?? ""}
                onChange={(e) => set(field, e.target.value)}
                placeholder={placeholders[field]}
                rows={2}
                className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-teal-300 text-slate-800 placeholder-slate-400"
              />
            </div>
          );
        })}

        {/* Pill arrays */}
        <PillInput
          label="Content Strengths"
          values={form.contentStrengths}
          onChange={(v) => set("contentStrengths", v)}
          placeholder="Myth busting, Education, ..."
        />
        <PillInput
          label="Audience Affinities"
          values={form.audienceAffinities}
          onChange={(v) => set("audienceAffinities", v)}
          placeholder="Athletes, New parents, ..."
        />

        {/* Hook preferences (checkboxes) */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Hook Preferences</label>
          <div className="grid grid-cols-2 gap-1.5">
            {HOOK_STYLE_OPTIONS.map((s) => {
              const checked = form.hookPreferences.includes(s.id);
              return (
                <label key={s.id} className="flex items-center gap-2 cursor-pointer group">
                  <div
                    onClick={() => set("hookPreferences", checked ? form.hookPreferences.filter((x) => x !== s.id) : [...form.hookPreferences, s.id])}
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                      checked ? "bg-teal-600 border-teal-600" : "border-slate-300 group-hover:border-teal-400"
                    )}
                  >
                    {checked && <Check size={10} className="text-white" />}
                  </div>
                  <span className="text-xs text-slate-700">{s.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <PillInput
          label="Do NOT"
          values={form.doNot}
          onChange={(v) => set("doNot", v)}
          placeholder="Emdashes, Meme overlays, ..."
        />

        {/* Example lines */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Voice Examples</label>
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              value={form.exampleLines[i] ?? ""}
              onChange={(e) => {
                const lines = [...form.exampleLines];
                lines[i] = e.target.value;
                set("exampleLines", lines);
              }}
              placeholder={`Example line ${i + 1}`}
              className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300 text-slate-800 placeholder-slate-400"
            />
          ))}
        </div>

        {/* Extract from transcript */}
        {personaId && (
          <div className="border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Extract from Transcript</p>
              <p className="text-xs text-slate-500">Paste a script or transcript — AI will auto-fill voice fields for you to review.</p>
            </div>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Paste script or transcript here..."
              rows={4}
              className="w-full text-sm bg-white border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-teal-300 text-slate-800 placeholder-slate-400"
            />
            <button
              onClick={handleExtract}
              disabled={!transcript.trim() || extracting}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {extracting ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              {extracting ? "Extracting..." : "Auto-Fill Fields"}
            </button>
          </div>
        )}

        {/* Preview voice */}
        {personaId && (
          <div className="border border-dashed border-slate-300 rounded-xl p-4 space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-0.5">Preview This Voice</p>
              <p className="text-xs text-slate-500">Enter a topic and hear this persona's hook before saving.</p>
            </div>
            <div className="flex gap-2">
              <input
                value={previewTopic}
                onChange={(e) => setPreviewTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handlePreview(); }}
                placeholder="e.g. back pain from sitting"
                className="flex-1 text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300 text-slate-800 placeholder-slate-400"
              />
              <button
                onClick={handlePreview}
                disabled={!previewTopic.trim() || previewing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {previewing ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />}
                Preview
              </button>
            </div>
            {previewHook && (
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-500 mb-1">{form.name}'s Hook</p>
                <p className="text-sm font-bold italic text-slate-800">"{previewHook}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save footer */}
      <div className="border-t border-slate-100 px-5 py-4 flex items-center justify-between">
        {saveMutation.isError && (
          <p className="text-xs text-rose-600">{(saveMutation.error as Error)?.message ?? "Save failed"}</p>
        )}
        {saved && <p className="text-xs text-emerald-600 font-bold">Saved</p>}
        {!saveMutation.isError && !saved && <span />}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!form.name.trim() || saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {saveMutation.isPending ? "Saving..." : "Save Persona"}
        </button>
      </div>
    </div>
  );
};

export const PersonaPanel: React.FC<PersonaPanelProps> = ({ onClose }) => {
  const [editState, setEditState] = useState<EditState>({ mode: "list" });
  const queryClient = useQueryClient();

  const { data } = useQuery<{ personas: CreatorPersona[] }>({
    queryKey: ["personas"],
    queryFn: () => fetch("/api/personas").then((r) => r.json()),
  });

  const personas = data?.personas ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`/api/personas/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["personas"] }),
  });

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const AVATAR_COLOR_MAP: Record<string, string> = {
    teal: "bg-teal-600",
    violet: "bg-violet-600",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    sky: "bg-sky-500",
  };

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="absolute right-0 top-0 bottom-0 w-full md:w-[560px] bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <span className="text-sm font-black uppercase tracking-widest text-slate-800">Creator Personas</span>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {editState.mode === "list" ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <button
                onClick={() => setEditState({ mode: "create" })}
                className="w-full flex items-center gap-2 p-4 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-all text-sm font-bold"
              >
                <Plus size={16} />
                New Creator
              </button>

              {personas.map((p) => (
                <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shrink-0", AVATAR_COLOR_MAP[p.avatarColor ?? "teal"] ?? "bg-teal-600")}>
                    {p.initials ?? p.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{p.name}</p>
                    {p.role && <p className="text-xs text-slate-500">{p.role}</p>}
                    {p.voiceTone && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1 italic">{p.voiceTone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setEditState({ mode: "edit", personaId: p.id })}
                      className="px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(p.id)}
                      className="px-3 py-1.5 rounded-full text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}

              {personas.length === 0 && !data && (
                <div className="text-center py-8 text-slate-400 text-sm">Loading personas...</div>
              )}
            </div>
          </div>
        ) : (
          <PersonaEditor
            personaId={editState.personaId}
            onBack={() => setEditState({ mode: "list" })}
          />
        )}
      </div>
    </div>
  );
};
