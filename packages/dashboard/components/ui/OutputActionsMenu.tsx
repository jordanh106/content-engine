import React, { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Download, ExternalLink, Copy, Wand2, FileCode, Image as ImageIcon, Film, FileText, Check, Crop, Sparkles, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { ProjectOutput } from "../../shared/types.js";

type Aspect = "1:1" | "4:5" | "9:16" | "16:9";

type Props = {
  output: ProjectOutput;
  projectId?: string;
  onSendToCanvas?: (output: ProjectOutput) => void;
};

/**
 * Kebab menu attached to each generated output. Actions depend on output kind:
 *  - All: Download, Copy URL, Open full, Send to Canvas
 *  - Image: + Open in new tab
 *  - Video: + Open in new tab
 *  - HTML: + Open in new tab / Preview
 *  - Text: + Copy contents
 */
export const OutputActionsMenu: React.FC<Props> = ({ output, projectId, onSendToCanvas }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [busyMsg, setBusyMsg] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const qc = useQueryClient();

  const cropMutation = useMutation({
    mutationFn: async (aspect: Aspect) => {
      if (!projectId) throw new Error("projectId required");
      const r = await fetch(`/api/projects/${projectId}/outputs/${output.id}/crop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aspect }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `crop failed (${r.status})`);
      }
      return r.json();
    },
    onMutate: () => setBusyMsg("Cropping…"),
    onSuccess: () => {
      setBusyMsg(null);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      setOpen(false);
      setCropOpen(false);
    },
    onError: (err: Error) => setBusyMsg(err.message),
  });

  const variantMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error("projectId required");
      const r = await fetch(`/api/projects/${projectId}/outputs/${output.id}/variant`, {
        method: "POST",
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `variant failed (${r.status})`);
      }
      return r.json();
    },
    onMutate: () => setBusyMsg("Generating variant…"),
    onSuccess: () => {
      setBusyMsg(null);
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["project-log", projectId] });
      setOpen(false);
    },
    onError: (err: Error) => setBusyMsg(err.message),
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const copyUrl = async () => {
    if (!output.url) return;
    const absoluteUrl = output.url.startsWith("http") ? output.url : window.location.origin + output.url;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
    setOpen(false);
  };

  const downloadHref = output.url ?? "#";
  const filenameGuess = output.label ? `${output.label}${guessExt(output.kind, output.url)}` : `output_${output.id}`;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm text-slate-500 hover:text-slate-900 hover:bg-white shadow-sm flex items-center justify-center transition-colors"
        title="More actions"
        aria-haspopup="menu"
      >
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-9 z-30 min-w-[200px] surface-floating py-1.5">
          <MenuKindHeader output={output} />

          {output.url && (
            <MenuItem
              icon={<Download size={14} />}
              label="Download"
              onClick={(e) => { e.stopPropagation(); /* native download via the <a> below */ }}
              as="a"
              href={downloadHref}
              download={filenameGuess}
            />
          )}

          {output.url && (
            <MenuItem
              icon={<ExternalLink size={14} />}
              label="Open in new tab"
              as="a"
              href={downloadHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            />
          )}

          {output.url && (
            <MenuItem
              icon={copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
              label={copied ? "Copied!" : "Copy URL"}
              onClick={(e) => { e.stopPropagation(); copyUrl(); }}
            />
          )}

          {output.kind === "text" && output.filePath && (
            <MenuItem
              icon={<Copy size={14} />}
              label="Copy file contents"
              onClick={async (e) => {
                e.stopPropagation();
                if (!output.url) return;
                try {
                  const res = await fetch(output.url);
                  const text = await res.text();
                  await navigator.clipboard.writeText(text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch { /* ignore */ }
                setOpen(false);
              }}
            />
          )}

          {onSendToCanvas && (output.kind === "image" || output.kind === "video") && (
            <MenuItem
              icon={<Wand2 size={14} />}
              label="Send to Canvas"
              onClick={(e) => { e.stopPropagation(); onSendToCanvas(output); setOpen(false); }}
            />
          )}

          {projectId && output.url && (output.kind === "image" || output.kind === "video") && (
            <>
              <div className="my-1 border-t border-slate-100" />
              {!cropOpen ? (
                <MenuItem
                  icon={<Crop size={14} />}
                  label="Crop to aspect…"
                  onClick={(e) => { e.stopPropagation(); setCropOpen(true); }}
                />
              ) : (
                <div className="px-3 py-1.5 space-y-1">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Crop to</div>
                  {(["1:1", "4:5", "9:16", "16:9"] as Aspect[]).map((a) => (
                    <button
                      key={a}
                      onClick={(e) => { e.stopPropagation(); cropMutation.mutate(a); }}
                      disabled={cropMutation.isPending}
                      className="w-full text-left px-2 py-1 text-sm text-slate-700 hover:bg-slate-50 rounded disabled:opacity-50 flex items-center gap-2"
                    >
                      {cropMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Crop size={12} className="text-slate-400" />}
                      {a}
                    </button>
                  ))}
                  <button
                    onClick={(e) => { e.stopPropagation(); setCropOpen(false); }}
                    className="w-full text-left px-2 py-1 text-[11px] text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}

          {projectId && output.kind === "image" && output.prompt && (
            <MenuItem
              icon={variantMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              label={variantMutation.isPending ? "Generating variant…" : "Generate variant"}
              onClick={(e) => { e.stopPropagation(); variantMutation.mutate(); }}
            />
          )}

          {busyMsg && (
            <p className="px-3 py-1.5 text-[11px] text-slate-500 border-t border-slate-100 mt-1">{busyMsg}</p>
          )}
        </div>
      )}
    </div>
  );
};

const MenuKindHeader: React.FC<{ output: ProjectOutput }> = ({ output }) => {
  const KindIcon = ({ kind }: { kind: ProjectOutput["kind"] }) => {
    if (kind === "image") return <ImageIcon size={13} />;
    if (kind === "video") return <Film size={13} />;
    if (kind === "html") return <FileCode size={13} />;
    if (kind === "text") return <FileText size={13} />;
    return null;
  };
  return (
    <div className="px-3 py-1.5 border-b border-slate-100 flex items-center gap-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
      <KindIcon kind={output.kind} />
      <span>{output.label ?? output.kind}</span>
      {output.predictedVirality != null && (
        <span className="ml-auto tabular-nums text-teal-700">{Math.round(output.predictedVirality)}/100</span>
      )}
    </div>
  );
};

type MenuItemProps = {
  icon: React.ReactNode;
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  as?: "button" | "a";
  href?: string;
  download?: string;
  target?: string;
  rel?: string;
};

const MenuItem: React.FC<MenuItemProps> = ({ icon, label, onClick, as = "button", href, download, target, rel }) => {
  const className = clsx(
    "w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-left",
  );
  const inner = (
    <>
      <span className="text-slate-400 shrink-0">{icon}</span>
      <span>{label}</span>
    </>
  );
  if (as === "a") {
    return <a className={className} href={href} download={download} target={target} rel={rel} onClick={onClick}>{inner}</a>;
  }
  return <button className={className} onClick={onClick} role="menuitem">{inner}</button>;
};

function guessExt(kind: ProjectOutput["kind"], url: string | null): string {
  if (!url) return "";
  const u = url.toLowerCase();
  if (u.includes(".mp4")) return ".mp4";
  if (u.includes(".webm")) return ".webm";
  if (u.includes(".png")) return ".png";
  if (u.includes(".jpg") || u.includes(".jpeg")) return ".jpg";
  if (u.includes(".webp")) return ".webp";
  if (u.includes(".html")) return ".html";
  if (u.includes(".md")) return ".md";
  if (kind === "image") return ".png";
  if (kind === "video") return ".mp4";
  if (kind === "html") return ".html";
  if (kind === "text") return ".md";
  return "";
}
