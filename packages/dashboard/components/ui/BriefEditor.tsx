import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Code, AlertCircle } from "lucide-react";
import { clsx } from "clsx";
import { Eyebrow } from "./Eyebrow.js";
import { Button } from "./Button.js";
import type { ProjectKindBriefSection } from "../../shared/project-kinds.js";
import { parseBriefSections, serializeBriefSections, briefCompletionPercent } from "../../utils/project-steps.js";

type Props = {
  briefMd: string;
  schema: ProjectKindBriefSection[];
  disabled?: boolean;
  onChange: (next: string) => void;
};

/**
 * Section-aware markdown brief editor.
 *
 * Reads the schema from PROJECT_KIND_REGISTRY[kind].briefSections and renders one card
 * per `## Heading`. Each section card shows: heading, required tag, completion indicator,
 * placeholder hint, and an auto-resizing textarea.
 *
 * Always reads/writes the same markdown shape the orchestrators consume, so the editor is
 * transparent to the rest of the system. Power-users can toggle to raw markdown.
 */
export const BriefEditor: React.FC<Props> = ({ briefMd, schema, disabled, onChange }) => {
  const [rawMode, setRawMode] = useState(false);
  const [localSections, setLocalSections] = useState<Record<string, string>>(() => parseBriefSections(briefMd));

  // When the parent briefMd changes externally (e.g. just-loaded project), resync local state
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!hydratedRef.current) {
      setLocalSections(parseBriefSections(briefMd));
      hydratedRef.current = true;
    }
  }, [briefMd]);

  const completion = useMemo(() => briefCompletionPercent(briefMd, schema), [briefMd, schema]);
  const requiredCount = schema.filter((s) => s.required).length;
  const filledRequired = schema.filter((s) => s.required && (localSections[s.heading] ?? "").trim().length >= (s.minLength ?? 1)).length;

  const updateSection = (heading: string, value: string) => {
    const next = { ...localSections, [heading]: value };
    setLocalSections(next);
    onChange(serializeBriefSections(next, schema));
  };

  if (rawMode) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Eyebrow>Brief (raw markdown)</Eyebrow>
          <Button variant="ghost" size="sm" icon={<Code />} onClick={() => setRawMode(false)}>
            Section view
          </Button>
        </div>
        <textarea
          value={briefMd}
          onChange={(e) => {
            onChange(e.target.value);
            setLocalSections(parseBriefSections(e.target.value));
          }}
          disabled={disabled}
          rows={18}
          className="w-full p-3 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-mono leading-relaxed bg-white text-slate-800 resize-y disabled:opacity-60 disabled:cursor-not-allowed"
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow>Brief</Eyebrow>
          <p className="type-meta mt-0.5">
            <span className="tabular-nums font-semibold text-slate-700">{filledRequired}/{requiredCount}</span> required sections complete
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${completion}%` }} />
          </div>
          <Button variant="ghost" size="sm" icon={<Code />} onClick={() => setRawMode(true)}>
            Raw
          </Button>
        </div>
      </div>

      {disabled && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertCircle size={13} className="shrink-0" />
          <span>Editing locked while the orchestrator is running.</span>
        </div>
      )}

      <div className="space-y-3">
        {schema.map((section) => {
          const value = localSections[section.heading] ?? "";
          const filled = value.trim().length >= (section.minLength ?? 1);
          const isRequired = section.required;
          return (
            <div
              key={section.heading}
              className={clsx(
                "surface-secondary !p-4 transition-colors",
                filled && isRequired ? "border-teal-200/70" : "",
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={clsx(
                    "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                    filled && isRequired ? "bg-teal-100 text-teal-700" : !isRequired ? "bg-slate-100 text-slate-400" : "bg-amber-50 text-amber-700 border border-amber-200",
                  )}>
                    {filled ? <Check size={11} /> : isRequired ? "!" : "·"}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-900 truncate">{section.heading}</h4>
                </div>
                <span className={clsx(
                  "text-[10px] font-medium uppercase tracking-wider shrink-0",
                  isRequired ? "text-slate-400" : "text-slate-300",
                )}>
                  {isRequired ? "Required" : "Optional"}
                </span>
              </div>
              {section.hint && (
                <p className="text-xs text-slate-500 mb-2">{section.hint}</p>
              )}
              <textarea
                value={value}
                onChange={(e) => updateSection(section.heading, e.target.value)}
                disabled={disabled}
                rows={section.rows ?? 2}
                placeholder={section.placeholder}
                className={clsx(
                  "w-full px-3 py-2 rounded-lg border text-sm leading-relaxed bg-white text-slate-800 resize-y outline-none transition-colors",
                  "border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500",
                  "placeholder:text-slate-400",
                  "disabled:opacity-60 disabled:cursor-not-allowed",
                )}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
