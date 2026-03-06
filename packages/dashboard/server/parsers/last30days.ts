import fs from "fs";
import path from "path";
import type { ResearchReport } from "../../shared/types.js";

const REPORT_PATH = path.join(
  process.env.HOME || "/tmp",
  ".local",
  "share",
  "last30days",
  "out",
  "report.json",
);

let cache: ResearchReport | null = null;
let cacheMtime = 0;

export function invalidateResearchCache(): void {
  cache = null;
  cacheMtime = 0;
}

export function parseResearchReport(): ResearchReport | null {
  if (!fs.existsSync(REPORT_PATH)) return null;

  const stat = fs.statSync(REPORT_PATH);
  if (cache && stat.mtimeMs <= cacheMtime) return cache;

  try {
    const raw = JSON.parse(fs.readFileSync(REPORT_PATH, "utf-8"));
    const report: ResearchReport = {
      topic: raw.topic ?? "",
      range: raw.range ?? { from: "", to: "" },
      generated_at: raw.generated_at ?? "",
      mode: raw.mode ?? "",
      reddit: (raw.reddit ?? []).map((r: Record<string, unknown>) => ({
        id: r.id ?? "",
        title: r.title ?? "",
        url: r.url ?? "",
        subreddit: r.subreddit ?? "",
        date: (r.date as string) ?? null,
        engagement: (r.engagement as ResearchReport["reddit"][0]["engagement"]) ?? null,
        comment_insights: (r.comment_insights as string[]) ?? [],
        relevance: (r.relevance as number) ?? 0,
        why_relevant: (r.why_relevant as string) ?? "",
        score: (r.score as number) ?? 0,
      })),
      x: (raw.x ?? []).map((x: Record<string, unknown>) => ({
        id: x.id ?? "",
        text: x.text ?? "",
        url: x.url ?? "",
        author_handle: x.author_handle ?? "",
        date: (x.date as string) ?? null,
        engagement: (x.engagement as ResearchReport["x"][0]["engagement"]) ?? null,
        relevance: (x.relevance as number) ?? 0,
        why_relevant: (x.why_relevant as string) ?? "",
        score: (x.score as number) ?? 0,
      })),
      web: (raw.web ?? []).map((w: Record<string, unknown>) => ({
        id: w.id ?? "",
        title: w.title ?? "",
        url: w.url ?? "",
        source_domain: (w.source_domain as string) ?? "",
        snippet: (w.snippet as string) ?? "",
        date: (w.date as string) ?? null,
        relevance: (w.relevance as number) ?? 0,
        why_relevant: (w.why_relevant as string) ?? "",
        score: (w.score as number) ?? 0,
      })),
      instagram: (raw.instagram ?? []).map((i: Record<string, unknown>) => ({
        title: String(i.title ?? ""),
        url: String(i.url ?? ""),
        source: String(i.source ?? ""),
        snippet: String(i.snippet ?? ""),
        relevance: Number(i.relevance) || 0,
        score: Number(i.score) || 0,
      })),
      tiktok: (raw.tiktok ?? []).map((t: Record<string, unknown>) => ({
        title: String(t.title ?? ""),
        url: String(t.url ?? ""),
        source: String(t.source ?? ""),
        snippet: String(t.snippet ?? ""),
        relevance: Number(t.relevance) || 0,
        score: Number(t.score) || 0,
      })),
      facebook: (raw.facebook ?? []).map((f: Record<string, unknown>) => ({
        title: String(f.title ?? ""),
        url: String(f.url ?? ""),
        source: String(f.source ?? ""),
        snippet: String(f.snippet ?? ""),
        relevance: Number(f.relevance) || 0,
        score: Number(f.score) || 0,
      })),
      best_practices: raw.best_practices ?? [],
      reddit_error: raw.reddit_error,
      x_error: raw.x_error,
      web_error: raw.web_error,
      from_cache: raw.from_cache,
      cache_age_hours: raw.cache_age_hours,
    };

    cache = report;
    cacheMtime = stat.mtimeMs;
    return report;
  } catch {
    return null;
  }
}

export function getReportPath(): string {
  return REPORT_PATH;
}
