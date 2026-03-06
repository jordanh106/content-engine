import React, { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

type Position = { top: number; left: number; width: number; height: number };

type SpotlightProps = {
  targetSelector: string;
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  onDismiss: () => void;
  padding?: number;
};

function calcPopoverPosition(
  rect: Position,
  side: "top" | "bottom" | "left" | "right",
  popW: number,
  popH: number,
): { top: number; left: number } {
  const gap = 16;
  const isMobile = window.innerWidth < 768;
  const effectiveSide = isMobile && (side === "left" || side === "right") ? "bottom" : side;

  let top: number;
  let left: number;

  switch (effectiveSide) {
    case "top":
      top = rect.top - popH - gap;
      left = rect.left + rect.width / 2 - popW / 2;
      break;
    case "bottom":
      top = rect.top + rect.height + gap;
      left = rect.left + rect.width / 2 - popW / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2 - popH / 2;
      left = rect.left - popW - gap;
      break;
    case "right":
      top = rect.top + rect.height / 2 - popH / 2;
      left = rect.left + rect.width + gap;
      break;
  }

  // Clamp to viewport
  top = Math.max(12, Math.min(top, window.innerHeight - popH - 12));
  left = Math.max(12, Math.min(left, window.innerWidth - popW - 12));

  return { top, left };
}

export const Spotlight: React.FC<SpotlightProps> = ({
  targetSelector,
  content,
  side = "bottom",
  onDismiss,
  padding = 8,
}) => {
  const [targetRect, setTargetRect] = useState<Position | null>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef(0);

  const findAndPosition = useCallback(() => {
    const el = document.querySelector(targetSelector);
    if (!el) return false;

    // Scroll into view
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    const rect = el.getBoundingClientRect();
    const pos = {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    };
    setTargetRect(pos);
    return true;
  }, [targetSelector, padding]);

  // Find target element, retry if not found (view transition)
  useEffect(() => {
    attemptRef.current = 0;
    const tryFind = () => {
      if (findAndPosition()) return;
      attemptRef.current += 1;
      if (attemptRef.current < 10) {
        requestAnimationFrame(tryFind);
      }
    };
    // Small delay for view transitions
    setTimeout(tryFind, 50);
  }, [findAndPosition]);

  // Update popover position when target is found
  useEffect(() => {
    if (!targetRect || !popoverRef.current) return;
    const popRect = popoverRef.current.getBoundingClientRect();
    setPopoverPos(calcPopoverPosition(targetRect, side, popRect.width, popRect.height));
  }, [targetRect, side]);

  // Re-position on resize/scroll
  useEffect(() => {
    if (!targetRect) return;
    const handler = () => findAndPosition();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [targetRect, findAndPosition]);

  if (!targetRect) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[75]"
      >
        {/* Backdrop - click to dismiss */}
        <div
          className="absolute inset-0"
          onClick={onDismiss}
          style={{ cursor: "pointer" }}
        />

        {/* Spotlight cutout */}
        <div
          className="absolute rounded-2xl"
          style={{
            top: targetRect.top,
            left: targetRect.left,
            width: targetRect.width,
            height: targetRect.height,
            boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
            pointerEvents: "none",
          }}
        />

        {/* Popover */}
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ type: "spring", damping: 25, stiffness: 300, delay: 0.1 }}
          className="fixed z-[76]"
          style={{ top: popoverPos.top, left: popoverPos.left }}
        >
          {content}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
};
