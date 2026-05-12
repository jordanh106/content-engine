import React, { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { clsx } from "clsx";
import { IconButton } from "./IconButton.js";

export type KebabItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  kbd?: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

type Props = {
  items: (KebabItem | "divider")[];
  triggerLabel?: string;
  triggerIcon?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
};

/**
 * KebabMenu — overflow menu button (⋯) for toolbar secondary actions.
 *
 * Click trigger → menu opens. Click anywhere outside or press Esc → closes.
 * Menu items can include keyboard shortcut hints right-aligned. Use `"divider"`
 * in the items array to insert a horizontal divider between sections.
 */
export const KebabMenu: React.FC<Props> = ({ items, triggerLabel = "More actions", triggerIcon, align = "right", className }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={clsx("relative inline-block", className)}>
      <IconButton
        icon={triggerIcon ?? <MoreHorizontal />}
        label={triggerLabel}
        variant="secondary"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      />
      {open && (
        <div
          role="menu"
          className={clsx(
            "absolute z-50 mt-2 min-w-[220px] surface-floating py-1.5",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => {
            if (item === "divider") {
              return <div key={`div-${i}`} className="my-1 border-t border-slate-100" role="separator" />;
            }
            return (
              <button
                key={item.id}
                role="menuitem"
                onClick={() => { setOpen(false); item.onSelect(); }}
                disabled={item.disabled}
                className={clsx(
                  "w-full flex items-center justify-between gap-3 px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                  item.destructive
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-slate-700 hover:bg-slate-50",
                )}
              >
                <span className="inline-flex items-center gap-2.5">
                  {item.icon && (
                    <span className={item.destructive ? "text-rose-500" : "text-slate-400"}>
                      {React.isValidElement(item.icon)
                        ? React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 15 })
                        : item.icon}
                    </span>
                  )}
                  {item.label}
                </span>
                {item.kbd && (
                  <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.kbd}</kbd>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
