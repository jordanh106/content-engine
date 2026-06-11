/**
 * /api/intel/recent — reads the latest viral-insights, creator-insights, and
 * audience-demand markdown files within a window. The Weekly Studio n8n chain
 * uses this to gather all intel in one HTTP GET rather than reading the
 * filesystem directly from n8n.
 */
import fs from "fs";
import path from "path";
import { Router } from "express";

type IntelFile = {
  source: "viral_insights" | "creator_insights" | "audience_demand";
  filename: string;
  ageDays: number;
  audienceId?: string;       // for audience_demand files
  preview: string;           // first 800 chars
};

export function createIntelRouter(industryDir: string) {
  const router = Router();

  // GET /api/intel/recent?days=14
  router.get("/recent", (req, res) => {
    const days = req.query.days ? Math.max(1, Math.min(180, Number(req.query.days))) : 14;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

    const files: IntelFile[] = [];

    files.push(...readDir(path.join(industryDir, "viral-insights"), "viral_insights", cutoffMs));
    files.push(...readDir(path.join(industryDir, "creator-insights"), "creator_insights", cutoffMs));
    files.push(...readDir(path.join(industryDir, "audience-demand"), "audience_demand", cutoffMs));

    // Sort newest first
    files.sort((a, b) => a.ageDays - b.ageDays);

    res.json({ days, count: files.length, files });
  });

  return router;
}

function readDir(dir: string, source: IntelFile["source"], cutoffMs: number): IntelFile[] {
  const out: IntelFile[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const fname of fs.readdirSync(dir)) {
    if (!fname.endsWith(".md")) continue;
    const full = path.join(dir, fname);
    let stat: fs.Stats;
    try { stat = fs.statSync(full); } catch { continue; }
    if (stat.mtimeMs < cutoffMs) continue;
    const content = fs.readFileSync(full, "utf-8");
    const ageDays = Math.floor((Date.now() - stat.mtimeMs) / (24 * 60 * 60 * 1000));

    let audienceId: string | undefined;
    if (source === "audience_demand") {
      const m = fname.match(/^demand-([a-z_]+)-\d{4}-\d{2}-\d{2}\.md$/);
      if (m) audienceId = m[1];
    }

    out.push({
      source,
      filename: fname,
      ageDays,
      audienceId,
      preview: content.slice(0, 800),
    });
  }
  return out;
}
