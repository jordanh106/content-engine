import React from "react";
import {
  LayoutDashboard,
  Columns3,
  Library,
  Lightbulb,
  Eye,
  Calendar,
  Timer,
  TrendingUp,
} from "lucide-react";
import type { DashboardView } from "../shared/types.js";
import { cn } from "../utils/cn.js";

type NavItem = {
  view: DashboardView;
  label: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { view: "HOME", label: "Home", icon: <LayoutDashboard size={20} /> },
  { view: "PIPELINE", label: "Pipeline", icon: <Columns3 size={20} /> },
  { view: "LIBRARY", label: "Library", icon: <Library size={20} /> },
  { view: "IDEAS", label: "Ideas", icon: <Lightbulb size={20} /> },
  { view: "WATCHLIST", label: "Watchlist", icon: <Eye size={20} /> },
  { view: "CALENDAR", label: "Calendar", icon: <Calendar size={20} /> },
  { view: "SESSION", label: "Session", icon: <Timer size={20} /> },
  { view: "METRICS", label: "Metrics", icon: <TrendingUp size={20} /> },
];

type LayoutProps = {
  currentView: DashboardView;
  onNavigate: (view: DashboardView) => void;
  children: React.ReactNode;
};

export const Layout: React.FC<LayoutProps> = ({
  currentView,
  onNavigate,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 bg-white border-r border-slate-200 p-4 gap-1 shrink-0">
        <div className="px-3 py-4 mb-4">
          <h1 className="text-lg font-serif font-bold text-slate-900">Content Engine</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mt-1">
            Production Dashboard
          </p>
        </div>
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-left",
              currentView === item.view
                ? "bg-teal-50 text-teal-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex z-50">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={cn(
              "flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors",
              currentView === item.view
                ? "text-teal-600"
                : "text-slate-400",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
};
