import fs from "fs";
import path from "path";
import type { IndustryConfig, Audience, Condition } from "../../shared/types.js";

let cache: IndustryConfig | null = null;
let cacheTimestamp = 0;

export function invalidateConfigCache(): void {
  cache = null;
  cacheTimestamp = 0;
}

export function parseConfig(filePath: string): IndustryConfig {
  const stat = fs.statSync(filePath);
  if (cache && stat.mtimeMs <= cacheTimestamp) {
    return cache;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  const audiences: Audience[] = (raw.audiences || []).map(
    (a: { id: string; label: string; personaRef?: string; videos?: string }) => ({
      id: a.id,
      label: a.label,
      personaRef: a.personaRef,
      videos: a.videos,
    }),
  );

  const conditions: Condition[] = [];
  if (raw.conditions) {
    for (const [audienceId, conditionList] of Object.entries(raw.conditions)) {
      if (Array.isArray(conditionList)) {
        for (const c of conditionList as { id: string; label: string }[]) {
          conditions.push({
            id: c.id,
            label: c.label,
            audience: audienceId,
          });
        }
      }
    }
  }

  const config: IndustryConfig = {
    name: raw.name || "",
    slug: raw.slug || "",
    audiences,
    conditions,
    platforms: raw.platforms || [],
    postingCadence: raw.posting_cadence || {},
    contentMix: raw.content_mix || {},
  };

  cache = config;
  cacheTimestamp = stat.mtimeMs;
  return config;
}

export function getConfigPath(industryDir: string): string {
  return path.join(industryDir, "config.json");
}
