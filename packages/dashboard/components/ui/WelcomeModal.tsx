import React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { useOnboarding } from "../OnboardingProvider.js";

export const WelcomeModal: React.FC = () => {
  const { isFirstVisit, completeWelcome, startTour } = useOnboarding();

  if (!isFirstVisit) return null;

  const handleTakeTour = () => {
    completeWelcome();
    startTour();
  };

  const handleSkip = () => {
    completeWelcome();
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 z-[70] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-surface-elevated border border-themed rounded-2xl p-8 max-w-md w-full shadow-2xl"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 mx-auto mb-5">
            <Sparkles size={24} />
          </div>

          <h2 className="text-xl font-serif font-bold text-slate-900 text-center mb-2">
            Welcome to Content Engine
          </h2>
          <p className="text-sm text-slate-500 text-center leading-relaxed mb-8">
            Your production dashboard for managing content from script to publish.
            Let's take a quick tour to help you get started.
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={handleTakeTour}
              className="w-full px-6 py-3 bg-teal-600 text-white rounded-full text-sm font-black uppercase tracking-widest hover:bg-teal-700 transition-colors"
            >
              Take the Tour
            </button>
            <button
              onClick={handleSkip}
              className="w-full px-6 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Skip for now
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
