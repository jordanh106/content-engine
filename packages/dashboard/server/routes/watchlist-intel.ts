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
