import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import {
  Radar,
  Lightbulb,
  Eye,
  Library,
  Columns3,
  Timer,
  Calendar,
  MessageSquareText,
  TrendingUp,
  LayoutDashboard,
  Bookmark,
  Zap,
  Search,
  ArrowRight,
} from "lucide-react";
import type { DashboardView } from "../shared/types.js";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: DashboardView) => void;
  onOpenVault: () => void;
};

type CommandItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  group: "navigation" | "actions";
  keywords?: string;
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  onNavigate,
  onOpenVault,
}) => {
  const [recentViews, setRecentViews] = useState<DashboardView[]>([]);

  // Load recent views from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("recent-views");
      if (saved) setRecentViews(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [open]);

  const trackRecent = (view: DashboardView) => {
    const updated = [view, ...recentViews.filter((v) => v !== view)].slice(0, 3);
    setRecentViews(updated);
    localStorage.setItem("recent-views", JSON.stringify(updated));
  };

  const nav = (view: DashboardView) => {
    trackRecent(view);
    onNavigate(view);
    onOpenChange(false);
  };

  const navigationItems: CommandItem[] = [
    { id: "home", label: "Home", icon: <LayoutDashboard size={16} />, action: () => nav("HOME"), group: "navigation", keywords: "dashboard overview" },
    { id: "opportunities", label: "Opportunities", icon: <Radar size={16} />, action: () => nav("OPPORTUNITIES"), group: "navigation", keywords: "discover trends scoring" },
    { id: "ideas", label: "Ideas", icon: <Lightbulb size={16} />, action: () => nav("IDEAS"), group: "navigation", keywords: "idea bank brainstorm" },
    { id: "watchlist", label: "Watchlist", icon: <Eye size={16} />, action: () => nav("WATCHLIST"), group: "navigation", keywords: "creators competitors" },
    { id: "library", label: "Library", icon: <Library size={16} />, action: () => nav("LIBRARY"), group: "navigation", keywords: "content videos scripts" },
    { id: "pipeline", label: "Pipeline", icon: <Columns3 size={16} />, action: () => nav("PIPELINE"), group: "navigation", keywords: "production status kanban" },
    { id: "session", label: "Session", icon: <Timer size={16} />, action: () => nav("SESSION"), group: "navigation", keywords: "recording batch produce" },
    { id: "calendar", label: "Calendar", icon: <Calendar size={16} />, action: () => nav("CALENDAR"), group: "navigation", keywords: "schedule publish plan" },
    { id: "captions", label: "Captions", icon: <MessageSquareText size={16} />, action: () => nav("CAPTIONS"), group: "navigation", keywords: "caption studio hashtags" },
    { id: "metrics", label: "Metrics", icon: <TrendingUp size={16} />, action: () => nav("METRICS"), group: "navigation", keywords: "analytics performance views" },
  ];

  const actionItems: CommandItem[] = [
    { id: "vault", label: "Open Vault", icon: <Bookmark size={16} />, action: () => { onOpenVault(); onOpenChange(false); }, group: "actions", keywords: "hooks styles" },
    { id: "gen-opps", label: "Generate Opportunities", icon: <Zap size={16} />, action: () => nav("OPPORTUNITIES"), group: "actions", keywords: "ai analyze score" },
    { id: "run-research", label: "Run Research", icon: <Search size={16} />, action: () => nav("METRICS"), group: "actions", keywords: "last30days reddit x" },
    { id: "start-session", label: "Start Session", icon: <Timer size={16} />, action: () => nav("SESSION"), group: "actions", keywords: "record batch produce" },
  ];

  const VIEW_LABELS: Record<string, string> = {
    HOME: "Home",
    OPPORTUNITIES: "Opportunities",
    IDEAS: "Ideas",
    WATCHLIST: "Watchlist",
    LIBRARY: "Library",
    PIPELINE: "Pipeline",
    SESSION: "Session",
    CALENDAR: "Calendar",
    CAPTIONS: "Captions",
    METRICS: "Metrics",
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="absolute left-1/2 top-[20%] -translate-x-1/2 w-[90%] max-w-lg">
        <Command
          className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          label="Command Palette"
        >
          <div className="flex items-center gap-3 px-4 border-b border-slate-200">
            <Search size={16} className="text-slate-400 shrink-0" />
            <Command.Input
              placeholder="Type a command or search..."
              className="w-full py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
              autoFocus
            />
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded border border-slate-200 shrink-0">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-slate-500">
              No results found.
            </Command.Empty>

            {/* Recent */}
            {recentViews.length > 0 && (
              <Command.Group heading="Recent">
                {recentViews.map((v) => (
                  <Command.Item
                    key={`recent-${v}`}
                    value={`recent ${v.toLowerCase()}`}
                    onSelect={() => nav(v)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-700 cursor-pointer data-[selected=true]:bg-teal-50 data-[selected=true]:text-teal-700"
                  >
                    <ArrowRight size={14} className="text-slate-400" />
                    {VIEW_LABELS[v] ?? v}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Navigation */}
            <Command.Group heading="Navigation">
              {navigationItems.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.label} ${item.keywords ?? ""}`}
                  onSelect={item.action}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-700 cursor-pointer data-[selected=true]:bg-teal-50 data-[selected=true]:text-teal-700"
                >
                  <span className="text-slate-400">{item.icon}</span>
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>

            {/* Actions */}
            <Command.Group heading="Actions">
              {actionItems.map((item) => (
                <Command.Item
                  key={item.id}
                  value={`${item.label} ${item.keywords ?? ""}`}
                  onSelect={item.action}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-700 cursor-pointer data-[selected=true]:bg-teal-50 data-[selected=true]:text-teal-700"
                >
                  <span className="text-teal-500">{item.icon}</span>
                  {item.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
};
