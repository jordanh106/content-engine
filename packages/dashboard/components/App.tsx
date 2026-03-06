import React, { useState, useCallback, useEffect } from "react";
import type { DashboardView } from "../shared/types.js";
import { Layout } from "./Layout.js";
import { DashboardHome } from "./DashboardHome.js";
import { PipelineBoard } from "./PipelineBoard.js";
import { ContentLibrary } from "./ContentLibrary.js";
import { VideoDetail } from "./VideoDetail.js";
import { ComposerPage } from "./composer/ComposerPage.js";
import { MetricsView } from "./MetricsView.js";
import { IdeasView } from "./IdeasView.js";
import { WatchlistView } from "./WatchlistView.js";
import { OpportunitiesView } from "./OpportunitiesView.js";
import { SessionView } from "./SessionView.js";
import { CalendarView } from "./CalendarView.js";
import { CaptionStudio } from "./CaptionStudio.js";
import { VaultPanel } from "./VaultPanel.js";
import { CommandPalette } from "./CommandPalette.js";
import { OnboardingProvider, useOnboarding } from "./OnboardingProvider.js";
import { WelcomeModal } from "./ui/WelcomeModal.js";
import { GuidedTour } from "./ui/GuidedTour.js";
import { OnboardingChecklist } from "./ui/OnboardingChecklist.js";

const AppInner: React.FC = () => {
  const [view, setView] = useState<DashboardView>("HOME");
  const [previousView, setPreviousView] = useState<DashboardView>("LIBRARY");
  const [selectedVideoCode, setSelectedVideoCode] = useState<string | null>(null);
  const [composerVideoCode, setComposerVideoCode] = useState<string | null>(null);
  const [vaultOpen, setVaultOpen] = useState(false);
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

  // Cmd+K keyboard listener for command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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

  const handleOpenComposer = useCallback(
    (code: string) => {
      setPreviousView(view);
      setComposerVideoCode(code);
      setSelectedVideoCode(null);
      setView("COMPOSER");
    },
    [view],
  );

  const handleBackFromComposer = useCallback(() => {
    setView(previousView);
    if (composerVideoCode) {
      setSelectedVideoCode(composerVideoCode);
    }
    setComposerVideoCode(null);
  }, [previousView, composerVideoCode]);

  const handleOpenVault = useCallback(() => {
    setVaultOpen(true);
  }, []);

  const handleCloseVault = useCallback(() => {
    setVaultOpen(false);
  }, []);

  // Composer is a full-page view - rendered outside Layout
  if (view === "COMPOSER" && composerVideoCode) {
    return (
      <ComposerPage
        videoCode={composerVideoCode}
        onBack={handleBackFromComposer}
      />
    );
  }

  return (
    <>
      <Layout currentView={view} onNavigate={handleNavigate} onOpenVault={handleOpenVault}>
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

        {selectedVideoCode && (
          <VideoDetail
            code={selectedVideoCode}
            onClose={handleCloseDetail}
            onOpenComposer={handleOpenComposer}
          />
        )}
      </Layout>

      {/* Vault slide-out panel */}
      <VaultPanel open={vaultOpen} onClose={handleCloseVault} />

      {/* Command palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onNavigate={handleNavigate}
        onOpenVault={handleOpenVault}
      />

      <WelcomeModal />
      <GuidedTour />
      <OnboardingChecklist />
    </>
  );
};

export const App: React.FC = () => (
  <OnboardingProvider>
    <AppInner />
  </OnboardingProvider>
);
