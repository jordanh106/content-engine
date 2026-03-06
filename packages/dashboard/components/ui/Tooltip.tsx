import React, { useState, useRef, useCallback, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

type TooltipProps = {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  delay?: number;
  maxWidth?: number;
  children: React.ReactElement;
};

type Position = { top: number; left: number };

function calcPosition(
  rect: DOMRect,
  side: "top" | "bottom" | "left" | "right",
  tipW: number,
  tipH: number,
): Position {
  const gap = 8;
  switch (side) {
    case "top":
      return { top: rect.top - tipH - gap, left: rect.left + rect.width / 2 - tipW / 2 };
    case "bottom":
      return { top: rect.bottom + gap, left: rect.left + rect.width / 2 - tipW / 2 };
    case "left":
      return { top: rect.top + rect.height / 2 - tipH / 2, left: rect.left - tipW - gap };
    case "right":
      return { top: rect.top + rect.height / 2 - tipH / 2, left: rect.right + gap };
  }
}

function clampPosition(pos: Position, tipW: number, tipH: number): Position {
  return {
    top: Math.max(8, Math.min(pos.top, window.innerHeight - tipH - 8)),
    left: Math.max(8, Math.min(pos.left, window.innerWidth - tipW - 8)),
  };
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  side = "top",
  delay = 300,
  maxWidth = 240,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isTouchRef = useRef(false);
  const isHoveringTipRef = useRef(false);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !tipRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tipRect = tipRef.current.getBoundingClientRect();
    const pos = calcPosition(rect, side, tipRect.width, tipRect.height);
    setPosition(clampPosition(pos, tipRect.width, tipRect.height));
  }, [side]);

  useEffect(() => {
    if (visible) updatePosition();
  }, [visible, updatePosition]);

  const show = useCallback(() => {
    if (isTouchRef.current) return;
    timerRef.current = setTimeout(() => setVisible(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    // Small delay to allow moving to the tooltip content
    setTimeout(() => {
      if (!isHoveringTipRef.current) {
        setVisible(false);
      }
    }, 100);
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "touch") {
      isTouchRef.current = true;
      setVisible((v) => !v);
    }
  }, []);

  // Keyboard: show on focus, hide on blur
  const handleFocus = useCallback(() => {
    if (isTouchRef.current) return;
    setVisible(true);
  }, []);

  const handleBlur = useCallback(() => {
    setVisible(false);
  }, []);

  // Escape key dismiss (WCAG 1.4.13)
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setVisible(false);
        e.stopPropagation();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [visible]);

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!visible || !isTouchRef.current) return;
    const handler = (e: PointerEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        tipRef.current &&
        !tipRef.current.contains(e.target as Node)
      ) {
        setVisible(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [visible]);

  // Reset touch flag on mouse move
  useEffect(() => {
    const handler = () => { isTouchRef.current = false; };
    document.addEventListener("mousemove", handler, { once: true });
    return () => document.removeEventListener("mousemove", handler);
  }, []);

  // Tooltip hover handlers (WCAG 1.4.13 - hoverable)
  const handleTipMouseEnter = useCallback(() => {
    isHoveringTipRef.current = true;
  }, []);

  const handleTipMouseLeave = useCallback(() => {
    isHoveringTipRef.current = false;
    setVisible(false);
  }, []);

  const child = React.cloneElement(children, {
    ref: triggerRef,
    onMouseEnter: show,
    onMouseLeave: hide,
    onPointerDown: handlePointerDown,
    onFocus: handleFocus,
    onBlur: handleBlur,
    "aria-describedby": visible ? tooltipId : undefined,
  } as Record<string, unknown>);

  return (
    <>
      {child}
      {createPortal(
        <AnimatePresence>
          {visible && (
            <motion.div
              ref={tipRef}
              id={tooltipId}
              role="tooltip"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[60]"
              style={{ top: position.top, left: position.left, maxWidth }}
              onMouseEnter={handleTipMouseEnter}
              onMouseLeave={handleTipMouseLeave}
            >
              <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-lg leading-relaxed">
                {content}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
};
