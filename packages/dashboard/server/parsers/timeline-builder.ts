import type {
  ParsedVideo,
  FormatTimingData,
  TimelineItem,
  VibeMotionComponent,
} from "../../shared/types.js";

/**
 * Build a unified timeline that interleaves cinema shots and
 * motion graphics based on the format's Scene Flow timing.
 */
export function buildTimeline(
  video: ParsedVideo,
  components: VibeMotionComponent[],
  formatTiming: FormatTimingData,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  // Track which components have been placed
  const placedComponentIds = new Set<string>();

  // Track which cinema shots have been placed
  const placedShotNumbers = new Set<number>();

  // ========================================
  // 1. Place motion graphics using Scene Flow
  // ========================================

  for (const scene of formatTiming.scenes) {
    // Skip "Hold" scenes (pauses with no component)
    if (scene.componentType === "Hold") continue;

    // Find matching components for this scene
    const matching = components.filter(
      (c) => c.componentType === scene.componentType && !placedComponentIds.has(c.id),
    );

    if (matching.length === 0) continue;

    if (scene.isRepeating) {
      // Repeating scenes: place all matching components sequentially
      const perItemDuration = scene.duration ?? 5;
      let cursor = scene.startTime;

      for (const comp of matching) {
        const dur = comp.durationInSeconds || perItemDuration;
        items.push({
          id: `mg-${comp.id}`,
          type: "motion-graphic",
          startTime: cursor,
          duration: dur,
          label: comp.label,
          sceneName: scene.scene,
          component: comp,
        });
        placedComponentIds.add(comp.id);
        cursor += dur;
      }
    } else {
      // Non-repeating: place the first matching component
      const comp = matching[0];
      const dur = comp.durationInSeconds || scene.duration || 3;
      items.push({
        id: `mg-${comp.id}`,
        type: "motion-graphic",
        startTime: scene.startTime,
        duration: dur,
        label: comp.label,
        sceneName: scene.scene,
        component: comp,
      });
      placedComponentIds.add(comp.id);
    }
  }

  // Place any remaining unmatched components at the end
  const unplaced = components.filter((c) => !placedComponentIds.has(c.id));
  if (unplaced.length > 0) {
    // Find the latest endTime from placed items
    let cursor = items.reduce((max, item) => Math.max(max, item.startTime + item.duration), 0);

    for (const comp of unplaced) {
      const dur = comp.durationInSeconds || 3;
      items.push({
        id: `mg-${comp.id}`,
        type: "motion-graphic",
        startTime: cursor,
        duration: dur,
        label: comp.label,
        sceneName: null,
        component: comp,
      });
      cursor += dur;
    }
  }

  // ========================================
  // 2. Place cinema shots
  // ========================================

  // Cinema shots are placed sequentially using their duration.
  // They run alongside (not replacing) the motion graphics,
  // representing the filmed footage that plays behind/with the graphics.
  let shotCursor = 0;

  for (const shot of video.shots) {
    if (placedShotNumbers.has(shot.number)) continue;

    items.push({
      id: `cs-${shot.number}`,
      type: "cinema-shot",
      startTime: shotCursor,
      duration: shot.duration,
      label: shot.prompt.length > 50 ? `${shot.prompt.slice(0, 47)}...` : shot.prompt,
      sceneName: findSceneForTime(formatTiming, shotCursor),
      shot,
    });

    placedShotNumbers.add(shot.number);
    shotCursor += shot.duration;
  }

  // Sort by type (cinema first for each time slot), then by startTime
  items.sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime - b.startTime;
    // Cinema shots before motion graphics at same start time
    if (a.type === "cinema-shot" && b.type !== "cinema-shot") return -1;
    if (a.type !== "cinema-shot" && b.type === "cinema-shot") return 1;
    return 0;
  });

  return items;
}

/**
 * Find which scene a given time falls within.
 */
function findSceneForTime(formatTiming: FormatTimingData, time: number): string | null {
  for (const scene of formatTiming.scenes) {
    const end = scene.endTime ?? scene.startTime + (scene.duration ?? 0);
    if (time >= scene.startTime && time < end) {
      return scene.scene;
    }
  }
  return null;
}
