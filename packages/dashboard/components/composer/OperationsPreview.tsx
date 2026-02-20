import React, { useState } from "react";
import { Check, X, Eye } from "lucide-react";
import { cn } from "../../utils/cn.js";
import type { ComponentOperation } from "../../shared/types.js";

type OperationsPreviewProps = {
  operations: ComponentOperation[];
  message: string;
  onApply: (operations: ComponentOperation[]) => void;
  onReject: () => void;
};

function describeOperation(op: ComponentOperation): string {
  switch (op.action) {
    case "add":
      return `Add ${op.component.label || op.component.componentType}`;
    case "replace":
      return `Replace component #${op.index + 1} with ${op.component.label || op.component.componentType}`;
    case "modify":
      return `Modify component #${op.index + 1} props`;
    case "remove":
      return `Remove component #${op.index + 1}`;
    case "reorder":
      return `Reorder components`;
    default:
      return "Unknown operation";
  }
}

function operationIcon(action: string): string {
  switch (action) {
    case "add":
      return "+";
    case "replace":
      return "~";
    case "modify":
      return "~";
    case "remove":
      return "-";
    case "reorder":
      return "#";
    default:
      return "?";
  }
}

function operationColor(action: string): string {
  switch (action) {
    case "add":
      return "text-teal-600 bg-teal-50";
    case "replace":
      return "text-amber-600 bg-amber-50";
    case "modify":
      return "text-violet-600 bg-violet-50";
    case "remove":
      return "text-rose-600 bg-rose-50";
    case "reorder":
      return "text-slate-600 bg-slate-50";
    default:
      return "text-slate-600 bg-slate-50";
  }
}

export const OperationsPreview: React.FC<OperationsPreviewProps> = ({
  operations,
  message,
  onApply,
  onReject,
}) => {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(operations.map((_, i) => i)),
  );

  const toggleOp = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleApply = () => {
    const selectedOps = operations.filter((_, i) => selected.has(i));
    onApply(selectedOps);
  };

  return (
    <div className="border border-violet-200 rounded-lg bg-violet-50/50 mx-3 mb-2">
      {/* AI message */}
      <div className="px-3 py-2 text-xs text-violet-900 border-b border-violet-100">
        {message}
      </div>

      {/* Operations list */}
      <div className="px-2 py-1.5 space-y-1">
        <div className="flex items-center gap-1.5 px-1 mb-1">
          <Eye size={10} className="text-violet-400" />
          <span className="text-[9px] font-black uppercase tracking-[0.15em] text-violet-400">
            Proposed Changes
          </span>
        </div>
        {operations.map((op, i) => (
          <label
            key={i}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors",
              selected.has(i)
                ? "bg-white border border-violet-200"
                : "opacity-50",
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(i)}
              onChange={() => toggleOp(i)}
              className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5"
            />
            <span
              className={cn(
                "inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold",
                operationColor(op.action),
              )}
            >
              {operationIcon(op.action)}
            </span>
            <span className="text-[11px] text-slate-700">
              {describeOperation(op)}
            </span>
          </label>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-violet-100">
        <button
          onClick={handleApply}
          disabled={selected.size === 0}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors",
            selected.size > 0
              ? "bg-violet-600 text-white hover:bg-violet-700"
              : "bg-slate-200 text-slate-400 cursor-not-allowed",
          )}
        >
          <Check size={12} />
          Apply {selected.size === operations.length ? "All" : `${selected.size}/${operations.length}`}
        </button>
        <button
          onClick={onReject}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <X size={12} />
          Reject
        </button>
      </div>
    </div>
  );
};
