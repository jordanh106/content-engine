import React from "react";
import { ArrowRight } from "lucide-react";

type WorkflowCTAProps = {
  label: string;
  sublabel: string;
  onClick: () => void;
};

export const WorkflowCTA: React.FC<WorkflowCTAProps> = ({ label, sublabel, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center justify-between w-full px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl hover:bg-teal-100 transition-colors group text-left"
  >
    <div>
      <span className="text-sm font-semibold text-teal-800">{label}</span>
      <span className="block text-xs text-teal-600 mt-0.5">{sublabel}</span>
    </div>
    <ArrowRight size={16} className="text-teal-600 group-hover:translate-x-0.5 transition-transform shrink-0 ml-3" />
  </button>
);

type EmptyStateProps = {
  icon: React.ReactNode;
  headline: string;
  description: string;
  ctaLabel: string;
  onAction: () => void;
};

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, headline, description, ctaLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center max-w-md mx-auto">
    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
      {icon}
    </div>
    <h3 className="text-lg font-serif font-bold text-slate-900 mb-2">{headline}</h3>
    <p className="text-sm text-slate-500 mb-6">{description}</p>
    <button
      onClick={onAction}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-full text-sm font-bold hover:bg-teal-700 transition-colors"
    >
      {ctaLabel}
      <ArrowRight size={14} />
    </button>
  </div>
);
