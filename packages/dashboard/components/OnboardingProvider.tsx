import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { OnboardingProgress, DashboardView } from "../shared/types.js";
import { CHECKLIST_ITEMS, CHANGELOG, GUIDE_SECTIONS } from "../shared/help-content.js";
import {
  getOnboardingProgress,
  updateOnboardingProgress,
  getChangelogState,
  updateChangelogState,
  isHintSeen as isHintSeenUtil,
  markHintSeen as markHintSeenUtil,
  resetAll as resetAllUtil,
} from "../utils/hints.js";

type OnboardingContextValue = {
  progress: OnboardingProgress;
  isFirstVisit: boolean;

  // Tour controls
  isTourActive: boolean;
  currentTourStep: number;
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;

  // Welcome
  completeWelcome: () => void;

  // Checklist
  checklistCompleted: Record<string, boolean>;
  completionPercent: number;
  isChecklistDismissed: boolean;
  markChecklistDone: (id: string) => void;
  dismissChecklist: () => void;
  trackEvent: (eventId: string) => void;

  // Guide section tracking
  guideSectionsRead: string[];
  markGuideSectionRead: (id: string) => void;
  guideCompletionPercent: number;

  // Hints
  isHintSeen: (id: string) => boolean;
  markHintSeen: (id: string) => void;
  resetAll: () => void;

  // Changelog
  hasUnseenChanges: boolean;
  dismissChangelog: () => void;

  // View tracking
  trackViewVisit: (view: DashboardView) => void;

  // Navigation hook (set by App.tsx)
  onNavigate: ((view: DashboardView) => void) | null;
  setOnNavigate: (fn: (view: DashboardView) => void) => void;
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within OnboardingProvider");
  return ctx;
}

export const OnboardingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [progress, setProgress] = useState<OnboardingProgress>(getOnboardingProgress);
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [hintVersion, setHintVersion] = useState(0);
  const [onNavigate, setOnNavigateState] = useState<((view: DashboardView) => void) | null>(null);

  const isFirstVisit = !progress.welcomeCompleted;

  // Sync progress to localStorage
  const updateProgress = useCallback((partial: Partial<OnboardingProgress>) => {
    setProgress((prev) => {
      const next = { ...prev, ...partial };
      updateOnboardingProgress(next);
      return next;
    });
  }, []);

  // Welcome
  const completeWelcome = useCallback(() => {
    updateProgress({ welcomeCompleted: true });
  }, [updateProgress]);

  // Tour controls
  const startTour = useCallback(() => {
    setCurrentTourStep(0);
    setIsTourActive(true);
    updateProgress({ tourStep: 0 });
  }, [updateProgress]);

  const nextStep = useCallback(() => {
    setCurrentTourStep((prev) => {
      const next = prev + 1;
      updateProgress({ tourStep: next });
      return next;
    });
  }, [updateProgress]);

  const prevStep = useCallback(() => {
    setCurrentTourStep((prev) => {
      const next = Math.max(0, prev - 1);
      updateProgress({ tourStep: next });
      return next;
    });
  }, [updateProgress]);

  const skipTour = useCallback(() => {
    setIsTourActive(false);
    updateProgress({ tourCompleted: true });
  }, [updateProgress]);

  const completeTour = useCallback(() => {
    setIsTourActive(false);
    updateProgress({ tourCompleted: true });
  }, [updateProgress]);

  // Checklist
  const checklistCompleted = progress.checklist;
  const completionPercent = Math.round(
    (CHECKLIST_ITEMS.filter((item) => checklistCompleted[item.id]).length / CHECKLIST_ITEMS.length) * 100,
  );
  const isChecklistDismissed = completionPercent === 100 || !!progress.checklist._dismissed;

  const markChecklistDone = useCallback(
    (id: string) => {
      if (checklistCompleted[id]) return;
      updateProgress({ checklist: { ...progress.checklist, [id]: true } });
    },
    [checklistCompleted, progress.checklist, updateProgress],
  );

  const dismissChecklist = useCallback(() => {
    updateProgress({ checklist: { ...progress.checklist, _dismissed: true } });
  }, [progress.checklist, updateProgress]);

  const trackEvent = useCallback(
    (eventId: string) => {
      const item = CHECKLIST_ITEMS.find((i) => i.eventId === eventId);
      if (item && !checklistCompleted[item.id]) {
        markChecklistDone(item.id);
      }
    },
    [checklistCompleted, markChecklistDone],
  );

  // Track view visits
  const trackViewVisit = useCallback(
    (view: DashboardView) => {
      if (!progress.viewsVisited.includes(view)) {
        updateProgress({ viewsVisited: [...progress.viewsVisited, view] });
      }
    },
    [progress.viewsVisited, updateProgress],
  );

  // Auto-track checklist events from view visits
  useEffect(() => {
    const viewEventMap: Record<string, string> = {
      LIBRARY: "visit-library",
      IDEAS: "visit-ideas",
      CALENDAR: "visit-calendar",
    };
    for (const view of progress.viewsVisited) {
      const eventId = viewEventMap[view];
      if (eventId) trackEvent(eventId);
    }
  }, [progress.viewsVisited, trackEvent]);

  // Guide section tracking
  const guideSectionsRead = progress.guideSectionsRead || [];
  const guideCompletionPercent = Math.round(
    (guideSectionsRead.length / Math.max(GUIDE_SECTIONS.length, 1)) * 100,
  );
  const markGuideSectionRead = useCallback(
    (id: string) => {
      if (guideSectionsRead.includes(id)) return;
      updateProgress({ guideSectionsRead: [...guideSectionsRead, id] });
    },
    [guideSectionsRead, updateProgress],
  );

  // Hints
  const isHintSeen = useCallback(
    (id: string) => {
      void hintVersion; // reactive dependency
      return isHintSeenUtil(id);
    },
    [hintVersion],
  );

  const markHintSeen = useCallback(
    (id: string) => {
      markHintSeenUtil(id);
      setHintVersion((v) => v + 1);
    },
    [],
  );

  const resetAllOnboarding = useCallback(() => {
    resetAllUtil();
    setProgress(getOnboardingProgress());
    setHintVersion((v) => v + 1);
  }, []);

  // Changelog
  const changelogState = getChangelogState();
  const latestVersion = CHANGELOG[0]?.version ?? "0.0.0";
  const hasUnseenChanges = latestVersion !== changelogState.lastSeenVersion && progress.welcomeCompleted;

  const dismissChangelog = useCallback(() => {
    updateChangelogState(latestVersion);
  }, [latestVersion]);

  const setOnNavigate = useCallback((fn: (view: DashboardView) => void) => {
    setOnNavigateState(() => fn);
  }, []);

  const value: OnboardingContextValue = {
    progress,
    isFirstVisit,
    isTourActive,
    currentTourStep,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    completeWelcome,
    checklistCompleted,
    completionPercent,
    isChecklistDismissed,
    markChecklistDone,
    dismissChecklist,
    trackEvent,
    guideSectionsRead,
    markGuideSectionRead,
    guideCompletionPercent,
    isHintSeen,
    markHintSeen,
    resetAll: resetAllOnboarding,
    hasUnseenChanges,
    dismissChangelog,
    onNavigate,
    setOnNavigate,
    trackViewVisit,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
};
