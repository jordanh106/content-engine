import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Image as ImageIcon, Loader2, Sparkles, Trash2, RotateCcw, AlertCircle, Lock } from "lucide-react";
import { Eyebrow } from "./Eyebrow.js";
import { Button } from "./Button.js";

type VisualSystem = {
  style: string;
  palette: string[];
  typographyMood: string;
  density: "minimal" | "medium" | "dense";
  mood: string;
  paletteColors: {
    primary: string;
    accent: string;
    background: string;
    text: string;
  };
};

type Ref = {
  id: number;
  url: string | null;
  filePath: string | null;
  kind: "image" | "video" | "doc";
  label: string | null;
};

type Props = {
  projectId: string;
  refs: Ref[];
  disabled?: boolean;
};

/**
 * Visual Style anchor for cinematic carousels.
 *
 * Workflow: upload a reference carousel screenshot → click "Lock visual style" →
 * Claude Haiku Vision derives a Visual System (palette, typography, mood) → every
 * generated slide in this project inherits that system. Reset to revert to brand default.
 */
export const VisualSystemLock: React.FC<Props> = ({ projectId, refs, disabled }) => {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const imageRefs = refs.filter((r) => r.kind === "image");
  const styleRef = imageRefs[0];

  const { data: vsData } = useQuery<{ visualSystem: VisualSystem | null; isDefault: boolean }>({
    queryKey: ["project-visual-system", projectId],
    queryFn: () => fetch(`/api/projects/${projectId}/visual-system`).then((r) => r.json()),
    staleTime: 5_000,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/projects/${projectId}/refs`, { method: "POST", body: form });
      if (!res.ok) throw new Error("upload failed");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  const lock = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/visual-teardown`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Lock failed (${res.status})`);
      }
      return res.json() as Promise<{ visualSystem: VisualSystem }>;
    },
    onMutate: () => setError(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-visual-system", projectId] }),
    onError: (err) => setError(err instanceof Error ? err.message : "Lock failed"),
  });

  const reset = useMutation({
    mutationFn: () => fetch(`/api/projects/${projectId}/visual-system`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project-visual-system", projectId] }),
  });

  const removeRef = useMutation({
    mutationFn: (refId: number) => fetch(`/api/projects/${projectId}/refs/${refId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["project", projectId] }),
  });

  const locked = vsData && !vsData.isDefault && vsData.visualSystem !== null;
  const vs = vsData?.visualSystem ?? null;

  return (
    <section className="surface-secondary">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <Eyebrow>Visual style anchor</Eyebrow>
          <p className="type-meta mt-0.5">
            {locked ? "Locked to your reference" : "Using brand default — warm cream + coral editorial"}
          </p>
        </div>
        {locked && (
          <Button variant="ghost" size="sm" icon={<RotateCcw />} onClick={() => reset.mutate()} disabled={disabled || reset.isPending}>
            Reset to brand
          </Button>
        )}
      </div>

      <div className="grid md:grid-cols-[200px_1fr] gap-4">
        {/* Reference image slot */}
        <div>
          {styleRef && styleRef.url ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square group">
              <img src={styleRef.url} alt="Visual style reference" className="w-full h-full object-cover" loading="lazy" />
              <button
                onClick={() => removeRef.mutate(styleRef.id)}
                title="Remove reference"
                className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm text-slate-500 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm"
                disabled={disabled || removeRef.isPending}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || upload.isPending}
              className="aspect-square w-full rounded-xl border-2 border-dashed border-slate-200 hover:border-rose-400 hover:bg-rose-50/40 transition-colors flex flex-col items-center justify-center text-slate-400 hover:text-rose-600 gap-1.5"
            >
              {upload.isPending ? <Loader2 size={22} className="animate-spin" /> : <ImageIcon size={22} />}
              <span className="text-xs font-semibold">{upload.isPending ? "Uploading…" : "Drop or click"}</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        </div>

        {/* Visual System summary or empty state */}
        <div className="min-w-0">
          {locked && vs ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-rose-600" />
                <p className="text-sm font-semibold text-slate-900">{vs.style}</p>
              </div>
              <p className="text-xs text-slate-600 italic">{vs.mood}</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {vs.palette.slice(0, 5).map((c, i) => {
                  const hex = c.match(/#[0-9a-fA-F]{6}/)?.[0] ?? "#94a3b8";
                  return (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                      <span className="w-3 h-3 rounded-full border border-slate-200" style={{ background: hex }} />
                      <span className="font-mono">{hex}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider">
                {vs.typographyMood} · {vs.density} density
              </p>
            </div>
          ) : styleRef ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Reference uploaded. Lock the visual style and every generated slide will inherit its palette, typography, and mood.
              </p>
              <Button
                variant="primary"
                tone="rose"
                size="sm"
                icon={lock.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                onClick={() => lock.mutate()}
                disabled={disabled || lock.isPending}
              >
                {lock.isPending ? "Analysing…" : "Lock visual style"}
              </Button>
              {error && (
                <p className="text-xs text-rose-600 flex items-center gap-1">
                  <AlertCircle size={11} /> {error}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">
                Optional. Drop a reference carousel screenshot and we'll match its visual language across every generated slide.
              </p>
              <p className="text-xs text-slate-400">
                Skip this and we'll use the brand default (warm cream, coral accents, Georgia serif).
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
