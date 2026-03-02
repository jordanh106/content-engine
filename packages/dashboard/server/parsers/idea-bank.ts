import fs from "fs";
import type { Idea, IdeaCategory } from "../../shared/types.js";

let cache: Idea[] | null = null;
let cacheTimestamp = 0;

export function invalidateIdeaCache(): void {
  cache = null;
  cacheTimestamp = 0;
}

const SECTION_MAP: Record<string, IdeaCategory> = {
  "trending ideas": "trending",
  "competitor-inspired ideas": "competitor",
  "evergreen ideas": "evergreen",
  "audience requests": "audience",
  "personal/creative ideas": "personal",
  "archived (scheduled)": "archived",
};

export function parseIdeaBank(filePath: string): Idea[] {
  if (!fs.existsSync(filePath)) return [];

  const stat = fs.statSync(filePath);
  if (cache && stat.mtimeMs <= cacheTimestamp) return cache;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const ideas: Idea[] = [];
  let currentCategory: IdeaCategory = "evergreen";
  let idCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect section headers: ## Section Name
    const sectionMatch = line.match(/^##\s+(.+)$/);
    if (sectionMatch) {
      const key = sectionMatch[1].trim().toLowerCase();
      if (SECTION_MAP[key]) {
        currentCategory = SECTION_MAP[key];
      }
      continue;
    }

    // Parse table rows (skip header/separator rows)
    if (!line.startsWith("|")) continue;
    if (line.includes("---")) continue;
    if (line.toLowerCase().includes("| topic")) continue;

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    // Archived section has different columns: Topic, Format, Scheduled Date, Video Code
    if (currentCategory === "archived") {
      if (cells.length >= 2 && cells[0]) {
        ideas.push({
          id: idCounter++,
          topic: cells[0],
          suggestedFormat: cells[1] || "",
          hookAngle: "",
          priority: "Medium",
          source: cells[3] || "",
          dateAdded: cells[2] || "",
          category: "archived",
        });
      }
      continue;
    }

    // Standard sections: Topic, Format, Hook, Priority, Source/Inspired/Audience/Notes, Date
    if (cells.length >= 4 && cells[0]) {
      ideas.push({
        id: idCounter++,
        topic: cells[0],
        suggestedFormat: cells[1] || "",
        hookAngle: cells[2] || "",
        priority: (cells[3] as Idea["priority"]) || "Medium",
        source: cells[4] || "",
        dateAdded: cells[5] || "",
        category: currentCategory,
      });
    }
  }

  cache = ideas;
  cacheTimestamp = stat.mtimeMs;
  return ideas;
}
