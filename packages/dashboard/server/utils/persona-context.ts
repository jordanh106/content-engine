import { sqlite } from "../db.js";
import type { CreatorPersona } from "../../shared/types.js";

function safeParseJson(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadPersona(creatorId: number | null): CreatorPersona | null {
  if (!creatorId) return null;
  try {
    const row = sqlite.prepare("SELECT * FROM creator_personas WHERE id = ? AND is_active = 1").get(creatorId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as number,
      name: row.name as string,
      role: (row.role as string | null) ?? null,
      initials: (row.initials as string | null) ?? null,
      avatarColor: (row.avatar_color as string | null) ?? null,
      voiceTone: (row.voice_tone as string | null) ?? null,
      humorStyle: (row.humor_style as string | null) ?? null,
      contentStrengths: safeParseJson(row.content_strengths as string | null),
      audienceAffinities: safeParseJson(row.audience_affinities as string | null),
      hookPreferences: safeParseJson(row.hook_preferences as string | null),
      sentenceStyle: (row.sentence_style as string | null) ?? null,
      doNot: safeParseJson(row.do_not as string | null),
      exampleLines: safeParseJson(row.example_lines as string | null),
      vaultStyleId: (row.vault_style_id as number | null) ?? null,
      isActive: (row.is_active as number) === 1,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  } catch {
    return null;
  }
}

export function buildPersonaPrompt(persona: CreatorPersona | null): string {
  if (!persona) return "";
  return `
CREATOR VOICE — generating content for ${persona.name}:
- Tone: ${persona.voiceTone ?? ""}
- Humor: ${persona.humorStyle ?? ""}
- Sentences: ${persona.sentenceStyle ?? ""}
- Strengths: ${persona.contentStrengths.join(", ")}
- Audience affinities: ${persona.audienceAffinities.join(", ")}
- Hook preferences: ${persona.hookPreferences.join(", ")}
- Do NOT: ${persona.doNot.join("; ")}
- Voice examples: ${persona.exampleLines.map((l) => `"${l}"`).join(" | ")}
Adapt all output to match this creator's voice while maintaining the shared brand voice above.
  `.trim();
}
