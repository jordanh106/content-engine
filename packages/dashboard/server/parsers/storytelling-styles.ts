import fs from "fs";
import type { StorytellingStyle } from "../../shared/types.js";

let cache: StorytellingStyle[] | null = null;
let cacheMtime = 0;

export function invalidateStorytellingStylesCache(): void {
  cache = null;
  cacheMtime = 0;
}

/**
 * Parse YAML-block-tagged storytelling style presets from a markdown file.
 * Each style is a fenced ` ```yaml:storytelling-style ` block containing a single style record.
 * We parse minimal YAML (scalars, indented scalars, simple lists) — no full YAML deps.
 */
export function parseStorytellingStyles(filePath: string): StorytellingStyle[] {
  if (!fs.existsSync(filePath)) return [];

  const stat = fs.statSync(filePath);
  if (cache && stat.mtimeMs <= cacheMtime) return cache;

  const content = fs.readFileSync(filePath, "utf-8");
  const blocks: string[] = [];
  const re = /```yaml:storytelling-style\s*\n([\s\S]*?)\n```/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    blocks.push(match[1]);
  }

  const styles: StorytellingStyle[] = [];
  for (const block of blocks) {
    try {
      const style = parseStyleBlock(block);
      if (style) styles.push(style);
    } catch (err) {
      console.error("[storytelling-styles] parse error", err);
    }
  }

  cache = styles;
  cacheMtime = stat.mtimeMs;
  return styles;
}

type YamlValue = string | number | string[] | Record<string, unknown>;
type YamlMap = Record<string, YamlValue>;

function parseStyleBlock(block: string): StorytellingStyle | null {
  const tree = parseYamlMap(block, 0);
  if (!tree) return null;

  const voice = tree.voice as YamlMap | undefined;
  const visual = tree.visual as YamlMap | undefined;
  const motion = tree.motion as YamlMap | undefined;
  const audio = tree.audio_palette as YamlMap | undefined;
  const pacing = tree.pacing as YamlMap | undefined;

  if (!voice || !visual || !motion || !audio || !pacing) {
    throw new Error(`Style block missing required section: ${Object.keys(tree).join(",")}`);
  }

  return {
    key: asString(tree.key),
    displayName: asString(tree.displayName),
    tagline: asString(tree.tagline),
    exampleReels: asStringArray(tree.exampleReels),
    hookArchetypes: asStringArray(tree.hookArchetypes),
    voice: {
      elevenlabs_voice_id: asStringOrNull(voice.elevenlabs_voice_id),
      elevenlabs_voice_name: asString(voice.elevenlabs_voice_name),
      direction: asString(voice.direction),
      stability: asNumber(voice.stability),
      similarity_boost: asNumber(voice.similarity_boost),
      style: asNumber(voice.style),
      pace: asNumber(voice.pace),
    },
    visual: {
      aesthetic: asString(visual.aesthetic),
      model_hero: asString(visual.model_hero),
      model_draft: asString(visual.model_draft),
      resolution: asString(visual.resolution),
      compositionFormula: asString(visual.compositionFormula),
      negativePrompts: asStringArray(visual.negativePrompts),
    },
    motion: {
      direction: asString(motion.direction),
      model_hero: asString(motion.model_hero),
      model_draft: asString(motion.model_draft),
      defaultDurationSec: asNumber(motion.defaultDurationSec),
    },
    audio_palette: {
      music_brief: asString(audio.music_brief),
      sfx_beats: asStringArray(audio.sfx_beats),
    },
    pacing: {
      shotsFor15s: asNumber(pacing.shotsFor15s),
      shotsFor30s: asNumber(pacing.shotsFor30s),
      shotsFor45s: asNumber(pacing.shotsFor45s),
      shotsFor60s: asNumber(pacing.shotsFor60s),
      averageShotSec: asNumber(pacing.averageShotSec),
    },
  };
}

/**
 * Minimal YAML map parser.
 * Supports: `key: value`, indented `key:` followed by sub-map, lists `- item`, and scalars.
 * No anchors, flow style, multi-line scalars, or comments mid-line.
 */
function parseYamlMap(text: string, baseIndent: number): YamlMap {
  const lines = text.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#"));
  const result: YamlMap = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const indent = countIndent(line);
    if (indent < baseIndent) break;
    if (indent > baseIndent) { i++; continue; }
    const stripped = line.slice(indent);
    if (stripped.startsWith("- ")) { i++; continue; }
    const colonIdx = stripped.indexOf(":");
    if (colonIdx === -1) { i++; continue; }
    const key = stripped.slice(0, colonIdx).trim();
    const rawValue = stripped.slice(colonIdx + 1).trim();
    if (rawValue) {
      result[key] = parseScalar(rawValue);
      i++;
    } else {
      const childIndent = i + 1 < lines.length ? countIndent(lines[i + 1]) : baseIndent + 2;
      const childLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && countIndent(lines[j]) >= childIndent) {
        childLines.push(lines[j]);
        j++;
      }
      const childText = childLines.join("\n");
      const firstChild = childLines[0]?.slice(childIndent);
      if (firstChild && firstChild.startsWith("- ")) {
        result[key] = childLines.map((l) => unquote(l.slice(childIndent + 2).trim()));
      } else {
        result[key] = parseYamlMap(childText, childIndent);
      }
      i = j;
    }
  }
  return result;
}

function countIndent(line: string): number {
  let n = 0;
  while (n < line.length && line[n] === " ") n++;
  return n;
}

function parseScalar(raw: string): YamlValue {
  if (/^-?\d+(\.\d+)?$/.test(raw)) return parseFloat(raw);
  if (raw === "true") return "true";
  if (raw === "false") return "false";
  if (raw === "null") return "";
  return unquote(raw);
}

function unquote(s: string): string {
  return s.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

function asStringOrNull(v: unknown): string | null {
  if (v == null || v === "" || v === "null") return null;
  return asString(v);
}

function asNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseFloat(v) || 0;
  return 0;
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => asString(x)).filter(Boolean);
}
