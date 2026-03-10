import type { OnboardingProgress } from "../shared/types.js";

const STORAGE_PREFIX = "ce_hint_";
const ONBOARD_KEY = "ce_onboard_progress";
const CHANGELOG_KEY = "ce_changelog_dismissed";

// ============================================
// Feature Hints (existing)
// ============================================

export function isHintSeen(id: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === "1";
  } catch {
    return false;
  }
}

export function markHintSeen(id: string): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, "1");
  } catch {
    /* silently fail (private browsing) */
  }
}

export function resetAllHints(): void {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* silently fail */
  }
}

// ============================================
// Onboarding Progress
// ============================================

const DEFAULT_PROGRESS: OnboardingProgress = {
  welcomeCompleted: false,
  tourCompleted: false,
  tourStep: 0,
  checklist: {},
  firstVisitDate: new Date().toISOString().split("T")[0],
  viewsVisited: [],
  guideSectionsRead: [],
};

export function getOnboardingProgress(): OnboardingProgress {
  try {
    const raw = localStorage.getItem(ONBOARD_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export function updateOnboardingProgress(partial: Partial<OnboardingProgress>): void {
  try {
    const current = getOnboardingProgress();
    localStorage.setItem(ONBOARD_KEY, JSON.stringify({ ...current, ...partial }));
  } catch {
    /* silently fail */
  }
}

// ============================================
// Changelog State
// ============================================

export function getChangelogState(): { lastSeenVersion: string } {
  try {
    const raw = localStorage.getItem(CHANGELOG_KEY);
    if (!raw) return { lastSeenVersion: "0.0.0" };
    return JSON.parse(raw);
  } catch {
    return { lastSeenVersion: "0.0.0" };
  }
}

export function updateChangelogState(version: string): void {
  try {
    localStorage.setItem(CHANGELOG_KEY, JSON.stringify({ lastSeenVersion: version }));
  } catch {
    /* silently fail */
  }
}

// ============================================
// Full Reset (onboarding + hints + changelog)
// ============================================

export function resetAll(): void {
  try {
    resetAllHints();
    localStorage.removeItem(ONBOARD_KEY);
    localStorage.removeItem(CHANGELOG_KEY);
  } catch {
    /* silently fail */
  }
}
