import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, X, Trophy, Sparkles } from "lucide-react";
import type { CoachToast as CoachToastData } from "../../hooks/useQuestTracker.js";

type CoachToastProps = {
  toast: CoachToastData;
  onDismiss: () => void;
  onLevelUp?: (level: number, name: string) => void;
};

export const CoachToast: React.FC<CoachToastProps> = ({ toast, onDismiss, onLevelUp }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));

    // Auto-dismiss after 12 seconds (coach messages are educational, give time to read)
    const timer = setTimeout(() => {
      handleDismiss();
    }, 12000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => {
      if (toast.levelUp && onLevelUp) {
        onLevelUp(toast.levelUp.level, toast.levelUp.name);
      }
      onDismiss();
    }, 300);
  };

  return createPortal(
    <div
      className={`fixed bottom-28 md:bottom-8 left-4 right-4 md:left-auto md:right-20 md:w-[380px] z-[45] transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="bg-surface-elevated border border-themed rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 dark:bg-blue-500/10 border-b border-blue-100 dark:border-blue-500/20">
          <div className="flex items-center gap-2">
            <MessageCircle size={14} className="text-blue-500" />
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
              AI Coach
            </span>
          </div>
          <div className="flex items-center gap-2">
            {toast.xp > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
                <Sparkles size={10} /> +{toast.xp} XP
              </span>
            )}
            <button
              onClick={handleDismiss}
              className="p-0.5 rounded text-blue-400 hover:text-blue-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {/* Step completion */}
          {toast.stepTitle && !toast.questComplete && (
            <p className="text-[10px] font-bold text-emerald-500 mb-1.5 flex items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[8px]">✓</span>
              {toast.stepTitle}
            </p>
          )}

          {/* Quest complete */}
          {toast.questComplete && (
            <p className="text-[10px] font-bold text-amber-500 mb-1.5 flex items-center gap-1">
              <Trophy size={12} />
              Quest Complete!
            </p>
          )}

          {/* Coach message */}
          <p className="text-[12px] text-themed-secondary leading-relaxed">
            {toast.message}
          </p>

          {/* Level up teaser */}
          {toast.levelUp && (
            <div className="mt-2 px-3 py-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
              <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1.5">
                <Trophy size={12} />
                Level Up! You're now a {toast.levelUp.name}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
