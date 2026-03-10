import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { db } from "../db.js";
import { ideaConcepts } from "../../shared/schema.js";
import { parseIdeaBank } from "../parsers/idea-bank.js";
import { parseConfig } from "../parsers/config.js";
import type {
  IdeaGenerateRequest,
  IdeaGenerateResponse,
  CaptionRequest,
  CaptionResponse,
  ConversationMessage,
} from "../../shared/types.js";
import { FORMATS } from "../../shared/types.js";

function buildFormatTable(): string {
  return Object.entries(FORMATS)
    .map(([id, f]) => `${id}: ${f.name}`)
    .join("\n");
}

function buildIdeaSystemPrompt(
  brandVoice: string,
  audiences: string,
  existingTopics: string[],
): string {
  const topicList =
    existingTopics.length > 0
      ? existingTopics.slice(0, 200).join("\n- ")
      : "(none yet)";

  return `You are a content idea brainstorming assistant for a chiropractic practice's short-form video content.

BRAND VOICE:
${brandVoice}

VIDEO FORMAT TEMPLATES:
${buildFormatTable()}

Format guidance:
- A (Explainer): 30-45s, education/awareness
- B (Checklist): 30-45s, shareability/saves
- C (Demo): 30-60s, actionable tutorials
- D (Myth Buster): 15-30s, engagement/comments
- E (Walkthrough): 45-60s, conversion
- F (Quick Tip): 6-15s, TikTok micro-content
- G (Patient Story): 15-30s, social proof

AUDIENCE SEGMENTS:
${audiences}

EXISTING IDEAS (do NOT suggest duplicates):
- ${topicList}

RULES:
1. Return 3-5 ideas per response unless the user asks for a different number.
2. Each idea must have: topic, suggestedFormat (e.g. "A (Explainer)"), hookAngle, priority (High/Medium/Low), category (trending/competitor/evergreen/audience/personal).
3. Match format to content type: educational -> A, list-based -> B, tutorial -> C, debunking -> D, process -> E, micro-content -> F, testimonial -> G.
4. Hook angles should be specific and compelling: use statistics, questions, or provocative statements.
5. No emdashes in any text. Use commas, periods, or restructure.
6. Ideas must be relevant to the brand's audience segments and content pillars.
7. Avoid duplicating any topic from the existing ideas list.

RESPONSE FORMAT:
Return a JSON object with:
- "ideas": array of idea objects with topic, suggestedFormat, hookAngle, priority, category
- "message": a brief conversational response (1-2 sentences)

Your entire response must be a single valid JSON object. No markdown code fences, no extra text.`;
}

function buildCaptionSystemPrompt(brandVoice: string): string {
  return `You are a social media caption writer for a chiropractic practice's short-form video content.

BRAND VOICE:
${brandVoice}

PLATFORM GUIDELINES:
- Instagram Reels: Hook in first line (before "...more"), 2-3 short paragraphs, 3-5 relevant hashtags at end, warm/educational tone, end with a question or CTA to drive comments
- TikTok: Ultra-short (1-2 lines max), punchy and casual, trending/viral language welcome, 2-3 hashtags mixed in, text-heavy overlays assumed so caption complements
- YouTube Shorts: Slightly longer, SEO-friendly keywords in first line, educational tone, include a CTA to subscribe/watch more, no hashtags (use description tags instead)

RULES:
1. No emdashes. Use commas, periods, or restructure.
2. Match the brand voice: warm, educational, empowering, never clinical.
3. If a script is provided, the caption should complement (not repeat) the video content.
4. Each platform caption should feel native to that platform.
5. Include relevant emojis sparingly (1-3 per caption, not excessive).

RESPONSE FORMAT:
Return a JSON object with:
- "captions": array of objects with "platform" (Instagram/TikTok/YouTube) and "caption" (the text)
- "message": a brief conversational note (1 sentence)

Your entire response must be a single valid JSON object. No markdown code fences, no extra text.`;
}

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned;
}

export function createIdeasAiRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const brandPath = path.join(industryDir, "brand.md");
  const configPath = path.join(industryDir, "config.json");
  const ideaBankPath = path.join(industryDir, "idea-bank.md");

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn(
      "[ideas-ai] ANTHROPIC_API_KEY not set. AI idea features will be unavailable.",
    );
  }

  // POST /generate - AI-powered idea brainstorming
  router.post("/generate", async (req, res) => {
    if (!client) {
      res.status(503).json({
        error: "AI unavailable. Set ANTHROPIC_API_KEY in .env",
      });
      return;
    }

    const body = req.body as IdeaGenerateRequest;
    if (!body.prompt || typeof body.prompt !== "string") {
      res.status(400).json({ error: "Missing prompt" });
      return;
    }

    try {
      const brandVoice = fs.existsSync(brandPath)
        ? fs.readFileSync(brandPath, "utf-8").slice(0, 1500)
        : "";

      const config = fs.existsSync(configPath) ? parseConfig(configPath) : null;
      const audiences = config
        ? config.audiences.map((a) => `- ${a.label}`).join("\n")
        : "";

      const existingIdeas = parseIdeaBank(ideaBankPath);
      const allTopics = [
        ...new Set([
          ...existingIdeas.map((i) => i.topic),
          ...(body.existingTopics || []),
        ]),
      ];

      const messages: Array<{ role: "user" | "assistant"; content: string }> =
        [];
      if (body.conversationHistory?.length > 0) {
        for (const msg of body.conversationHistory.slice(-20)) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }
      messages.push({ role: "user", content: body.prompt });

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: buildIdeaSystemPrompt(brandVoice, audiences, allTopics),
        messages,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const parsed: IdeaGenerateResponse = JSON.parse(
        stripCodeFences(textBlock.text),
      );

      res.json(parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate ideas";
      console.error("[ideas-ai] Generate error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /caption - AI-powered caption generation
  router.post("/caption", async (req, res) => {
    if (!client) {
      res.status(503).json({
        error: "AI unavailable. Set ANTHROPIC_API_KEY in .env",
      });
      return;
    }

    const body = req.body as CaptionRequest;
    if (!body.prompt || typeof body.prompt !== "string") {
      res.status(400).json({ error: "Missing prompt" });
      return;
    }

    try {
      const brandVoice = fs.existsSync(brandPath)
        ? fs.readFileSync(brandPath, "utf-8").slice(0, 1500)
        : "";

      const messages: Array<{ role: "user" | "assistant"; content: string }> =
        [];
      if (body.conversationHistory?.length > 0) {
        for (const msg of body.conversationHistory.slice(-20)) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      // Build user message with context
      let userContent = body.prompt;
      if (body.context) {
        const ctx = body.context;
        const parts: string[] = [];
        if (ctx.topic) parts.push(`Topic: ${ctx.topic}`);
        if (ctx.hookAngle) parts.push(`Hook: ${ctx.hookAngle}`);
        if (ctx.suggestedFormat) parts.push(`Format: ${ctx.suggestedFormat}`);
        if (ctx.category) parts.push(`Category: ${ctx.category}`);
        if (ctx.script) parts.push(`Script:\n${ctx.script}`);

        if (parts.length > 0) {
          userContent = `${body.prompt}\n\nVideo context:\n${parts.join("\n")}`;
        }
      }
      messages.push({ role: "user", content: userContent });

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: buildCaptionSystemPrompt(brandVoice),
        messages,
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      const parsed: CaptionResponse = JSON.parse(
        stripCodeFences(textBlock.text),
      );

      res.json(parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate captions";
      console.error("[ideas-ai] Caption error:", message);
      res.status(500).json({ error: message });
    }
  });

  // ============================================
  // One-Sentence Concept Framework (Feature 5)
  // ============================================

  const CONCEPT_PROMPT = `You are a concept architect for short-form video. Evaluate this video concept.

A great one-sentence concept must be:
1. TECHNICALLY INTERESTING (1-10): Contains a surprising fact, counterintuitive angle, or novel approach
2. EMOTIONALLY RESONANT (1-10): Connects to a feeling viewers already have (fear, curiosity, hope)
3. 10-SECOND EXPLAINABLE (1-10): Understood immediately, no backstory needed
4. VISUAL PAYOFF (1-10): Something satisfying to SEE, not just hear

Generate:
1. One-sentence concept (under 20 words)
2. Score each dimension 1-10 with brief rationale
3. Overall score (average of 4 dimensions, rounded)
4. Strengths and weaknesses
5. If overall < 7: suggest a refined version that scores higher

Return JSON:
{
  "oneSentence": "...",
  "technicalInterestScore": 8,
  "emotionalResonanceScore": 7,
  "tenSecondExplainabilityScore": 9,
  "visualPayoffScore": 6,
  "overallScore": 7,
  "aiFeedback": {
    "strengths": ["..."],
    "weaknesses": ["..."],
    "suggestions": ["..."]
  },
  "refinedVersion": "..." or null
}

No emdashes. Return JSON only.`;

  // GET /concept/:topic - Get saved concept
  router.get("/concept/:topic", async (req, res) => {
    try {
      const topic = decodeURIComponent(req.params.topic);
      const concepts = db
        .select()
        .from(ideaConcepts)
        .where(eq(ideaConcepts.ideaTopic, topic))
        .all();
      res.json({ concept: concepts[0] || null });
    } catch (error) {
      console.error("[ideas-ai] Get concept error:", error);
      res.status(500).json({ error: "Failed to get concept" });
    }
  });

  // POST /concept/:topic - Generate concept
  router.post("/concept/:topic", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const topic = decodeURIComponent(req.params.topic);
      const { hookAngle, format, audience } = req.body;

      const config = fs.existsSync(configPath) ? parseConfig(configPath) : null;
      const brandVoice = fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8").slice(0, 800) : "";

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: `${CONCEPT_PROMPT}\n\nBRAND CONTEXT:\n${brandVoice}`,
        messages: [{
          role: "user",
          content: `IDEA: Topic: "${topic}"${hookAngle ? ` | Hook: "${hookAngle}"` : ""}${format ? ` | Format: ${format}` : ""}${audience ? ` | Audience: ${audience}` : ""}
${config ? `\nPractice: ${config.name}. Audiences: ${config.audiences.map((a) => a.label).join(", ")}` : ""}`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      // Save to DB (upsert)
      db.delete(ideaConcepts).where(eq(ideaConcepts.ideaTopic, topic)).run();
      const saved = db
        .insert(ideaConcepts)
        .values({
          ideaTopic: topic,
          oneSentence: parsed.oneSentence,
          technicalInterestScore: parsed.technicalInterestScore,
          emotionalResonanceScore: parsed.emotionalResonanceScore,
          tenSecondExplainabilityScore: parsed.tenSecondExplainabilityScore,
          visualPayoffScore: parsed.visualPayoffScore,
          overallScore: parsed.overallScore,
          aiFeedback: JSON.stringify(parsed.aiFeedback),
          refinedVersion: parsed.refinedVersion || null,
          approved: parsed.overallScore >= 7,
        })
        .returning()
        .get();

      res.json({ concept: saved });
    } catch (error) {
      console.error("[ideas-ai] Generate concept error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to generate concept" });
    }
  });

  // POST /concept/:topic/refine - Refine concept with feedback
  router.post("/concept/:topic/refine", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const topic = decodeURIComponent(req.params.topic);
      const { currentConcept, feedback } = req.body;

      if (!currentConcept) {
        res.status(400).json({ error: "currentConcept is required" });
        return;
      }

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: CONCEPT_PROMPT,
        messages: [{
          role: "user",
          content: `Refine this concept for topic "${topic}".

CURRENT CONCEPT: "${currentConcept}"
${feedback ? `USER FEEDBACK: "${feedback}"` : ""}

Create an improved one-sentence concept that scores higher. Re-score all 4 dimensions.`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      // Update in DB
      db.delete(ideaConcepts).where(eq(ideaConcepts.ideaTopic, topic)).run();
      const saved = db
        .insert(ideaConcepts)
        .values({
          ideaTopic: topic,
          oneSentence: parsed.oneSentence,
          technicalInterestScore: parsed.technicalInterestScore,
          emotionalResonanceScore: parsed.emotionalResonanceScore,
          tenSecondExplainabilityScore: parsed.tenSecondExplainabilityScore,
          visualPayoffScore: parsed.visualPayoffScore,
          overallScore: parsed.overallScore,
          aiFeedback: JSON.stringify(parsed.aiFeedback),
          refinedVersion: parsed.refinedVersion || null,
          approved: parsed.overallScore >= 7,
        })
        .returning()
        .get();

      res.json({ concept: saved });
    } catch (error) {
      console.error("[ideas-ai] Refine concept error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to refine concept" });
    }
  });

  // PUT /concept/:topic - Manually update concept (triggers re-scoring)
  router.put("/concept/:topic", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable." });
      return;
    }

    try {
      const topic = decodeURIComponent(req.params.topic);
      const { oneSentence, approved } = req.body;

      if (approved !== undefined && !oneSentence) {
        // Just toggling approval
        const existing = db.select().from(ideaConcepts).where(eq(ideaConcepts.ideaTopic, topic)).all();
        if (existing.length === 0) {
          res.status(404).json({ error: "No concept found" });
          return;
        }
        db.delete(ideaConcepts).where(eq(ideaConcepts.ideaTopic, topic)).run();
        const saved = db
          .insert(ideaConcepts)
          .values({
            ...existing[0],
            id: undefined as unknown as number,
            approved,
          })
          .returning()
          .get();
        res.json({ concept: saved });
        return;
      }

      if (!oneSentence) {
        res.status(400).json({ error: "oneSentence is required" });
        return;
      }

      // Re-score with AI
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: CONCEPT_PROMPT,
        messages: [{
          role: "user",
          content: `Score this concept for topic "${topic}": "${oneSentence}"`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      db.delete(ideaConcepts).where(eq(ideaConcepts.ideaTopic, topic)).run();
      const saved = db
        .insert(ideaConcepts)
        .values({
          ideaTopic: topic,
          oneSentence: oneSentence,
          technicalInterestScore: parsed.technicalInterestScore,
          emotionalResonanceScore: parsed.emotionalResonanceScore,
          tenSecondExplainabilityScore: parsed.tenSecondExplainabilityScore,
          visualPayoffScore: parsed.visualPayoffScore,
          overallScore: parsed.overallScore,
          aiFeedback: JSON.stringify(parsed.aiFeedback),
          refinedVersion: null,
          approved: approved ?? parsed.overallScore >= 7,
        })
        .returning()
        .get();

      res.json({ concept: saved });
    } catch (error) {
      console.error("[ideas-ai] Update concept error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to update concept" });
    }
  });

  return router;
}
