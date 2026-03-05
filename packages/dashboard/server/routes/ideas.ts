import fs from "fs";
import { Router } from "express";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { parseIdeaBank, invalidateIdeaCache } from "../parsers/idea-bank.js";
import { parseContentLibrary, invalidateCache as invalidateContentCache } from "../parsers/content-library.js";
import { db } from "../db.js";
import { videoStatus, statusHistory } from "../../shared/schema.js";
import type { IdeaCategory, FormatId } from "../../shared/types.js";
import { FORMATS } from "../../shared/types.js";

const VALID_CATEGORIES: IdeaCategory[] = ["trending", "competitor", "evergreen", "audience", "personal"];

const CATEGORY_HEADERS: Record<string, string> = {
  trending: "## Trending Ideas",
  competitor: "## Competitor-Inspired Ideas",
  evergreen: "## Evergreen Ideas",
  audience: "## Audience Requests",
  personal: "## Personal/Creative Ideas",
};

export type IngestIdea = {
  topic: string;
  suggestedFormat?: string;
  hookAngle?: string;
  priority?: string;
  source?: string;
  category?: IdeaCategory;
};

export function appendIdeasToFile(filePath: string, ideas: IngestIdea[]): number {
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

function findIdeaRow(lines: string[], topic: string): number {
  const normalized = topic.toLowerCase().trim();
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("|")) continue;
    if (lines[i].includes("---") || lines[i].toLowerCase().includes("| topic")) continue;
    const cells = lines[i].split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (cells[0]?.toLowerCase().trim() === normalized) return i;
  }
  return -1;
}

function updateIdeaInFile(filePath: string, topic: string, updates: { priority?: string; suggestedFormat?: string }): boolean {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const rowIdx = findIdeaRow(lines, topic);
  if (rowIdx === -1) return false;

  const cells = lines[rowIdx].split("|").map((c) => c.trim());
  // cells[0] is empty (before first |), cells[1]=Topic, [2]=Format, [3]=Hook, [4]=Priority, [5]=Source, [6]=Date, [7] empty
  if (updates.suggestedFormat !== undefined) cells[2] = ` ${updates.suggestedFormat} `;
  if (updates.priority !== undefined) cells[4] = ` ${updates.priority} `;

  // Rebuild with proper spacing
  const rebuilt = cells.map((c, i) => (i === 0 || i === cells.length - 1) ? "" : ` ${c.trim()} `);
  lines[rowIdx] = "|" + rebuilt.slice(1, -1).join("|") + "|";

  fs.writeFileSync(filePath, lines.join("\n"));
  return true;
}

function archiveIdeaInFile(filePath: string, topic: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const rowIdx = findIdeaRow(lines, topic);
  if (rowIdx === -1) return false;

  // Parse the row before removing
  const cells = lines[rowIdx].split("|").map((c) => c.trim()).filter((c) => c.length > 0);
  const ideaTopic = cells[0] || "";
  const format = cells[1] || "";
  const today = new Date().toISOString().split("T")[0];

  // Remove from current location
  lines.splice(rowIdx, 1);

  // Find the Archived section separator
  const archiveHeader = "## Archived (Scheduled)";
  const archiveIdx = lines.findIndex((l) => l.trim() === archiveHeader);
  if (archiveIdx === -1) return false;

  let sepIdx = -1;
  for (let i = archiveIdx + 1; i < lines.length; i++) {
    if (lines[i].includes("|") && lines[i].includes("---")) {
      sepIdx = i;
      break;
    }
  }
  if (sepIdx === -1) return false;

  // Remove empty placeholder after separator
  const afterSep = sepIdx + 1;
  if (afterSep < lines.length) {
    const archivedCells = lines[afterSep].split("|").map((c) => c.trim()).filter((c) => c.length > 0);
    if (lines[afterSep].startsWith("|") && archivedCells.length === 0) {
      lines.splice(afterSep, 1);
    }
  }

  // Insert after last archived row
  let insertIdx = sepIdx + 1;
  while (insertIdx < lines.length && lines[insertIdx].startsWith("|")) {
    insertIdx++;
  }

  lines.splice(insertIdx, 0, `| ${ideaTopic} | ${format} | ${today} | |`);
  fs.writeFileSync(filePath, lines.join("\n"));
  return true;
}

const FORMAT_FILE_MAP: Record<string, string> = {
  A: "explainer.md",
  B: "checklist.md",
  C: "demo.md",
  D: "myth-buster.md",
  E: "walkthrough.md",
  F: "quick-tip.md",
  G: "patient-story.md",
};

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

  // GET /api/ideas/digest/:date - serve digest markdown for a given date
  router.get("/digest/:date", (_req, res) => {
    const { date } = _req.params;
    const insightsDir = path.join(industryDir, "viral-insights");
    const digestPath = path.join(insightsDir, `intel-${date}.md`);
    if (!fs.existsSync(digestPath)) {
      res.status(404).json({ error: "No digest found for this date" });
      return;
    }
    const markdown = fs.readFileSync(digestPath, "utf-8");
    res.json({ markdown, date });
  });

  // PUT /api/ideas/update - update an idea's priority or format
  router.put("/update", (req, res) => {
    const { topic, priority, suggestedFormat } = req.body as {
      topic?: string;
      priority?: string;
      suggestedFormat?: string;
    };

    if (!topic) {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    const updated = updateIdeaInFile(ideaBankPath, topic, { priority, suggestedFormat });
    if (!updated) {
      res.status(404).json({ error: "Idea not found" });
      return;
    }
    invalidateIdeaCache();
    res.json({ updated: true });
  });

  // POST /api/ideas/archive - move an idea to the archived section
  router.post("/archive", (req, res) => {
    const { topic } = req.body as { topic?: string };
    if (!topic) {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    const archived = archiveIdeaInFile(ideaBankPath, topic);
    if (!archived) {
      res.status(404).json({ error: "Idea not found" });
      return;
    }
    invalidateIdeaCache();
    res.json({ archived: true });
  });

  // POST /api/ideas/develop - AI-powered script generation from an idea
  router.post("/develop", async (req, res) => {
    const { topic, suggestedFormat, hookAngle, priority, category } = req.body as {
      topic?: string;
      suggestedFormat?: string;
      hookAngle?: string;
      priority?: string;
      category?: string;
    };

    if (!topic) {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({ error: "ANTHROPIC_API_KEY must be set in .env" });
      return;
    }

    try {
      // Read brand voice
      const brandPath = path.join(industryDir, "brand.md");
      const brandVoice = fs.existsSync(brandPath) ? fs.readFileSync(brandPath, "utf-8") : "";

      // Read format template
      const formatCode = suggestedFormat?.match(/^([A-G])/)?.[1] || "A";
      const formatFile = FORMAT_FILE_MAP[formatCode] || "explainer.md";
      const formatsDir = path.resolve(industryDir, "../../formats");
      const formatPath = path.join(formatsDir, formatFile);
      const formatTemplate = fs.existsSync(formatPath) ? fs.readFileSync(formatPath, "utf-8") : "";

      const client = new Anthropic({ apiKey });

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `You are a content scriptwriter for a chiropractic practice's short-form video content.

BRAND VOICE:
${brandVoice}

FORMAT TEMPLATE:
${formatTemplate}

Write a production-ready script for this content idea:

Topic: ${topic}
Format: ${suggestedFormat || "A (Explainer)"}
Hook Angle: ${hookAngle || "Use your best judgment"}
Priority: ${priority || "Medium"}
Category: ${category || "general"}

Requirements:
- Follow the format template structure exactly (hook, body segments, CTA)
- Include delivery cues in brackets like [Warm, empathetic] or [Direct to camera]
- Match the brand voice: warm, educational, empowering, never clinical
- No emdashes. Use commas, periods, or restructure.
- Include a strong hook in the first 3 seconds
- End with an engaging CTA
- Target 30-45 seconds for most formats, 6-15s for Quick Tips

Return the script in this exact format:

HOOK:
[The opening hook line with delivery cue]

BODY:
[The main content sections with delivery cues]

CTA:
[The call to action with delivery cue]

DELIVERY CUES:
- [List each unique delivery cue used]

DURATION: [estimated seconds]`,
          },
        ],
      });

      const scriptText = message.content[0].type === "text" ? message.content[0].text : "";

      // Parse delivery cues from the response
      const cuesMatch = scriptText.match(/DELIVERY CUES:\n([\s\S]*?)(?:\n\nDURATION|\n*$)/);
      const deliveryCues = cuesMatch
        ? cuesMatch[1].split("\n").map((l) => l.replace(/^-\s*/, "").trim()).filter(Boolean)
        : [];

      res.json({ script: scriptText, deliveryCues });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate script";
      console.error("[ideas-develop] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // POST /api/ideas/start-production - create a video entry from an idea and start production
  router.post("/start-production", (req, res) => {
    const { topic, format, audience, hookAngle, source } = req.body as {
      topic?: string;
      format?: string;
      audience?: string;
      hookAngle?: string;
      source?: string;
    };

    if (!topic) {
      res.status(400).json({ error: "topic is required" });
      return;
    }

    try {
      // Determine format letter
      const formatLetter = (format?.match(/^([A-G])/)?.[1] || "A") as FormatId;
      const formatInfo = FORMATS[formatLetter];

      // Find next available code for this format
      const videos = parseContentLibrary(contentLibraryPath);
      const existingNums = videos
        .filter((v) => v.code.startsWith(formatLetter))
        .map((v) => parseInt(v.code.slice(1), 10))
        .filter((n) => !isNaN(n));
      const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
      const newCode = `${formatLetter}${nextNum}`;

      // Map audience ID to section name for content-library.md
      const AUDIENCE_ID_TO_SECTION: Record<string, string> = {
        prenatal: "Pregnancy & Postpartum",
        infant: "Babies & Infants",
        kids: "Kids & Teens",
        athlete: "Active Adults & Athletes",
        adult: "Adults & Daily Life",
        senior: "Seniors & Aging Well",
        general: "Whole Family & General",
      };

      const audienceId = audience || "general";
      const sectionName = AUDIENCE_ID_TO_SECTION[audienceId] || "Whole Family & General";

      // Default duration by format
      const defaultDurations: Record<string, number> = {
        A: 35, B: 35, C: 45, D: 20, E: 50, F: 10, G: 20,
      };
      const duration = defaultDurations[formatLetter] || 30;

      // Build the video entry
      const entry = [
        "",
        `#### ${newCode}: ${topic}`,
        "",
        `**Format:** ${formatLetter} (${formatInfo.name}) | **Duration:** ${duration}s | **Tags:** draft, new`,
        "",
        "**Voiceover Script:**",
        "",
        `> [Direct to camera] ${hookAngle || "Script to be developed in Composer."}`,
        "",
      ].join("\n");

      // Find the audience section and insert at the end of it
      const content = fs.readFileSync(contentLibraryPath, "utf-8");
      const lines = content.split("\n");

      // Find the section header
      let sectionIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^###\s+/) && lines[i].includes(sectionName)) {
          sectionIdx = i;
          break;
        }
      }

      if (sectionIdx === -1) {
        // Fallback: append at the end of the "Whole Family & General" section or end of file
        sectionIdx = lines.length - 1;
      }

      // Find the end of this section (before next ### header or end of file)
      let insertIdx = sectionIdx + 1;
      while (insertIdx < lines.length) {
        if (lines[insertIdx].match(/^###\s+/) && !lines[insertIdx].startsWith("####")) {
          break;
        }
        insertIdx++;
      }

      // Insert before the next section header (or at end)
      lines.splice(insertIdx, 0, entry);
      fs.writeFileSync(contentLibraryPath, lines.join("\n"));
      invalidateContentCache();

      // Create status record in SQLite
      const now = new Date().toISOString();
      db.insert(videoStatus)
        .values({
          videoCode: newCode,
          currentStatus: "SCRIPTED",
          statusUpdatedAt: now,
          notes: source ? `Created from: ${source}` : "Created from idea bank",
        })
        .run();

      db.insert(statusHistory)
        .values({
          videoCode: newCode,
          fromStatus: null,
          toStatus: "SCRIPTED",
          notes: `Started production: ${topic}`,
        })
        .run();

      // Archive the idea if it exists
      archiveIdeaInFile(ideaBankPath, topic);
      invalidateIdeaCache();

      res.status(201).json({ videoCode: newCode, topic, format: formatLetter, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start production";
      console.error("[ideas-start-production] Error:", message);
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
