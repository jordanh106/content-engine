import React from "react";
import { X } from "lucide-react";
import { clsx } from "clsx";

type Props = {
  eyebrow?: string;
  title: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  right?: React.ReactNode;
  className?: string;
};

/**
 * ModalHeader — editorial white header used across every modal / sheet / dialog.
 *
 * Replaces ad-hoc dark gradients and inconsistent header treatments. White surface,
 * teal eyebrow, serif title — aligns with .impeccable's "editorial over industrial" principle.
 */
export const ModalHeader: React.FC<Props> = ({ eyebrow, title, icon, onClose, right, className }) => {
  return (
    <div className={clsx("px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {icon && <span className="text-teal-600 shrink-0">{icon}</span>}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-teal-700 truncate">{eyebrow}</p>
          )}
          <p className="text-lg font-serif font-bold text-slate-900 truncate">{title}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {right}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};
