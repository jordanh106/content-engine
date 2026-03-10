import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Info,
  AlertTriangle,
  CheckCircle2,
  Command,
} from "lucide-react";
import type { DashboardView } from "../shared/types.js";
import type { GuideBlock, GuideSection } from "../shared/help-content.js";
import { GUIDE_SECTIONS } from "../shared/help-content.js";
import { useOnboarding } from "./OnboardingProvider.js";
import { cn } from "../utils/cn.js";

type FieldManualProps = {
  open: boolean;
  onClose: () => void;
  currentView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  initialSection?: string;
};

const PHASE_LABELS: Record<string, { label: string; color: string; activeColor: string }> = {
  discover: { label: "Discover", color: "text-violet-600 bg-violet-50 border-violet-200", activeColor: "bg-violet-600 text-white border-violet-600" },
  produce: { label: "Produce", color: "text-sky-600 bg-sky-50 border-sky-200", activeColor: "bg-sky-600 text-white border-sky-600" },
  publish: { label: "Publish", color: "text-emerald-600 bg-emerald-50 border-emerald-200", activeColor: "bg-emerald-600 text-white border-emerald-600" },
  measure: { label: "Measure", color: "text-amber-600 bg-amber-50 border-amber-200", activeColor: "bg-amber-600 text-white border-amber-600" },
  reference: { label: "Reference", color: "text-slate-600 bg-slate-50 border-slate-200", activeColor: "bg-slate-600 text-white border-slate-600" },
};

// Map DashboardView to the guide section that matches
const VIEW_TO_SECTION: Partial<Record<DashboardView, string>> = {
  HOME: "getting-started",
  OPPORTUNITIES: "opportunities",
  IDEAS: "ideas",
  WATCHLIST: "watchlist",
  LIBRARY: "library",
  PIPELINE: "pipeline",
  SESSION: "sessions",
  CALENDAR: "calendar",
  CAPTIONS: "captions",
  METRICS: "metrics",
  VAULT: "vault",
};

// ============================================
// Block Renderer
// ============================================

const BlockRenderer: React.FC<{ block: GuideBlock; onNavigate: (view: DashboardView) => void; onClose: () => void }> = ({
  block,
  onNavigate,
  onClose,
}) => {
  switch (block.type) {
    case "paragraph":
      return <p className="text-sm text-slate-600 leading-relaxed">{block.text}</p>;

    case "heading":
      return <h4 className="text-xs font-bold text-slate-800 mt-3 mb-1 uppercase tracking-wide">{block.text}</h4>;

    case "tip":
      return (
        <div className="bg-slate-50 rounded-xl p-3">
          <p className="text-xs font-bold text-slate-800 mb-0.5">{block.label}</p>
          <p className="text-xs text-slate-500 leading-relaxed">{block.text}</p>
        </div>
      );

    case "shortcut":
      return (
        <div className="flex items-center gap-2 py-1">
          <div className="flex items-center gap-1">
            {block.keys.map((key) => (
              <kbd
                key={key}
                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-600 bg-slate-100 rounded border border-slate-200"
              >
                {key === "Cmd" ? <><Command size={10} className="mr-0.5" />Cmd</> : key}
              </kbd>
            ))}
          </div>
          <span className="text-xs text-slate-600">{block.description}</span>
        </div>
      );

    case "steps":
      return (
        <div>
          {block.title && <p className="text-xs font-bold text-slate-700 mb-1.5">{block.title}</p>}
          <ol className="space-y-1">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-2 text-xs text-slate-600 leading-relaxed">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      );

    case "table":
      return (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                {block.headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-bold text-slate-700 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className={cn(i % 2 === 1 && "bg-slate-50/50")}>
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 text-slate-600 whitespace-nowrap">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "callout": {
      const variants = {
        info: { border: "border-l-sky-500", bg: "bg-sky-50", text: "text-sky-800", icon: <Info size={14} className="text-sky-500" /> },
        warning: { border: "border-l-amber-500", bg: "bg-amber-50", text: "text-amber-800", icon: <AlertTriangle size={14} className="text-amber-500" /> },
        success: { border: "border-l-emerald-500", bg: "bg-emerald-50", text: "text-emerald-800", icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
      };
      const v = variants[block.variant];
      return (
        <div className={cn("flex items-start gap-2 rounded-lg border-l-4 p-3", v.border, v.bg)}>
          <span className="flex-shrink-0 mt-0.5">{v.icon}</span>
          <p className={cn("text-xs leading-relaxed", v.text)}>{block.text}</p>
        </div>
      );
    }

    case "navigate":
      return (
        <button
          onClick={() => { onNavigate(block.targetView); onClose(); }}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[10px] font-black uppercase tracking-widest bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors min-h-[44px]"
        >
          {block.label}
          <ArrowRight size={12} />
        </button>
      );

    default:
      return null;
  }
};

// ============================================
// Section Card
// ============================================

const SectionCard: React.FC<{
  section: GuideSection;
  isExpanded: boolean;
  isCurrentView: boolean;
  isRead: boolean;
  onToggle: () => void;
  onNavigate: (view: DashboardView) => void;
  onClose: () => void;
}> = ({ section, isExpanded, isCurrentView, isRead, onToggle, onNavigate, onClose }) => {
  const phase = PHASE_LABELS[section.phase];

  return (
    <div
      className={cn(
        "bg-white border rounded-2xl overflow-hidden transition-all",
        isCurrentView ? "border-l-4 border-l-teal-600 border-slate-200" : "border-slate-200",
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-4 text-left min-h-[44px] hover:bg-slate-50/50 transition-colors"
      >
        <span className="flex-shrink-0 mt-1 text-slate-400">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-slate-900">{section.title}</span>
            <span className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border", phase.color)}>
              {phase.label}
            </span>
            {isCurrentView && (
              <span className="text-[9px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full">
                You are here
              </span>
            )}
            {isRead && !isCurrentView && (
              <CheckCircle2 size={12} className="text-emerald-400" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{section.summary}</p>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pl-11 space-y-3">
              {section.content.map((block, i) => (
                <BlockRenderer key={i} block={block} onNavigate={onNavigate} onClose={onClose} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// Main FieldManual
// ============================================

export const FieldManual: React.FC<FieldManualProps> = ({
  open,
  onClose,
  currentView,
  onNavigate,
  initialSection,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const { guideSectionsRead, markGuideSectionRead, guideCompletionPercent } = useOnboarding();
  const scrollRef = useRef<HTMLDivElement>(null);
  const readTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Auto-expand current view's section on open
  useEffect(() => {
    if (open) {
      setSearchQuery("");
      setPhaseFilter(null);
      const target = initialSection || VIEW_TO_SECTION[currentView];
      if (target) {
        setExpandedSections(new Set([target]));
        // Scroll to section after render
        requestAnimationFrame(() => {
          const el = document.getElementById(`guide-section-${target}`);
          if (el && scrollRef.current) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      } else {
        setExpandedSections(new Set());
      }
    }
    return () => {
      // Clear all read timers on close
      readTimers.current.forEach((t) => clearTimeout(t));
      readTimers.current.clear();
    };
  }, [open, currentView, initialSection]);

  const toggleSection = useCallback((id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Clear read timer
        const timer = readTimers.current.get(id);
        if (timer) { clearTimeout(timer); readTimers.current.delete(id); }
      } else {
        next.add(id);
        // Start 3-second read timer
        const timer = setTimeout(() => {
          markGuideSectionRead(id);
          readTimers.current.delete(id);
        }, 3000);
        readTimers.current.set(id, timer);
      }
      return next;
    });
  }, [markGuideSectionRead]);

  // Filter sections by search and phase
  const filteredSections = useMemo(() => {
    let sections = GUIDE_SECTIONS;

    if (phaseFilter) {
      sections = sections.filter((s) => s.phase === phaseFilter);
    }

    if (searchQuery.trim().length >= 2) {
      const q = searchQuery.toLowerCase();
      sections = sections.filter((s) => {
        if (s.title.toLowerCase().includes(q)) return true;
        if (s.summary.toLowerCase().includes(q)) return true;
        if (s.keywords.some((k) => k.includes(q))) return true;
        // Search block text
        return s.content.some((block) => {
          if ("text" in block && typeof block.text === "string" && block.text.toLowerCase().includes(q)) return true;
          if ("label" in block && typeof block.label === "string" && block.label.toLowerCase().includes(q)) return true;
          if ("items" in block && Array.isArray(block.items) && block.items.some((item) => item.toLowerCase().includes(q))) return true;
          if ("description" in block && typeof block.description === "string" && block.description.toLowerCase().includes(q)) return true;
          return false;
        });
      });
    }

    return sections;
  }, [phaseFilter, searchQuery]);

  const readCount = guideSectionsRead.length;
  const totalCount = GUIDE_SECTIONS.length;

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 z-[100]"
          />

          {/* Panel: bottom sheet on mobile, right drawer on desktop */}
          <motion.div
            initial={{ y: "100%", x: 0 }}
            animate={{ y: 0, x: 0 }}
            exit={{ y: "100%", x: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 md:inset-y-0 md:inset-x-auto md:right-0 md:w-[560px] bg-white border-t md:border-t-0 md:border-l border-slate-200 rounded-t-2xl md:rounded-none z-[101] flex flex-col max-h-[90vh] md:max-h-none"
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pt-2 pb-1">
              <div className="w-8 h-1 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 pt-4 md:pt-5 pb-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search the field manual..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300"
                />
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Phase filter chips + progress */}
            <div className="px-5 py-3 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
                <button
                  onClick={() => setPhaseFilter(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors whitespace-nowrap flex-shrink-0",
                    !phaseFilter ? "bg-slate-900 text-white border-slate-900" : "text-slate-500 bg-white border-slate-200 hover:border-slate-300",
                  )}
                >
                  All
                </button>
                {Object.entries(PHASE_LABELS).map(([key, val]) => (
                  <button
                    key={key}
                    onClick={() => setPhaseFilter(phaseFilter === key ? null : key)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-colors whitespace-nowrap flex-shrink-0",
                      phaseFilter === key ? val.activeColor : cn(val.color, "hover:opacity-80"),
                    )}
                  >
                    {val.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      guideCompletionPercent === 100 ? "bg-emerald-500" : "bg-teal-500",
                    )}
                    style={{ width: `${guideCompletionPercent}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                  {readCount}/{totalCount} explored
                </span>
              </div>
            </div>

            {/* Sections list */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
              {filteredSections.length === 0 && (
                <div className="text-center py-12">
                  <Search size={24} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-500">No sections match your search.</p>
                </div>
              )}
              {filteredSections.map((section) => {
                const currentSectionId = VIEW_TO_SECTION[currentView];
                return (
                  <div key={section.id} id={`guide-section-${section.id}`}>
                    <SectionCard
                      section={section}
                      isExpanded={expandedSections.has(section.id)}
                      isCurrentView={section.id === currentSectionId}
                      isRead={guideSectionsRead.includes(section.id)}
                      onToggle={() => toggleSection(section.id)}
                      onNavigate={onNavigate}
                      onClose={onClose}
                    />
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 flex-shrink-0">
              <p className="text-[10px] text-slate-400 text-center">
                Press <kbd className="px-1 py-0.5 text-[9px] font-mono bg-slate-100 rounded border border-slate-200">?</kbd> to toggle this guide
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
};
