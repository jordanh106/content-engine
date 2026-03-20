import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { sqlite } from "../db.js";
import type { CreatorPersona } from "../../shared/types.js";

function parsePersonaRow(row: Record<string, unknown>): CreatorPersona {
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
}

function safeParseJson(val: string | null): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function personaToDb(body: Partial<CreatorPersona>) {
  return {
    name: body.name,
    role: body.role ?? null,
    initials: body.initials ?? null,
    avatar_color: body.avatarColor ?? null,
    voice_tone: body.voiceTone ?? null,
    humor_style: body.humorStyle ?? null,
    content_strengths: body.contentStrengths ? JSON.stringify(body.contentStrengths) : null,
    audience_affinities: body.audienceAffinities ? JSON.stringify(body.audienceAffinities) : null,
    hook_preferences: body.hookPreferences ? JSON.stringify(body.hookPreferences) : null,
    sentence_style: body.sentenceStyle ?? null,
    do_not: body.doNot ? JSON.stringify(body.doNot) : null,
    example_lines: body.exampleLines ? JSON.stringify(body.exampleLines) : null,
    vault_style_id: body.vaultStyleId ?? null,
  };
}

export function createPersonasRouter() {
  const router = Router();

  const client = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  // GET /api/personas — list active personas
  router.get("/", (_req, res) => {
    try {
      const rows = sqlite.prepare("SELECT * FROM creator_personas WHERE is_active = 1 ORDER BY id ASC").all() as Record<string, unknown>[];
      res.json({ personas: rows.map(parsePersonaRow) });
    } catch {
      res.status(500).json({ error: "Failed to fetch personas" });
    }
  });

  // GET /api/personas/:id
  router.get("/:id", (req, res) => {
    try {
      const row = sqlite.prepare("SELECT * FROM creator_personas WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
      if (!row) { res.status(404).json({ error: "Persona not found" }); return; }
      res.json({ persona: parsePersonaRow(row) });
    } catch {
      res.status(500).json({ error: "Failed to fetch persona" });
    }
  });

  // POST /api/personas — create
  router.post("/", (req, res) => {
    const body = req.body as Partial<CreatorPersona>;
    if (!body.name?.trim()) { res.status(400).json({ error: "name required" }); return; }
    try {
      const db = personaToDb(body);
      const stmt = sqlite.prepare(`
        INSERT INTO creator_personas (name, role, initials, avatar_color, voice_tone, humor_style, content_strengths, audience_affinities, hook_preferences, sentence_style, do_not, example_lines, vault_style_id)
        VALUES (@name, @role, @initials, @avatar_color, @voice_tone, @humor_style, @content_strengths, @audience_affinities, @hook_preferences, @sentence_style, @do_not, @example_lines, @vault_style_id)
      `);
      const result = stmt.run(db);
      const row = sqlite.prepare("SELECT * FROM creator_personas WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>;
      res.json({ persona: parsePersonaRow(row) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create persona";
      res.status(500).json({ error: msg });
    }
  });

  // PUT /api/personas/:id — update
  router.put("/:id", (req, res) => {
    const body = req.body as Partial<CreatorPersona>;
    try {
      const db = personaToDb(body);
      sqlite.prepare(`
        UPDATE creator_personas SET
          name = COALESCE(@name, name),
          role = @role,
          initials = @initials,
          avatar_color = @avatar_color,
          voice_tone = @voice_tone,
          humor_style = @humor_style,
          content_strengths = @content_strengths,
          audience_affinities = @audience_affinities,
          hook_preferences = @hook_preferences,
          sentence_style = @sentence_style,
          do_not = @do_not,
          example_lines = @example_lines,
          vault_style_id = @vault_style_id,
          updated_at = datetime('now')
        WHERE id = ?
      `).run({ ...db }, req.params.id);
      const row = sqlite.prepare("SELECT * FROM creator_personas WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
      if (!row) { res.status(404).json({ error: "Persona not found" }); return; }
      res.json({ persona: parsePersonaRow(row) });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update persona";
      res.status(500).json({ error: msg });
    }
  });

  // DELETE /api/personas/:id — soft delete
  router.delete("/:id", (req, res) => {
    try {
      sqlite.prepare("UPDATE creator_personas SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch {
      res.status(500).json({ error: "Failed to delete persona" });
    }
  });

  // POST /api/personas/:id/extract — auto-extract voice from transcript
  router.post("/:id/extract", async (req, res) => {
    const { transcript } = req.body as { transcript?: string };
    if (!transcript?.trim()) { res.status(400).json({ error: "transcript required" }); return; }
    if (!client) { res.status(503).json({ error: "AI unavailable" }); return; }

    try {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: `Analyze this script/transcript and extract voice characteristics for a creator persona profile. Return JSON only.

TRANSCRIPT:
${transcript.slice(0, 3000)}

Return this exact JSON structure:
{
  "voiceTone": "2-3 sentences describing overall tone and authority style",
  "humorStyle": "describe humor approach — how jokes land, when used",
  "sentenceStyle": "sentence length, rhythm, distinctive patterns",
  "contentStrengths": ["strength1", "strength2", "strength3"],
  "hookPreferences": ["one of: question, myth_contrarian, statistic, story_emotional, pattern_interrupt, did_you_know"],
  "doNot": ["thing to avoid based on what is clearly absent from this voice"],
  "exampleLines": ["verbatim line 1 from the transcript", "verbatim line 2", "verbatim line 3"]
}`,
        }],
      });

      const textBlock = msg.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") throw new Error("No response");

      let parsed: Record<string, unknown>;
      try {
        const text = textBlock.text.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        parsed = JSON.parse(text);
      } catch {
        throw new Error("Failed to parse AI response");
      }

      res.json({ extracted: parsed });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Extraction failed" });
    }
  });

  // POST /api/personas/:id/preview — generate sample hook in this persona's voice
  router.post("/:id/preview", async (req, res) => {
    const { topic } = req.body as { topic?: string };
    if (!topic?.trim()) { res.status(400).json({ error: "topic required" }); return; }
    if (!client) { res.status(503).json({ error: "AI unavailable" }); return; }

    try {
      const row = sqlite.prepare("SELECT * FROM creator_personas WHERE id = ?").get(req.params.id) as Record<string, unknown> | undefined;
      if (!row) { res.status(404).json({ error: "Persona not found" }); return; }
      const persona = parsePersonaRow(row);

      const personaContext = `
Creator: ${persona.name}
Tone: ${persona.voiceTone ?? ""}
Humor: ${persona.humorStyle ?? ""}
Sentences: ${persona.sentenceStyle ?? ""}
Do NOT: ${persona.doNot.join(", ")}
Example lines: ${persona.exampleLines.map((l) => `"${l}"`).join(" | ")}
      `.trim();

      const msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        messages: [{
          role: "user",
          content: `Write one 5-second video hook for this topic in this creator's exact voice. Return only the hook line, no quotes, no explanation.

TOPIC: ${topic}
${personaContext}`,
        }],
      });

      const textBlock = msg.content.find((b) => b.type === "text");
      const hookLine = textBlock && textBlock.type === "text"
        ? textBlock.text.trim().replace(/^["']|["']$/g, "")
        : "";

      res.json({ hookLine });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Preview failed" });
    }
  });

  return router;
}
