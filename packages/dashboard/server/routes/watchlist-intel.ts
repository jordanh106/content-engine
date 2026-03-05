import fs from "fs";
import { Router } from "express";
import path from "path";
import { parseIdeaBank, invalidateIdeaCache } from "../parsers/idea-bank.js";
import {
  invalidateWatchlistIntelCache,
  listWatchlistIntelDates,
  parseWatchlistIntel,
  getLatestWatchlistIntel,
  getAllPreviousTopics,
} from "../parsers/watchlist-insights.js";
import { appendIdeasToFile } from "./ideas.js";
import type { IdeaCategory } from "../../shared/types.js";

export function createWatchlistIntelRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const watchlistIntelDir = path.join(industryDir, "watchlist-insights");
  const ideaBankPath = path.join(industryDir, "idea-bank.md");

  // GET /api/watchlist-intel - list all reports
  router.get("/", (_req, res) => {
    const dates = listWatchlistIntelDates(watchlistIntelDir);
    const reports = dates.map((date) => {
      const report = parseWatchlistIntel(watchlistIntelDir, date);
      return {
        date,
        ideasCount: report?.ideas?.length || 0,
        risingCreatorsCount: report?.risingCreators?.length || 0,
      };
    });
    res.json({ reports, total: reports.length });
  });

  // GET /api/watchlist-intel/latest - latest report with full data + previousTopics
  router.get("/latest", (_req, res) => {
    const report = getLatestWatchlistIntel(watchlistIntelDir);
    if (!report) {
      res.json({ date: null, ideas: [], risingCreators: [], selfImprovementNotes: null, previousTopics: [] });
      return;
    }

    const previousTopics = getAllPreviousTopics(watchlistIntelDir);
    res.json({ ...report, previousTopics });
  });

  // GET /api/watchlist-intel/:date - specific report
  router.get("/:date", (req, res) => {
    const { date } = req.params;
    const report = parseWatchlistIntel(watchlistIntelDir, date);
    if (!report) {
      res.status(404).json({ error: "No report found for this date" });
      return;
    }
    res.json(report);
  });

  // POST /api/watchlist-intel/sync-n8n - pull latest report from n8n execution
  router.post("/sync-n8n", async (_req, res) => {
    const apiUrl = process.env.N8N_API_URL;
    const apiKey = process.env.N8N_API_KEY;
    const workflowId = process.env.N8N_WATCHLIST_INTEL_WORKFLOW_ID;

    if (!apiUrl || !apiKey || !workflowId) {
      res.status(500).json({ error: "N8N_API_URL, N8N_API_KEY, and N8N_WATCHLIST_INTEL_WORKFLOW_ID must be set in .env" });
      return;
    }

    try {
      // Fetch latest successful execution
      const listRes = await fetch(
        `${apiUrl}/executions?workflowId=${workflowId}&status=success&limit=1`,
        { headers: { "X-N8N-API-KEY": apiKey } },
      );
      if (!listRes.ok) {
        res.status(502).json({ error: `n8n API error: ${listRes.status} ${listRes.statusText}` });
        return;
      }

      const listData = (await listRes.json()) as { data: Array<{ id: string }> };
      if (!listData.data?.length) {
        res.json({ synced: false, message: "No successful executions found" });
        return;
      }

      const executionId = listData.data[0].id;

      // Fetch execution with full data
      const execRes = await fetch(
        `${apiUrl}/executions/${executionId}?includeData=true`,
        { headers: { "X-N8N-API-KEY": apiKey } },
      );
      if (!execRes.ok) {
        res.status(502).json({ error: `n8n API error fetching execution: ${execRes.status}` });
        return;
      }

      const execData = (await execRes.json()) as {
        data: { resultData: { runData: Record<string, Array<{ data: { main: Array<Array<{ json: Record<string, unknown> }>> } }>> } };
      };

      // Extract report from "Format Watchlist Report" node output
      const runData = execData.data?.resultData?.runData;
      const nodeRuns = runData?.["Format Watchlist Report"];
      const output = nodeRuns?.[0]?.data?.main?.[0]?.[0]?.json;

      if (!output?.markdown || !output?.date) {
        res.json({ synced: false, message: "No report data found in latest execution" });
        return;
      }

      const markdown = output.markdown as string;
      const date = output.date as string;
      const ideas = Array.isArray(output.ideas) ? output.ideas as Array<{
        topic: string; suggestedFormat?: string; hookAngle?: string;
        priority?: string; source?: string; category?: IdeaCategory;
        inspiredBy?: string; whyNonObvious?: string; targetAudience?: string;
      }> : [];

      // Check if this report already exists
      const reportPath = path.join(watchlistIntelDir, `watchlist-intel-${date}.md`);
      const alreadyExists = fs.existsSync(reportPath);

      // Save report markdown
      fs.mkdirSync(watchlistIntelDir, { recursive: true });
      fs.writeFileSync(reportPath, markdown);
      invalidateWatchlistIntelCache();

      // Deduplicate and ingest ideas
      let ideasAdded = 0;
      let duplicatesSkipped = 0;

      if (ideas.length > 0) {
        const existing = parseIdeaBank(ideaBankPath);
        const existingTopics = new Set(existing.map((e) => e.topic.toLowerCase().trim()));

        const newIdeas = ideas.filter((i) => {
          if (!i.topic || existingTopics.has(i.topic.toLowerCase().trim())) {
            duplicatesSkipped++;
            return false;
          }
          return true;
        });

        if (newIdeas.length > 0) {
          const toIngest = newIdeas.map((i) => ({
            topic: i.topic,
            suggestedFormat: i.suggestedFormat,
            hookAngle: i.hookAngle,
            priority: i.priority,
            source: i.source || "n8n Watchlist Intelligence",
            category: (i.category || "competitor") as IdeaCategory,
          }));

          ideasAdded = appendIdeasToFile(ideaBankPath, toIngest);
          invalidateIdeaCache();
        }
      }

      res.status(201).json({
        synced: true,
        executionId,
        date,
        reportSaved: true,
        wasNew: !alreadyExists,
        ideasAdded,
        duplicatesSkipped,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync from n8n";
      console.error("[watchlist-intel-sync] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/watchlist-intel/ingest - accept report from n8n workflow
  router.post("/ingest", (req, res) => {
    const { ideas, report } = req.body as {
      ideas?: Array<{
        topic: string;
        suggestedFormat?: string;
        hookAngle?: string;
        priority?: string;
        source?: string;
        category?: IdeaCategory;
        inspiredBy?: string;
        whyNonObvious?: string;
        targetAudience?: string;
      }>;
      report?: {
        markdown: string;
        date: string;
        newHookPatterns?: Array<{ pattern: string; example: string; bestFormat: string; platform: string; optimizes: string }>;
        risingCreators?: Array<{ handle: string; platform: string; followers: string; whyWatch: string }>;
        selfImprovementNotes?: { bestQueries: string[]; mostActionableCreators: string[]; nextScanFocus: string };
      };
    };

    try {
      let reportSaved = false;
      let ideasAdded = 0;
      let duplicatesSkipped = 0;

      // Save report markdown
      if (report?.markdown && report?.date) {
        fs.mkdirSync(watchlistIntelDir, { recursive: true });
        const reportPath = path.join(watchlistIntelDir, `watchlist-intel-${report.date}.md`);
        fs.writeFileSync(reportPath, report.markdown);
        reportSaved = true;
        invalidateWatchlistIntelCache();
      }

      // Deduplicate and ingest ideas into idea-bank.md
      if (ideas && Array.isArray(ideas) && ideas.length > 0) {
        const existing = parseIdeaBank(ideaBankPath);
        const existingTopics = new Set(existing.map((e) => e.topic.toLowerCase().trim()));

        const newIdeas = ideas.filter((i) => {
          if (!i.topic || existingTopics.has(i.topic.toLowerCase().trim())) {
            duplicatesSkipped++;
            return false;
          }
          return true;
        });

        if (newIdeas.length > 0) {
          const toIngest = newIdeas.map((i) => ({
            topic: i.topic,
            suggestedFormat: i.suggestedFormat,
            hookAngle: i.hookAngle,
            priority: i.priority,
            source: i.source || "n8n Watchlist Intelligence",
            category: (i.category || "competitor") as IdeaCategory,
          }));

          ideasAdded = appendIdeasToFile(ideaBankPath, toIngest);
          invalidateIdeaCache();
        }
      }

      res.status(201).json({ reportSaved, ideasAdded, duplicatesSkipped });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to ingest watchlist intelligence";
      console.error("[watchlist-intel-ingest] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
