import fs from "fs";
import path from "path";
import type { CreatorInsight } from "../../shared/types.js";

let cache: Map<string, CreatorInsight> = new Map();
let cacheTimestamp = 0;

export function invalidateCreatorInsightsCache(): void {
  cache = new Map();
  cacheTimestamp = 0;
}

export function parseCreatorInsights(dirPath: string): Map<string, CreatorInsight> {
  if (!fs.existsSync(dirPath)) return new Map();

  try {
    const stat = fs.statSync(dirPath);
    if (cache.size > 0 && stat.mtimeMs <= cacheTimestamp) return cache;
  } catch {
    return new Map();
  }

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
  const results = new Map<string, CreatorInsight>();

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
      const insight = parseInsightMarkdown(content, file);
      if (insight.handle) {
        results.set(insight.handle.replace("@", "").toLowerCase(), insight);
      }
    } catch {
      // Skip unparseable files
    }
  }

  cache = results;
  cacheTimestamp = Date.now();
  return results;
}

function parseInsightMarkdown(content: string, filename: string): CreatorInsight {
  const lines = content.split("\n");

  // Try to extract handle from title line "# Creator Analysis: @handle" or filename
  let handle = filename.replace(/\.md$/, "").replace(/^creator-/, "");
  const titleMatch = content.match(/#.*?@(\w+)/);
  if (titleMatch) handle = titleMatch[1];

  // Extract date
  let analyzedAt = "";
  const dateMatch = content.match(/(?:date|analyzed|generated)[:\s]+(\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) analyzedAt = dateMatch[1];

  // Extract sections by looking for ## headers
  const contentPatterns: string[] = [];
  const hookStyles: string[] = [];
  const topPerformingFormats: string[] = [];
  const keyTakeaways: string[] = [];
  let postingFrequency = "";

  let currentSection = "";
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      currentSection = headerMatch[1].toLowerCase();
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      const text = bulletMatch[1].trim();
      if (currentSection.includes("pattern") || currentSection.includes("content")) {
        contentPatterns.push(text);
      } else if (currentSection.includes("hook")) {
        hookStyles.push(text);
      } else if (currentSection.includes("format")) {
        topPerformingFormats.push(text);
      } else if (currentSection.includes("takeaway") || currentSection.includes("key") || currentSection.includes("summary")) {
        keyTakeaways.push(text);
      } else if (currentSection.includes("frequency") || currentSection.includes("posting")) {
        postingFrequency = text;
      }
    }
  }

  return {
    handle,
    analyzedAt,
    contentPatterns: contentPatterns.slice(0, 10),
    hookStyles: hookStyles.slice(0, 10),
    postingFrequency,
    topPerformingFormats: topPerformingFormats.slice(0, 5),
    keyTakeaways: keyTakeaways.slice(0, 10),
    rawMarkdown: content,
  };
}
