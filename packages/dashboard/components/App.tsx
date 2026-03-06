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
import { VaultView } from "./VaultView.js";
import { OnboardingProvider, useOnboarding } from "./OnboardingProvider.js";
import { WelcomeModal } from "./ui/WelcomeModal.js";
import { GuidedTour } from "./ui/GuidedTour.js";
import { OnboardingChecklist } from "./ui/OnboardingChecklist.js";

const AppInner: React.FC = () => {
  const [view, setView] = useState<DashboardView>("HOME");
  const [previousView, setPreviousView] = useState<DashboardView>("LIBRARY");
  const [selectedVideoCode, setSelectedVideoCode] = useState<string | null>(null);
  const [composerVideoCode, setComposerVideoCode] = useState<string | null>(null);
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
      <Layout currentView={view} onNavigate={setView}>
        {view === "LIBRARY" && (
          <ContentLibrary onSelectVideo={handleSelectVideo} />
        )}
        {view === "HOME" && (
          <DashboardHome onSelectVideo={handleSelectVideo} onNavigate={setView} />
        )}
        {view === "PIPELINE" && (
          <PipelineBoard onSelectVideo={handleSelectVideo} />
        )}
        {view === "CALENDAR" && <CalendarView />}
        {view === "SESSION" && <SessionView />}
        {view === "IDEAS" && <IdeasView />}
        {view === "OPPORTUNITIES" && <OpportunitiesView />}
        {view === "WATCHLIST" && <WatchlistView />}
        {view === "CAPTIONS" && <CaptionStudio />}
        {view === "VAULT" && <VaultView />}
        {view === "METRICS" && <MetricsView />}

        {selectedVideoCode && (
          <VideoDetail
            code={selectedVideoCode}
            onClose={handleCloseDetail}
            onOpenComposer={handleOpenComposer}
          />
        )}
      </Layout>

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
