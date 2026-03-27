import React, { useState } from "react";
import {
  TrendingUp,
  Radar,
  Lightbulb,
  Eye,
  Brain,
} from "lucide-react";
import { MetricsView } from "./MetricsView.js";
import { OpportunitiesView } from "./OpportunitiesView.js";
import { IdeasView } from "./IdeasView.js";
import { WatchlistView } from "./WatchlistView.js";
import type { DashboardView } from "../shared/types.js";
import { ScrollReveal } from "./ui/animations.js";

type IntelligenceTab = "performance" | "opportunities" | "ideas" | "watchlist";

const TABS: { key: IntelligenceTab; label: string; icon: React.ReactNode }[] = [
  { key: "performance", label: "Performance", icon: <TrendingUp size={15} /> },
  { key: "opportunities", label: "Opportunities", icon: <Radar size={15} /> },
  { key: "ideas", label: "Ideas", icon: <Lightbulb size={15} /> },
  { key: "watchlist", label: "Watchlist", icon: <Eye size={15} /> },
];

type IntelligenceViewProps = {
  onNavigate: (view: DashboardView) => void;
  initialTab?: IntelligenceTab;
};

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({
  onNavigate,
  initialTab = "performance",
}) => {
  const [activeTab, setActiveTab] = useState<IntelligenceTab>(initialTab);

  return (
    <div>
      {/* Tab header */}
      <div className="sticky top-0 z-20 bg-surface-body/80 backdrop-blur-xl border-b border-themed">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <ScrollReveal delay={0}>
            <div className="flex items-center gap-3 pt-4 pb-1">
              <Brain size={20} className="text-blue-400" />
              <h1 className="text-xl font-bold text-themed font-serif">Intelligence</h1>
            </div>
          </ScrollReveal>
          <div className="flex gap-1 mt-2 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold whitespace-nowrap transition-colors border-b-2 ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-400"
                    : "border-transparent text-themed-muted hover:text-themed-secondary"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content -- renders the existing view component */}
      <div>
        {activeTab === "performance" && <MetricsView onNavigate={onNavigate} />}
        {activeTab === "opportunities" && <OpportunitiesView onNavigate={onNavigate} />}
        {activeTab === "ideas" && <IdeasView onNavigate={onNavigate} />}
        {activeTab === "watchlist" && <WatchlistView onNavigate={onNavigate} />}
      </div>
    </div>
  );
};
