import fs from "fs";
import path from "path";
import type { ParsedVideo, ShotPrompt, FormatId } from "../../shared/types.js";

const AUDIENCE_SECTION_MAP: Record<string, { id: string; label: string }> = {
  "Pregnancy & Postpartum": { id: "prenatal", label: "Pregnancy & Postpartum" },
  "Babies & Infants": { id: "infant", label: "Babies & Infants" },
  "Kids & Teens": { id: "kids", label: "Kids & Teens" },
  "Active Adults & Athletes": { id: "athlete", label: "Active Adults & Athletes" },
  "Adults & Daily Life": { id: "adult", label: "Adults & Daily Life" },
  "Seniors & Aging Well": { id: "senior", label: "Seniors & Aging Well" },
  "General & Whole Family": { id: "general", label: "Whole Family & General" },
  "Whole Family & General": { id: "general", label: "Whole Family & General" },
};

const FORMAT_NAMES: Record<string, string> = {
  A: "Explainer",
  B: "Checklist",
  C: "Demo",
  D: "Myth Buster",
  E: "Walkthrough",
};

let cache: ParsedVideo[] | null = null;
let cacheTimestamp = 0;

export function invalidateCache(): void {
  cache = null;
  cacheTimestamp = 0;
}

export function parseContentLibrary(filePath: string): ParsedVideo[] {
  const stat = fs.statSync(filePath);
  if (cache && stat.mtimeMs <= cacheTimestamp) {
    return cache;
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const videos: ParsedVideo[] = [];

  let currentAudience = { id: "general", label: "General" };
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Detect audience section headers: ### Audience Name
    const audienceMatch = line.match(/^###\s+(.+)$/);
    if (audienceMatch && !line.startsWith("####")) {
      const sectionName = audienceMatch[1].trim();
      const mapped = AUDIENCE_SECTION_MAP[sectionName];
      if (mapped) {
        currentAudience = mapped;
      }
      i++;
      continue;
    }

    // Detect video headers: #### CODE: Title
    const videoMatch = line.match(/^####\s+([A-Z]\d+):\s+(.+)$/);
    if (videoMatch) {
      const code = videoMatch[1];
      const title = videoMatch[2].trim();
      i++;

      // Parse format/duration/tags line
      let format: FormatId = "A";
      let duration = 30;
      let tags: string[] = [];

      while (i < lines.length && !lines[i].startsWith("**Voiceover")) {
        const metaMatch = lines[i].match(
          /\*\*Format:\*\*\s+([A-E])\s+\([^)]+\)\s+\|\s+\*\*Duration:\*\*\s+(\d+)s\s+\|\s+\*\*Tags:\*\*\s+(.+)/,
        );
        if (metaMatch) {
          format = metaMatch[1] as FormatId;
          duration = parseInt(metaMatch[2], 10);
          tags = metaMatch[3].split(",").map((t) => t.trim());
        }
        i++;
      }

      // Parse voiceover script (blockquote lines starting with >)
      const scriptLines: string[] = [];
      const deliveryCues: string[] = [];

      // Skip the "**Voiceover Script:**" line
      if (i < lines.length && lines[i].startsWith("**Voiceover")) {
        i++;
      }

      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith(">")) {
          const scriptText = l.replace(/^>\s*/, "");
          scriptLines.push(scriptText);

          // Extract delivery cues like [Warm, empathetic]
          const cueMatches = scriptText.match(/\[([^\]]+)\]/g);
          if (cueMatches) {
            deliveryCues.push(...cueMatches.map((c) => c.slice(1, -1)));
          }
        } else if (l === "" && scriptLines.length > 0) {
          // Empty line after script content - might be end of script
          i++;
          // Check if next non-empty line is still a blockquote
          while (i < lines.length && lines[i].trim() === "") i++;
          if (i < lines.length && lines[i].trim().startsWith(">")) {
            scriptLines.push(""); // preserve paragraph break
            continue;
          }
          break;
        } else if (l.startsWith("**Cinema") || l.startsWith("**Vibe")) {
          break;
        } else if (l === "") {
          i++;
          continue;
        } else {
          break;
        }
        i++;
      }

      // Parse Cinema Studio shots table
      const shots: ShotPrompt[] = [];

      // Find the shots table
      while (
        i < lines.length &&
        !lines[i].startsWith("**Cinema") &&
        !lines[i].startsWith("**Vibe") &&
        !lines[i].startsWith("---") &&
        !lines[i].startsWith("####")
      ) {
        i++;
      }

      if (i < lines.length && lines[i].startsWith("**Cinema")) {
        i++; // skip the header
        // Skip empty lines and table header
        while (i < lines.length) {
          const l = lines[i].trim();
          if (l === "" || l.startsWith("| Shot") || l.startsWith("|---")) {
            i++;
            continue;
          }
          if (!l.startsWith("|")) break;

          // Parse table row: | 1 | 3s | prompt text | camera movement |
          const cells = l
            .split("|")
            .map((c) => c.trim())
            .filter((c) => c.length > 0);
          if (cells.length >= 4) {
            const shotNum = parseInt(cells[0], 10);
            const shotDur = parseInt(cells[1].replace("s", ""), 10);
            if (!isNaN(shotNum) && !isNaN(shotDur)) {
              shots.push({
                number: shotNum,
                duration: shotDur,
                prompt: cells[2],
                cameraMovement: cells[3],
              });
            }
          }
          i++;
        }
      }

      // Parse optional Vibe Motion line
      let vibeMotion: string | null = null;
      while (i < lines.length) {
        const l = lines[i].trim();
        if (l.startsWith("**Vibe Motion")) {
          vibeMotion = l.replace(/\*\*Vibe Motion:?\*\*\s*/, "").trim();
          i++;
          break;
        }
        if (l.startsWith("---") || l.startsWith("####")) break;
        i++;
      }

      videos.push({
        code,
        title,
        format,
        formatName: FORMAT_NAMES[format] || format,
        duration,
        tags,
        audience: currentAudience.id,
        audienceLabel: currentAudience.label,
        script: scriptLines.join("\n"),
        deliveryCues,
        shots,
        vibeMotion,
      });

      continue;
    }

    i++;
  }

  cache = videos;
  cacheTimestamp = stat.mtimeMs;
  return videos;
}

export function getContentLibraryPath(industryDir: string): string {
  return path.join(industryDir, "content-library.md");
}

/**
 * Update a video's script in content-library.md.
 * Finds the video by code, replaces the blockquote script lines,
 * preserves all other content (metadata, shots, vibe motion).
 */
export function updateVideoScript(filePath: string, videoCode: string, newScript: string): boolean {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  // Find the video header line: #### CODE: Title
  const headerPattern = new RegExp(`^####\\s+${videoCode}:\\s+`);
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headerPattern.test(lines[i])) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return false;

  // Find the "**Voiceover Script:**" line after the header
  let voiceoverIdx = -1;
  for (let i = headerIdx + 1; i < lines.length && i < headerIdx + 10; i++) {
    if (lines[i].startsWith("**Voiceover")) {
      voiceoverIdx = i;
      break;
    }
  }
  if (voiceoverIdx === -1) return false;

  // Find the range of blockquote lines (the script body)
  let scriptStart = voiceoverIdx + 1;
  // Skip any blank lines between the voiceover header and first blockquote
  while (scriptStart < lines.length && lines[scriptStart].trim() === "") scriptStart++;

  let scriptEnd = scriptStart;
  while (scriptEnd < lines.length) {
    const l = lines[scriptEnd].trim();
    if (l.startsWith(">")) {
      scriptEnd++;
    } else if (l === "") {
      // Could be paragraph break within script — peek ahead
      let peek = scriptEnd + 1;
      while (peek < lines.length && lines[peek].trim() === "") peek++;
      if (peek < lines.length && lines[peek].trim().startsWith(">")) {
        scriptEnd = peek;
        continue;
      }
      break;
    } else {
      break;
    }
  }

  // Build the new blockquote lines from the script text
  const newScriptLines = newScript
    .split("\n")
    .map((line) => {
      if (line.trim() === "") return "";
      // Don't double-prefix if already has >
      return line.startsWith("> ") ? line : `> ${line}`;
    });

  // Splice: remove old script lines, insert new ones
  const before = lines.slice(0, scriptStart);
  const after = lines.slice(scriptEnd);
  const updated = [...before, ...newScriptLines, ...after];

  fs.writeFileSync(filePath, updated.join("\n"), "utf-8");
  invalidateCache();
  return true;
}
