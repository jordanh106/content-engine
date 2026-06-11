import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, Code, AlertCircle, Sparkles, Loader2 } from "lucide-react";
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
  /** Optional: enable the AI Suggest button. Hits /api/projects/:id/suggest-brief. */
  projectId?: string;
};

/**
 * Section-aware markdown brief editor.
 *
 * Reads the schema from PROJECT_KIND_REGISTRY[kind].briefSections and renders one card
 * per `## Heading`. Each section card shows: heading, required tag, completion indicator,
 * placeholder hint, and an auto-resizing textarea.
 *
 * When projectId is supplied, an "AI Suggest" affordance lets the user type a topic seed
 * and auto-fill every required section via Claude Haiku.
 */
export const BriefEditor: React.FC<Props> = ({ briefMd, schema, disabled, onChange, projectId }) => {
  const [rawMode, setRawMode] = useState(false);
  const [localSections, setLocalSections] = useState<Record<string, string>>(() => parseBriefSections(briefMd));
  const [topicSeed, setTopicSeed] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

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
  const briefHasMeaningfulContent = Object.values(localSections).some((v) => v.trim().length > 12);

  const updateSection = (heading: string, value: string) => {
    const next = { ...localSections, [heading]: value };
    setLocalSections(next);
    onChange(serializeBriefSections(next, schema));
  };

  const runAiSuggest = async (seed: string) => {
    if (!projectId) return;
    if (seed.trim().length < 6) {
      setAiError("Add a bit more detail to your topic first.");
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/suggest-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicSeed: seed }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error || `Suggest failed (${r.status})`);
      }
      const { suggestedBrief } = await r.json() as { suggestedBrief: string };
      const parsed = parseBriefSections(suggestedBrief);
      setLocalSections(parsed);
      onChange(suggestedBrief);
      setConfirmReplace(false);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "AI suggest failed");
    } finally {
      setAiBusy(false);
    }
  };

  const handleAiClick = () => {
    if (!projectId) return;
    // If the brief already has meaningful content, ask before replacing.
    if (briefHasMeaningfulContent && !confirmReplace) {
      setConfirmReplace(true);
      return;
    }
    // Use the topic-seed input if filled, otherwise fall back to the first non-empty section
    const seed = topicSeed.trim() || schema.map((s) => localSections[s.heading]?.trim()).find((v) => v && v.length > 6) || "";
    runAiSuggest(seed);
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
          {projectId && (
            <Button
              variant="ghost"
              size="sm"
              icon={aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              onClick={handleAiClick}
              disabled={aiBusy || disabled}
            >
              {aiBusy ? "Thinking…" : confirmReplace ? "Replace brief?" : "AI Suggest"}
            </Button>
          )}
          <Button variant="ghost" size="sm" icon={<Code />} onClick={() => setRawMode(true)}>
            Raw
          </Button>
        </div>
      </div>

      {/* Topic-seed banner — visible until the brief has real content */}
      {projectId && !briefHasMeaningfulContent && !disabled && (
        <div className="rounded-xl border border-teal-200/60 bg-teal-50/40 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={12} className="text-teal-600" />
            <p className="text-xs font-semibold text-teal-900">Need ideas?</p>
          </div>
          <p className="text-xs text-slate-600 mb-2.5">Drop a topic and we'll draft the rest of the brief for you.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={topicSeed}
              onChange={(e) => { setTopicSeed(e.target.value); setAiError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runAiSuggest(topicSeed); } }}
              placeholder="e.g. The origin of the chainsaw"
              disabled={aiBusy}
              className="flex-1 px-3 py-2 rounded-lg border border-teal-200/60 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm bg-white text-slate-800 placeholder:text-slate-400"
            />
            <Button
              variant="primary"
              tone="teal"
              size="sm"
              icon={aiBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
              onClick={() => runAiSuggest(topicSeed)}
              disabled={aiBusy || topicSeed.trim().length < 6}
            >
              {aiBusy ? "Drafting…" : "AI Suggest"}
            </Button>
          </div>
          {aiError && (
            <p className="text-xs text-rose-600 mt-2 flex items-center gap-1">
              <AlertCircle size={11} /> {aiError}
            </p>
          )}
        </div>
      )}

      {/* Confirm-replace banner when AI Suggest button hit on already-populated brief */}
      {confirmReplace && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-xs text-amber-900">
            <strong>Replace the current brief?</strong> This will overwrite every section.
          </p>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setConfirmReplace(false)}>Cancel</Button>
            <Button variant="primary" tone="amber" size="sm" onClick={handleAiClick} disabled={aiBusy}>
              Replace
            </Button>
          </div>
        </div>
      )}

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
