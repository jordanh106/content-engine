const STORAGE_PREFIX = "ce_hint_";

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
