import React from "react";
import { Image as ImageIcon, Film, FileCode, LayoutGrid, FileText } from "lucide-react";
import type { ProjectKindExpectedOutput } from "../../shared/project-kinds.js";

type Props = {
  outputs: ProjectKindExpectedOutput[];
};

const KIND_ICON: Record<ProjectKindExpectedOutput["kind"], React.ReactNode> = {
  image: <ImageIcon size={14} className="text-teal-600" />,
  video: <Film size={14} className="text-teal-600" />,
  html: <FileCode size={14} className="text-teal-600" />,
  carousel: <LayoutGrid size={14} className="text-teal-600" />,
  text: <FileText size={14} className="text-teal-600" />,
};

/**
 * A horizontal chip strip showing what this project KIND will produce. Renders below the
 * stepper so the user immediately knows what they're heading toward.
 */
export const ExpectedOutputsStrip: React.FC<Props> = ({ outputs }) => {
  if (outputs.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <span className="type-eyebrow text-slate-400">This template produces</span>
      {outputs.map((o, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs text-teal-800"
          title={o.blurb}
        >
          {KIND_ICON[o.kind]}
          <span className="font-semibold tabular-nums">{o.count && o.count > 1 ? `${o.count} ` : ""}</span>
          <span>{o.label}</span>
        </span>
      ))}
    </div>
  );
};
