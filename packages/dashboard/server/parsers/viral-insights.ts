import fs from "fs";
import path from "path";
import type { IntelDigest, TrendingTopic, HookPattern, FormatTrend, ContentGap } from "../../shared/types.js";

let cache: Map<string, IntelDigest> = new Map();
let cacheTimestamp = 0;

export function invalidateIntelCache(): void {
  cache = new Map();
  cacheTimestamp = 0;
}

function parseTrendingTopics(lines: string[]): TrendingTopic[] {
  const topics: TrendingTopic[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-")) continue;
    // Format: "- Topic Name (Platforms) - Context, engagement"
    const match = trimmed.match(/^-\s+(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$/);
    if (match) {
      const context = match[3].trim();
      const engMatch = context.match(/(\d+-?\d*%?\s*engagement)/i);
      topics.push({
        topic: match[1].trim(),
        platforms: match[2].split("/").map((p) => p.trim()),
        context: context.replace(/,?\s*\d+-?\d*%?\s*engagement/i, "").trim(),
        engagementRange: engMatch ? engMatch[1] : "",
      });
    }
  }
  return topics;
}

function parseHookPatterns(lines: string[]): HookPattern[] {
  const patterns: HookPattern[] = [];
  let currentType = "";
  for (const line of lines) {
    const trimmed = line.trim();
    // Type header lines (no dash prefix): "Question Hooks", "Statistics", "Pattern Interrupts", etc.
    if (trimmed && !trimmed.startsWith("-") && !trimmed.startsWith('"')) {
      currentType = trimmed.replace(/\s*Hooks?\s*$/i, "").trim();
      continue;
    }
    // Hook line: - "Hook text" (Platform, Priority)
    const match = trimmed.match(/^-\s+"([^"]+)"\s*\(([^,]+),\s*([^)]+)\)/);
    if (match) {
      patterns.push({
        type: currentType || "General",
        text: match[1],
        platform: match[2].trim(),
        priority: match[3].trim(),
      });
    }
  }
  return patterns;
}

function parseFormatTrends(lines: string[]): FormatTrend[] {
  const trends: FormatTrend[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Format: "A (Explainer) - Platform notes"
    const match = trimmed.match(/^([A-G])\s*\(([^)]+)\)\s*-\s*(.+)$/);
    if (match) {
      trends.push({
        format: match[1],
        trend: match[3].trim(),
        platforms: match[2].trim(),
      });
    }
  }
  return trends;
}

function parseContentGaps(lines: string[]): ContentGap[] {
  const gaps: ContentGap[] = [];
  let currentArea = "";
  const descLines: string[] = [];

  const flush = () => {
    if (currentArea && descLines.length > 0) {
      gaps.push({ area: currentArea, description: descLines.join(". ").replace(/\.\./g, ".") });
      descLines.length = 0;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Area header (no dash prefix, no number prefix)
    if (!trimmed.startsWith("-") && !trimmed.startsWith("Format:")) {
      flush();
      currentArea = trimmed;
    } else if (trimmed.startsWith("-")) {
      descLines.push(trimmed.slice(1).trim());
    }
  }
  flush();
  return gaps;
}

function parseRecommendedIdeas(lines: string[]): string[] {
  const ideas: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Lines starting with number or dash
    const match = trimmed.match(/^(?:\d+\.\s*)?-?\s*"?(.+)"?\s*$/);
    if (match && trimmed.length > 5) {
      ideas.push(trimmed.replace(/^\d+\.\s*/, "").trim());
    }
  }
  return ideas;
}

function parseNextActions(lines: string[]): string[] {
  const actions: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^\d+\.\s*(.+)$/);
    if (match) {
      actions.push(match[1].trim());
    }
  }
  return actions;
}

function parseCreatorHighlights(lines: string[]): string[] {
  const creators: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("-") || trimmed.startsWith("@")) {
      creators.push(trimmed.replace(/^-\s*/, "").trim());
    }
  }
  return creators;
}

function extractSection(content: string, sectionNum: number): string[] {
  // Find section by number prefix: "1. SECTION NAME", "2. SECTION NAME", etc.
  const sectionRegex = new RegExp(`^${sectionNum}\\.\\s+.+$`, "m");
  const nextSectionRegex = new RegExp(`^${sectionNum + 1}\\.\\s+.+$`, "m");

  const startMatch = content.match(sectionRegex);
  if (!startMatch || startMatch.index === undefined) return [];

  const startIdx = startMatch.index + startMatch[0].length;
  const endMatch = content.slice(startIdx).match(nextSectionRegex);
  const endIdx = endMatch && endMatch.index !== undefined ? startIdx + endMatch.index : undefined;

  const sectionContent = endIdx ? content.slice(startIdx, endIdx) : content.slice(startIdx);

  // Also stop at "---" dividers or end-of-file markers
  const dividerIdx = sectionContent.indexOf("\n---");
  const finalContent = dividerIdx >= 0 ? sectionContent.slice(0, dividerIdx) : sectionContent;

  return finalContent.split("\n").filter((l) => l.trim().length > 0);
}

function parseDigest(content: string, date: string): IntelDigest {
  return {
    date,
    trendingTopics: parseTrendingTopics(extractSection(content, 1)),
    hookPatterns: parseHookPatterns(extractSection(content, 2)),
    formatTrends: parseFormatTrends(extractSection(content, 3)),
    creatorHighlights: parseCreatorHighlights(extractSection(content, 4)),
    contentGaps: parseContentGaps(extractSection(content, 5)),
    recommendedIdeas: parseRecommendedIdeas(extractSection(content, 6)),
    nextActions: parseNextActions(extractSection(content, 7)),
  };
}

export function listDigestDates(viralInsightsDir: string): string[] {
  if (!fs.existsSync(viralInsightsDir)) return [];
  const files = fs.readdirSync(viralInsightsDir);
  return files
    .filter((f) => f.startsWith("intel-") && f.endsWith(".md"))
    .map((f) => f.replace("intel-", "").replace(".md", ""))
    .sort()
    .reverse();
}

export function parseViralInsights(viralInsightsDir: string, date?: string): IntelDigest | null {
  if (!fs.existsSync(viralInsightsDir)) return null;

  const dates = listDigestDates(viralInsightsDir);
  if (dates.length === 0) return null;

  const targetDate = date || dates[0];
  const filePath = path.join(viralInsightsDir, `intel-${targetDate}.md`);

  if (!fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  const cached = cache.get(targetDate);
  if (cached && stat.mtimeMs <= cacheTimestamp) return cached;

  const content = fs.readFileSync(filePath, "utf-8");
  const digest = parseDigest(content, targetDate);

  cache.set(targetDate, digest);
  cacheTimestamp = stat.mtimeMs;
  return digest;
}
