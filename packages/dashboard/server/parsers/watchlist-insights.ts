import fs from "fs";
import path from "path";
import type { WatchlistIntelReport, WatchlistIntelIdea, RisingCreator, SelfImprovementNotes } from "../../shared/types.js";

let cache: Map<string, WatchlistIntelReport> = new Map();
let cacheTimestamp = 0;

export function invalidateWatchlistIntelCache(): void {
  cache = new Map();
  cacheTimestamp = 0;
}

export function listWatchlistIntelDates(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir);
  return files
    .filter((f) => f.startsWith("watchlist-intel-") && f.endsWith(".md"))
    .map((f) => f.replace("watchlist-intel-", "").replace(".md", ""))
    .sort()
    .reverse();
}

function extractJsonBlock(content: string): {
  ideas: WatchlistIntelIdea[];
  risingCreators: RisingCreator[];
  selfImprovementNotes: SelfImprovementNotes;
} {
  const defaults = {
    ideas: [] as WatchlistIntelIdea[],
    risingCreators: [] as RisingCreator[],
    selfImprovementNotes: { bestQueries: [], mostActionableCreators: [], nextScanFocus: "" },
  };

  const match = content.match(/```json\n([\s\S]*?)\n```/);
  if (!match?.[1]) return defaults;

  try {
    const parsed = JSON.parse(match[1]);
    return {
      ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
      risingCreators: Array.isArray(parsed.risingCreators) ? parsed.risingCreators : [],
      selfImprovementNotes: parsed.selfImprovementNotes || defaults.selfImprovementNotes,
    };
  } catch {
    return defaults;
  }
}

export function parseWatchlistIntel(dir: string, date?: string): WatchlistIntelReport | null {
  if (!fs.existsSync(dir)) return null;

  const dates = listWatchlistIntelDates(dir);
  if (dates.length === 0) return null;

  const targetDate = date || dates[0];
  const filePath = path.join(dir, `watchlist-intel-${targetDate}.md`);

  if (!fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  const cached = cache.get(targetDate);
  if (cached && stat.mtimeMs <= cacheTimestamp) return cached;

  const content = fs.readFileSync(filePath, "utf-8");
  const extracted = extractJsonBlock(content);

  const report: WatchlistIntelReport = {
    date: targetDate,
    markdown: content,
    ideas: extracted.ideas,
    risingCreators: extracted.risingCreators,
    selfImprovementNotes: extracted.selfImprovementNotes,
    previousTopics: [],
  };

  cache.set(targetDate, report);
  cacheTimestamp = stat.mtimeMs;
  return report;
}

export function getLatestWatchlistIntel(dir: string): WatchlistIntelReport | null {
  return parseWatchlistIntel(dir);
}

export function getAllPreviousTopics(dir: string): string[] {
  const dates = listWatchlistIntelDates(dir);
  const topics = new Set<string>();

  for (const date of dates) {
    const report = parseWatchlistIntel(dir, date);
    if (report?.ideas) {
      for (const idea of report.ideas) {
        if (idea.topic) topics.add(idea.topic.toLowerCase().trim());
      }
    }
  }

  return Array.from(topics);
}
