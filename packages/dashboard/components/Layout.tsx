import React, { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Columns3,
  Library,
  Lightbulb,
  Radar,
  Eye,
  Calendar,
  Timer,
  TrendingUp,
  MessageSquareText,
  Bookmark,
  BookOpen,
  MoreHorizontal,
  ChevronDown,
  X,
  Bell,
  Brain,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DashboardView } from "../shared/types.js";
import { cn } from "../utils/cn.js";

type NavItem = {
  view: DashboardView;
  label: string;
  icon: React.ReactNode;
};

type NavGroup = {
  label: string;
  phase: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "DISCOVER",
    phase: "discover",
    items: [
      { view: "OPPORTUNITIES", label: "Opportunities", icon: <Radar size={18} /> },
      { view: "IDEAS", label: "Ideas", icon: <Lightbulb size={18} /> },
      { view: "WATCHLIST", label: "Watchlist", icon: <Eye size={18} /> },
    ],
  },
  {
    label: "PRODUCE",
    phase: "produce",
    items: [
      { view: "LIBRARY", label: "Library", icon: <Library size={18} /> },
      { view: "PIPELINE", label: "Pipeline", icon: <Columns3 size={18} /> },
      { view: "SESSION", label: "Session", icon: <Timer size={18} /> },
    ],
  },
  {
    label: "PUBLISH",
    phase: "publish",
    items: [
      { view: "CALENDAR", label: "Calendar", icon: <Calendar size={18} /> },
      { view: "CAPTIONS", label: "Captions", icon: <MessageSquareText size={18} /> },
    ],
  },
  {
    label: "MEASURE",
    phase: "measure",
    items: [
      { view: "METRICS", label: "Metrics", icon: <TrendingUp size={18} /> },
      { view: "STRATEGY", label: "Strategy", icon: <Brain size={18} /> },
    ],
  },
];

// Mobile: 4 core items always visible + More
const MOBILE_CORE: NavItem[] = [
  { view: "HOME", label: "Home", icon: <LayoutDashboard size={20} /> },
  { view: "LIBRARY", label: "Library", icon: <Library size={20} /> },
  { view: "PIPELINE", label: "Pipeline", icon: <Columns3 size={20} /> },
  { view: "METRICS", label: "Metrics", icon: <TrendingUp size={20} /> },
];

// All views in mobile "More" sheet (excluding core 4)
const MOBILE_CORE_VIEWS = new Set(MOBILE_CORE.map((i) => i.view));

function getCollapsedState(): Record<string, boolean> {
  try {
    const saved = localStorage.getItem("nav-collapsed");
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// Notification Bell Component
type Notification = {
  id: number;
  type: string;
  title: string;
  detail: string | null;
  targetView: string | null;
  read: boolean;
  createdAt: string;
};

const NotificationBell: React.FC<{ onNavigate: (view: DashboardView) => void }> = ({ onNavigate }) => {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["notifications"],
    queryFn: () => fetch("/api/analytics/notifications").then((r) => r.json()),
    refetchInterval: 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: () => fetch("/api/analytics/notifications/read-all", { method: "PUT" }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.unreadCount ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open && unread > 0) markReadMutation.mutate(); }}
        className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors relative"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-slate-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="p-3 border-b border-slate-100">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Notifications</p>
            </div>
            {(data?.notifications || []).length === 0 ? (
              <p className="p-4 text-xs text-slate-400 text-center">No notifications yet</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(data?.notifications || []).slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (n.targetView) onNavigate(n.targetView as DashboardView);
                      setOpen(false);
                    }}
                    className={cn("w-full text-left p-3 hover:bg-slate-50 transition-colors", !n.read && "bg-amber-50/50")}
                  >
                    <p className="text-xs font-medium text-slate-800">{n.title}</p>
                    {n.detail && <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{n.detail}</p>}
                    <p className="text-[9px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

type LayoutProps = {
  currentView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  onOpenVault?: () => void;
  onOpenGuide?: () => void;
  children: React.ReactNode;
};

export const Layout: React.FC<LayoutProps> = ({
  currentView,
  onNavigate,
  onOpenVault,
  onOpenGuide,
  children,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(getCollapsedState);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("nav-collapsed", JSON.stringify(collapsed));
  }, [collapsed]);

  const toggleGroup = (phase: string) => {
    setCollapsed((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  // Check if current view is in the "More" sheet items
  const currentInMore = !MOBILE_CORE_VIEWS.has(currentView);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 bg-white border-r border-slate-200 shrink-0 h-screen sticky top-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <h1 className="text-lg font-serif font-bold text-slate-900">Content Engine</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-0.5">
              Production Dashboard
            </p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell onNavigate={onNavigate} />
            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                title="Field Manual (?)"
              >
                <BookOpen size={18} />
              </button>
            )}
            {onOpenVault && (
              <button
                onClick={onOpenVault}
                className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                title="Open Vault"
              >
                <Bookmark size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Nav groups */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          {NAV_GROUPS.map((group) => (
            <div key={group.phase}>
              <button
                onClick={() => toggleGroup(group.phase)}
                className="flex items-center justify-between w-full px-2 pt-4 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600 transition-colors"
              >
                {group.label}
                <ChevronDown
                  size={12}
                  className={cn(
                    "transition-transform",
                    collapsed[group.phase] && "-rotate-90",
                  )}
                />
              </button>
              {!collapsed[group.phase] && (
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.view}
                      onClick={() => onNavigate(item.view)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors text-left w-full",
                        currentView === item.view
                          ? "bg-teal-50 text-teal-700 font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Home button at bottom */}
        <div className="border-t border-slate-200 px-3 py-2">
          <button
            onClick={() => onNavigate("HOME")}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full",
              currentView === "HOME"
                ? "bg-teal-50 text-teal-700 font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <LayoutDashboard size={18} />
            Home
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom tabs — Priority+ pattern */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
        <div className="flex">
          {MOBILE_CORE.map((item) => (
            <button
              key={item.view}
              onClick={() => {
                onNavigate(item.view);
                setMoreOpen(false);
              }}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors",
                currentView === item.view
                  ? "text-teal-600"
                  : "text-slate-400",
              )}
            >
              {currentView === item.view && (
                <span className="absolute top-0 w-6 h-0.5 bg-teal-600 rounded-full" />
              )}
              {item.icon}
              {item.label}
            </button>
          ))}
          {/* More button */}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors relative",
              currentInMore || moreOpen ? "text-teal-600" : "text-slate-400",
            )}
          >
            {currentInMore && !moreOpen && (
              <span className="absolute top-0 w-6 h-0.5 bg-teal-600 rounded-full" />
            )}
            <MoreHorizontal size={20} />
            More
          </button>
        </div>
      </nav>

      {/* Mobile "More" bottom sheet */}
      {moreOpen && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/30 z-50"
            onClick={() => setMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-[60] max-h-[70vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-sm font-bold text-slate-900">Navigate</h2>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            {NAV_GROUPS.map((group) => (
              <div key={group.phase} className="px-3 pb-2">
                <p className="px-2 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <button
                    key={item.view}
                    onClick={() => {
                      onNavigate(item.view);
                      setMoreOpen(false);
                    }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full",
                      currentView === item.view
                        ? "bg-teal-50 text-teal-700 font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
            {/* Vault & Guide in More sheet */}
            {(onOpenVault || onOpenGuide) && (
              <div className="px-3 pb-4 border-t border-slate-100 mt-1 pt-2 space-y-0.5">
                {onOpenGuide && (
                  <button
                    onClick={() => {
                      onOpenGuide();
                      setMoreOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left w-full"
                  >
                    <BookOpen size={18} />
                    Field Manual
                  </button>
                )}
                {onOpenVault && (
                  <button
                    onClick={() => {
                      onOpenVault();
                      setMoreOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left w-full"
                  >
                    <Bookmark size={18} />
                    Vault
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
