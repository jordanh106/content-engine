import fs from "fs";
import path from "path";
import type { FormatId, FormatTimingData, SceneFlowEntry } from "../../shared/types.js";

// ============================================
// Format file mapping
// ============================================

const FORMAT_FILES: Record<FormatId, string> = {
  A: "explainer.md",
  B: "checklist.md",
  C: "demo.md",
  D: "myth-buster.md",
  E: "walkthrough.md",
  F: "quick-tip.md",
  G: "patient-story.md",
};

const FORMAT_NAMES: Record<FormatId, string> = {
  A: "Explainer",
  B: "Checklist",
  C: "Demo",
  D: "Myth Buster",
  E: "Walkthrough",
  F: "Quick Tip",
  G: "Patient Story",
};

// ============================================
// Duration parsing
// ============================================

/**
 * Parse the Duration column from a Scene Flow table row.
 * Handles patterns like:
 *   "0-3s (0-90f)"      -> { startTime: 0, endTime: 3, duration: 3 }
 *   "~5s each"           -> { duration: 5, isEach: true }
 *   "~6-8s each"         -> { duration: 7, isEach: true }
 *   "Variable"           -> { duration: null }
 *   "Final 3-5s"         -> { duration: 4, isFinal: true }
 *   "3s before CTA"      -> { duration: 3 }
 *   "3s"                 -> { duration: 3 }
 */
function parseDurationCell(raw: string): {
  startTime: number | null;
  endTime: number | null;
  duration: number | null;
  isEach: boolean;
  isFinal: boolean;
} {
  const text = raw.trim();

  // "Variable"
  if (/^variable$/i.test(text)) {
    return { startTime: null, endTime: null, duration: null, isEach: false, isFinal: false };
  }

  // "Final X-Ys" or "Final Xs"
  const finalMatch = text.match(/^Final\s+(\d+)(?:-(\d+))?s/i);
  if (finalMatch) {
    const min = parseInt(finalMatch[1], 10);
    const max = finalMatch[2] ? parseInt(finalMatch[2], 10) : min;
    return { startTime: null, endTime: null, duration: Math.round((min + max) / 2), isEach: false, isFinal: true };
  }

  // "~Xs each" or "~X-Ys each"
  const eachMatch = text.match(/^~?(\d+)(?:-(\d+))?s\s+each/i);
  if (eachMatch) {
    const min = parseInt(eachMatch[1], 10);
    const max = eachMatch[2] ? parseInt(eachMatch[2], 10) : min;
    return { startTime: null, endTime: null, duration: Math.round((min + max) / 2), isEach: true, isFinal: false };
  }

  // "X-Ys (Xf-Yf)" - absolute time range with frame info
  const rangeMatch = text.match(/^(\d+)-(\d+)s/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    return { startTime: start, endTime: end, duration: end - start, isEach: false, isFinal: false };
  }

  // "Xs before CTA" or plain "Xs"
  const plainMatch = text.match(/^(\d+)s/);
  if (plainMatch) {
    return { startTime: null, endTime: null, duration: parseInt(plainMatch[1], 10), isEach: false, isFinal: false };
  }

  return { startTime: null, endTime: null, duration: null, isEach: false, isFinal: false };
}

// ============================================
// Component parsing
// ============================================

/**
 * Parse the Component column from a Scene Flow table row.
 * Handles patterns like:
 *   "`HookText`"                          -> { type: "HookText", isRepeating: false }
 *   "`SectionCard` (per section)"         -> { type: "SectionCard", isRepeating: true, note: "per section" }
 *   "`MythTruthReveal` (type: \"myth\")"  -> { type: "MythTruthReveal", isRepeating: false }
 *   "Hold"                                -> { type: "Hold", isRepeating: false }
 */
function parseComponentCell(raw: string): {
  type: string;
  isRepeating: boolean;
  repeatingNote: string | null;
} {
  const text = raw.trim();

  // "Hold" (pause)
  if (/^hold$/i.test(text)) {
    return { type: "Hold", isRepeating: false, repeatingNote: null };
  }

  // Extract component name from backticks
  const compMatch = text.match(/`(\w+)`/);
  if (!compMatch) {
    return { type: text, isRepeating: false, repeatingNote: null };
  }

  const compType = compMatch[1];

  // Check for "(per xxx)" repeating pattern
  const repeatMatch = text.match(/\(per\s+(\w+)\)/i);
  if (repeatMatch) {
    return { type: compType, isRepeating: true, repeatingNote: `per ${repeatMatch[1]}` };
  }

  return { type: compType, isRepeating: false, repeatingNote: null };
}

// ============================================
// Main parser
// ============================================

export function parseFormatTiming(formatFilePath: string, formatId: FormatId): FormatTimingData {
  const content = fs.readFileSync(formatFilePath, "utf-8");
  const lines = content.split("\n");

  // Parse total duration from header: "**Duration:** 30-45 seconds"
  let totalMin = 30;
  let totalMax = 45;
  for (const line of lines) {
    const durMatch = line.match(/\*\*Duration:\*\*\s*(\d+)-(\d+)\s*seconds/);
    if (durMatch) {
      totalMin = parseInt(durMatch[1], 10);
      totalMax = parseInt(durMatch[2], 10);
      break;
    }
  }

  // Find the Scene Flow table
  const scenes: SceneFlowEntry[] = [];
  let inSceneFlow = false;
  let pastHeader = false;

  for (const line of lines) {
    // Detect "### Scene Flow" heading
    if (/^###\s+Scene Flow/i.test(line)) {
      inSceneFlow = true;
      pastHeader = false;
      continue;
    }

    // Stop at next heading
    if (inSceneFlow && /^###?\s/.test(line) && !/^###\s+Scene Flow/i.test(line)) {
      break;
    }

    if (!inSceneFlow) continue;

    // Skip non-table lines
    if (!line.trim().startsWith("|")) continue;

    // Skip header row and separator
    if (line.includes("Scene") && line.includes("Duration") && line.includes("Component")) {
      pastHeader = false;
      continue;
    }
    if (/^\|[\s-|]+\|$/.test(line.trim())) {
      pastHeader = true;
      continue;
    }

    if (!pastHeader) continue;

    // Parse table row: | Scene | Duration | Component | Animation | Spring Config |
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cells.length < 3) continue;

    const sceneName = cells[0];
    const durationInfo = parseDurationCell(cells[1]);
    const componentInfo = parseComponentCell(cells[2]);

    scenes.push({
      scene: sceneName,
      startTime: durationInfo.startTime ?? 0,
      endTime: durationInfo.endTime,
      duration: durationInfo.duration,
      componentType: componentInfo.type,
      isRepeating: componentInfo.isRepeating || durationInfo.isEach,
      repeatingNote: componentInfo.repeatingNote,
    });
  }

  // Assign sequential startTimes where not explicitly set
  resolveTimings(scenes, totalMax);

  return {
    formatId,
    formatName: FORMAT_NAMES[formatId],
    scenes,
    totalDuration: [totalMin, totalMax],
  };
}

/**
 * Walk through scenes and assign startTime / endTime
 * where they weren't explicitly parsed from the table.
 */
function resolveTimings(scenes: SceneFlowEntry[], totalDuration: number): void {
  let cursor = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];

    // If startTime was explicitly parsed, use it
    if (scene.startTime > 0) {
      cursor = scene.startTime;
    } else {
      scene.startTime = cursor;
    }

    // Calculate duration if known
    if (scene.duration !== null) {
      if (scene.endTime === null) {
        scene.endTime = cursor + scene.duration;
      }
      cursor = scene.endTime;
    } else if (scene.endTime !== null) {
      scene.duration = scene.endTime - scene.startTime;
      cursor = scene.endTime;
    } else {
      // Variable duration - estimate based on remaining time and remaining scenes
      const remainingScenes = scenes.slice(i + 1);
      const knownRemaining = remainingScenes.reduce((sum, s) => sum + (s.duration ?? 0), 0);
      const available = totalDuration - cursor - knownRemaining;
      scene.duration = Math.max(3, available);
      scene.endTime = cursor + scene.duration;
      cursor = scene.endTime;
    }
  }
}

// ============================================
// Cache and loader
// ============================================

let timingCache: Map<FormatId, FormatTimingData> | null = null;

export function loadAllFormatTimings(formatsDir: string): Map<FormatId, FormatTimingData> {
  if (timingCache) return timingCache;

  const result = new Map<FormatId, FormatTimingData>();

  for (const [formatId, filename] of Object.entries(FORMAT_FILES)) {
    const filePath = path.join(formatsDir, filename);
    if (fs.existsSync(filePath)) {
      result.set(formatId as FormatId, parseFormatTiming(filePath, formatId as FormatId));
    }
  }

  timingCache = result;
  return result;
}
