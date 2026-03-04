import fs from "fs";
import path from "path";
import type { ProductionPlan } from "../../shared/types.js";

let cache: Map<string, ProductionPlan> = new Map();
let cacheTimestamp = 0;

export function invalidateProductionPlanCache(): void {
  cache = new Map();
  cacheTimestamp = 0;
}

export function parseProductionPlans(dirPath: string): Map<string, ProductionPlan> {
  if (!fs.existsSync(dirPath)) return new Map();

  try {
    const stat = fs.statSync(dirPath);
    if (cache.size > 0 && stat.mtimeMs <= cacheTimestamp) return cache;
  } catch {
    return new Map();
  }

  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
  const results = new Map<string, ProductionPlan>();

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
      const plan = parsePlanMarkdown(content, file);
      if (plan.videoCode) {
        results.set(plan.videoCode, plan);
      }
    } catch {
      // Skip unparseable files
    }
  }

  cache = results;
  cacheTimestamp = Date.now();
  return results;
}

function parsePlanMarkdown(content: string, filename: string): ProductionPlan {
  const lines = content.split("\n");

  // Extract video code from title "# Production Plan: D2 - Title" or filename
  let videoCode = "";
  let title = "";
  const titleMatch = content.match(/#.*?([A-G]\d+)\s*[-:]\s*(.+)/);
  if (titleMatch) {
    videoCode = titleMatch[1];
    title = titleMatch[2].trim();
  } else {
    // Try filename like "D2-tech-neck.md"
    const fnMatch = filename.match(/^([A-G]\d+)/);
    if (fnMatch) videoCode = fnMatch[1];
  }

  // Extract date
  let generatedAt = "";
  const dateMatch = content.match(/(?:date|generated|created)[:\s]+(\d{4}-\d{2}-\d{2})/i);
  if (dateMatch) generatedAt = dateMatch[1];

  // Extract sections
  const hookVariations: string[] = [];
  const shotList: string[] = [];
  const platformOptimization: Record<string, string> = {};

  let currentSection = "";
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+)/);
    if (headerMatch) {
      currentSection = headerMatch[1].toLowerCase();
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    const numberedMatch = line.match(/^\d+\.\s+(.+)/);
    const text = bulletMatch?.[1]?.trim() || numberedMatch?.[1]?.trim();

    if (text) {
      if (currentSection.includes("hook")) {
        hookVariations.push(text);
      } else if (currentSection.includes("shot")) {
        shotList.push(text);
      } else if (currentSection.includes("platform")) {
        const platMatch = text.match(/\*\*(.+?)\*\*[:\s]+(.+)/);
        if (platMatch) {
          platformOptimization[platMatch[1].toLowerCase()] = platMatch[2];
        }
      }
    }
  }

  return {
    videoCode,
    title,
    generatedAt,
    hookVariations: hookVariations.slice(0, 10),
    platformOptimization,
    shotList: shotList.slice(0, 20),
    rawMarkdown: content,
  };
}
