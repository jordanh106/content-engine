import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trophy, ArrowRight, Sparkles } from "lucide-react";
import { CREATOR_LEVELS } from "../../shared/types.js";

type LevelUpCelebrationProps = {
  newLevel: number;
  newLevelName: string;
  onDismiss: () => void;
};

const LEVEL_MESSAGES: Record<number, { headline: string; body: string }> = {
  2: {
    headline: "You're a Writer now",
    body: "You've learned to observe and decode what makes content work. Now it's time to create your own. The Script Wizard is unlocked, and your Library of 57 proven scripts awaits.",
  },
  3: {
    headline: "You're a Producer now",
    body: "Scripts are ready, time to bring them to life. You've unlocked the Pipeline and Session views. Batch your recordings by audience for maximum efficiency.",
  },
  4: {
    headline: "You're a Publisher now",
    body: "Content is built. Now put it in front of your audience. Calendar and Metrics are unlocked. Consistency beats perfection, every time.",
  },
  5: {
    headline: "You're a Strategist now",
    body: "You've mastered the full content creation cycle. Now you'll learn to use data to decide what to create next. This is where casual creators separate from professionals.",
  },
};

const LEVEL_COLORS: Record<string, { from: string; to: string; accent: string }> = {
  sky:     { from: "from-sky-500",     to: "to-blue-600",    accent: "text-sky-200" },
  amber:   { from: "from-amber-500",   to: "to-orange-600",  accent: "text-amber-200" },
  emerald: { from: "from-emerald-500", to: "to-teal-600",    accent: "text-emerald-200" },
  violet:  { from: "from-violet-500",  to: "to-purple-600",  accent: "text-violet-200" },
};

export const LevelUpCelebration: React.FC<LevelUpCelebrationProps> = ({
  newLevel,
  newLevelName,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const levelDef = CREATOR_LEVELS.find((l) => l.level === newLevel);
  const message = LEVEL_MESSAGES[newLevel] ?? {
    headline: `Welcome to Level ${newLevel}`,
    body: "New capabilities unlocked. Keep creating!",
  };
  const colors = LEVEL_COLORS[levelDef?.color ?? "sky"] ?? LEVEL_COLORS.sky;

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center p-4 transition-all duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleDismiss} />

      {/* Card */}
      <div
        className={`relative max-w-md w-full rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ${
          visible ? "scale-100 translate-y-0" : "scale-90 translate-y-8"
        }`}
      >
        {/* Gradient header */}
        <div className={`bg-gradient-to-br ${colors.from} ${colors.to} px-8 py-10 text-center`}>
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
            <Trophy size={32} className="text-white" />
          </div>
          <p className={`text-sm font-bold uppercase tracking-widest ${colors.accent} mb-2`}>
            Level {newLevel} Unlocked
          </p>
          <h2 className="text-2xl font-serif font-bold text-white">
            {message.headline}
          </h2>
        </div>

        {/* Body */}
        <div className="bg-surface-elevated px-8 py-6">
          <p className="text-sm text-themed-secondary leading-relaxed text-center">
            {message.body}
          </p>

          {/* New features unlocked hint */}
          {levelDef && (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              <Sparkles size={12} className="text-amber-500" />
              <span className="text-[10px] font-bold text-themed-muted uppercase tracking-wider">
                {levelDef.description}
              </span>
            </div>
          )}

          <button
            onClick={handleDismiss}
            className={`mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r ${colors.from} ${colors.to} text-white text-sm font-bold hover:shadow-lg transition-shadow`}
          >
            Continue Your Journey
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
