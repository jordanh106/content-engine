import React from "react";
import { Check, Circle } from "lucide-react";
import { clsx } from "clsx";
import type { ComputedStep } from "../../utils/project-steps.js";

type Props = {
  steps: ComputedStep[];
  onSelect?: (stepId: ComputedStep["id"]) => void;
};

/**
 * Horizontal stepper showing project progress.
 *
 * todo:    grey circle + index number
 * active:  teal circle with index, slight scale, ring
 * done:    teal-filled circle with checkmark
 * skipped: grey circle with dash, slightly faded
 */
export const ProjectStepper: React.FC<Props> = ({ steps, onSelect }) => {
  return (
    <div className="surface-secondary !py-4 !px-5">
      <div className="flex items-center gap-2 overflow-x-auto">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <button
              onClick={() => onSelect?.(step.id)}
              className={clsx(
                "flex items-center gap-2.5 px-2 py-1 rounded-lg transition-colors group whitespace-nowrap",
                onSelect ? "hover:bg-slate-50 cursor-pointer" : "cursor-default",
              )}
              disabled={!onSelect}
            >
              <StepCircle status={step.status} index={idx + 1} />
              <span className={clsx(
                "text-sm transition-colors",
                step.status === "active" && "font-semibold text-slate-900",
                step.status === "done" && "font-medium text-teal-700",
                step.status === "todo" && "text-slate-500",
                step.status === "skipped" && "text-slate-300 line-through",
              )}>
                {step.label}
              </span>
            </button>
            {idx < steps.length - 1 && (
              <span
                className={clsx(
                  "h-px flex-1 min-w-[24px] transition-colors",
                  steps[idx + 1].status === "done" || step.status === "done"
                    ? "bg-teal-300"
                    : "bg-slate-200",
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const StepCircle: React.FC<{ status: ComputedStep["status"]; index: number }> = ({ status, index }) => {
  const base = "w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-all shrink-0";
  if (status === "done") {
    return <span className={clsx(base, "bg-teal-600 text-white")}><Check size={14} /></span>;
  }
  if (status === "active") {
    return <span className={clsx(base, "bg-teal-100 text-teal-700 ring-2 ring-teal-500/30 ring-offset-2 ring-offset-white")}>{index}</span>;
  }
  if (status === "skipped") {
    return <span className={clsx(base, "bg-slate-100 text-slate-300")}><Circle size={11} /></span>;
  }
  return <span className={clsx(base, "bg-slate-100 text-slate-400")}>{index}</span>;
};
