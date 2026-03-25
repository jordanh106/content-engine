import React, { useEffect, useState, useCallback, useRef } from "react";
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
  BookOpen,
  Zap,
  Search,
  ArrowRight,
  FileText,
  Hash,
  User,
  Layers,
  Compass,
} from "lucide-react";
import type { DashboardView } from "../shared/types.js";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: DashboardView) => void;
  onOpenVault: () => void;
  onOpenGuide?: () => void;
  onSelectVideo?: (code: string) => void;
};

type CommandItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  group: "navigation" | "actions";
  keywords?: string;
};

type SearchResult = {
  type: "video" | "idea" | "creator" | "hook";
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
};

const SEARCH_ICONS: Record<string, JSX.Element> = {
  video: <FileText size={14} className="text-teal-500" />,
  idea: <Lightbulb size={14} className="text-amber-500" />,
  creator: <User size={14} className="text-violet-500" />,
  hook: <Hash size={14} className="text-emerald-500" />,
};

const SEARCH_TYPE_LABELS: Record<string, string> = {
  video: "Video",
  idea: "Idea",
  creator: "Creator",
  hook: "Hook",
};

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onOpenChange,
  onNavigate,
  onOpenVault,
  onOpenGuide,
  onSelectVideo,
}) => {
  const [recentViews, setRecentViews] = useState<DashboardView[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load recent views from localStorage
  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem("recent-views");
        if (saved) setRecentViews(JSON.parse(saved));
      } catch { /* ignore */ }
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch { /* ignore */ }
    setIsSearching(false);
  }, []);

  const handleInputChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 200);
  }, [doSearch]);

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

  const handleSearchSelect = (result: SearchResult) => {
    switch (result.type) {
      case "video":
        if (onSelectVideo) {
          onSelectVideo(result.id);
          nav("LIBRARY");
        } else {
          nav("LIBRARY");
        }
        break;
      case "idea":
        nav("IDEAS");
        break;
      case "creator":
        nav("WATCHLIST");
        break;
      case "hook":
        onOpenVault();
        onOpenChange(false);
        break;
    }
  };

  type CommandItemWithShortcut = CommandItem & { shortcut?: string };

  const navigationItems: CommandItemWithShortcut[] = [
    { id: "home", label: "Home", icon: <LayoutDashboard size={16} />, action: () => nav("HOME"), group: "navigation", keywords: "dashboard overview", shortcut: "1" },
    { id: "discover", label: "Discover", icon: <Compass size={16} />, action: () => nav("DISCOVER_FEED"), group: "navigation", keywords: "discover feed trending outliers inspiration videos", shortcut: "D" },
    { id: "opportunities", label: "Opportunities", icon: <Radar size={16} />, action: () => nav("OPPORTUNITIES"), group: "navigation", keywords: "discover trends scoring", shortcut: "2" },
    { id: "ideas", label: "Ideas", icon: <Lightbulb size={16} />, action: () => nav("IDEAS"), group: "navigation", keywords: "idea bank brainstorm", shortcut: "3" },
    { id: "watchlist", label: "Watchlist", icon: <Eye size={16} />, action: () => nav("WATCHLIST"), group: "navigation", keywords: "creators competitors", shortcut: "W" },
    { id: "library", label: "Library", icon: <Library size={16} />, action: () => nav("LIBRARY"), group: "navigation", keywords: "content videos scripts", shortcut: "4" },
    { id: "pipeline", label: "Pipeline", icon: <Columns3 size={16} />, action: () => nav("PIPELINE"), group: "navigation", keywords: "production status kanban", shortcut: "5" },
    { id: "session", label: "Session", icon: <Timer size={16} />, action: () => nav("SESSION"), group: "navigation", keywords: "recording batch produce", shortcut: "6" },
    { id: "calendar", label: "Calendar", icon: <Calendar size={16} />, action: () => nav("CALENDAR"), group: "navigation", keywords: "schedule publish plan", shortcut: "7" },
    { id: "captions", label: "Captions", icon: <MessageSquareText size={16} />, action: () => nav("CAPTIONS"), group: "navigation", keywords: "caption studio hashtags", shortcut: "8" },
    { id: "metrics", label: "Metrics", icon: <TrendingUp size={16} />, action: () => nav("METRICS"), group: "navigation", keywords: "analytics performance views", shortcut: "9" },
  ];

  const actionItems: CommandItem[] = [
    { id: "vault", label: "Open Vault", icon: <Bookmark size={16} />, action: () => { onOpenVault(); onOpenChange(false); }, group: "actions", keywords: "hooks styles" },
    { id: "guide", label: "Open Field Manual", icon: <BookOpen size={16} />, action: () => { onOpenGuide?.(); onOpenChange(false); }, group: "actions", keywords: "help guide manual how to learn reference" },
    { id: "gen-opps", label: "Generate Opportunities", icon: <Zap size={16} />, action: () => nav("OPPORTUNITIES"), group: "actions", keywords: "ai analyze score" },
    { id: "run-research", label: "Run Research", icon: <Search size={16} />, action: () => nav("METRICS"), group: "actions", keywords: "last30days reddit x" },
    { id: "start-session", label: "Start Session", icon: <Timer size={16} />, action: () => nav("SESSION"), group: "actions", keywords: "record batch produce" },
    { id: "gen-carousel", label: "Generate Carousel", icon: <Layers size={16} />, action: () => nav("CAROUSEL_LAB"), group: "actions", keywords: "carousel thumbnail instagram linkedin tiktok slides" },
    { id: "export-backup", label: "Export Backup", icon: <FileText size={16} />, action: () => {
      window.open("/api/analytics/backup", "_blank");
      onOpenChange(false);
    }, group: "actions", keywords: "backup export download data" },
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
          shouldFilter={searchResults.length === 0}
        >
          <div className="flex items-center gap-3 px-4 border-b border-slate-200">
            <Search size={16} className="text-slate-400 shrink-0" />
            <Command.Input
              placeholder="Search videos, ideas, creators, or type a command..."
              className="w-full py-3.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none bg-transparent"
              autoFocus
              onValueChange={handleInputChange}
            />
            <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded border border-slate-200 shrink-0">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-[50vh] overflow-y-auto p-2">
            <Command.Empty className="px-4 py-8 text-center text-sm text-slate-500">
              {isSearching ? "Searching..." : "No results found."}
            </Command.Empty>

            {/* Content Search Results */}
            {searchResults.length > 0 && (
              <Command.Group heading="Content">
                {searchResults.map((result) => (
                  <Command.Item
                    key={`search-${result.type}-${result.id}`}
                    value={`search ${result.title} ${result.subtitle}`}
                    onSelect={() => handleSearchSelect(result)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-700 cursor-pointer data-[selected=true]:bg-teal-50 data-[selected=true]:text-teal-700"
                  >
                    {SEARCH_ICONS[result.type]}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      <div className="text-[10px] text-slate-400 truncate">{result.subtitle}</div>
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-300 shrink-0">
                      {SEARCH_TYPE_LABELS[result.type]}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Recent */}
            {recentViews.length > 0 && searchResults.length === 0 && (
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
                  <span className="flex-1">{item.label}</span>
                  {item.shortcut && (
                    <kbd className="hidden md:inline-flex px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 rounded border border-slate-200">{item.shortcut}</kbd>
                  )}
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
