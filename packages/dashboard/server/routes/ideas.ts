import fs from "fs";
import { Router } from "express";
import path from "path";
import { parseIdeaBank, invalidateIdeaCache } from "../parsers/idea-bank.js";
import type { IdeaCategory } from "../../shared/types.js";

const VALID_CATEGORIES: IdeaCategory[] = ["trending", "competitor", "evergreen", "audience", "personal"];

const CATEGORY_HEADERS: Record<string, string> = {
  trending: "## Trending Ideas",
  competitor: "## Competitor-Inspired Ideas",
  evergreen: "## Evergreen Ideas",
  audience: "## Audience Requests",
  personal: "## Personal/Creative Ideas",
};

type IngestIdea = {
  topic: string;
  suggestedFormat?: string;
  hookAngle?: string;
  priority?: string;
  source?: string;
  category?: IdeaCategory;
};

function appendIdeasToFile(filePath: string, ideas: IngestIdea[]): number {
  if (!fs.existsSync(filePath)) return 0;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let added = 0;

  // Group ideas by category
  const grouped: Record<string, IngestIdea[]> = {};
  for (const idea of ideas) {
    const cat = idea.category && VALID_CATEGORIES.includes(idea.category) ? idea.category : "trending";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(idea);
  }

  // For each category, find the section and insert rows
  for (const [category, categoryIdeas] of Object.entries(grouped)) {
    const header = CATEGORY_HEADERS[category];
    if (!header) continue;

    // Find the section header line
    const headerIdx = lines.findIndex((l) => l.trim() === header);
    if (headerIdx === -1) continue;

    // Find the separator line (|---|...) after the header
    let sepIdx = -1;
    for (let i = headerIdx + 1; i < lines.length; i++) {
      if (lines[i].includes("|") && lines[i].includes("---")) {
        sepIdx = i;
        break;
      }
      // Stop if we hit the next section
      if (lines[i].startsWith("## ")) break;
    }
    if (sepIdx === -1) continue;

    // Check if the line after separator is an empty placeholder row
    const afterSep = sepIdx + 1;
    if (afterSep < lines.length) {
      const cells = lines[afterSep].split("|").map((c) => c.trim()).filter((c) => c.length > 0);
      if (lines[afterSep].startsWith("|") && cells.length === 0) {
        lines.splice(afterSep, 1); // Remove empty placeholder
      }
    }

    // Find insertion point: after separator + existing data rows
    let insertIdx = sepIdx + 1;
    while (insertIdx < lines.length && lines[insertIdx].startsWith("|")) {
      insertIdx++;
    }

    // Build and insert new rows
    const today = new Date().toISOString().split("T")[0];
    const newRows = categoryIdeas.map((idea) => {
      const fmt = idea.suggestedFormat || "";
      const hook = idea.hookAngle || "";
      const pri = idea.priority || "Medium";
      const src = idea.source || "";
      const date = today;
      return `| ${idea.topic} | ${fmt} | ${hook} | ${pri} | ${src} | ${date} |`;
    });

    lines.splice(insertIdx, 0, ...newRows);
    added += newRows.length;
  }

  fs.writeFileSync(filePath, lines.join("\n"));
  return added;
}

export function createIdeasRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const ideaBankPath = path.join(industryDir, "idea-bank.md");

  // GET /api/ideas - list all ideas with optional category filter
  router.get("/", (_req, res) => {
    const { category } = _req.query;
    let ideas = parseIdeaBank(ideaBankPath);

    if (category && typeof category === "string") {
      ideas = ideas.filter((i) => i.category === (category as IdeaCategory));
    }

    res.json({ ideas, total: ideas.length });
  });

  // GET /api/ideas/summary - category counts
  router.get("/summary", (_req, res) => {
    const ideas = parseIdeaBank(ideaBankPath);
    const counts: Record<string, number> = {};
    for (const idea of ideas) {
      counts[idea.category] = (counts[idea.category] || 0) + 1;
    }
    res.json({ counts, total: ideas.length });
  });

  // POST /api/ideas/sync-n8n - pull latest ideas from n8n execution
  router.post("/sync-n8n", async (_req, res) => {
    const apiUrl = process.env.N8N_API_URL;
    const apiKey = process.env.N8N_API_KEY;
    const workflowId = process.env.N8N_WORKFLOW_ID;

    if (!apiUrl || !apiKey || !workflowId) {
      res.status(500).json({ error: "N8N_API_URL, N8N_API_KEY, and N8N_WORKFLOW_ID must be set in .env" });
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
        res.json({ synced: 0, digestSaved: false, message: "No successful executions found" });
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

      // Extract ideas from "Send to Dashboard" or "Format Markdown Digest" node output
      const runData = execData.data?.resultData?.runData;
      let ideas: IngestIdea[] = [];
      let markdown = "";
      let date = "";

      for (const nodeName of ["Send to Dashboard", "Format Markdown Digest"]) {
        const nodeRuns = runData?.[nodeName];
        if (!nodeRuns?.length) continue;
        const output = nodeRuns[0]?.data?.main?.[0]?.[0]?.json;
        if (!output) continue;

        if (Array.isArray(output.ideas) && output.ideas.length > 0) {
          ideas = output.ideas as IngestIdea[];
          markdown = (output.markdown as string) || "";
          date = (output.date as string) || "";
          break;
        }
      }

      if (ideas.length === 0) {
        res.json({ synced: 0, digestSaved: false, message: "No ideas found in latest execution" });
        return;
      }

      // Deduplicate against existing ideas
      const existing = parseIdeaBank(ideaBankPath);
      const existingTopics = new Set(existing.map((e) => e.topic.toLowerCase().trim()));
      const newIdeas = ideas.filter((i) => i.topic && !existingTopics.has(i.topic.toLowerCase().trim()));

      if (newIdeas.length === 0) {
        res.json({ synced: 0, digestSaved: false, executionId, message: "All ideas already exist" });
        return;
      }

      // Ingest new ideas
      const added = appendIdeasToFile(ideaBankPath, newIdeas);
      invalidateIdeaCache();

      // Save digest
      let digestSaved = false;
      if (markdown && date) {
        const insightsDir = path.join(industryDir, "viral-insights");
        fs.mkdirSync(insightsDir, { recursive: true });
        const digestPath = path.join(insightsDir, `intel-${date}.md`);
        if (!fs.existsSync(digestPath)) {
          fs.writeFileSync(digestPath, markdown);
          digestSaved = true;
        }
      }

      res.status(201).json({ synced: added, digestSaved, executionId });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to sync from n8n";
      console.error("[ideas-sync-n8n] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/ideas/ingest - accept ideas from n8n workflow or external sources
  router.post("/ingest", (req, res) => {
    const { ideas, digest } = req.body as {
      ideas?: IngestIdea[];
      digest?: { markdown: string; date: string };
    };

    if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
      res.status(400).json({ error: "ideas array is required and must not be empty" });
      return;
    }

    // Validate each idea has a topic
    const valid = ideas.filter((i) => i.topic && typeof i.topic === "string" && i.topic.trim().length > 0);
    if (valid.length === 0) {
      res.status(400).json({ error: "No valid ideas (each idea must have a non-empty topic)" });
      return;
    }

    try {
      // Append ideas to idea-bank.md
      const added = appendIdeasToFile(ideaBankPath, valid);
      invalidateIdeaCache();

      // Save digest file if provided
      let digestSaved = false;
      if (digest?.markdown && digest?.date) {
        const insightsDir = path.join(industryDir, "viral-insights");
        fs.mkdirSync(insightsDir, { recursive: true });
        const digestPath = path.join(insightsDir, `intel-${digest.date}.md`);
        fs.writeFileSync(digestPath, digest.markdown);
        digestSaved = true;
      }

      res.status(201).json({ added, digestSaved });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to ingest ideas";
      console.error("[ideas-ingest] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
