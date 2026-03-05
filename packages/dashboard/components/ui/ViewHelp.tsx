import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, X, RotateCcw } from "lucide-react";
import { resetAllHints } from "../../utils/hints.js";
import type { ViewHelpData } from "../../shared/help-content.js";

export const ViewHelp: React.FC<ViewHelpData> = ({ title, description, tips }) => {
  const [open, setOpen] = useState(false);

  const handleReset = () => {
    resetAllHints();
    window.location.reload();
  };

  return (
    <>
      {/* Floating help button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 md:bottom-6 right-4 z-30 w-10 h-10 rounded-full bg-slate-900 text-white shadow-lg flex items-center justify-center hover:bg-slate-800 transition-colors"
        aria-label="View help"
      >
        <HelpCircle size={18} />
      </button>

      {/* Drawer */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setOpen(false)}
                className="fixed inset-0 bg-black/20 z-40"
              />

              {/* Panel: bottom sheet on mobile, right drawer on desktop */}
              <motion.div
                initial={{ y: "100%", x: 0 }}
                animate={{ y: 0, x: 0 }}
                exit={{ y: "100%", x: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 md:inset-y-0 md:inset-x-auto md:right-0 md:w-[380px] bg-white border-t md:border-t-0 md:border-l border-slate-200 rounded-t-2xl md:rounded-none z-50 flex flex-col max-h-[75vh] md:max-h-none"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
                  <div>
                    <h3 className="text-base font-serif font-bold text-slate-900">{title}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">How to use this view</p>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-5 space-y-4">
                  <p className="text-sm text-slate-600 leading-relaxed">{description}</p>

                  <div className="space-y-2">
                    {tips.map((tip) => (
                      <div
                        key={tip.label}
                        className="bg-slate-50 rounded-xl p-3"
                      >
                        <p className="text-xs font-bold text-slate-800 mb-0.5">{tip.label}</p>
                        <p className="text-xs text-slate-500 leading-relaxed">{tip.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 flex-shrink-0">
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
                  >
                    <RotateCcw size={10} />
                    Reset Tips
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
