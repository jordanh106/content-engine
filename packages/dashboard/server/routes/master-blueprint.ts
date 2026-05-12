import fs from "fs";
import path from "path";
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { parseMasterBlueprint } from "../parsers/master-blueprint.js";
import { parseContentLibrary } from "../parsers/content-library.js";

export type ComplianceScore = {
  total: number;
  passing: boolean;
  threshold: number;
  categories: {
    hookArchitecture: { score: number; max: number; notes: string };
    bodyStructure: { score: number; max: number; notes: string };
    visualProduction: { score: number; max: number; notes: string };
    ctaEngagement: { score: number; max: number; notes: string };
    pillarAlignment: { score: number; max: number; notes: string };
    antiPatternCheck: { score: number; max: number; notes: string };
  };
  strengths: string[];
  fixes: string[];
  verdict: string;
  blueprintVersion: string;
};

export function createMasterBlueprintRouter(industryDir: string, contentLibraryPath: string) {
  const router = Router();
  const blueprintPath = path.join(industryDir, "master-blueprint.md");

  router.get("/", (_req, res) => {
    try {
      const blueprint = parseMasterBlueprint(blueprintPath);
      if (!blueprint) {
        res.status(404).json({ error: "master-blueprint.md not found" });
        return;
      }
      res.json({ blueprint });
    } catch (e) {
      console.error("[blueprint] GET / error:", e);
      res.status(500).json({ error: String(e) });
    }
  });

  router.get("/raw", (_req, res) => {
    try {
      if (!fs.existsSync(blueprintPath)) {
        res.status(404).send("# Blueprint not found");
        return;
      }
      res.type("text/markdown").send(fs.readFileSync(blueprintPath, "utf-8"));
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  // POST /api/blueprint/check-compliance
  // Body: { script: string, format?: string, duration?: number, audience?: string, pillar?: string }
  // Returns ComplianceScore
  router.post("/check-compliance", async (req, res) => {
    let client: Anthropic | null = null;
    try {
      client = new Anthropic();
    } catch {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const blueprint = parseMasterBlueprint(blueprintPath);
      if (!blueprint) {
        res.status(404).json({ error: "master-blueprint.md not found" });
        return;
      }

      const { script, format, duration, audience, pillar } = req.body as {
        script: string;
        format?: string;
        duration?: number;
        audience?: string;
        pillar?: string;
      };

      if (!script || script.trim().length < 20) {
        res.status(400).json({ error: "Script too short (min 20 chars)" });
        return;
      }

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: `You are the Blueprint Compliance Auditor for a chiropractic content engine. Score this script against the Master Blueprint and return JSON only.

MASTER BLUEPRINT:
${blueprint.raw.slice(0, 8000)}

SCRIPT TO AUDIT:
${script}

METADATA:
Format: ${format || "unspecified"}
Duration target: ${duration || "unspecified"}s
Audience: ${audience || "unspecified"}
Pillar: ${pillar || "unspecified"}

Score each category 0 to max. Be strict but fair. Return ONLY this JSON shape, no markdown, no commentary:

{
  "categories": {
    "hookArchitecture": { "score": 0-25, "max": 25, "notes": "<one line: what works or what's missing>" },
    "bodyStructure": { "score": 0-20, "max": 20, "notes": "<one line>" },
    "visualProduction": { "score": 0-20, "max": 20, "notes": "<one line>" },
    "ctaEngagement": { "score": 0-15, "max": 15, "notes": "<one line>" },
    "pillarAlignment": { "score": 0-10, "max": 10, "notes": "<one line>" },
    "antiPatternCheck": { "score": 0-10, "max": 10, "notes": "<one line: which anti-patterns triggered, or 'clean'>" }
  },
  "strengths": ["<one concrete strength>", "<another>"],
  "fixes": ["<one specific actionable fix>", "<another>", "<another>"],
  "verdict": "<one sentence: should this ship, revise, or restart>"
}`,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      // Extract JSON from response (model may wrap in code fence)
      const raw = textBlock.text.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        res.status(500).json({ error: "AI returned non-JSON", raw });
        return;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const categories = parsed.categories;
      const total =
        (categories.hookArchitecture?.score || 0) +
        (categories.bodyStructure?.score || 0) +
        (categories.visualProduction?.score || 0) +
        (categories.ctaEngagement?.score || 0) +
        (categories.pillarAlignment?.score || 0) +
        (categories.antiPatternCheck?.score || 0);

      const result: ComplianceScore = {
        total,
        passing: total >= blueprint.passingScore,
        threshold: blueprint.passingScore,
        categories,
        strengths: parsed.strengths || [],
        fixes: parsed.fixes || [],
        verdict: parsed.verdict || "",
        blueprintVersion: blueprint.version,
      };

      res.json(result);
    } catch (error) {
      console.error("[blueprint] POST /check-compliance error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  // POST /api/blueprint/check-video/:code — convenience wrapper using stored script
  router.post("/check-video/:code", async (req, res) => {
    const videos = parseContentLibrary(contentLibraryPath);
    const video = videos.find((v) => v.code === req.params.code);
    if (!video) {
      res.status(404).json({ error: "Video not found" });
      return;
    }
    if (!video.script || video.script.trim().length < 20) {
      res.status(400).json({ error: "Video has no script to audit" });
      return;
    }

    // Internal call: forward to /check-compliance handler via fetch
    try {
      const port = process.env.PORT || "3001";
      const r = await fetch(`http://localhost:${port}/api/blueprint/check-compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: video.script,
          format: video.format,
          duration: video.duration,
          audience: video.audience,
        }),
      });
      const data = await r.json();
      res.status(r.status).json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return router;
}
