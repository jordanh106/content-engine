import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { eq, desc, like, and } from "drizzle-orm";
import { db } from "../db.js";
import { vaultHooks, vaultStyles, scriptVersions, performanceMetrics } from "../../shared/schema.js";
import { parseHookPatterns } from "../parsers/hook-patterns.js";
import type { VaultHook, VaultStyle } from "../../shared/types.js";

function stripCodeFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "");
  }
  return cleaned;
}

// Map hook-patterns.md category names to slug keys
function categorySlug(name: string): string {
  const map: Record<string, string> = {
    "Question Hooks": "question",
    "Statistic Hooks": "statistic",
    "Myth/Contrarian Hooks": "myth",
    "Emotional/Story Hooks": "emotional",
    "Did You Know Hooks": "didyouknow",
    "Pattern Interrupt Hooks": "pattern_interrupt",
    "CTA Hooks (Closing Patterns)": "cta",
  };
  return map[name] || name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

// Extract [VARIABLES] from a Mad Lib pattern
function extractVariables(pattern: string): string[] {
  const matches = pattern.match(/\[([A-Z][A-Z0-9_ ]*)\]/g);
  if (!matches) return [];
  return [...new Set(matches.map((m) => m.slice(1, -1)))];
}

export function createVaultRouter(contentLibraryPath: string) {
  const router = Router();

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn("[vault] ANTHROPIC_API_KEY not set.");
  }

  // =============================================
  // HOOKS
  // =============================================

  // GET /api/vault/hooks - Merged list from hook-patterns.md + SQLite
  router.get("/hooks", async (_req, res) => {
    try {
      const { category, format, platform, search } = _req.query as Record<string, string | undefined>;

      // 1. Library hooks from hook-patterns.md
      const hookPatternsPath = contentLibraryPath.replace("content-library.md", "hook-patterns.md");
      let libraryHooks: VaultHook[] = [];
      try {
        const categories = parseHookPatterns(hookPatternsPath);
        let libraryId = -1;
        for (const cat of categories) {
          for (const p of cat.patterns) {
            libraryId--;
            libraryHooks.push({
              id: libraryId,
              pattern: p.pattern,
              example: p.example,
              category: categorySlug(cat.name),
              sourceCreator: null,
              sourceUrl: null,
              bestFormat: p.bestFormat,
              platform: p.platform,
              optimizes: p.optimizes,
              variables: extractVariables(p.pattern),
              usageCount: 0,
              lastUsedAt: null,
              createdAt: "",
              isLibrary: true,
            });
          }
        }
      } catch { /* hook-patterns.md may not exist */ }

      // 2. Custom hooks from SQLite
      const customRows = db.select().from(vaultHooks).orderBy(desc(vaultHooks.createdAt)).all();
      const customHooks: VaultHook[] = customRows.map((r) => ({
        id: r.id,
        pattern: r.pattern,
        example: r.example,
        category: r.category,
        sourceCreator: r.sourceCreator,
        sourceUrl: r.sourceUrl,
        bestFormat: r.bestFormat,
        platform: r.platform,
        optimizes: r.optimizes,
        variables: r.variables ? JSON.parse(r.variables) : [],
        usageCount: r.usageCount ?? 0,
        lastUsedAt: r.lastUsedAt,
        createdAt: r.createdAt ?? "",
        isLibrary: false,
      }));

      let allHooks = [...customHooks, ...libraryHooks];

      // Apply filters
      if (category) {
        allHooks = allHooks.filter((h) => h.category === category);
      }
      if (format) {
        allHooks = allHooks.filter((h) => h.bestFormat && h.bestFormat.includes(format));
      }
      if (platform) {
        allHooks = allHooks.filter((h) => h.platform && h.platform.toLowerCase().includes(platform.toLowerCase()));
      }
      if (search) {
        const q = search.toLowerCase();
        allHooks = allHooks.filter(
          (h) =>
            h.pattern.toLowerCase().includes(q) ||
            (h.example && h.example.toLowerCase().includes(q)),
        );
      }

      res.json({ hooks: allHooks, total: allHooks.length });
    } catch (error) {
      console.error("[vault] Error listing hooks:", error);
      res.status(500).json({ error: "Failed to list hooks" });
    }
  });

  // POST /api/vault/hooks - Save a new hook
  router.post("/hooks", async (req, res) => {
    try {
      const { pattern, example, category, sourceCreator, sourceUrl, bestFormat, platform, optimizes } = req.body;
      if (!pattern) {
        res.status(400).json({ error: "pattern is required" });
        return;
      }

      const variables = extractVariables(pattern);
      const result = db
        .insert(vaultHooks)
        .values({
          pattern,
          example: example || null,
          category: category || "custom",
          sourceCreator: sourceCreator || null,
          sourceUrl: sourceUrl || null,
          bestFormat: bestFormat || null,
          platform: platform || null,
          optimizes: optimizes || null,
          variables: JSON.stringify(variables),
        })
        .returning()
        .get();

      res.json({
        hook: {
          ...result,
          variables,
          isLibrary: false,
        },
      });
    } catch (error) {
      console.error("[vault] Error saving hook:", error);
      res.status(500).json({ error: "Failed to save hook" });
    }
  });

  // POST /api/vault/hooks/extract - AI: raw text -> Mad Lib pattern + variables
  router.post("/hooks/extract", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { text } = req.body;
      if (!text) {
        res.status(400).json({ error: "text is required" });
        return;
      }

      // Load existing patterns as few-shot examples
      const hookPatternsPath = contentLibraryPath.replace("content-library.md", "hook-patterns.md");
      let examples = "";
      try {
        const categories = parseHookPatterns(hookPatternsPath);
        const samplePatterns = categories.flatMap((c) => c.patterns).slice(0, 5);
        examples = samplePatterns
          .map((p) => `Input: "${p.example}" -> Pattern: "${p.pattern}"`)
          .join("\n");
      } catch { /* ok */ }

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `Convert this hook into a reusable Mad Lib template by replacing specific nouns, verbs, and adjectives with [UPPERCASE_VARIABLE] placeholders.

Examples:
${examples}
Input: "Why your chiropractor is lying about posture" -> Pattern: "Why [PROFESSIONAL] is lying about [TOPIC]"
Input: "3 mistakes you're making with your morning routine" -> Pattern: "[NUMBER] mistakes you're making with [ACTIVITY]"

Now convert this hook:
Input: "${text}"

Respond with JSON only:
{
  "pattern": "the Mad Lib template with [VARIABLES]",
  "variables": ["VARIABLE1", "VARIABLE2"],
  "category": "one of: question, statistic, myth, emotional, didyouknow, pattern_interrupt, mystery, list, problem, shock, callout, transformation, exclusivity, controversial, fomo, urgency, custom",
  "optimizes": "one of: watch time, saves, comments, shares, follows"
}`,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));
      res.json({
        pattern: parsed.pattern,
        variables: parsed.variables || extractVariables(parsed.pattern),
        category: parsed.category || "custom",
        optimizes: parsed.optimizes || null,
        originalText: text,
      });
    } catch (error) {
      console.error("[vault] Hook extraction error:", error);
      res.status(500).json({ error: "Failed to extract hook pattern" });
    }
  });

  // PUT /api/vault/hooks/:id - Update a hook
  router.put("/hooks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (id < 0) {
        res.status(400).json({ error: "Cannot edit library hooks" });
        return;
      }

      const { pattern, example, category, sourceCreator, sourceUrl, bestFormat, platform, optimizes } = req.body;
      const updates: Record<string, unknown> = {};
      if (pattern !== undefined) {
        updates.pattern = pattern;
        updates.variables = JSON.stringify(extractVariables(pattern));
      }
      if (example !== undefined) updates.example = example;
      if (category !== undefined) updates.category = category;
      if (sourceCreator !== undefined) updates.sourceCreator = sourceCreator;
      if (sourceUrl !== undefined) updates.sourceUrl = sourceUrl;
      if (bestFormat !== undefined) updates.bestFormat = bestFormat;
      if (platform !== undefined) updates.platform = platform;
      if (optimizes !== undefined) updates.optimizes = optimizes;

      const result = db
        .update(vaultHooks)
        .set(updates)
        .where(eq(vaultHooks.id, id))
        .returning()
        .get();

      if (!result) {
        res.status(404).json({ error: "Hook not found" });
        return;
      }

      res.json({ hook: { ...result, variables: result.variables ? JSON.parse(result.variables) : [], isLibrary: false } });
    } catch (error) {
      console.error("[vault] Error updating hook:", error);
      res.status(500).json({ error: "Failed to update hook" });
    }
  });

  // DELETE /api/vault/hooks/:id
  router.delete("/hooks/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (id < 0) {
        res.status(400).json({ error: "Cannot delete library hooks" });
        return;
      }

      db.delete(vaultHooks).where(eq(vaultHooks.id, id)).run();
      res.json({ deleted: true });
    } catch (error) {
      console.error("[vault] Error deleting hook:", error);
      res.status(500).json({ error: "Failed to delete hook" });
    }
  });

  // =============================================
  // STYLES
  // =============================================

  // GET /api/vault/styles
  router.get("/styles", async (_req, res) => {
    try {
      const rows = db.select().from(vaultStyles).orderBy(desc(vaultStyles.createdAt)).all();
      const styles: VaultStyle[] = rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        sourceCreator: r.sourceCreator,
        sourceUrl: r.sourceUrl,
        sourceTranscript: r.sourceTranscript,
        styleRules: JSON.parse(r.styleRules),
        exampleScript: r.exampleScript,
        usageCount: r.usageCount ?? 0,
        createdAt: r.createdAt ?? "",
      }));
      res.json({ styles, total: styles.length });
    } catch (error) {
      console.error("[vault] Error listing styles:", error);
      res.status(500).json({ error: "Failed to list styles" });
    }
  });

  // POST /api/vault/styles - Save a new style
  router.post("/styles", async (req, res) => {
    try {
      const { name, description, sourceCreator, sourceUrl, sourceTranscript, styleRules, exampleScript } = req.body;
      if (!name || !styleRules) {
        res.status(400).json({ error: "name and styleRules are required" });
        return;
      }

      const result = db
        .insert(vaultStyles)
        .values({
          name,
          description: description || null,
          sourceCreator: sourceCreator || null,
          sourceUrl: sourceUrl || null,
          sourceTranscript: sourceTranscript || null,
          styleRules: typeof styleRules === "string" ? styleRules : JSON.stringify(styleRules),
          exampleScript: exampleScript || null,
        })
        .returning()
        .get();

      res.json({
        style: {
          ...result,
          styleRules: JSON.parse(result.styleRules),
        },
      });
    } catch (error) {
      console.error("[vault] Error saving style:", error);
      res.status(500).json({ error: "Failed to save style" });
    }
  });

  // POST /api/vault/styles/extract - AI: transcript -> style rules
  router.post("/styles/extract", async (req, res) => {
    if (!client) {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { transcript, name, sourceCreator, sourceUrl } = req.body;
      if (!transcript) {
        res.status(400).json({ error: "transcript is required" });
        return;
      }

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `Analyze this video transcript and extract concrete, measurable writing style rules. These rules will be used as a "filter" to convert other scripts to match this creator's voice.

TRANSCRIPT:
"${transcript.slice(0, 3000)}"

Extract CONCRETE rules, not vague descriptions.

BAD: "Punchy tone"
GOOD: "Sentences average 8 words. One-word impact statements appear every 3rd sentence."

BAD: "Engaging style"
GOOD: "Opens with a direct question. Uses second person 'you' 3x per paragraph. Never uses passive voice."

Respond with JSON only:
{
  "name": "${name || "Extracted Style"}",
  "description": "One-sentence summary of the overall vibe",
  "styleRules": {
    "sentenceLength": "Average word count per sentence and variation pattern",
    "tone": "Specific tone markers with examples from the transcript",
    "structure": "How the content is organized (e.g., 'Problem statement -> 3 quick tips -> callback to opening')",
    "techniques": ["List of 3-5 specific techniques used, with examples"],
    "doNot": ["List of 2-3 things this style explicitly avoids"]
  },
  "exampleScript": "A 3-4 sentence example demonstrating these rules applied to a generic topic"
}`,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const parsed = JSON.parse(stripCodeFences(textBlock.text));

      // Save to database
      const result = db
        .insert(vaultStyles)
        .values({
          name: parsed.name || name || "Extracted Style",
          description: parsed.description || null,
          sourceCreator: sourceCreator || null,
          sourceUrl: sourceUrl || null,
          sourceTranscript: transcript.slice(0, 5000),
          styleRules: JSON.stringify(parsed.styleRules),
          exampleScript: parsed.exampleScript || null,
        })
        .returning()
        .get();

      res.json({
        style: {
          ...result,
          styleRules: parsed.styleRules,
        },
      });
    } catch (error) {
      console.error("[vault] Style extraction error:", error);
      res.status(500).json({ error: "Failed to extract style" });
    }
  });

  // PUT /api/vault/styles/:id
  router.put("/styles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, description, styleRules, exampleScript } = req.body;

      const updates: Record<string, unknown> = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      if (styleRules !== undefined) {
        updates.styleRules = typeof styleRules === "string" ? styleRules : JSON.stringify(styleRules);
      }
      if (exampleScript !== undefined) updates.exampleScript = exampleScript;

      const result = db
        .update(vaultStyles)
        .set(updates)
        .where(eq(vaultStyles.id, id))
        .returning()
        .get();

      if (!result) {
        res.status(404).json({ error: "Style not found" });
        return;
      }

      res.json({ style: { ...result, styleRules: JSON.parse(result.styleRules) } });
    } catch (error) {
      console.error("[vault] Error updating style:", error);
      res.status(500).json({ error: "Failed to update style" });
    }
  });

  // DELETE /api/vault/styles/:id
  router.delete("/styles/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      db.delete(vaultStyles).where(eq(vaultStyles.id, id)).run();
      res.json({ deleted: true });
    } catch (error) {
      console.error("[vault] Error deleting style:", error);
      res.status(500).json({ error: "Failed to delete style" });
    }
  });

  // =============================================
  // HOOK PERFORMANCE - Aggregate by category
  // =============================================

  router.get("/hooks/performance", async (_req, res) => {
    try {
      // Get all script versions that have a hookId
      const scripts = db.select().from(scriptVersions).all().filter((s) => s.hookId != null);

      if (scripts.length === 0) {
        res.json({ categories: [], totalLinked: 0 });
        return;
      }

      // Build hookId -> hook data map (from custom hooks)
      const customHooks = db.select().from(vaultHooks).all();
      const hookMap = new Map<number, { category: string; pattern: string; bestFormat: string | null; platform: string | null }>();
      for (const h of customHooks) {
        hookMap.set(h.id, { category: h.category, pattern: h.pattern, bestFormat: h.bestFormat, platform: h.platform });
      }

      // Build videoCode -> hookCategory map
      const videoHookCategory = new Map<string, string>();
      for (const s of scripts) {
        if (s.videoCode && s.hookId && hookMap.has(s.hookId)) {
          videoHookCategory.set(s.videoCode, hookMap.get(s.hookId)!.category);
        }
      }

      // Get all performance metrics for linked videos
      const allMetrics = db.select().from(performanceMetrics).all();
      const linkedMetrics = allMetrics.filter((m) => videoHookCategory.has(m.videoCode));

      // Aggregate by category
      const categoryStats = new Map<string, {
        category: string;
        videoCount: number;
        totalViews: number;
        totalLikes: number;
        totalSaves: number;
        totalShares: number;
        totalComments: number;
        videos: Set<string>;
        platforms: Set<string>;
      }>();

      for (const m of linkedMetrics) {
        const cat = videoHookCategory.get(m.videoCode)!;
        if (!categoryStats.has(cat)) {
          categoryStats.set(cat, {
            category: cat,
            videoCount: 0,
            totalViews: 0,
            totalLikes: 0,
            totalSaves: 0,
            totalShares: 0,
            totalComments: 0,
            videos: new Set(),
            platforms: new Set(),
          });
        }
        const stats = categoryStats.get(cat)!;
        stats.videos.add(m.videoCode);
        stats.platforms.add(m.platform);
        stats.totalViews += m.views ?? 0;
        stats.totalLikes += m.likes ?? 0;
        stats.totalSaves += m.saves ?? 0;
        stats.totalShares += m.shares ?? 0;
        stats.totalComments += m.comments ?? 0;
      }

      // Format response
      const categories = Array.from(categoryStats.values()).map((s) => ({
        category: s.category,
        videoCount: s.videos.size,
        platforms: Array.from(s.platforms),
        avgViews: s.videos.size > 0 ? Math.round(s.totalViews / s.videos.size) : 0,
        avgEngagement: s.totalViews > 0
          ? Number(((s.totalLikes + s.totalSaves + s.totalShares + s.totalComments) / s.totalViews * 100).toFixed(1))
          : 0,
        totalViews: s.totalViews,
        totalEngagement: s.totalLikes + s.totalSaves + s.totalShares + s.totalComments,
      }));

      // Sort by avgEngagement descending
      categories.sort((a, b) => b.avgEngagement - a.avgEngagement);

      // Count total hooks by category (all hooks including library)
      const hookPatternsPath = contentLibraryPath.replace("content-library.md", "hook-patterns.md");
      const allCategoryCounts = new Map<string, number>();
      try {
        const parsedCats = parseHookPatterns(hookPatternsPath);
        for (const cat of parsedCats) {
          const slug = categorySlug(cat.name);
          allCategoryCounts.set(slug, (allCategoryCounts.get(slug) ?? 0) + cat.patterns.length);
        }
      } catch { /* ok */ }
      for (const h of customHooks) {
        allCategoryCounts.set(h.category, (allCategoryCounts.get(h.category) ?? 0) + 1);
      }

      // Mark untested categories
      const untestedCategories = Array.from(allCategoryCounts.entries())
        .filter(([cat]) => !categoryStats.has(cat))
        .map(([cat, count]) => ({ category: cat, hookCount: count }));

      res.json({
        categories,
        untestedCategories,
        totalLinked: videoHookCategory.size,
      });
    } catch (error) {
      console.error("[vault] Hook performance error:", error);
      res.status(500).json({ error: "Failed to aggregate hook performance" });
    }
  });

  // =============================================
  // SEED - Pre-load proven hook templates
  // =============================================

  router.post("/hooks/seed", async (_req, res) => {
    try {
      const existingCount = db.select().from(vaultHooks).all().length;
      if (existingCount > 0) {
        res.json({ seeded: false, message: "Hooks already exist", count: existingCount });
        return;
      }

      const templates = [
        { pattern: "Did you know that [SURPRISING FACT]?", category: "mystery", optimizes: "watch time", bestFormat: "A, F", platform: "YouTube Shorts, TikTok" },
        { pattern: "Top [NUMBER] [ADJECTIVE] facts about [TOPIC]", category: "list", optimizes: "saves", bestFormat: "B, A", platform: "Instagram Reels, YouTube Shorts" },
        { pattern: "[NUMBER] mistakes you're probably making with [TASK]", category: "problem", optimizes: "saves", bestFormat: "B, C", platform: "Instagram Reels, TikTok" },
        { pattern: "You won't believe [WHAT HAPPENS] when [ACTION]", category: "shock", optimizes: "shares", bestFormat: "D, G", platform: "TikTok, Instagram Reels" },
        { pattern: "If you're [DEMOGRAPHIC], stop scrolling!", category: "callout", optimizes: "watch time", bestFormat: "A, C", platform: "TikTok, Instagram Reels" },
        { pattern: "I went from [BAD STATE] to [GOOD STATE] in [TIMEFRAME]", category: "transformation", optimizes: "shares", bestFormat: "G, E", platform: "Instagram Reels, YouTube Shorts" },
        { pattern: "Only [PERCENTAGE] know [INFORMATION]", category: "exclusivity", optimizes: "shares", bestFormat: "A, F", platform: "TikTok, Instagram Reels" },
        { pattern: "Everything you knew about [BELIEF] is 100% WRONG!", category: "controversial", optimizes: "comments", bestFormat: "D", platform: "TikTok, Instagram Reels" },
        { pattern: "Have you heard about [TRENDING TOPIC]?", category: "fomo", optimizes: "comments", bestFormat: "A, F", platform: "TikTok" },
        { pattern: "Before you [COMMON ACTION], watch this...", category: "urgency", optimizes: "watch time", bestFormat: "C, A", platform: "TikTok, YouTube Shorts" },
      ];

      for (const t of templates) {
        db.insert(vaultHooks)
          .values({
            pattern: t.pattern,
            example: null,
            category: t.category,
            sourceCreator: null,
            sourceUrl: null,
            bestFormat: t.bestFormat,
            platform: t.platform,
            optimizes: t.optimizes,
            variables: JSON.stringify(extractVariables(t.pattern)),
          })
          .run();
      }

      res.json({ seeded: true, count: templates.length });
    } catch (error) {
      console.error("[vault] Seed error:", error);
      res.status(500).json({ error: "Failed to seed hooks" });
    }
  });

  // POST /api/vault/hooks/:id/adapt - AI generates niche adaptations of a hook
  router.post("/hooks/:id/adapt", async (req, res) => {
    const hookId = parseInt(req.params.id);
    try {
      const hook = db.select().from(vaultHooks).where(eq(vaultHooks.id, hookId)).get();
      if (!hook) { res.status(404).json({ error: "Hook not found" }); return; }

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) { res.status(400).json({ error: "ANTHROPIC_API_KEY not set" }); return; }

      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `Adapt this hook pattern for a chiropractic/health & wellness content creator. Generate 3 adapted versions.

Original hook: "${hook.pattern}"
${hook.example ? `Example: "${hook.example}"` : ""}
${hook.sourceCreator ? `Source creator: ${hook.sourceCreator}` : ""}
Category: ${hook.category}

Create 3 adaptations that:
- Keep the psychological trigger (curiosity, fear, authority, etc.)
- Apply to chiropractic, health, family wellness topics
- Sound natural and conversational
- Are ready to use (not templates)

Return JSON array of 3 objects: [{ "pattern": "adapted hook pattern with [VARIABLES]", "example": "concrete filled example", "whyItWorks": "brief explanation" }]
Return ONLY the JSON array.`,
        }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") { res.status(500).json({ error: "No AI response" }); return; }
      let cleaned = textBlock.text.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      const adaptations = JSON.parse(cleaned);
      res.json({ originalHook: hook.pattern, adaptations });
    } catch (error) {
      console.error("[vault] Hook adaptation error:", error);
      res.status(500).json({ error: "Failed to adapt hook" });
    }
  });

  return router;
}
