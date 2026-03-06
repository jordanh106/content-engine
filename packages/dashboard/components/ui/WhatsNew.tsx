import React, { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift } from "lucide-react";
import { useOnboarding } from "../OnboardingProvider.js";
import { CHANGELOG } from "../../shared/help-content.js";

export const WhatsNew: React.FC = () => {
  const { hasUnseenChanges, dismissChangelog } = useOnboarding();
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen(true);
    dismissChangelog();
  };

  const handleClose = () => {
    setOpen(false);
  };

  if (!hasUnseenChanges && !open) return null;

  return (
    <>
      {/* Badge trigger - rendered inline where parent places it */}
      {hasUnseenChanges && !open && (
        <button
          onClick={handleOpen}
          className="ml-auto px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[9px] font-black uppercase tracking-widest animate-pulse"
          aria-label="What's new"
        >
          New
        </button>
      )}

      {/* Drawer */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
                className="fixed inset-0 bg-black/20 z-40"
              />

              <motion.div
                initial={{ y: "100%", x: 0 }}
                animate={{ y: 0, x: 0 }}
                exit={{ y: "100%", x: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="fixed inset-x-0 bottom-0 md:inset-y-0 md:inset-x-auto md:right-0 md:w-[380px] bg-white border-t md:border-t-0 md:border-l border-slate-200 rounded-t-2xl md:rounded-none z-50 flex flex-col max-h-[75vh] md:max-h-none"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Gift size={18} className="text-teal-600" />
                    <h3 className="text-base font-serif font-bold text-slate-900">What's New</h3>
                  </div>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-5 space-y-6">
                  {CHANGELOG.map((entry) => (
                    <div key={entry.version}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-600">
                          v{entry.version}
                        </span>
                        <span className="text-[10px] text-slate-400">{entry.date}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 mb-2">{entry.title}</p>
                      <ul className="space-y-1.5">
                        {entry.items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                            <span className="w-1 h-1 rounded-full bg-teal-400 mt-1.5 flex-shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
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
