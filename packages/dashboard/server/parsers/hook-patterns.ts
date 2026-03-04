import fs from "fs";
import type { HookPatternEntry, HookPatternCategory } from "../../shared/types.js";

let cache: HookPatternCategory[] | null = null;
let cacheMtime = 0;

export function invalidateHookCache(): void {
  cache = null;
  cacheMtime = 0;
}

export function parseHookPatterns(filePath: string): HookPatternCategory[] {
  if (!fs.existsSync(filePath)) return [];

  const stat = fs.statSync(filePath);
  if (cache && stat.mtimeMs <= cacheMtime) return cache;

  const content = fs.readFileSync(filePath, "utf-8");
  const categories: HookPatternCategory[] = [];

  // Split by ## headings
  const sections = content.split(/^## /m).slice(1);

  for (const section of sections) {
    const lines = section.split("\n");
    const name = lines[0].trim();

    // Description is the first non-empty line after the heading (before the table)
    let description = "";
    for (let i = 1; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed || trimmed.startsWith("|") || trimmed.startsWith("---")) continue;
      if (!trimmed.startsWith("#")) {
        description = trimmed;
        break;
      }
    }

    // Parse markdown table rows
    const patterns: HookPatternEntry[] = [];
    let inTable = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) {
        if (inTable) break; // end of table
        continue;
      }
      // Skip header row and separator row
      if (trimmed.includes("Pattern") && trimmed.includes("Example")) {
        inTable = true;
        continue;
      }
      if (trimmed.match(/^\|[\s-|]+$/)) continue;
      if (!inTable) continue;

      const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean);
      if (cells.length >= 5) {
        patterns.push({
          pattern: cells[0].replace(/^"|"$/g, ""),
          example: cells[1].replace(/^"|"$/g, ""),
          bestFormat: cells[2],
          platform: cells[3],
          optimizes: cells[4],
        });
      }
    }

    if (patterns.length > 0) {
      categories.push({ name, description, patterns });
    }
  }

  cache = categories;
  cacheMtime = stat.mtimeMs;
  return categories;
}
