import React from "react";

type EmptyStateProps = {
  icon: React.ReactNode;
  headline: string;
  description: string;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
  compact?: boolean;
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  headline,
  description,
  action,
  secondaryAction,
  compact = false,
}) => {
  return (
    <div className={`bg-white border border-slate-200 rounded-2xl ${compact ? "p-6" : "p-8"} text-center`}>
      <div className={`w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto ${compact ? "mb-2" : "mb-3"}`}>
        {icon}
      </div>
      <p className={`font-serif font-bold text-slate-600 ${compact ? "text-sm" : "text-base"} mb-1`}>
        {headline}
      </p>
      <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
        {description}
      </p>
      {(action || secondaryAction) && (
        <div className="flex items-center justify-center gap-3 mt-4">
          {action && (
            <button
              onClick={action.onClick}
              className="px-4 py-2 rounded-full bg-teal-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-teal-700 transition-colors"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="px-4 py-2 rounded-full border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-colors"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
