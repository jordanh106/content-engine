import fs from "fs";
import path from "path";
import type { ResearchIdea } from "../../shared/types.js";
import { parseIdeaBank } from "./idea-bank.js";

let cache: ResearchIdea[] | null = null;
let cacheTimestamp = 0;

export function invalidateResearchCache(): void {
  cache = null;
  cacheTimestamp = 0;
}

/**
 * Extract trending topic context from Section 1.
 * Format: `- Topic Name (Platforms) - Context text`
 */
function extractTrendingContext(content: string): Map<string, { context: string; platforms: string[] }> {
  const map = new Map<string, { context: string; platforms: string[] }>();
  const sectionMatch = content.match(/1\.\s*TRENDING\s+TOPICS\s*\n([\s\S]*?)(?:\n\d+\.\s|\n---|\n\*|$)/i);
  if (!sectionMatch) return map;

  for (const line of sectionMatch[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-")) continue;
    const match = trimmed.match(/^-\s+(.+?)\s*\(([^)]+)\)\s*-\s*(.+)$/);
    if (match) {
      // Store with lowercase key words for fuzzy matching
      const keywords = match[1].trim().toLowerCase().split(/\s+/);
      const entry = { context: match[3].trim(), platforms: match[2].split("/").map((p) => p.trim()) };
      // Store under each significant keyword for matching
      map.set(match[1].trim().toLowerCase(), entry);
      for (const kw of keywords) {
        if (kw.length > 3) map.set(kw, entry);
      }
    }
  }
  return map;
}

/**
 * Extract content gap descriptions from Section 5.
 * Format: Area name followed by bullet points with details.
 */
function extractGapContext(content: string): Map<string, string> {
  const map = new Map<string, string>();
  const sectionMatch = content.match(/5\.\s*CONTENT\s+GAPS\s*(?:&\s*OPPORTUNITIES)?\s*\n([\s\S]*?)(?:\n\d+\.\s|\n---|\n\*|$)/i);
  if (!sectionMatch) return map;

  let currentArea = "";
  const descriptions: string[] = [];

  const flush = () => {
    if (currentArea && descriptions.length > 0) {
      const desc = descriptions.join(". ").replace(/\.\./g, ".");
      const keywords = currentArea.toLowerCase().split(/\s+/);
      map.set(currentArea.toLowerCase(), desc);
      for (const kw of keywords) {
        if (kw.length > 3) map.set(kw, desc);
      }
      descriptions.length = 0;
    }
  };

  for (const line of sectionMatch[1].split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (!trimmed.startsWith("-") && !trimmed.startsWith("Format:")) {
      flush();
      currentArea = trimmed;
    } else if (trimmed.startsWith("-")) {
      descriptions.push(trimmed.slice(1).trim());
    }
  }
  flush();
  return map;
}

/**
 * Match an idea topic against trending/gap context using fuzzy keyword matching.
 */
function findMatchingContext(topic: string, contextMap: Map<string, { context: string; platforms: string[] }>): { context: string; platforms: string[] } | null {
  const topicLower = topic.toLowerCase();
  // Direct match
  if (contextMap.has(topicLower)) return contextMap.get(topicLower)!;
  // Keyword match
  const topicWords = topicLower.split(/\s+/).filter((w) => w.length > 3);
  for (const word of topicWords) {
    if (contextMap.has(word)) return contextMap.get(word)!;
  }
  return null;
}

function findMatchingGap(topic: string, gapMap: Map<string, string>): string | null {
  const topicLower = topic.toLowerCase();
  if (gapMap.has(topicLower)) return gapMap.get(topicLower)!;
  const topicWords = topicLower.split(/\s+/).filter((w) => w.length > 3);
  for (const word of topicWords) {
    if (gapMap.has(word)) return gapMap.get(word)!;
  }
  return null;
}

/**
 * Extract idea suggestions from a single intel digest (n8n Content Intelligence output).
 * Section 6 format: `- Topic | Format | "Hook" | Platform | Priority`
 * Cross-references Sections 1 and 5 for context enrichment.
 */
function extractFromIntelDigest(content: string, fileName: string, date: string): ResearchIdea[] {
  const ideas: ResearchIdea[] = [];

  // Pre-extract context from Sections 1 and 5
  const trendingContext = extractTrendingContext(content);
  const gapContext = extractGapContext(content);

  // Find Section 6: RECOMMENDED CONTENT IDEAS
  const sectionMatch = content.match(/6\.\s*RECOMMENDED\s+CONTENT\s+IDEAS\s*\n([\s\S]*?)(?:\n\d+\.\s|\n---|\n\*|$)/i);
  if (!sectionMatch) return ideas;

  const lines = sectionMatch[1].split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-")) continue;

    // Parse pipe-delimited: - Topic | Format | "Hook" | Platform | Priority
    const parts = trimmed.slice(1).split("|").map((p) => p.trim());
    if (parts.length >= 3) {
      const topic = parts[0];
      const platformStr = parts[3] || "";
      const trendMatch = findMatchingContext(topic, trendingContext);
      const gapMatch = findMatchingGap(topic, gapContext);

      ideas.push({
        topic,
        suggestedFormat: parts[1] || undefined,
        hookAngle: (parts[2] || "").replace(/^["']|["']$/g, ""),
        priority: parts[4] || "Medium",
        source: `Content Intelligence - ${date}`,
        category: "trending",
        sourceFile: fileName,
        sourceDate: date,
        alreadyInBank: false,
        context: trendMatch?.context || undefined,
        platforms: trendMatch?.platforms || (platformStr ? platformStr.split("/").map((p) => p.trim()) : undefined),
        gapDescription: gapMatch || undefined,
      });
    }
  }

  return ideas;
}

/**
 * Extract idea suggestions from a scout report (viral-scout output).
 * Look for tables with Topic columns or numbered idea lists.
 */
function extractFromScoutReport(content: string, fileName: string): ResearchIdea[] {
  const ideas: ResearchIdea[] = [];
  const dateMatch = fileName.match(/scout-(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : "unknown";

  // Look for markdown tables with idea-like headers
  const tableRegex = /\|[^|]*(?:Topic|Idea|Content)[^|]*\|/gi;
  if (tableRegex.test(content)) {
    const lines = content.split("\n");
    let inIdeaTable = false;

    for (const line of lines) {
      if (!line.startsWith("|")) {
        if (inIdeaTable && line.trim() === "") inIdeaTable = false;
        continue;
      }
      if (line.includes("---")) continue;

      // Detect header row
      if (/topic|idea|content/i.test(line) && /format|hook|priority/i.test(line)) {
        inIdeaTable = true;
        continue;
      }

      if (!inIdeaTable) continue;

      const cells = line.split("|").map((c) => c.trim()).filter((c) => c.length > 0);
      if (cells.length >= 2 && cells[0]) {
        ideas.push({
          topic: cells[0],
          suggestedFormat: cells[1] || undefined,
          hookAngle: cells[2] || undefined,
          priority: cells[3] || "Medium",
          source: `Viral Scout - ${date}`,
          category: "trending",
          sourceFile: fileName,
          sourceDate: date,
          alreadyInBank: false,
        });
      }
    }
  }

  // Also extract from bullet list sections titled "Ideas" or "Content Ideas"
  const ideaSectionMatch = content.match(/(?:Content\s+Ideas|Suggested\s+Ideas|Recommended\s+Ideas|Ideas\s+to\s+Create)\s*\n([\s\S]*?)(?:\n##|\n---|\n\*|$)/i);
  if (ideaSectionMatch) {
    const lines = ideaSectionMatch[1].split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("-") && !trimmed.match(/^\d+\./)) continue;

      const text = trimmed.replace(/^[-\d.]\s*/, "").trim();
      if (text.length < 5) continue;

      // Check if pipe-delimited
      if (text.includes("|")) {
        const parts = text.split("|").map((p) => p.trim());
        ideas.push({
          topic: parts[0],
          suggestedFormat: parts[1] || undefined,
          hookAngle: (parts[2] || "").replace(/^["']|["']$/g, ""),
          priority: parts[4] || parts[3] || "Medium",
          source: `Viral Scout - ${date}`,
          category: "trending",
          sourceFile: fileName,
          sourceDate: date,
          alreadyInBank: false,
        });
      } else {
        ideas.push({
          topic: text,
          source: `Viral Scout - ${date}`,
          category: "trending",
          sourceFile: fileName,
          sourceDate: date,
          priority: "Medium",
          alreadyInBank: false,
        });
      }
    }
  }

  return ideas;
}

/**
 * Extract idea suggestions from a creator analysis report.
 * Look for "Content Gaps" or "Opportunities" sections.
 */
function extractFromCreatorInsight(content: string, fileName: string): ResearchIdea[] {
  const ideas: ResearchIdea[] = [];
  const handle = fileName.replace(/\.md$/, "");

  // Look for "Gaps", "Opportunities", "Content Gaps", "Unexploited" sections
  const gapMatch = content.match(/(?:Content\s+Gaps|Opportunities|Unexploited|What\s+They're\s+Missing|Adapt\s+for\s+Collective)\s*\n([\s\S]*?)(?:\n##|\n---|\n\*|$)/i);
  if (!gapMatch) return ideas;

  const lines = gapMatch[1].split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("-") && !trimmed.match(/^\d+\./)) continue;

    let text = trimmed.replace(/^[-\d.]\s*/, "").trim();
    // Remove bold markers
    text = text.replace(/\*\*/g, "");
    if (text.length < 5) continue;

    ideas.push({
      topic: text.slice(0, 120), // Cap length
      source: `Creator Analysis - @${handle}`,
      category: "competitor",
      sourceFile: fileName,
      sourceDate: "ongoing",
      priority: "Medium",
      alreadyInBank: false,
    });
  }

  return ideas;
}

/**
 * Parse all research outputs and extract structured idea suggestions.
 * Deduplicates against existing ideas in idea-bank.md.
 */
export function parseResearchSuggestions(
  viralInsightsDir: string,
  creatorInsightsDir: string,
  ideaBankPath: string,
): ResearchIdea[] {
  // Check cache freshness using directory mtimes
  const dirs = [viralInsightsDir, creatorInsightsDir].filter((d) => fs.existsSync(d));
  const latestMtime = dirs.reduce((max, d) => {
    const stat = fs.statSync(d);
    return stat.mtimeMs > max ? stat.mtimeMs : max;
  }, 0);

  if (cache && latestMtime <= cacheTimestamp) return cache;

  const allIdeas: ResearchIdea[] = [];

  // 1. Parse intel digests (n8n Content Intelligence)
  if (fs.existsSync(viralInsightsDir)) {
    const files = fs.readdirSync(viralInsightsDir).filter((f) => f.startsWith("intel-") && f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(viralInsightsDir, file), "utf-8");
      const date = file.replace("intel-", "").replace(".md", "");
      allIdeas.push(...extractFromIntelDigest(content, file, date));
    }
  }

  // 2. Parse scout reports (viral-scout output)
  if (fs.existsSync(viralInsightsDir)) {
    const files = fs.readdirSync(viralInsightsDir).filter((f) => f.startsWith("scout-") && f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(viralInsightsDir, file), "utf-8");
      allIdeas.push(...extractFromScoutReport(content, file));
    }
  }

  // 3. Parse creator insights
  if (fs.existsSync(creatorInsightsDir)) {
    const files = fs.readdirSync(creatorInsightsDir).filter((f) => f.endsWith(".md"));
    for (const file of files) {
      const content = fs.readFileSync(path.join(creatorInsightsDir, file), "utf-8");
      allIdeas.push(...extractFromCreatorInsight(content, file));
    }
  }

  // 4. Deduplicate against existing idea bank
  const existingIdeas = parseIdeaBank(ideaBankPath);
  const existingTopics = new Set(existingIdeas.map((i) => i.topic.toLowerCase().trim()));

  for (const idea of allIdeas) {
    const normalized = idea.topic.toLowerCase().trim();
    if (existingTopics.has(normalized)) {
      idea.alreadyInBank = true;
    }
    // Also fuzzy match: check if any existing topic contains (or is contained by) this topic
    for (const existing of existingTopics) {
      if (normalized.includes(existing) || existing.includes(normalized)) {
        idea.alreadyInBank = true;
        break;
      }
    }
  }

  // 5. Deduplicate within results (same topic from multiple sources)
  const seen = new Set<string>();
  const deduped = allIdeas.filter((idea) => {
    const key = idea.topic.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: not-in-bank first, then by priority (High > Medium > Low), then by date (newest first)
  const priorityOrder: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
  deduped.sort((a, b) => {
    if (a.alreadyInBank !== b.alreadyInBank) return a.alreadyInBank ? 1 : -1;
    const pa = priorityOrder[a.priority] ?? 1;
    const pb = priorityOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return (b.sourceDate || "").localeCompare(a.sourceDate || "");
  });

  cache = deduped;
  cacheTimestamp = latestMtime;
  return deduped;
}
