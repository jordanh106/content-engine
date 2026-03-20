import fs from "fs";
import path from "path";
import { Router, Request, Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { parseContentLibrary } from "../parsers/content-library.js";
import type { ConversationMessage } from "../../shared/types.js";
import { FORMATS } from "../../shared/types.js";

function extractJSON(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
  }
  if (!cleaned.startsWith("{") && !cleaned.startsWith("[")) {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return match[0];
  }
  return cleaned;
}

function buildFormatTable(): string {
  return Object.entries(FORMATS)
    .map(([id, f]) => `${id}: ${f.name}`)
    .join(", ");
}

export function createIdeaLabRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);

  const client = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  function loadContext(): {
    brand: string;
    librarySummary: string;
    hookPatterns: string;
    audiences: string;
    formatTable: string;
  } {
    let brand = "";
    try {
      const brandPath = path.join(industryDir, "brand.md");
      if (fs.existsSync(brandPath)) brand = fs.readFileSync(brandPath, "utf-8").slice(0, 1200);
    } catch { /* ignore */ }

    let librarySummary = "";
    try {
      const videos = parseContentLibrary(contentLibraryPath);
      librarySummary = videos
        .slice(0, 60)
        .map((v) => `${v.code}: "${v.title}" (${v.format}, ${v.audienceLabel})`)
        .join("\n");
    } catch { /* ignore */ }

    let hookPatterns = "";
    try {
      const hookPath = path.join(industryDir, "hook-patterns.md");
      if (fs.existsSync(hookPath)) hookPatterns = fs.readFileSync(hookPath, "utf-8").slice(0, 1000);
    } catch { /* ignore */ }

    let audiences = "";
    try {
      const configPath = path.join(industryDir, "config.json");
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
        audiences?: Array<{ label: string; description?: string }>;
      };
      audiences = (config.audiences || []).map((a) => `- ${a.label}${a.description ? ": " + a.description : ""}`).join("\n");
    } catch { /* ignore */ }

    return { brand, librarySummary, hookPatterns, audiences, formatTable: buildFormatTable() };
  }

  async function streamResponse(
    systemPrompt: string,
    userContent: string,
    conversationHistory: ConversationMessage[],
    req: Request,
    res: Response,
    routeName: string
  ): Promise<void> {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const sendEvent = (data: Record<string, unknown>) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...conversationHistory,
      { role: "user", content: userContent },
    ];

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      messages,
    });

    req.on("close", () => stream.abort());

    let fullText = "";
    let lastProgressChars = 0;

    stream.on("text", (textChunk: string) => {
      fullText += textChunk;
      if (fullText.length - lastProgressChars >= 80) {
        sendEvent({ type: "progress", chars: fullText.length });
        lastProgressChars = fullText.length;
      }
    });

    try {
      await stream.finalMessage();
      const parsed = JSON.parse(extractJSON(fullText));
      sendEvent({ type: "result", data: parsed });
    } catch (err) {
      const isAbort = err instanceof Error && (
        err.name === "AbortError" ||
        err.name === "APIUserAbortError" ||
        err.message.toLowerCase().includes("abort")
      );
      if (!isAbort) {
        const status = (err as { status?: number }).status;
        const msg =
          status === 429
            ? "Rate limited — wait 30 seconds and try again."
            : err instanceof Error
            ? err.message
            : "Request failed";
        console.error(`[idea-lab/${routeName}] Error:`, msg);
        sendEvent({ type: "error", message: msg });
      }
    } finally {
      if (!res.writableEnded) res.end();
    }
  }

  // POST /api/idea-lab/spark-url
  // Body: { url: string, description?: string }
  // Streams SSE → result: UrlSparkResult
  router.post("/spark-url", async (req, res) => {
    const { url, description, creatorId } = req.body as { url?: string; description?: string; creatorId?: number };
    if (!url) {
      res.status(400).json({ error: "url is required" });
      return;
    }

    const { brand, librarySummary, audiences, formatTable } = loadContext();

    let personaPrompt = "";
    if (creatorId) {
      const { loadPersona, buildPersonaPrompt } = await import("../utils/persona-context.js");
      const persona = loadPersona(creatorId);
      personaPrompt = buildPersonaPrompt(persona);
    }

    // Try YouTube oEmbed metadata (free, no API key needed)
    let videoMeta = "";
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const r = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
      if (r.ok) {
        const data = await r.json() as { title?: string; author_name?: string };
        if (data.title) videoMeta = `Title: "${data.title}"\nCreator: ${data.author_name || "Unknown"}`;
      }
    } catch { /* not YouTube or network error — use URL + description */ }

    const systemPrompt = `You are a content pattern analyst for a chiropractic practice. Your job is to reverse-engineer what makes a video work, then generate niche-specific adaptations — not copies, but translations of the same structural pattern applied to a different audience.

BRAND VOICE:
${brand.slice(0, 600)}

AUDIENCE SEGMENTS:
${audiences}

VIDEO FORMATS AVAILABLE: ${formatTable}
Format details:
- A (Explainer): 30-45s, education/awareness
- B (Checklist): 30-45s, shareability/saves, "X signs you have Y"
- C (Demo): 30-60s, hands-on tutorials
- D (Myth Buster): 15-30s, contrarian/engagement
- E (Walkthrough): 45-60s, process/conversion
- F (Quick Tip): 6-15s, micro-content
- G (Patient Story): 15-30s, social proof

EXISTING CONTENT (avoid duplicating these exact topics):
${librarySummary.slice(0, 800)}

RULES:
1. No emdashes. Use commas, periods, or restructure sentences.
2. Adaptations must be translations of the same pattern, not the same topic.
3. Each adaptation must be specific and immediately actionable.
4. difficultyLevel must be "Easy", "Medium", or "Advanced".
5. Respond with valid JSON only — no markdown, no extra text.
${personaPrompt ? `\n${personaPrompt}` : ""}`;

    const userContent = `Analyze this video and generate 3 niche-specific adaptations for a prenatal/pediatric chiropractic practice.

VIDEO URL: ${url}
${videoMeta ? `VIDEO METADATA:\n${videoMeta}` : ""}
${description ? `WHAT I NOTICED: ${description}` : ""}

Step 1: Identify the structural pattern (what makes it work regardless of topic).
Step 2: Identify the hook mechanism (the psychological trigger that stops scroll).
Step 3: Generate 3 adaptations for our chiropractic audience.

Respond with this exact JSON structure:
{
  "sourcePattern": "2-3 sentence description of the structural pattern that makes this video work",
  "hookMechanism": "1-2 sentences on the psychological trigger — why it stops scroll",
  "adaptations": [
    {
      "adaptedTopic": "specific topic for our practice",
      "hookLine": "exact opening line — the first 3 seconds of script",
      "suggestedFormat": "A (Explainer)",
      "targetAudience": "which audience segment this reaches",
      "whyItWorks": "1-2 sentences on why this pattern works for our audience",
      "timeToFilm": "15min|30min|45min|1hr",
      "difficultyLevel": "Easy|Medium|Advanced"
    }
  ]
}`;

    await streamResponse(systemPrompt, userContent, [], req, res, "spark-url");
  });

  // POST /api/idea-lab/guide
  // Body: { message: string, conversationHistory?: ConversationMessage[] }
  // Streams SSE → result: { response: string, isComplete: boolean, idea?: FormedIdea }
  router.post("/guide", async (req, res) => {
    const { message, conversationHistory = [], creatorId } = req.body as {
      message?: string;
      conversationHistory?: ConversationMessage[];
      creatorId?: number;
    };
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }

    const { brand, librarySummary, hookPatterns, audiences, formatTable } = loadContext();

    let personaPrompt = "";
    if (creatorId) {
      const { loadPersona, buildPersonaPrompt } = await import("../utils/persona-context.js");
      const persona = loadPersona(creatorId);
      personaPrompt = buildPersonaPrompt(persona);
    }

    const systemPrompt = `You are a creative content development coach helping someone shape a loose idea into a production-ready video concept for a prenatal and pediatric chiropractic practice.

Your role: Ask ONE targeted question at a time to extract what they're really trying to make. Never ask multiple questions at once. Be warm, encouraging, and concise.

After 2-3 exchanges (when you have enough information), synthesize their input into a concrete idea. Signal completion with "readyForProduction: true" in your JSON.

BRAND VOICE:
${brand.slice(0, 500)}

AUDIENCE SEGMENTS:
${audiences}

VIDEO FORMATS: ${formatTable}

HOOK PATTERNS LIBRARY (for reference):
${hookPatterns.slice(0, 600)}

EXISTING CONTENT (avoid duplicating):
${librarySummary.slice(0, 600)}

RULES:
1. No emdashes. Use commas, periods, or restructure.
2. Ask ONE question per turn — never a list of questions.
3. Questions should clarify: audience, desired outcome, or visual format.
4. After 2-3 exchanges, synthesize into the idea JSON.
5. Respond with valid JSON only. No markdown, no extra text.
${personaPrompt ? `\n${personaPrompt}\n` : ""}
RESPONSE FORMAT (every turn):
{
  "response": "Your conversational reply — either a clarifying question OR the synthesis announcement (e.g. 'Here is what I think you are making:')",
  "isComplete": false,
  "idea": null
}

When the idea is fully formed (after 2-3 exchanges):
{
  "response": "Here is what I think you are making: [1-2 sentence summary]",
  "isComplete": true,
  "idea": {
    "topic": "specific video topic",
    "hookAngle": "the opening hook line",
    "suggestedFormat": "B (Checklist)",
    "targetAudience": "audience segment",
    "whyItWorks": "why this resonates with the audience",
    "readyForProduction": true
  }
}`;

    const userContent = message;

    await streamResponse(systemPrompt, userContent, conversationHistory, req, res, "guide");
  });

  // POST /api/idea-lab/mutate
  // Body: { topic: string, hookAngle?: string, audience?: string }
  // Returns: { mutations: FormatMutation[] }
  router.post("/mutate", async (req, res) => {
    const { topic, hookAngle, audience, creatorId } = req.body as {
      topic?: string;
      hookAngle?: string;
      audience?: string;
      creatorId?: number;
    };
    if (!topic) {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    const { brand, audiences } = loadContext();

    let personaPrompt = "";
    if (creatorId) {
      const { loadPersona, buildPersonaPrompt } = await import("../utils/persona-context.js");
      const persona = loadPersona(creatorId);
      personaPrompt = buildPersonaPrompt(persona);
    }

    const prompt = `You are a content format strategist for a prenatal and pediatric chiropractic practice. Take a single idea and show how it would look in all 7 video format templates simultaneously.

BRAND VOICE:
${brand.slice(0, 500)}

AUDIENCE SEGMENTS:
${audiences}

FORMAT GUIDE:
A (Explainer) — 30-45s — "What Is [X]?" — Instagram/YouTube — Education, SEO
B (Checklist) — 30-45s — "X Signs You Have Y" — Instagram/TikTok — Shareability, saves
C (Demo) — 30-60s — "The Exercise/Tutorial" — All platforms — Actionable value
D (Myth Buster) — 15-30s — "Myth vs. Truth" — TikTok/Instagram — Engagement, comments
E (Walkthrough) — 45-60s — "What Happens During [X]" — YouTube/Instagram — Conversion
F (Quick Tip) — 6-15s — "Did You Know?" — TikTok — Micro-content
G (Patient Story) — 15-30s — "This Changed Everything" — Instagram — Social proof

IDEA TO MUTATE:
Topic: ${topic}
${hookAngle ? `Original hook: ${hookAngle}` : ""}
${audience ? `Audience: ${audience}` : ""}

Generate all 7 format mutations. Each must feel like a distinct video, not a copy. The topic adapts to fit each format's strengths.

RULES:
1. No emdashes. Use commas, periods, or restructure.
2. difficultyLevel must be "Easy", "Medium", or "Advanced".
3. platformFit is an array of platform names from: ["TikTok", "Instagram", "YouTube"].
4. Each adaptedHook is the first 3 seconds of script.
5. Valid JSON only. No markdown, no extra text.
${personaPrompt ? `\n${personaPrompt}` : ""}

Respond with:
{
  "mutations": [
    {
      "format": "A",
      "formatName": "Explainer",
      "adaptedTopic": "specific title for this format",
      "adaptedHook": "verbatim opening line",
      "estimatedRuntime": "35s",
      "platformFit": ["Instagram", "YouTube"],
      "difficultyLevel": "Easy",
      "whyThisFormat": "1 sentence on why this format works for this topic"
    }
  ]
}

Return all 7 formats (A through G) in order.`;

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }
      const parsed = JSON.parse(extractJSON(textBlock.text));
      res.json(parsed);
    } catch (err) {
      const status = (err as { status?: number }).status;
      const msg =
        status === 429
          ? "Rate limited — wait 30 seconds and try again."
          : err instanceof Error
          ? err.message
          : "Mutation failed";
      console.error("[idea-lab/mutate] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/idea-lab/script-draft
  // Body: { topic, hookLine, format, audience, creatorId?, mode?, rawNotes?, roughDraft? }
  // mode: "original" | "finisher" | "fixer"
  // Streams SSE → result: ScriptDraft
  router.post("/script-draft", async (req, res) => {
    const { topic, hookLine, format, audience, creatorId, mode, rawNotes, roughDraft } = req.body as {
      topic?: string;
      hookLine?: string;
      format?: string;
      audience?: string;
      creatorId?: number;
      mode?: "original" | "finisher" | "fixer";
      rawNotes?: string;
      roughDraft?: string;
    };
    const scriptMode = mode ?? "original";
    if (scriptMode === "original" && !topic) {
      res.status(400).json({ error: "topic is required" });
      return;
    }
    if (scriptMode === "finisher" && !rawNotes) {
      res.status(400).json({ error: "rawNotes is required for Finisher mode" });
      return;
    }
    if (scriptMode === "fixer" && !roughDraft) {
      res.status(400).json({ error: "roughDraft is required for Fixer mode" });
      return;
    }

    const { brand, audiences, formatTable } = loadContext();

    // Load creator persona if provided
    let personaPrompt = "";
    if (creatorId) {
      try {
        const { loadPersona, buildPersonaPrompt } = await import("../utils/persona-context.js");
        const persona = loadPersona(creatorId);
        personaPrompt = buildPersonaPrompt(persona);
      } catch { /* persona loading is optional */ }
    }

    const systemPrompt = `You are a short-form video script writer for a prenatal and pediatric chiropractic practice. Write a complete, production-ready script that can be filmed today.

SHARED BRAND VOICE:
${brand.slice(0, 600)}

${personaPrompt ? personaPrompt + "\n\n" : ""}AUDIENCE SEGMENTS:
${audiences}

FORMAT GUIDE: ${formatTable}
Format details:
- A (Explainer): 30-45s, educational
- B (Checklist): 30-45s, "X things" structure
- C (Demo): 30-60s, show the exercise or technique
- D (Myth Buster): 15-30s, contrarian opener
- E (Walkthrough): 45-60s, step-by-step process
- F (Quick Tip): 6-15s, one tight insight
- G (Patient Story): 15-30s, transformation arc

RULES:
1. No emdashes. Use commas, periods, or restructure.
2. Delivery cues go in [square brackets] — keep them brief: [Warm], [Deadpan], [Pause], [Direct to camera].
3. keyPoints are the body of the script — each is one sentence or tight phrase to deliver on camera.
4. CTA is the last line — direct, not begging.
5. productionNotes are filming tips (shot type, setting, energy level).
6. Respond with valid JSON only. No markdown, no extra text.`;

    const jsonShape = `{
  "hookLine": "the opening line delivered to camera",
  "keyPoints": [
    "[Delivery cue] Point one.",
    "[Delivery cue] Point two.",
    "[Delivery cue] Point three."
  ],
  "cta": "the final call to action line",
  "estimatedDuration": "~32 seconds",
  "productionNotes": "Film standing, direct to camera. Energy: calm and authoritative. No B-roll needed for hook."
}`;

    let userContent: string;
    if (scriptMode === "finisher") {
      userContent = `Turn these raw notes into a complete short-form video script. Use ONLY the information provided — do not add outside facts or research.

Format: ${format || "A (Explainer)"}
Audience: ${audience || "general chiropractic audience"}

RAW NOTES:
${rawNotes}

Respond with this exact JSON structure:
${jsonShape}`;
    } else if (scriptMode === "fixer") {
      userContent = `Polish and refine this rough draft into a production-ready short-form script. Improve clarity, pacing, and hook strength. Use ONLY the content provided — do not add outside facts.

Format: ${format || "A (Explainer)"}
Audience: ${audience || "general chiropractic audience"}

ROUGH DRAFT:
${roughDraft}

Respond with this exact JSON structure:
${jsonShape}`;
    } else {
      userContent = `Write a complete short-form video script for:
Topic: ${topic}
Hook line: ${hookLine || "(generate an opening hook)"}
Format: ${format || "A (Explainer)"}
Audience: ${audience || "general chiropractic audience"}

Respond with this exact JSON structure:
${jsonShape}`;
    }

    await streamResponse(systemPrompt, userContent, [], req, res, "script-draft");
  });

  // POST /api/idea-lab/rewrite-hook
  // Body: { topic, currentHook, style, audience?, creatorId? }
  // Returns: { hookLine: string }
  router.post("/rewrite-hook", async (req, res) => {
    const { topic, currentHook, style, audience, creatorId } = req.body as {
      topic?: string;
      currentHook?: string;
      style?: string;
      audience?: string;
      creatorId?: number;
    };
    if (!topic || !style) {
      res.status(400).json({ error: "topic and style are required" });
      return;
    }

    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    const { brand } = loadContext();

    let personaPrompt = "";
    if (creatorId) {
      try {
        const { loadPersona, buildPersonaPrompt } = await import("../utils/persona-context.js");
        const persona = loadPersona(creatorId);
        personaPrompt = buildPersonaPrompt(persona);
      } catch { /* optional */ }
    }

    const STYLE_DESCRIPTIONS: Record<string, string> = {
      question: "Opens with a direct question that creates curiosity or identifies with the viewer's problem",
      myth_contrarian: "Opens by challenging a common belief: 'Everyone thinks X — they're wrong'",
      statistic: "Opens with a specific number or percentage that surprises the viewer",
      story_emotional: "Opens with a micro-story or observation that creates emotional connection",
      pattern_interrupt: "Opens with something unexpected, counterintuitive, or visually/verbally surprising",
      did_you_know: "Opens with a fascinating fact the viewer almost certainly didn't know",
    };

    const styleDescription = STYLE_DESCRIPTIONS[style] || style;

    const prompt = `Rewrite this video hook in a specific style. Return only the new hook line — one sentence, no quotes, no explanation.

BRAND: ${brand.slice(0, 300)}
${personaPrompt ? "\n" + personaPrompt + "\n" : ""}
TOPIC: ${topic}
CURRENT HOOK: ${currentHook || "(none)"}
AUDIENCE: ${audience || "chiropractic patients"}
TARGET STYLE: ${style} — ${styleDescription}

Rules: No emdashes. 1-2 sentences max. Punchy and specific. Match the creator's voice if specified.

Return ONLY the new hook line. Nothing else.`;

    try {
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 120,
        messages: [{ role: "user", content: prompt }],
      });
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }
      res.json({ hookLine: textBlock.text.trim().replace(/^["']|["']$/g, "") });
    } catch (err) {
      const status = (err as { status?: number }).status;
      const msg = status === 429
        ? "Rate limited — wait 30 seconds and try again."
        : err instanceof Error ? err.message : "Rewrite failed";
      console.error("[idea-lab/rewrite-hook] Error:", msg);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
