/**
 * Central Living Brand Voice reader.
 *
 * Replaces the scattered "static string + sliced read from brand.md" pattern
 * across 5+ routes. Every AI call in the dashboard reads from one source.
 *
 * Source of truth: the newest file in `industries/chiropractic/brand-voice/`
 * matching `voice-*.md`. Sorted by filename (which is dated YYYY-MM-DD) — the
 * lexicographic max is also the chronological max. `voice-INITIAL.md` always
 * sorts last in pure-alpha sort, so we explicitly prefer dated files when any
 * exist, falling back to INITIAL only on a fresh install.
 *
 * The /refresh-voice skill writes new dated files into this directory weekly.
 * `industries/chiropractic/brand.md` is the constitution — the refresher must
 * not contradict it, but the dashboard does NOT read from it directly. It's
 * the source the refresher distills into the dated voice files.
 */
import fs from "fs";
import path from "path";

export type BrandVoice = {
  /** The prompt-ready 5-bullet style guide. Dropped verbatim into AI prompts. */
  styleBlock: string;
  /** Phrases that recur in published top-performing work (auto-learned). */
  signaturePhrases: string[];
  /** Tone descriptors (3-5 adjectives, ranked). */
  toneDescriptors: string[];
  /** Source file name, e.g. "voice-2026-05-13.md". For audit / debug. */
  sourceVersion: string;
  /** ISO date of the source file's mtime. */
  updatedAt: string;
  /** Raw markdown of the entire source file. */
  raw: string;
};

let cache: { value: BrandVoice; ts: number; sourcePath: string } | null = null;
const CACHE_TTL_MS = 2 * 60 * 1000;  // 2 minutes — voice updates land weekly, no need for tight invalidation

export function invalidateBrandVoiceCache(): void {
  cache = null;
}

/**
 * Read the current voice profile for the given industry.
 *
 * `industryDir` should be the absolute path to the industry root, e.g.
 * `/Users/.../content-engine/industries/chiropractic`.
 */
export function getCurrentBrandVoice(industryDir: string): BrandVoice {
  const voiceDir = path.join(industryDir, "brand-voice");
  const sourcePath = pickNewestVoiceFile(voiceDir);

  if (cache && cache.sourcePath === sourcePath && Date.now() - cache.ts < CACHE_TTL_MS) {
    // Verify mtime hasn't changed since cache (cheap stat).
    try {
      const stat = fs.statSync(sourcePath);
      if (stat.mtimeMs <= Date.parse(cache.value.updatedAt) + 1000) {
        return cache.value;
      }
    } catch { /* fall through */ }
  }

  const value = sourcePath ? parseVoiceFile(sourcePath) : fallbackVoice();
  cache = { value, ts: Date.now(), sourcePath: sourcePath || "" };
  return value;
}

/**
 * Format a BrandVoice into a prompt-ready string. Drop this verbatim into any
 * Claude/Haiku prompt that previously inlined the brandVoice 5-bullet block.
 */
export function formatBrandVoiceForPrompt(v: BrandVoice): string {
  const parts: string[] = [v.styleBlock.trim()];

  if (v.toneDescriptors.length > 0) {
    parts.push(`Tone: ${v.toneDescriptors.join(", ")}.`);
  }

  if (v.signaturePhrases.length > 0) {
    parts.push(`Signature phrases this brand uses (lean into these when natural):\n${v.signaturePhrases.map((p) => `- ${p}`).join("\n")}`);
  }

  return parts.join("\n\n");
}

// ─── internals ──────────────────────────────────────────────────────────────

function pickNewestVoiceFile(voiceDir: string): string {
  if (!fs.existsSync(voiceDir)) return "";
  const files = fs.readdirSync(voiceDir)
    .filter((f) => f.startsWith("voice-") && f.endsWith(".md"));
  if (files.length === 0) return "";

  // Prefer dated files (voice-2026-05-13.md) over voice-INITIAL.md.
  const dated = files.filter((f) => /^voice-\d{4}-\d{2}-\d{2}\.md$/.test(f));
  const candidates = dated.length > 0 ? dated : files;
  candidates.sort();  // YYYY-MM-DD sorts chronologically; INITIAL sorts last alpha
  const newest = candidates[candidates.length - 1];
  return path.join(voiceDir, newest);
}

function parseVoiceFile(sourcePath: string): BrandVoice {
  const raw = fs.readFileSync(sourcePath, "utf-8");
  const stat = fs.statSync(sourcePath);

  return {
    styleBlock: extractSection(raw, "Style block") || extractFallbackStyle(),
    signaturePhrases: extractBullets(raw, "Signature phrases"),
    toneDescriptors: extractRankedList(raw, "Tone descriptors"),
    sourceVersion: path.basename(sourcePath),
    updatedAt: new Date(stat.mtimeMs).toISOString(),
    raw,
  };
}

function extractSection(md: string, headingPattern: string): string {
  // Match a "## Heading...\n" block, capture everything until the next "## " or end of file.
  const re = new RegExp(`##\\s+${escapeRegex(headingPattern)}[^\\n]*\\n+([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const m = md.match(re);
  if (!m) return "";
  // Strip trailing whitespace and any italicized "(none captured yet ...)" placeholders.
  return m[1].trim().replace(/\*\(?none captured yet[^*]*\)?\*/gi, "").trim();
}

function extractBullets(md: string, headingPattern: string): string[] {
  const section = extractSection(md, headingPattern);
  if (!section) return [];
  return section.split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("- "))
    .map((l) => l.slice(2).trim())
    // Drop sub-bullets that are just metadata like "appears N times in top decile".
    .map((l) => l.replace(/—\s*appears\s+\d+\s+times.*$/i, "").trim())
    .filter((l) => l.length > 0);
}

function extractRankedList(md: string, headingPattern: string): string[] {
  const section = extractSection(md, headingPattern);
  if (!section) return [];
  return section.split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\s+/.test(l))
    .map((l) => l.replace(/^\d+\.\s+/, "").trim())
    .filter((l) => l.length > 0);
}

function fallbackVoice(): BrandVoice {
  return {
    styleBlock: extractFallbackStyle(),
    signaturePhrases: [],
    toneDescriptors: ["Warm", "Editorial", "Curious", "Reassuring", "Plainspoken"],
    sourceVersion: "fallback",
    updatedAt: new Date().toISOString(),
    raw: "",
  };
}

function extractFallbackStyle(): string {
  // Mirrors the original inline 5-bullet block from routes/projects.ts so behavior
  // is identical if the voice-*.md files are missing entirely.
  return `Voice and style guide:
- Warm, plain, friendly. Like an editor explaining something curious to a friend.
- No emdashes. Use commas, periods, or sentence fragments instead.
- No jargon. No marketing speak. No "in today's world" openers.
- Concrete and specific. Show, do not tell.
- Sentence-case headlines. No ALL CAPS unless emphasising a single key word.`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
