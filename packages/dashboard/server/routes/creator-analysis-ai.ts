import fs from "fs";
import { Router } from "express";
import path from "path";
import { parseWatchlist, invalidateWatchlistCache } from "../parsers/watchlist.js";
import { parseCreatorInsights, invalidateCreatorInsightsCache } from "../parsers/creator-insights.js";
import { updateCreatorInFile } from "./watchlist.js";

export function createCreatorAnalysisAiRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const watchlistPath = path.join(industryDir, "watchlist.md");
  const creatorInsightsDir = path.join(industryDir, "creator-insights");

  // POST /:handle/trigger - Uses n8n workflow for creator analysis
  router.post("/:handle/trigger", async (req, res) => {
    const rawHandle = req.params.handle;
    const handle = rawHandle.startsWith("@") ? rawHandle : `@${rawHandle}`;
    const cleanHandle = handle.replace("@", "").toLowerCase();
    const webhookUrl = process.env.N8N_CREATOR_ANALYSIS_WEBHOOK_URL;

    if (!webhookUrl) {
      res.status(503).json({ error: "Creator analysis requires n8n. Set N8N_CREATOR_ANALYSIS_WEBHOOK_URL in .env" });
      return;
    }

    try {
      // Load creator context from watchlist
      const creators = parseWatchlist(watchlistPath);
      const creator = creators.find((c) => c.handle.toLowerCase() === handle.toLowerCase());

      // Call n8n webhook (synchronous - waits for workflow to complete)
      console.log(`[creator-analysis-ai] Triggering n8n workflow for ${handle}`);
      const n8nResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle,
          platform: creator?.platform || "",
          followers: creator?.followers || "",
          whyTracking: creator?.whyTracking || "",
          contentStyle: creator?.contentStyle || "",
        }),
        signal: AbortSignal.timeout(240_000),
      });

      if (!n8nResponse.ok) {
        const errText = await n8nResponse.text().catch(() => "Unknown error");
        console.error(`[creator-analysis-ai] n8n failed (${n8nResponse.status}): ${errText}`);
        res.status(502).json({ error: `n8n workflow failed (${n8nResponse.status}). Check that the Creator Analysis workflow is active in n8n.` });
        return;
      }

      const result = await n8nResponse.json() as { success?: boolean; markdown?: string; handle?: string; analyzedAt?: string };

      if (!result.markdown) {
        throw new Error("n8n workflow returned no markdown");
      }

      // Strip preamble
      let markdown = result.markdown;
      const headerIdx = markdown.indexOf("\n# ");
      if (headerIdx > 0) markdown = markdown.slice(headerIdx + 1);

      // Save to creator-insights
      fs.mkdirSync(creatorInsightsDir, { recursive: true });
      const insightPath = path.join(creatorInsightsDir, `${cleanHandle}.md`);
      fs.writeFileSync(insightPath, markdown);
      invalidateCreatorInsightsCache();

      // Update lastAnalyzed in watchlist.md
      const today = new Date().toISOString().split("T")[0];
      if (creator) {
        updateCreatorInFile(watchlistPath, handle, { lastAnalyzed: today });
        invalidateWatchlistCache();
      }

      // Parse the saved insight for structured response
      const updatedInsights = parseCreatorInsights(creatorInsightsDir);
      const newInsight = updatedInsights.get(cleanHandle);

      res.json({ success: true, handle, insight: newInsight });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Analysis failed";
      console.error("[creator-analysis-ai] n8n trigger error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
