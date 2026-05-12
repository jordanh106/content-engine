import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Info } from "lucide-react";
import { useOnboarding } from "../OnboardingProvider.js";

type CoachmarkProps = {
  id: string;
  content: string;
  title?: string;
  side?: "top" | "bottom" | "left" | "right";
  /** Only show after this hint has been dismissed */
  showAfter?: string;
  /** Show on Nth view visit (default 1). Set higher to avoid showing during tour. */
  delayVisits?: number;
  children: React.ReactElement;
};

const Coachmark: React.FC<CoachmarkProps> = ({
  id,
  content,
  title,
  side = "bottom",
  showAfter,
  delayVisits = 1,
  children,
}) => {
  const { isHintSeen, markHintSeen: markSeen, progress, isTourActive } = useOnboarding();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const seen = isHintSeen(id);

  // Don't show during tour
  const blocked = isTourActive
    || seen
    || (showAfter && !isHintSeen(showAfter))
    || progress.viewsVisited.length < delayVisits;

  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const gap = 12;
    switch (side) {
      case "top":
        setPosition({ top: rect.top - gap, left: rect.left + rect.width / 2 });
        break;
      case "bottom":
        setPosition({ top: rect.bottom + gap, left: rect.left + rect.width / 2 });
        break;
      case "left":
        setPosition({ top: rect.top + rect.height / 2, left: rect.left - gap });
        break;
      case "right":
        setPosition({ top: rect.top + rect.height / 2, left: rect.right + gap });
        break;
    }
  }, [side]);

  useEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const dismiss = () => {
    markSeen(id);
    setOpen(false);
  };

  if (blocked) return <>{children}</>;

  const translateStyle =
    side === "top" || side === "bottom"
      ? { transform: "translateX(-50%)" }
      : { transform: "translateY(-50%)" };

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {children}

      {/* Info badge */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute -top-1.5 -right-1.5 z-10 w-4 h-4 rounded-full bg-white border-2 border-teal-500 flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
        aria-label="Feature tip"
      >
        <Info size={8} className="text-teal-600" strokeWidth={3} />
      </button>

      {/* Popover */}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={popoverRef}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="fixed z-[55]"
              style={{ top: position.top, left: position.left, ...translateStyle }}
            >
              <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xl max-w-[260px]">
                {title && (
                  <p className="text-xs font-bold text-slate-900 mb-1">{title}</p>
                )}
                <p className="text-sm text-slate-700 leading-relaxed mb-3">{content}</p>
                <button
                  onClick={dismiss}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
                >
                  Got it
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
};

// Export both names for backward compatibility
export { Coachmark };
export { Coachmark as FeatureHint };
