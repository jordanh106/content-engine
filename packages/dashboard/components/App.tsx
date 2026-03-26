import React, { useState, useCallback, useEffect } from "react";
import type { DashboardView } from "../shared/types.js";
import { Layout } from "./Layout.js";
import { DashboardHome } from "./DashboardHome.js";
import { PipelineBoard } from "./PipelineBoard.js";
import { ContentLibrary } from "./ContentLibrary.js";
import { VideoDetail } from "./VideoDetail.js";
import { MetricsView } from "./MetricsView.js";
import { IdeasView } from "./IdeasView.js";
import { WatchlistView } from "./WatchlistView.js";
import { OpportunitiesView } from "./OpportunitiesView.js";
import { SessionView } from "./SessionView.js";
import { CalendarView } from "./CalendarView.js";
import { CaptionStudio } from "./CaptionStudio.js";
import { VaultPanel } from "./VaultPanel.js";
import { PersonaPanel } from "./PersonaPanel.js";
import { CommandPalette } from "./CommandPalette.js";
import { OnboardingProvider, useOnboarding } from "./OnboardingProvider.js";
import { CreatorProvider } from "./context/CreatorContext.js";
import { WelcomeModal } from "./ui/WelcomeModal.js";
import { GuidedTour } from "./ui/GuidedTour.js";
import { OnboardingChecklist } from "./ui/OnboardingChecklist.js";
import { FieldManual } from "./FieldManual.js";
import { PerformanceReviewView } from "./PerformanceReviewView.js";
import { CarouselLab } from "./CarouselLab.js";
import { DiscoverFeed } from "./DiscoverFeed.js";
import { ViewTransition } from "./ui/animations.js";

const AppInner: React.FC = () => {
  const [view, setView] = useState<DashboardView>("HOME");
  const [selectedVideoCode, setSelectedVideoCode] = useState<string | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [personasOpen, setPersonasOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const onboarding = useOnboarding();

  // Register navigation function with onboarding context
  useEffect(() => {
    onboarding.setOnNavigate(setView);
  }, [onboarding.setOnNavigate]);

  // Track view visits for checklist auto-completion
  useEffect(() => {
    onboarding.trackViewVisit(view);
  }, [view, onboarding.trackViewVisit]);

  // Track video detail open for checklist
  useEffect(() => {
    if (selectedVideoCode) {
      onboarding.trackEvent("open-detail");
    }
  }, [selectedVideoCode, onboarding.trackEvent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Skip shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement)?.isContentEditable) return;
      if (commandPaletteOpen) return;

      switch (e.key) {
        case "1": setView("HOME"); break;
        case "2": setView("OPPORTUNITIES"); break;
        case "3": setView("IDEAS"); break;
        case "4": setView("LIBRARY"); break;
        case "5": setView("PIPELINE"); break;
        case "6": setView("SESSION"); break;
        case "7": setView("CALENDAR"); break;
        case "8": setView("CAPTIONS"); break;
        case "9": setView("METRICS"); break;
        case "v": setVaultOpen((prev) => !prev); break;
        case "w": setView("WATCHLIST"); break;
        case "d": setView("DISCOVER_FEED"); break;
        case "?": setGuideOpen((prev) => !prev); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [commandPaletteOpen]);

  const handleNavigate = useCallback((target: DashboardView) => {
    setView(target);
    setCommandPaletteOpen(false);
  }, []);

  const handleSelectVideo = (code: string) => {
    setSelectedVideoCode(code);
  };

  const handleCloseDetail = () => {
    setSelectedVideoCode(null);
  };

  const handleOpenVault = useCallback(() => {
    setVaultOpen(true);
  }, []);

  const handleCloseVault = useCallback(() => {
    setVaultOpen(false);
  }, []);

  const handleOpenGuide = useCallback(() => {
    setGuideOpen(true);
  }, []);

  const handleCloseGuide = useCallback(() => {
    setGuideOpen(false);
  }, []);

  return (
    <>
      <Layout currentView={view} onNavigate={handleNavigate} onOpenVault={handleOpenVault} onOpenGuide={handleOpenGuide} onOpenPersonas={() => setPersonasOpen(true)}>
        <ViewTransition viewKey={view}>
          {view === "LIBRARY" && (
            <ContentLibrary onSelectVideo={handleSelectVideo} />
          )}
          {view === "HOME" && (
            <DashboardHome onSelectVideo={handleSelectVideo} onNavigate={handleNavigate} />
          )}
          {view === "PIPELINE" && (
            <PipelineBoard onSelectVideo={handleSelectVideo} onNavigate={handleNavigate} />
          )}
          {view === "CALENDAR" && <CalendarView onNavigate={handleNavigate} />}
          {view === "SESSION" && <SessionView onNavigate={handleNavigate} />}
          {view === "IDEAS" && <IdeasView onNavigate={handleNavigate} />}
          {view === "OPPORTUNITIES" && <OpportunitiesView onNavigate={handleNavigate} />}
          {view === "WATCHLIST" && <WatchlistView onNavigate={handleNavigate} />}
          {view === "CAPTIONS" && <CaptionStudio onNavigate={handleNavigate} />}
          {view === "METRICS" && <MetricsView onNavigate={handleNavigate} />}
          {view === "STRATEGY" && <PerformanceReviewView onNavigate={handleNavigate} />}
          {view === "CAROUSEL_LAB" && <CarouselLab onNavigate={handleNavigate} />}
          {view === "DISCOVER_FEED" && <DiscoverFeed onSelectVideo={handleSelectVideo} onNavigate={handleNavigate} />}
        </ViewTransition>

        {selectedVideoCode && (
          <VideoDetail
            code={selectedVideoCode}
            onClose={handleCloseDetail}
/>
        )}
      </Layout>

      {/* Vault slide-out panel */}
      <VaultPanel open={vaultOpen} onClose={handleCloseVault} />

      {/* Creator Personas panel */}
      {personasOpen && <PersonaPanel onClose={() => setPersonasOpen(false)} />}

      {/* Field Manual */}
      <FieldManual
        open={guideOpen}
        onClose={handleCloseGuide}
        currentView={view}
        onNavigate={(target) => { handleNavigate(target); setGuideOpen(false); }}
      />

      {/* Command palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={handleNavigate}
        onOpenVault={handleOpenVault}
        onOpenGuide={handleOpenGuide}
        onSelectVideo={handleSelectVideo}
      />

      <WelcomeModal />
      <GuidedTour />
      <OnboardingChecklist />
    </>
  );
};

export const App: React.FC = () => (
  <CreatorProvider>
    <OnboardingProvider>
      <AppInner />
    </OnboardingProvider>
  </CreatorProvider>
);
