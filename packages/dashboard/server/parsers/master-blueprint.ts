import fs from "fs";

export type BlueprintSection = {
  title: string;
  body: string;
};

export type Blueprint = {
  version: string;
  generated: string;
  raw: string;
  hookArchetypes: string[];
  antiPatterns: string[];
  scoringWeights: {
    hookArchitecture: number;
    bodyStructure: number;
    visualProduction: number;
    ctaEngagement: number;
    pillarAlignment: number;
    antiPatternCheck: number;
  };
  passingScore: number;
  sections: BlueprintSection[];
};

let cache: Blueprint | null = null;
let cacheMtime = 0;

export function invalidateBlueprintCache(): void {
  cache = null;
  cacheMtime = 0;
}

function extractVersion(content: string): string {
  const match = content.match(/\*\*Blueprint version:\*\*\s*(.+)/);
  return match ? match[1].trim() : "1.0";
}

function extractGenerated(content: string): string {
  const match = content.match(/\*\*Generated:\*\*\s*(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : new Date().toISOString().slice(0, 10);
}

function extractHookArchetypes(content: string): string[] {
  // Extract the "Top-Performing Hook Archetypes" table rows
  const archetypeMatch = content.match(/Top-Performing Hook Archetypes[\s\S]*?\n\|[\s\S]*?(?=\n\n|\n###|\n##)/);
  if (!archetypeMatch) return [];
  const lines = archetypeMatch[0].split("\n");
  const archetypes: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\|\s*\*\*([^*]+)\*\*/);
    if (m) archetypes.push(m[1].trim());
  }
  return archetypes;
}

function extractAntiPatterns(content: string): string[] {
  // Pull anti-patterns from section 8
  const section = content.match(/##\s*8\.\s*Anti-Patterns[\s\S]*?(?=\n##\s)/);
  if (!section) return [];
  const lines = section[0].split("\n");
  const patterns: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*[^|]+\|\s*[^|]+\|/);
    if (m && !m[1].includes("Anti-Pattern") && !m[1].includes("---")) {
      patterns.push(m[1].trim());
    }
  }
  return patterns;
}

function extractSections(content: string): BlueprintSection[] {
  const sections: BlueprintSection[] = [];
  const regex = /^##\s+(\d+\.\s+.+)$/gm;
  const matches: { title: string; index: number }[] = [];
  let m;
  while ((m = regex.exec(content)) !== null) {
    matches.push({ title: m[1].trim(), index: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].title.length + 3; // skip "## "
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    sections.push({
      title: matches[i].title,
      body: content.slice(start, end).trim(),
    });
  }
  return sections;
}

export function parseMasterBlueprint(blueprintPath: string): Blueprint | null {
  if (!fs.existsSync(blueprintPath)) return null;
  const stat = fs.statSync(blueprintPath);
  if (cache && stat.mtimeMs <= cacheMtime) return cache;

  const content = fs.readFileSync(blueprintPath, "utf-8");

  const blueprint: Blueprint = {
    version: extractVersion(content),
    generated: extractGenerated(content),
    raw: content,
    hookArchetypes: extractHookArchetypes(content),
    antiPatterns: extractAntiPatterns(content),
    scoringWeights: {
      hookArchitecture: 25,
      bodyStructure: 20,
      visualProduction: 20,
      ctaEngagement: 15,
      pillarAlignment: 10,
      antiPatternCheck: 10,
    },
    passingScore: 80,
    sections: extractSections(content),
  };

  cache = blueprint;
  cacheMtime = stat.mtimeMs;
  return blueprint;
}
