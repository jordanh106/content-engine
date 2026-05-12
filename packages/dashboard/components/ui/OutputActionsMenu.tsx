import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Download, ExternalLink, Copy, Wand2, FileCode, Image as ImageIcon, Film, FileText, Check } from "lucide-react";
import { clsx } from "clsx";
import type { ProjectOutput } from "../../shared/types.js";

type Props = {
  output: ProjectOutput;
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
export const OutputActionsMenu: React.FC<Props> = ({ output, onSendToCanvas }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

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
