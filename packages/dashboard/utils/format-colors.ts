import type { FormatId } from "../shared/types.js";

type FormatColor = {
  bg: string;
  text: string;
  border: string;
  dot: string;
};

export const formatColors: Record<FormatId, FormatColor> = {
  A: { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200", dot: "bg-teal-500" },
  B: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  C: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
  D: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" },
  E: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500" },
};

export const audienceColors: Record<string, { bg: string; text: string }> = {
  prenatal: { bg: "bg-pink-50", text: "text-pink-700" },
  infant: { bg: "bg-amber-50", text: "text-amber-700" },
  kids: { bg: "bg-lime-50", text: "text-lime-700" },
  athlete: { bg: "bg-blue-50", text: "text-blue-700" },
  adult: { bg: "bg-slate-100", text: "text-slate-700" },
  senior: { bg: "bg-purple-50", text: "text-purple-700" },
  general: { bg: "bg-teal-50", text: "text-teal-700" },
};

export const statusColors: Record<string, { bg: string; text: string }> = {
  SCRIPTED: { bg: "bg-slate-100", text: "text-slate-600" },
  RECORDING: { bg: "bg-amber-50", text: "text-amber-700" },
  GENERATING: { bg: "bg-sky-50", text: "text-sky-700" },
  ASSEMBLED: { bg: "bg-teal-50", text: "text-teal-700" },
  SCHEDULED: { bg: "bg-violet-50", text: "text-violet-700" },
  PUBLISHED: { bg: "bg-emerald-50", text: "text-emerald-700" },
};
