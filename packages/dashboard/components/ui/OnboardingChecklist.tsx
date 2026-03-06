import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";
import { useOnboarding } from "../OnboardingProvider.js";
import { CHECKLIST_ITEMS } from "../../shared/help-content.js";

export const OnboardingChecklist: React.FC = () => {
  const {
    progress,
    checklistCompleted,
    completionPercent,
    isChecklistDismissed,
    dismissChecklist,
    onNavigate,
  } = useOnboarding();
  const [expanded, setExpanded] = useState(false);

  // Only show after welcome is done and tour is completed/skipped
  if (!progress.welcomeCompleted || !progress.tourCompleted) return null;
  if (isChecklistDismissed) return null;

  const completedCount = CHECKLIST_ITEMS.filter((item) => checklistCompleted[item.id]).length;
  const totalCount = CHECKLIST_ITEMS.length;

  // SVG progress ring
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionPercent / 100) * circumference;

  return createPortal(
    <>
      {/* Collapsed button */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="fixed bottom-24 md:bottom-6 right-4 z-[35] w-10 h-10 flex items-center justify-center"
          aria-label={`Onboarding progress: ${completedCount} of ${totalCount}`}
        >
          <svg width="40" height="40" className="absolute">
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="white"
              stroke="#e2e8f0"
              strokeWidth="2.5"
            />
            <circle
              cx="20"
              cy="20"
              r={radius}
              fill="none"
              stroke="#0d9488"
              strokeWidth="2.5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform="rotate(-90 20 20)"
              className="transition-all duration-500"
            />
          </svg>
          <span className="relative text-[10px] font-black text-teal-700">
            {completedCount}/{totalCount}
          </span>
        </button>
      )}

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-24 md:bottom-6 right-4 z-[35] w-[280px] bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 pb-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Getting Started</p>
                <p className="text-xs text-slate-500 mt-0.5">{completedCount} of {totalCount} complete</p>
              </div>
              <button
                onClick={() => setExpanded(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <X size={14} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="px-4 pb-3">
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
            </div>

            {/* Items */}
            <div className="px-4 pb-3 space-y-1">
              {CHECKLIST_ITEMS.map((item) => {
                const done = checklistCompleted[item.id];
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!done && item.targetView && onNavigate) {
                        onNavigate(item.targetView);
                        setExpanded(false);
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition-colors ${
                      done ? "opacity-60" : "hover:bg-slate-50"
                    }`}
                    disabled={done}
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      done ? "bg-teal-100 text-teal-600" : "border-2 border-slate-200"
                    }`}>
                      {done && <Check size={10} strokeWidth={3} />}
                    </div>
                    <span className={`text-xs ${done ? "text-slate-400 line-through" : "text-slate-700 font-medium"}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Dismiss */}
            <div className="px-4 py-3 border-t border-slate-100">
              <button
                onClick={dismissChecklist}
                className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
};
