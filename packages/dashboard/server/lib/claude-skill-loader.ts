/**
 * Read installed Claude skills from ~/.claude/skills/<name>/SKILL.md or
 * any nested SKILL.md under that directory. Returns the raw markdown so a
 * server-side Anthropic call can prepend it as a system prompt.
 *
 * Returns null when the skill isn't installed — callers should fall back
 * to their built-in prompt.
 */
import fs from "fs";
import path from "path";

const SKILLS_ROOT = path.join(process.env.HOME || "", ".claude", "skills");

const cache = new Map<string, { content: string | null; mtime: number }>();

/**
 * Reads SKILL.md at ~/.claude/skills/<skillName>/SKILL.md.
 * If `subSkill` is given, reads ~/.claude/skills/<skillName>/skills/<subSkill>/SKILL.md
 * (used by multi-skill packs like seedance-director).
 */
export function readSkillIfPresent(skillName: string, subSkill?: string): string | null {
  const key = subSkill ? `${skillName}::${subSkill}` : skillName;
  const dir = subSkill
    ? path.join(SKILLS_ROOT, skillName, "skills", subSkill)
    : path.join(SKILLS_ROOT, skillName);
  const filePath = path.join(dir, "SKILL.md");

  try {
    const stat = fs.statSync(filePath);
    const cached = cache.get(key);
    if (cached && cached.mtime === stat.mtimeMs) return cached.content;

    const content = fs.readFileSync(filePath, "utf-8");
    cache.set(key, { content, mtime: stat.mtimeMs });
    return content;
  } catch {
    cache.set(key, { content: null, mtime: 0 });
    return null;
  }
}

/** List all sub-skills inside a skill pack (e.g. seedance-director has 15). */
export function listSubSkills(skillName: string): string[] {
  const subDir = path.join(SKILLS_ROOT, skillName, "skills");
  try {
    return fs
      .readdirSync(subDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => fs.existsSync(path.join(subDir, n, "SKILL.md")));
  } catch {
    return [];
  }
}

/**
 * For Seedance prompts: pick the most relevant sub-skill from `seedance-director`
 * based on a short hint (the shot description or video genre).
 * Falls back to "01-cinematic" if available, else returns the top-level SKILL.md if any.
 */
export function pickSeedanceSkill(hint: string): string | null {
  const subSkills = listSubSkills("seedance-director");
  if (subSkills.length === 0) return readSkillIfPresent("seedance-director");

  const hintLower = hint.toLowerCase();
  const ranked = subSkills.map((name) => {
    const slug = name.replace(/^\d+-/, "").replace(/-/g, " ");
    const score = slug
      .split(" ")
      .reduce((s, word) => s + (hintLower.includes(word) ? 1 : 0), 0);
    return { name, score };
  });
  ranked.sort((a, b) => b.score - a.score);

  const top = ranked[0];
  if (top && top.score > 0) return readSkillIfPresent("seedance-director", top.name);

  // Default to cinematic if no strong match
  const cinematic = subSkills.find((n) => n.includes("cinematic")) || subSkills[0];
  return readSkillIfPresent("seedance-director", cinematic);
}

/** Status summary for the /api/higgsfield/status endpoint. */
export function skillInstallStatus(): { name: string; installed: boolean; subSkills?: string[] }[] {
  const seedanceSubs = listSubSkills("seedance-director");
  return [
    {
      name: "nano-banana-prompts",
      installed: readSkillIfPresent("nano-banana-prompts") != null,
    },
    {
      name: "seedance-director",
      installed: seedanceSubs.length > 0 || readSkillIfPresent("seedance-director") != null,
      subSkills: seedanceSubs.length > 0 ? seedanceSubs : undefined,
    },
  ];
}
