import fs from "fs";
import type { QuickStartTemplate, QuickStartTemplateGroup, QuickStartTemplateGenerate, ProjectKind } from "../../shared/types.js";

let cache: QuickStartTemplate[] | null = null;
let cacheMtime = 0;

export function invalidateQuickStartTemplatesCache(): void {
  cache = null;
  cacheMtime = 0;
}

/**
 * Parse the YAML-tagged quickstart-templates.md file. Reuses the same minimal YAML approach as
 * the storytelling-styles parser — no full YAML lib dependency.
 */
export function parseQuickStartTemplates(filePath: string): QuickStartTemplate[] {
  if (!fs.existsSync(filePath)) return [];
  const stat = fs.statSync(filePath);
  if (cache && stat.mtimeMs <= cacheMtime) return cache;

  const content = fs.readFileSync(filePath, "utf-8");
  const out: QuickStartTemplate[] = [];
  const re = /```yaml:quickstart-template\s*\n([\s\S]*?)\n```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    try {
      const parsed = parseBlock(m[1]);
      if (parsed) out.push(parsed);
    } catch (err) {
      console.error("[quickstart-templates] parse error", err);
    }
  }
  cache = out;
  cacheMtime = stat.mtimeMs;
  return out;
}

function parseBlock(block: string): QuickStartTemplate | null {
  const lines = block.split("\n");
  const obj: Record<string, string> = {};
  let inBriefTemplate = false;
  let inGenerates = false;
  let briefLines: string[] = [];
  const generates: QuickStartTemplateGenerate[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (inBriefTemplate) {
      // Brief continues until we hit a top-level key (no leading space) or `generates:`
      const isTopLevelKey = !line.startsWith(" ") && /^\w+:/.test(trimmed) && !trimmed.startsWith("- ");
      if (isTopLevelKey) {
        inBriefTemplate = false;
        // fall through to handle this line
      } else {
        // Strip the 2-space indent that YAML pipe block adds
        briefLines.push(line.replace(/^  /, ""));
        continue;
      }
    }

    if (inGenerates) {
      if (trimmed.startsWith("- ")) {
        const item = parseGenerateLine(trimmed.slice(2).trim());
        if (item) generates.push(item);
        continue;
      } else if (line.startsWith(" ")) {
        continue;
      } else {
        inGenerates = false;
        // fall through
      }
    }

    if (trimmed === "briefTemplate: |") {
      inBriefTemplate = true;
      briefLines = [];
      continue;
    }
    if (trimmed === "generates:") {
      inGenerates = true;
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (value) obj[key] = unquote(value);
  }

  if (!obj.key || !obj.projectKind || !obj.group || !obj.displayName) return null;

  return {
    key: obj.key,
    projectKind: obj.projectKind as ProjectKind,
    group: obj.group as QuickStartTemplateGroup,
    displayName: obj.displayName,
    icon: obj.icon || "Sparkles",
    blurb: obj.blurb || "",
    estimatedCreditsLow: parseInt(obj.estimatedCreditsLow || "0", 10),
    estimatedCreditsHigh: parseInt(obj.estimatedCreditsHigh || "0", 10),
    estimatedMinutes: parseInt(obj.estimatedMinutes || "0", 10),
    briefTemplate: briefLines.join("\n").trimEnd(),
    generates,
  };
}

function parseGenerateLine(s: string): QuickStartTemplateGenerate | null {
  // Format: { kind: image, model: nano_banana_2, count: 3, label: hero_v, aspect: "16:9", resolution: "2k" }
  if (!s.startsWith("{") || !s.endsWith("}")) return null;
  const inner = s.slice(1, -1).trim();
  const pairs = splitTopLevel(inner, ",");
  const obj: Record<string, string> = {};
  for (const p of pairs) {
    const colonIdx = p.indexOf(":");
    if (colonIdx === -1) continue;
    const k = p.slice(0, colonIdx).trim();
    const v = unquote(p.slice(colonIdx + 1).trim());
    obj[k] = v;
  }
  const kind = obj.kind;
  if (!kind) return null;
  if (kind === "image") {
    return {
      kind: "image",
      model: obj.model || "nano_banana_2",
      count: obj.count ? parseInt(obj.count, 10) : 1,
      label: obj.label || "image",
      aspect: obj.aspect,
      resolution: obj.resolution,
    };
  }
  if (kind === "video") {
    return {
      kind: "video",
      model: obj.model || "kling",
      durationSec: parseInt(obj.durationSec || "5", 10),
      label: obj.label || "video",
      aspect: obj.aspect,
    };
  }
  if (kind === "html") {
    return { kind: "html", label: obj.label || "html" };
  }
  if (kind === "carousel") {
    return { kind: "carousel", slides: parseInt(obj.slides || "5", 10), label: obj.label || "carousel" };
  }
  return null;
}

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let inStr = false;
  let strCh = "";
  let cur = "";
  for (const c of s) {
    if (inStr) {
      if (c === strCh) inStr = false;
      cur += c;
    } else if (c === '"' || c === "'") {
      inStr = true; strCh = c; cur += c;
    } else if (c === "{" || c === "[") {
      depth++; cur += c;
    } else if (c === "}" || c === "]") {
      depth--; cur += c;
    } else if (depth === 0 && c === sep) {
      out.push(cur.trim()); cur = "";
    } else {
      cur += c;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function unquote(s: string): string {
  return s.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
}
