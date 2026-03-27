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
  Users,
  LayoutGrid,
  Compass,
  Wand2,
  Zap,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DashboardView, CreatorPersona } from "../shared/types.js";
import { cn } from "../utils/cn.js";
import { useCreator } from "./context/CreatorContext.js";
import { ThemeToggle } from "./ui/ThemeToggle.js";

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
    label: "CREATE",
    phase: "create",
    items: [
      { view: "DISCOVER_FEED", label: "Discover", icon: <Compass size={18} /> },
      { view: "SCRIPT_WIZARD", label: "Create", icon: <Wand2 size={18} /> },
      { view: "LIBRARY", label: "Library", icon: <Library size={18} /> },
    ],
  },
  {
    label: "PRODUCE",
    phase: "produce",
    items: [
      { view: "PIPELINE", label: "Pipeline", icon: <Columns3 size={18} /> },
      { view: "SESSION", label: "Session", icon: <Timer size={18} /> },
    ],
  },
  {
    label: "ANALYZE",
    phase: "analyze",
    items: [
      { view: "INTELLIGENCE", label: "Intelligence", icon: <Brain size={18} /> },
      { view: "CALENDAR", label: "Calendar", icon: <Calendar size={18} /> },
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
        className="p-1.5 rounded-lg text-themed-muted hover:text-amber-600 hover:bg-amber-50 transition-colors relative"
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
          <div className="absolute right-0 top-full mt-2 w-72 bg-surface-elevated border border-themed rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="p-3 border-b border-themed-subtle">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Notifications</p>
            </div>
            {(data?.notifications || []).length === 0 ? (
              <p className="p-4 text-xs text-themed-muted text-center">No notifications yet</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {(data?.notifications || []).slice(0, 10).map((n) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      if (n.targetView) onNavigate(n.targetView as DashboardView);
                      setOpen(false);
                    }}
                    className={cn("w-full text-left p-3 hover:bg-surface-hover transition-colors", !n.read && "bg-amber-50/50")}
                  >
                    <p className="text-xs font-medium text-themed">{n.title}</p>
                    {n.detail && <p className="text-[10px] text-themed-tertiary mt-0.5 line-clamp-2">{n.detail}</p>}
                    <p className="text-[9px] text-themed-muted mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
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

const AVATAR_COLOR_MAP: Record<string, string> = {
  teal: "bg-teal-600",
  violet: "bg-violet-600",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  sky: "bg-sky-500",
};

const SidebarCreatorFooter: React.FC<{ onManage: () => void }> = ({ onManage }) => {
  const { selectedCreatorId, setSelectedCreatorId } = useCreator();
  const { data } = useQuery<{ personas: CreatorPersona[] }>({
    queryKey: ["personas"],
    queryFn: () => fetch("/api/personas").then((r) => r.json()),
    staleTime: 60_000,
  });
  const personas = data?.personas ?? [];
  if (personas.length === 0) return null;

  const active = personas.find((p) => p.id === selectedCreatorId) ?? null;

  return (
    <div className="border-t border-themed px-4 py-3 space-y-2">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-themed-muted">Creating as</p>
      {/* Avatar pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {personas.map((p) => {
          const isSelected = selectedCreatorId === p.id;
          const avatarCls = AVATAR_COLOR_MAP[p.avatarColor ?? "teal"] ?? "bg-teal-600";
          return (
            <button
              key={p.id}
              onClick={() => setSelectedCreatorId(isSelected ? null : p.id)}
              title={p.name}
              className={cn(
                "flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[10px] font-bold transition-all border",
                isSelected
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-surface-elevated text-themed-secondary border-themed hover:border-themed"
              )}
            >
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 text-white", avatarCls)}>
                {p.initials ?? p.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate max-w-[80px]">{p.name}</span>
              {isSelected && <span className="text-teal-400 text-[9px]">✓</span>}
            </button>
          );
        })}
      </div>
      {!active && (
        <p className="text-[9px] text-themed-muted italic">No creator selected — using brand voice</p>
      )}
      <button
        onClick={onManage}
        className="text-[9px] font-bold text-themed-muted hover:text-teal-600 transition-colors"
      >
        Manage creators →
      </button>
    </div>
  );
};

const MobileCreatorSwitcher: React.FC<{ onManage: () => void }> = ({ onManage }) => {
  const { selectedCreatorId, setSelectedCreatorId } = useCreator();
  const { data } = useQuery<{ personas: CreatorPersona[] }>({
    queryKey: ["personas"],
    queryFn: () => fetch("/api/personas").then((r) => r.json()),
    staleTime: 60_000,
  });
  const personas = data?.personas ?? [];
  if (personas.length === 0) return null;

  return (
    <div className="px-3 pb-3 border-t border-themed-subtle mt-1 pt-3">
      <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Creating as</p>
      <div className="px-2 flex items-center gap-1.5 flex-wrap">
        {personas.map((p) => {
          const isSelected = selectedCreatorId === p.id;
          const avatarCls = AVATAR_COLOR_MAP[p.avatarColor ?? "teal"] ?? "bg-teal-600";
          return (
            <button
              key={p.id}
              onClick={() => setSelectedCreatorId(isSelected ? null : p.id)}
              title={p.name}
              className={cn(
                "flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[10px] font-bold transition-all border",
                isSelected
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-surface-elevated text-themed-secondary border-themed hover:border-themed"
              )}
            >
              <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 text-white", avatarCls)}>
                {p.initials ?? p.name.slice(0, 2).toUpperCase()}
              </span>
              <span className="truncate max-w-[80px]">{p.name}</span>
              {isSelected && <span className="text-teal-400 text-[9px]">✓</span>}
            </button>
          );
        })}
      </div>
      <button
        onClick={onManage}
        className="mt-2 px-2 text-[9px] font-bold text-themed-muted hover:text-teal-600 transition-colors"
      >
        Manage creators →
      </button>
    </div>
  );
};

type LayoutProps = {
  currentView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  onOpenVault?: () => void;
  onOpenGuide?: () => void;
  onOpenPersonas?: () => void;
  children: React.ReactNode;
};

export const Layout: React.FC<LayoutProps> = ({
  currentView,
  onNavigate,
  onOpenVault,
  onOpenGuide,
  onOpenPersonas,
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
    <div className="min-h-screen bg-surface-body flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 bg-surface-secondary/80 backdrop-blur-xl border-r border-themed shrink-0 h-screen sticky top-0">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <h1 className="text-lg font-serif font-bold text-themed">Content Engine</h1>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mt-0.5">
              Production Dashboard
            </p>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell onNavigate={onNavigate} />
            <ThemeToggle />
            {onOpenGuide && (
              <button
                onClick={onOpenGuide}
                className="p-1.5 rounded-lg text-themed-muted hover:text-sky-400 hover:bg-surface-hover transition-colors"
                title="Field Manual (?)"
              >
                <BookOpen size={18} />
              </button>
            )}
            {onOpenVault && (
              <button
                onClick={onOpenVault}
                className="p-1.5 rounded-lg text-themed-muted hover:text-teal-400 hover:bg-surface-hover transition-colors"
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
                className="flex items-center justify-between w-full px-2 pt-4 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted hover:text-themed-secondary transition-colors"
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
                          ? "bg-[var(--accent-light)] text-[var(--accent)] font-semibold accent-glow"
                          : "text-themed-secondary hover:bg-surface-hover hover:text-themed",
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

        {/* Creator switcher footer */}
        {onOpenPersonas && <SidebarCreatorFooter onManage={onOpenPersonas} />}

        {/* Home button at bottom */}
        <div className="border-t border-themed px-3 py-2">
          <button
            onClick={() => onNavigate("HOME")}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left w-full",
              currentView === "HOME"
                ? "bg-[var(--accent-light)] text-[var(--accent)] font-semibold accent-glow"
                : "text-themed-secondary hover:bg-surface-hover hover:text-themed",
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-secondary border-t border-themed z-50">
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
                  : "text-themed-muted",
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
              currentInMore || moreOpen ? "text-teal-600" : "text-themed-muted",
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
          <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-elevated rounded-t-2xl z-[60] max-h-[70vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-sm font-bold text-themed">Navigate</h2>
              <button
                onClick={() => setMoreOpen(false)}
                className="p-1 rounded-lg text-themed-muted hover:text-themed-secondary"
              >
                <X size={18} />
              </button>
            </div>
            {NAV_GROUPS.map((group) => (
              <div key={group.phase} className="px-3 pb-2">
                <p className="px-2 pt-2 pb-1 text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">
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
                        : "text-themed-secondary hover:bg-surface-hover hover:text-slate-900",
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
            {/* Creator quick-switch in More sheet */}
            {onOpenPersonas && (
              <MobileCreatorSwitcher onManage={() => { onOpenPersonas(); setMoreOpen(false); }} />
            )}
            {/* Vault & Guide in More sheet */}
            {(onOpenVault || onOpenGuide) && (
              <div className="px-3 pb-4 border-t border-themed-subtle mt-1 pt-2 space-y-0.5">
                {onOpenGuide && (
                  <button
                    onClick={() => {
                      onOpenGuide();
                      setMoreOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-themed-secondary hover:bg-surface-hover hover:text-slate-900 transition-colors text-left w-full"
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
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-themed-secondary hover:bg-surface-hover hover:text-slate-900 transition-colors text-left w-full"
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
