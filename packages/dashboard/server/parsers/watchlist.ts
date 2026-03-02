import fs from "fs";
import type { WatchlistCreator } from "../../shared/types.js";

let cache: WatchlistCreator[] | null = null;
let cacheTimestamp = 0;

export function invalidateWatchlistCache(): void {
  cache = null;
  cacheTimestamp = 0;
}

export function parseWatchlist(filePath: string): WatchlistCreator[] {
  if (!fs.existsSync(filePath)) return [];

  const stat = fs.statSync(filePath);
  if (cache && stat.mtimeMs <= cacheTimestamp) return cache;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const creators: WatchlistCreator[] = [];
  let inActiveSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect the Active Watchlist section
    if (line.match(/^##\s+Active Watchlist/)) {
      inActiveSection = true;
      continue;
    }
    // Any other ## section ends the active section
    if (line.match(/^##\s+/) && inActiveSection) {
      inActiveSection = false;
      continue;
    }

    if (!inActiveSection) continue;
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    if (line.toLowerCase().includes("| handle")) continue;

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    // Handle, Platform, Followers, Why Tracking, Content Style, Frequency, Last Analyzed
    if (cells.length >= 2 && cells[0]) {
      creators.push({
        handle: cells[0],
        platform: cells[1] || "",
        followers: cells[2] || "",
        whyTracking: cells[3] || "",
        contentStyle: cells[4] || "",
        frequency: cells[5] || "",
        lastAnalyzed: cells[6] || "",
      });
    }
  }

  cache = creators;
  cacheTimestamp = stat.mtimeMs;
  return creators;
}
