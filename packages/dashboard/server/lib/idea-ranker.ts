/**
 * IdeaRanker — composite scoring across all idea sources.
 *
 * Reads ideas from idea-bank.md, inspiration_inbox SQLite rows, and (in Phase 3)
 * audience-demand/* files. For each idea computes four sub-scores plus a weighted
 * composite, with audience tags derived either from explicit tags on the source
 * or via the persona keyword matcher.
 *
 * The scoring is deliberately transparent — every idea card on the Home screen
 * shows the sub-scores so Jordan can audit why something ranks where it does.
 * That's the "ranker gets to 80%, taste does the last 20%" handoff in practice.
 */
import fs from "fs";
import path from "path";
import { sqlite } from "../db.js";
import { parseIdeaBank } from "../parsers/idea-bank.js";
import { parsePersonas, scoreIdeaAgainstPersonas, type Persona } from "./persona-parser.js";
import type { Idea } from "../../shared/types.js";

export type IdeaSource =
  | "idea_bank"
  | "viral_insights"
  | "creator_insights"
  | "inspiration_inbox"
  | "audience_demand"
  | "evergreen";

export type RankedIdea = {
  id: string;                     // composite: source + native id
  title: string;
  body: string;
  audienceTags: string[];
  formatHint?: string;
  hookAngle?: string;
  sources: Array<{ source: IdeaSource; reference: string; recency: "fresh" | "recent" | "stale" }>;
  scores: {
    audienceFit: number;          // 0-100 — overlap with persona keywords
    viralitySignal: number;       // 0-100 — referenced in viral-insights last 30d?
    formatFeasibility: number;    // 0-100 — production guide / hook pattern exists?
    competitiveGap: number;       // 0-100 — not yet in scheduled / published content?
    historicalFit: number;        // 0-100 — matches format/audience of historical top performers
    goalAlignment: number;        // 0-100 — serves the current quarter's locked goal (goal-lock.md)
    composite: number;            // weighted average
  };
  developCtaKind: string;         // ProjectKind hint for the Develop button
  rawSource: Idea | InboxRow;     // for debugging / outline rendering
};

type InboxRow = {
  id: number;
  content: string;
  source_url: string | null;
  status: string;
  audience_tags: string | null;
  created_at: string;
};

const WEIGHTS = {
  audienceFit: 0.25,             // slightly reduced — goalAlignment now absorbs some of this role
  viralitySignal: 0.20,
  formatFeasibility: 0.10,
  competitiveGap: 0.10,
  historicalFit: 0.15,
  goalAlignment: 0.20,           // quarter goal anchor — meaningful weight to enforce focus
};

const FRESH_DAYS = 7;
const RECENT_DAYS = 30;

const FORMAT_HINT_TO_KIND: Record<string, string> = {
  A: "explainer",
  B: "did_you_know",         // checklist
  C: "explainer",            // demo
  D: "did_you_know",         // myth buster
  E: "office_tour",
  F: "did_you_know",         // quick tip
  G: "patient_story",
};

let cache: { value: RankedIdea[]; ts: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;  // 5 minutes

export function invalidateRankerCache(): void {
  cache = null;
}

export type RankInput = {
  industryDir: string;          // e.g. /path/to/industries/chiropractic
  audienceFilter?: string;      // segment id; undefined = all
  limit?: number;               // default 25
};

export async function rankIdeas(input: RankInput): Promise<RankedIdea[]> {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return filterAndLimit(cache.value, input.audienceFilter, input.limit);
  }

  const personas = parsePersonas(path.join(input.industryDir, "audiences.md"));
  const ideaBank = parseIdeaBank(path.join(input.industryDir, "idea-bank.md"));
  const inboxRows = readInbox();
  const viralIntel = readViralInsightsKeywords(path.join(input.industryDir, "viral-insights"));
  const demandIdeas = readAudienceDemand(path.join(input.industryDir, "audience-demand"));
  const scheduledTopics = readScheduledTopics();
  const historicalSignals = readHistoricalSignals(path.join(input.industryDir, "content-library.md"));
  const goalLock = readGoalLock(input.industryDir);

  const ranked: RankedIdea[] = [];

  // Idea-bank entries
  for (const idea of ideaBank) {
    ranked.push(scoreIdea({
      id: `bank-${idea.id}`,
      title: idea.topic,
      body: idea.hookAngle || "",
      formatHint: extractFormatLetter(idea.suggestedFormat),
      hookAngle: idea.hookAngle,
      sources: [{ source: "idea_bank", reference: `idea-bank.md#${idea.category}-${idea.id}`, recency: classifyRecency(idea.dateAdded) }],
      raw: idea,
      personas, viralIntel, scheduledTopics, historicalSignals, goalLock,
    }));
  }

  // Inspiration inbox entries (status=inbox only)
  for (const row of inboxRows) {
    ranked.push(scoreIdea({
      id: `inbox-${row.id}`,
      title: row.content.slice(0, 80),
      body: row.content,
      formatHint: undefined,
      hookAngle: undefined,
      sources: [{
        source: "inspiration_inbox",
        reference: row.source_url || `inbox-${row.id}`,
        recency: classifyRecency(row.created_at),
      }],
      raw: row,
      explicitAudienceTags: parseAudienceTags(row.audience_tags),
      personas, viralIntel, scheduledTopics, historicalSignals, goalLock,
    }));
  }

  // Audience-demand "Suggested idea triggers" entries
  for (const d of demandIdeas) {
    ranked.push(scoreIdea({
      id: `demand-${d.audienceId}-${hashString(d.title)}`,
      title: d.title,
      body: d.body,
      formatHint: d.formatHint,
      hookAngle: undefined,
      sources: [{ source: "audience_demand", reference: d.reference, recency: d.recency }],
      raw: d as unknown as InboxRow,
      explicitAudienceTags: [d.audienceId],
      personas, viralIntel, scheduledTopics, historicalSignals, goalLock,
    }));
  }

  ranked.sort((a, b) => b.scores.composite - a.scores.composite);
  cache = { value: ranked, ts: Date.now() };
  return filterAndLimit(ranked, input.audienceFilter, input.limit);
}

type DemandIdea = {
  audienceId: string;
  title: string;
  body: string;
  formatHint?: string;
  reference: string;
  recency: "fresh" | "recent" | "stale";
};

function readAudienceDemand(demandDir: string): DemandIdea[] {
  const out: DemandIdea[] = [];
  if (!fs.existsSync(demandDir)) return out;
  for (const file of fs.readdirSync(demandDir)) {
    if (!file.startsWith("demand-") || !file.endsWith(".md")) continue;
    const m = file.match(/^demand-([a-z_]+)-(\d{4}-\d{2}-\d{2})\.md$/);
    if (!m) continue;
    const audienceId = m[1];
    const dateStr = m[2];
    const full = path.join(demandDir, file);
    const stat = fs.statSync(full);
    const recency = classifyRecency(dateStr);
    if (recency === "stale") continue;
    const content = fs.readFileSync(full, "utf-8");
    // Parse the "Suggested idea triggers" section: numbered bullets in the form
    //   N. **Format** — "Title" — rationale
    const triggerSection = content.split(/^##\s+Suggested idea triggers\s*$/m)[1];
    if (!triggerSection) continue;
    const stopAt = triggerSection.match(/^##\s+/m);
    const sectionText = stopAt ? triggerSection.slice(0, stopAt.index) : triggerSection;
    const lineRe = /^\s*\d+\.\s+\*\*([^*]+)\*\*\s*[—-]\s*"([^"]+)"\s*[—-]\s*(.+)$/gm;
    let lm: RegExpExecArray | null;
    while ((lm = lineRe.exec(sectionText)) !== null) {
      const formatText = lm[1].trim();
      const title = lm[2].trim();
      const rationale = lm[3].trim();
      out.push({
        audienceId,
        title,
        body: rationale,
        formatHint: extractFormatLetter(formatText),
        reference: `audience-demand/${file}`,
        recency,
      });
    }
    // Touch mtime so the cache invalidation watch picks up changes without rescan cost
    void stat;
  }
  return out;
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

function filterAndLimit(arr: RankedIdea[], audienceFilter?: string, limit?: number): RankedIdea[] {
  let out = arr;
  if (audienceFilter) {
    out = out.filter((i) => i.audienceTags.includes(audienceFilter));
  }
  return out.slice(0, limit ?? 25);
}

type ScoreInput = {
  id: string;
  title: string;
  body: string;
  formatHint?: string;
  hookAngle?: string;
  sources: RankedIdea["sources"];
  raw: Idea | InboxRow;
  explicitAudienceTags?: string[];
  personas: Persona[];
  viralIntel: Set<string>;
  scheduledTopics: Set<string>;
  historicalSignals: HistoricalSignals;
  goalLock: GoalLock | null;
};

function scoreIdea(s: ScoreInput): RankedIdea {
  const fullText = `${s.title} ${s.body}`.trim();
  const personaMatches = scoreIdeaAgainstPersonas(fullText, s.personas);

  const audienceTags = s.explicitAudienceTags?.length
    ? s.explicitAudienceTags
    : personaMatches.slice(0, 2).map((m) => m.id);
  const audienceFit = personaMatches.length > 0
    ? Math.round(personaMatches.slice(0, 2).reduce((a, b) => a + b.score, 0) / Math.min(2, personaMatches.length))
    : 0;

  const viralitySignal = computeViralitySignal(fullText, s.viralIntel);
  const formatFeasibility = computeFormatFeasibility(s.formatHint);
  const competitiveGap = computeCompetitiveGap(s.title, s.scheduledTopics);
  const historicalFit = computeHistoricalFit(s.formatHint, audienceTags, s.historicalSignals);
  const goalAlignment = computeGoalAlignment(audienceTags, s.goalLock);

  const composite = Math.round(
    audienceFit * WEIGHTS.audienceFit +
    viralitySignal * WEIGHTS.viralitySignal +
    formatFeasibility * WEIGHTS.formatFeasibility +
    competitiveGap * WEIGHTS.competitiveGap +
    historicalFit * WEIGHTS.historicalFit +
    goalAlignment * WEIGHTS.goalAlignment,
  );

  return {
    id: s.id,
    title: s.title,
    body: s.body,
    audienceTags,
    formatHint: s.formatHint,
    hookAngle: s.hookAngle,
    sources: s.sources,
    scores: { audienceFit, viralitySignal, formatFeasibility, competitiveGap, historicalFit, goalAlignment, composite },
    developCtaKind: s.formatHint ? (FORMAT_HINT_TO_KIND[s.formatHint] ?? "did_you_know") : "did_you_know",
    rawSource: s.raw,
  };
}

// ─── goalAlignment: does this serve the quarter's locked goal? ─────────────

type GoalLock = {
  anchorAudienceIds: string[];   // ["prenatal"]
  goalSummary: string;            // for telemetry / debug
  updatedAt: number;
};

// Adjacency: audiences that compound naturally with each other. An idea for an
// adjacent audience still serves the locked goal at a discount, not zero.
const AUDIENCE_ADJACENCY: Record<string, string[]> = {
  prenatal: ["infant", "general"],
  infant: ["prenatal", "kids", "general"],
  kids: ["infant", "general"],
  athlete: ["adult"],
  adult: ["athlete", "senior", "general"],
  senior: ["adult", "general"],
  general: [],
};

let goalLockCache: GoalLock | null = null;
let goalLockCacheTs = 0;

function readGoalLock(industryDir: string): GoalLock | null {
  const filePath = path.join(industryDir, "goal-lock.md");
  if (!fs.existsSync(filePath)) return null;
  const stat = fs.statSync(filePath);
  if (goalLockCache && stat.mtimeMs <= goalLockCacheTs) return goalLockCache;

  const content = fs.readFileSync(filePath, "utf-8");
  // Parse: look for "Anchor audience: <id>" line (case-insensitive). Strip parenthetical asides.
  const audienceMatch = content.match(/Anchor audience:\s*([a-z_, ]+)/i);
  const anchorAudienceIds = audienceMatch
    ? audienceMatch[1].split(",").map((s) => s.trim().replace(/\(.*$/, "").trim()).filter(Boolean)
    : [];
  const summaryMatch = content.match(/\*\*(.+?)\*\*/);
  const goalSummary = summaryMatch ? summaryMatch[1].trim() : "";

  goalLockCache = { anchorAudienceIds, goalSummary, updatedAt: stat.mtimeMs };
  goalLockCacheTs = stat.mtimeMs;
  return goalLockCache;
}

function computeGoalAlignment(audienceTags: string[], goalLock: GoalLock | null): number {
  // No goal locked → neutral score so existing ranking is preserved.
  if (!goalLock || goalLock.anchorAudienceIds.length === 0) return 50;
  // Direct hit on the anchor audience.
  if (audienceTags.some((t) => goalLock.anchorAudienceIds.includes(t))) return 100;
  // Adjacent audience — compounds toward the goal at a discount.
  for (const anchor of goalLock.anchorAudienceIds) {
    const adjacent = AUDIENCE_ADJACENCY[anchor] || [];
    if (audienceTags.some((t) => adjacent.includes(t))) return 60;
  }
  // Off-goal entirely — heavy penalty so ranking pulls it down.
  return 20;
}

// ─── historicalFit: do format + audience match what's actually worked? ─────

type HistoricalSignals = {
  /** Format letters of top-decile performers, ranked by performance share. */
  topFormats: Map<string, number>;       // "B" -> normalized 0..1
  /** Audience IDs of top-decile performers. */
  topAudiences: Map<string, number>;     // "prenatal" -> normalized 0..1
  /** Total rows analyzed (for confidence). */
  sampleSize: number;
};

function readHistoricalSignals(contentLibraryPath: string): HistoricalSignals {
  const topFormats = new Map<string, number>();
  const topAudiences = new Map<string, number>();
  let sampleSize = 0;

  try {
    // Read top performers from last 90 days (broader window than ranker recency since
    // outcome data is rare — we want signal even from older winners).
    const rows = sqlite.prepare(
      `SELECT video_code, format_id,
              SUM(saves) AS saves, SUM(shares) AS shares, SUM(likes) AS likes, SUM(views) AS views
       FROM performance_metrics
       WHERE recorded_at >= date('now', '-90 days')
       GROUP BY video_code
       ORDER BY (COALESCE(SUM(saves),0) + COALESCE(SUM(shares),0) * 2 + COALESCE(SUM(likes),0) * 0.2) DESC
       LIMIT 20`,
    ).all() as Array<{ video_code: string; format_id: string | null; saves: number; shares: number; likes: number; views: number }>;

    sampleSize = rows.length;
    if (rows.length === 0) return { topFormats, topAudiences, sampleSize };

    // Join with content-library video data to get audience + format.
    // Map video_code -> { audience, format } via the content library.
    const audienceByCode = readContentLibraryAudienceMap(contentLibraryPath);

    for (const r of rows) {
      const fmt = (r.format_id || "").charAt(0).toUpperCase();
      if (fmt) topFormats.set(fmt, (topFormats.get(fmt) || 0) + 1);
      const audience = audienceByCode.get(r.video_code);
      if (audience) topAudiences.set(audience, (topAudiences.get(audience) || 0) + 1);
    }

    // Normalize to 0..1 by dividing by max count
    normalize(topFormats);
    normalize(topAudiences);
  } catch { /* no metrics table or empty */ }

  return { topFormats, topAudiences, sampleSize };
}

function normalize(m: Map<string, number>): void {
  let max = 0;
  for (const v of m.values()) if (v > max) max = v;
  if (max === 0) return;
  for (const [k, v] of m) m.set(k, v / max);
}

function readContentLibraryAudienceMap(contentLibraryPath: string): Map<string, string> {
  // Map: video code -> audience id. Built by re-using audience prefix convention
  // (P1-P9 = prenatal, B1-B10 = infant, K1-K8 = kids, A1-A6 = athlete,
  //  D1-D11 = adult, S1-S5 = senior, G1-G8 = general).
  // Future: read content-library.md and parse explicit audience tags per video.
  const out = new Map<string, string>();
  void contentLibraryPath;
  const PREFIX_TO_AUDIENCE: Record<string, string> = {
    P: "prenatal", B: "infant", K: "kids", A: "athlete",
    D: "adult", S: "senior", G: "general",
  };
  // Pre-seed common codes; this is a cheap lookup until we wire the full parser
  for (const [prefix, audience] of Object.entries(PREFIX_TO_AUDIENCE)) {
    for (let i = 1; i <= 12; i++) out.set(`${prefix}${i}`, audience);
  }
  return out;
}

function computeHistoricalFit(
  formatHint: string | undefined,
  audienceTags: string[],
  signals: HistoricalSignals,
): number {
  if (signals.sampleSize === 0) {
    // No performance data yet — return neutral so the score doesn't bias against new ideas
    return 50;
  }

  let score = 0;
  let weight = 0;

  if (formatHint) {
    const fmtWeight = signals.topFormats.get(formatHint.charAt(0).toUpperCase()) ?? 0;
    score += fmtWeight * 100 * 0.5;
    weight += 0.5;
  }

  if (audienceTags.length > 0) {
    let best = 0;
    for (const tag of audienceTags) {
      const w = signals.topAudiences.get(tag) ?? 0;
      if (w > best) best = w;
    }
    score += best * 100 * 0.5;
    weight += 0.5;
  }

  if (weight === 0) return 50;
  return Math.round(score / weight);
}

function computeViralitySignal(text: string, viralIntel: Set<string>): number {
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4);
  let hits = 0;
  for (const t of tokens) if (viralIntel.has(t)) hits += 1;
  // Cap: 10 hits = 100
  return Math.min(100, Math.round((hits / 10) * 100));
}

function computeFormatFeasibility(formatHint?: string): number {
  if (!formatHint) return 50;  // unknown — assume average
  const letter = formatHint.charAt(0).toUpperCase();
  // All 7 formats have production guides in the formats/ folder, so feasibility is high for any known format.
  return ["A", "B", "C", "D", "E", "F", "G"].includes(letter) ? 90 : 60;
}

function computeCompetitiveGap(title: string, scheduledTopics: Set<string>): number {
  const norm = title.toLowerCase().trim();
  for (const scheduled of scheduledTopics) {
    if (norm === scheduled || norm.includes(scheduled) || scheduled.includes(norm)) {
      // We already have this scheduled — competitive gap is small.
      return 20;
    }
  }
  return 80;
}

function readInbox(): InboxRow[] {
  try {
    return sqlite.prepare(
      "SELECT id, content, source_url, status, audience_tags, created_at FROM inspiration_inbox WHERE status = 'inbox' ORDER BY id DESC LIMIT 100",
    ).all() as InboxRow[];
  } catch {
    return [];
  }
}

function readViralInsightsKeywords(viralInsightsDir: string): Set<string> {
  const keywords = new Set<string>();
  if (!fs.existsSync(viralInsightsDir)) return keywords;
  const cutoffMs = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(viralInsightsDir)) {
    if (!file.endsWith(".md")) continue;
    const full = path.join(viralInsightsDir, file);
    const stat = fs.statSync(full);
    if (stat.mtimeMs < cutoffMs) continue;
    const content = fs.readFileSync(full, "utf-8").toLowerCase();
    for (const w of content.split(/[^a-z0-9]+/)) {
      if (w.length >= 4) keywords.add(w);
    }
  }
  return keywords;
}

function readScheduledTopics(): Set<string> {
  const out = new Set<string>();
  try {
    const rows = sqlite.prepare(
      `SELECT video_code FROM calendar_entries WHERE date >= date('now', '-30 days')`,
    ).all() as Array<{ video_code: string }>;
    for (const r of rows) out.add(r.video_code.toLowerCase());
  } catch { /* no calendar yet */ }
  return out;
}

function parseAudienceTags(csv: string | null): string[] {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}

function extractFormatLetter(suggestedFormat: string): string | undefined {
  const m = suggestedFormat.match(/^([A-G])\b/i);
  return m ? m[1].toUpperCase() : undefined;
}

function classifyRecency(dateStr: string): "fresh" | "recent" | "stale" {
  if (!dateStr) return "stale";
  const ts = Date.parse(dateStr);
  if (isNaN(ts)) return "stale";
  const daysOld = (Date.now() - ts) / (24 * 60 * 60 * 1000);
  if (daysOld <= FRESH_DAYS) return "fresh";
  if (daysOld <= RECENT_DAYS) return "recent";
  return "stale";
}
