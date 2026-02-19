import React from "react";
import { X } from "lucide-react";
import { COMPONENT_REGISTRY, COMPONENT_TYPES } from "./component-registry.js";
import { cn } from "../../utils/cn.js";

const COMPONENT_TYPE_COLORS: Record<string, string> = {
  TitleCard: "border-violet-200 hover:bg-violet-50",
  StatCard: "border-blue-200 hover:bg-blue-50",
  SectionCard: "border-teal-200 hover:bg-teal-50",
  HookText: "border-amber-200 hover:bg-amber-50",
  ChecklistOverlay: "border-emerald-200 hover:bg-emerald-50",
  MythTruthReveal: "border-rose-200 hover:bg-rose-50",
  StepIndicator: "border-indigo-200 hover:bg-indigo-50",
  FrequencyCard: "border-cyan-200 hover:bg-cyan-50",
  CallToAction: "border-orange-200 hover:bg-orange-50",
  ChartCard: "border-sky-200 hover:bg-sky-50",
  QuoteCard: "border-pink-200 hover:bg-pink-50",
};

type AddComponentModalProps = {
  onAdd: (componentType: string) => void;
  onClose: () => void;
};

export const AddComponentModal: React.FC<AddComponentModalProps> = ({
  onAdd,
  onClose,
}) => {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Add Component</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Choose a component to add to your composition
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"
            >
              <X size={18} />
            </button>
          </div>

          {/* Component grid */}
          <div className="flex-1 overflow-auto p-4">
            <div className="grid grid-cols-2 gap-2">
              {COMPONENT_TYPES.map((type) => {
                const entry = COMPONENT_REGISTRY[type];
                const borderColor =
                  COMPONENT_TYPE_COLORS[type] || "border-slate-200 hover:bg-slate-50";

                return (
                  <button
                    key={type}
                    onClick={() => {
                      onAdd(type);
                      onClose();
                    }}
                    className={cn(
                      "text-left p-3 rounded-xl border-2 transition-colors",
                      borderColor,
                    )}
                  >
                    <p className="text-sm font-bold text-slate-800">
                      {entry.label}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {entry.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
