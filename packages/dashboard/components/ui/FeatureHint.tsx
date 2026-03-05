import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { isHintSeen, markHintSeen } from "../../utils/hints.js";

type FeatureHintProps = {
  id: string;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement;
};

export const FeatureHint: React.FC<FeatureHintProps> = ({
  id,
  content,
  side = "bottom",
  children,
}) => {
  const [seen, setSeen] = useState(() => isHintSeen(id));
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

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

  const dismiss = () => {
    markHintSeen(id);
    setSeen(true);
    setOpen(false);
  };

  if (seen) return <>{children}</>;

  const translateStyle =
    side === "top" || side === "bottom"
      ? { transform: "translateX(-50%)" }
      : { transform: "translateY(-50%)" };

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      {children}

      {/* Pulsing dot */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute -top-1 -right-1 z-10 w-3 h-3 flex items-center justify-center"
        aria-label="Feature tip"
      >
        <span className="absolute w-3 h-3 rounded-full bg-teal-400 animate-ping opacity-75" />
        <span className="relative w-2 h-2 rounded-full bg-teal-500" />
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
                <p className="text-sm text-slate-700 leading-relaxed mb-3">{content}</p>
                <button
                  onClick={dismiss}
                  className="text-[10px] font-black uppercase tracking-widest text-teal-600 hover:text-teal-700 transition-colors"
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
