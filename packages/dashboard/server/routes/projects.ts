/**
 * Projects — unified unit of work.
 *
 * A Project has a brief (markdown), a refs folder (uploaded reference images/video),
 * and an outputs folder (generated images/video/html). Maps directly to the Higgsfield
 * MCP "working directory" pattern from Aidan's video.
 *
 * Storytelling reels, brand launches, carousels, DTC ads all become Projects.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Router } from "express";
import multer from "multer";
import Anthropic from "@anthropic-ai/sdk";
import { sqlite } from "../db.js";
import { parseQuickStartTemplates } from "../parsers/quickstart-templates.js";
import { predictVirality } from "../lib/virality-predictor.js";
import { generateImage, generateVideo, uploadMediaFromUrl, uploadMediaFromPath, isConfigured } from "../lib/higgsfield-client.js";
import type { Project, ProjectRef, ProjectOutput, ProjectStatus, ProjectKind, ProjectWithAssets, ViralityBreakdown } from "../../shared/types.js";

type Row = Record<string, unknown>;

function rowToProject(r: Row): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as ProjectKind,
    status: r.status as ProjectStatus,
    briefMd: (r.brief_md as string) ?? null,
    active: Boolean(r.active),
    sourceTemplateId: (r.source_template_id as string) ?? null,
    thumbnailUrl: (r.thumbnail_url as string) ?? null,
    costCredits: (r.cost_credits as number) ?? 0,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToRef(r: Row): ProjectRef {
  return {
    id: r.id as number,
    projectId: r.project_id as string,
    label: (r.label as string) ?? null,
    uploadId: (r.upload_id as string) ?? null,
    url: (r.url as string) ?? null,
    filePath: (r.file_path as string) ?? null,
    kind: r.kind as "image" | "video" | "doc",
    createdAt: r.created_at as string,
  };
}

function rowToOutput(r: Row): ProjectOutput {
  let breakdown: ViralityBreakdown | null = null;
  if (r.predicted_virality_breakdown_json) {
    try { breakdown = JSON.parse(r.predicted_virality_breakdown_json as string); } catch { /* ignore */ }
  }
  return {
    id: r.id as number,
    projectId: r.project_id as string,
    kind: r.kind as ProjectOutput["kind"],
    label: (r.label as string) ?? null,
    url: (r.url as string) ?? null,
    filePath: (r.file_path as string) ?? null,
    modelUsed: (r.model_used as string) ?? null,
    prompt: (r.prompt as string) ?? null,
    costCredits: (r.cost_credits as number) ?? 0,
    predictedVirality: (r.predicted_virality as number) ?? null,
    predictedViralityBreakdown: breakdown,
    createdAt: r.created_at as string,
  };
}

function loadProject(id: string): Project | null {
  const row = sqlite.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Row | undefined;
  return row ? rowToProject(row) : null;
}

function loadProjectWithAssets(id: string): ProjectWithAssets | null {
  const p = loadProject(id);
  if (!p) return null;
  const refs = (sqlite.prepare("SELECT * FROM project_refs WHERE project_id = ? ORDER BY id ASC").all(id) as Row[]).map(rowToRef);
  const outputs = (sqlite.prepare("SELECT * FROM project_outputs WHERE project_id = ? ORDER BY created_at DESC").all(id) as Row[]).map(rowToOutput);
  return { ...p, refs, outputs };
}

export function createProjectsRouter(projectsDataDir: string, quickstartTemplatesPath: string, blueprintPath: string) {
  const router = Router();
  fs.mkdirSync(projectsDataDir, { recursive: true });

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

  // POST /api/projects/predict-virality body { kind, text?, imagePrompt?, motionPrompt?, format?, context? }
  router.post("/predict-virality", async (req, res) => {
    try {
      const body = req.body as { kind?: string; text?: string; imagePrompt?: string; motionPrompt?: string; format?: string; context?: string };
      if (!body.kind) {
        res.status(400).json({ error: "kind required" });
        return;
      }
      const prediction = await predictVirality(
        {
          kind: body.kind as "hook" | "narrative_line" | "caption" | "image_prompt" | "carousel_cover",
          text: body.text,
          imagePrompt: body.imagePrompt,
          motionPrompt: body.motionPrompt,
          format: body.format,
          context: body.context,
        },
        { blueprintPath },
      );
      res.json(prediction);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/projects/templates — list quick-start templates (both groups)
  router.get("/templates", (_req, res) => {
    const templates = parseQuickStartTemplates(quickstartTemplatesPath);
    res.json({ templates });
  });

  // POST /api/projects/from-template body { templateKey, name? }
  router.post("/from-template", (req, res) => {
    const { templateKey, name } = req.body as { templateKey?: string; name?: string };
    if (!templateKey) {
      res.status(400).json({ error: "templateKey required" });
      return;
    }
    const templates = parseQuickStartTemplates(quickstartTemplatesPath);
    const tpl = templates.find((t) => t.key === templateKey);
    if (!tpl) {
      res.status(404).json({ error: `template ${templateKey} not found` });
      return;
    }
    const id = `prj_${crypto.randomBytes(6).toString("hex")}`;
    fs.mkdirSync(path.join(projectsDataDir, id, "refs"), { recursive: true });
    fs.mkdirSync(path.join(projectsDataDir, id, "outputs"), { recursive: true });
    const projectName = name || tpl.displayName;
    sqlite.prepare(`
      INSERT INTO projects (id, name, kind, status, brief_md, source_template_id)
      VALUES (?, ?, ?, 'drafting', ?, ?)
    `).run(id, projectName, tpl.projectKind, tpl.briefTemplate, tpl.key);
    res.status(201).json({ project: loadProject(id), template: tpl });
  });

  // GET /api/projects?status=&kind=&limit=&offset=
  router.get("/", (req, res) => {
    const status = req.query.status as string | undefined;
    const kind = req.query.kind as string | undefined;
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;

    let sql = "SELECT * FROM projects WHERE 1=1";
    const params: unknown[] = [];
    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (kind) {
      sql += " AND kind = ?";
      params.push(kind);
    }
    sql += " ORDER BY updated_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const rows = sqlite.prepare(sql).all(...params) as Row[];
    res.json({ projects: rows.map(rowToProject) });
  });

  // GET /api/projects/active — the single active project (or null)
  router.get("/active", (_req, res) => {
    const row = sqlite.prepare("SELECT * FROM projects WHERE active = 1 ORDER BY updated_at DESC LIMIT 1").get() as Row | undefined;
    res.json({ active: row ? rowToProject(row) : null });
  });

  // POST /api/projects body { name, kind, briefMd?, sourceTemplateId? }
  router.post("/", (req, res) => {
    const { name, kind, briefMd, sourceTemplateId } = req.body as {
      name?: string; kind?: ProjectKind; briefMd?: string; sourceTemplateId?: string;
    };
    if (!name || !kind) {
      res.status(400).json({ error: "name and kind required" });
      return;
    }
    const id = `prj_${crypto.randomBytes(6).toString("hex")}`;
    const projectDir = path.join(projectsDataDir, id);
    fs.mkdirSync(path.join(projectDir, "refs"), { recursive: true });
    fs.mkdirSync(path.join(projectDir, "outputs"), { recursive: true });

    sqlite.prepare(`
      INSERT INTO projects (id, name, kind, status, brief_md, source_template_id)
      VALUES (?, ?, ?, 'drafting', ?, ?)
    `).run(id, name, kind, briefMd ?? null, sourceTemplateId ?? null);

    res.status(201).json({ project: loadProject(id) });
  });

  // GET /api/projects/:id — full project with refs + outputs
  router.get("/:id", (req, res) => {
    const project = loadProjectWithAssets(req.params.id);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.json({ project });
  });

  // PUT /api/projects/:id body { name?, briefMd?, status?, active? }
  router.put("/:id", (req, res) => {
    const id = req.params.id;
    if (!loadProject(id)) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const { name, briefMd, status, active, thumbnailUrl } = req.body as {
      name?: string; briefMd?: string; status?: ProjectStatus; active?: boolean; thumbnailUrl?: string;
    };
    const fields: string[] = [];
    const values: unknown[] = [];
    if (name !== undefined) { fields.push("name = ?"); values.push(name); }
    if (briefMd !== undefined) { fields.push("brief_md = ?"); values.push(briefMd); }
    if (status !== undefined) { fields.push("status = ?"); values.push(status); }
    if (active !== undefined) { fields.push("active = ?"); values.push(active ? 1 : 0); }
    if (thumbnailUrl !== undefined) { fields.push("thumbnail_url = ?"); values.push(thumbnailUrl); }
    if (fields.length === 0) {
      res.json({ project: loadProject(id) });
      return;
    }
    fields.push("updated_at = datetime('now')");
    values.push(id);
    sqlite.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
    res.json({ project: loadProject(id) });
  });

  // POST /api/projects/:id/set-active — flip this project active, clear all others
  router.post("/:id/set-active", (req, res) => {
    const id = req.params.id;
    if (!loadProject(id)) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    sqlite.transaction(() => {
      sqlite.prepare("UPDATE projects SET active = 0 WHERE active = 1").run();
      sqlite.prepare("UPDATE projects SET active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
    })();
    res.json({ project: loadProject(id) });
  });

  // DELETE /api/projects/:id — removes the project + its data dir
  router.delete("/:id", (req, res) => {
    const id = req.params.id;
    if (!loadProject(id)) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    sqlite.prepare("DELETE FROM projects WHERE id = ?").run(id);
    const dir = path.join(projectsDataDir, id);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    res.json({ deleted: true });
  });

  // POST /api/projects/:id/refs — multipart upload of a reference image/video/doc
  router.post("/:id/refs", upload.single("file"), (req, res) => {
    const id = String(req.params.id);
    if (!loadProject(id)) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const file = (req as unknown as { file?: { originalname: string; buffer: Buffer; mimetype: string } }).file;
    if (!file) {
      res.status(400).json({ error: "file (multipart) required" });
      return;
    }
    const refsDir = path.join(projectsDataDir, id, "refs");
    fs.mkdirSync(refsDir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(refsDir, `${Date.now()}-${safeName}`);
    fs.writeFileSync(filePath, file.buffer);

    const kind = file.mimetype.startsWith("video/") ? "video" : file.mimetype.startsWith("image/") ? "image" : "doc";
    const rawLabel = (req.body as { label?: string }).label;
    const label = typeof rawLabel === "string" && rawLabel.length > 0 ? rawLabel : safeName.replace(/\.[^.]+$/, "");
    const publicUrl = `/projects/${id}/refs/${path.basename(filePath)}`;

    const result = sqlite.prepare(`
      INSERT INTO project_refs (project_id, label, file_path, url, kind)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, label, filePath, publicUrl, kind);
    const row = sqlite.prepare("SELECT * FROM project_refs WHERE id = ?").get(result.lastInsertRowid) as Row;
    res.status(201).json({ ref: rowToRef(row) });
  });

  // DELETE /api/projects/:id/refs/:refId
  router.delete("/:id/refs/:refId", (req, res) => {
    const { id, refId } = req.params;
    const ref = sqlite.prepare("SELECT * FROM project_refs WHERE id = ? AND project_id = ?").get(String(refId), String(id)) as Row | undefined;
    if (!ref) { res.status(404).json({ error: "ref not found" }); return; }
    sqlite.prepare("DELETE FROM project_refs WHERE id = ?").run(String(refId));
    if (ref.file_path && typeof ref.file_path === "string" && fs.existsSync(ref.file_path)) {
      fs.unlinkSync(ref.file_path);
    }
    res.json({ deleted: true });
  });

  // POST /api/projects/:id/generate-brand-kit — the killer workflow.
  // Generates: 3 hero stills (Nano Banana Pro) → motion piece (Seedance 10s) →
  // 9:16 social cutdown (Kling 6s) → single-file HTML landing page (Claude Haiku).
  router.post("/:id/generate-brand-kit", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not configured" });
      return;
    }

    const refs = sqlite.prepare("SELECT * FROM project_refs WHERE project_id = ? ORDER BY id ASC").all(id) as Row[];
    const briefOverride = (req.body as { briefMd?: string }).briefMd;
    const brief = briefOverride ?? project.briefMd ?? "";

    if (brief.trim().length < 20) {
      res.status(422).json({ error: "brief is too short — add a 'Brand', 'Mood', 'Hero subject', 'Audience' section first" });
      return;
    }

    sqlite.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?").run(id);

    // Fire-and-forget orchestrator. We respond immediately with manifest=building so
    // the UI can poll /api/projects/:id every 10-30 sec to watch outputs populate.
    res.json({ status: "generating", projectId: id, message: "Brand kit generation started. Poll /api/projects/:id for progress." });

    // Kick off the async work in the background
    (async () => {
      const outDir = path.join(projectsDataDir, id, "outputs");
      fs.mkdirSync(outDir, { recursive: true });
      const refDescriptors = refs.map((r) => ({ label: r.label as string | null, url: r.url as string | null, kind: r.kind as string }));

      // Compose hero prompt using brief + ref labels
      const heroPromptBase = `Editorial brand hero shot. ${brief.slice(0, 1500)}\n\nStyle: photo-real, magazine-cover energy, restrained palette, generous whitespace, NOT AI-aesthetic. Avoid: oversaturation, cliché stock-photo subject, glowing edges. Reference labels: ${refDescriptors.map((d) => d.label).filter(Boolean).join(", ")}.`;

      // 1. Three hero stills in parallel
      const heroResults = await Promise.allSettled([1, 2, 3].map(async (n) => {
        const r = await generateImage({
          prompt: `${heroPromptBase}\n\nVariant ${n}: emphasise ${n === 1 ? "subject + mood" : n === 2 ? "context + lifestyle" : "detail / close-up"}.`,
          modelKey: "nano_banana_2",
          aspectRatio: "16:9",
          resolution: "2k",
        });
        const vir = await predictVirality(
          { kind: "image_prompt", imagePrompt: r.imageUrl, format: "brand_launch" },
          { blueprintPath },
        ).catch(() => null);
        return recordProjectOutput({
          projectId: id,
          kind: "image",
          label: `hero_v${n}`,
          url: r.imageUrl,
          modelUsed: "nano_banana_2",
          prompt: heroPromptBase,
          costCredits: 2,
          predictedVirality: vir?.score,
          predictedViralityBreakdown: vir?.breakdown,
        });
      }));
      const stills = heroResults.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<ProjectOutput>).value);
      const bestStill = stills.sort((a, b) => (b.predictedVirality ?? 0) - (a.predictedVirality ?? 0))[0];
      if (!bestStill || !bestStill.url) {
        sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
        return;
      }

      // 2. Motion piece (Seedance 10s, 16:9)
      try {
        const startUploadId = await uploadMediaFromUrl(bestStill.url);
        const motionPrompt = `${brief.slice(0, 800)}\n\nSlow editorial camera move (push-in / drift / parallax). Subtle subject motion. No fast cuts. 10 seconds.`;
        const motion = await generateVideo({
          prompt: motionPrompt,
          modelKey: "seedance",
          imageUploadIds: [startUploadId],
          duration: 10,
          aspectRatio: "16:9",
        });
        recordProjectOutput({
          projectId: id,
          kind: "video",
          label: "motion_piece",
          url: motion.videoUrl,
          modelUsed: "seedance_2_0",
          prompt: motionPrompt,
          costCredits: 22.5,
        });

        // 3. 9:16 social cutdown (Kling 6s)
        const cutdownPrompt = `${brief.slice(0, 500)}\n\nVertical 9:16 social cutdown. Tight composition, faster pacing than the motion piece. 6 seconds.`;
        const cutdown = await generateVideo({
          prompt: cutdownPrompt,
          modelKey: "kling",
          imageUploadIds: [startUploadId],
          duration: 5,
          aspectRatio: "9:16",
          sound: "on",
        });
        recordProjectOutput({
          projectId: id,
          kind: "video",
          label: "social_cutdown",
          url: cutdown.videoUrl,
          modelUsed: "kling3_0",
          prompt: cutdownPrompt,
          costCredits: 10,
        });
      } catch (err) {
        console.error("[brand-kit] motion/cutdown failed:", err);
      }

      // 4. Single-file HTML landing page via Anthropic
      try {
        const client = new Anthropic();
        const stillsBlock = stills.map((s, i) => `- Hero ${i + 1}: ${s.url}`).join("\n");
        const motionRow = sqlite.prepare("SELECT * FROM project_outputs WHERE project_id = ? AND label = 'motion_piece' ORDER BY id DESC LIMIT 1").get(id) as Row | undefined;
        const motionUrl = motionRow ? (motionRow.url as string | null) : null;
        const htmlResponse = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 3500,
          messages: [{
            role: "user",
            content: `You are an editorial web designer. Produce a single-file responsive HTML landing page using inline CSS (Tailwind CDN <script src="https://cdn.tailwindcss.com"></script>). Editorial aesthetic — generous whitespace, Georgia serif headings, restrained palette of slate + warm cream + one accent. NO emdashes. NO cliché AI-aesthetic. Magazine-cover energy. NOT corporate SaaS.

BRIEF:
${brief.slice(0, 3000)}

ASSETS TO INCLUDE:
${stillsBlock}
${motionUrl ? `- Motion piece (video): ${motionUrl}` : ""}

Return ONLY the HTML — start with <!DOCTYPE html>. Include the strongest hero still as the main visual, embed the motion piece as an autoplay-muted <video> below the fold, three feature sections, and a single quiet CTA. Use 1-2 fonts max. No icons unless inline SVG.`,
          }],
        });
        const htmlBlock = htmlResponse.content.find((b) => b.type === "text");
        if (htmlBlock && htmlBlock.type === "text") {
          const htmlPath = path.join(outDir, `landing_page.html`);
          fs.writeFileSync(htmlPath, htmlBlock.text, "utf-8");
          recordProjectOutput({
            projectId: id,
            kind: "html",
            label: "landing_page",
            url: `/projects/${id}/outputs/landing_page.html`,
            filePath: htmlPath,
            modelUsed: "claude-haiku-4-5",
            prompt: brief.slice(0, 500),
          });
        }
      } catch (err) {
        console.error("[brand-kit] landing page failed:", err);
      }

      sqlite.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(id);
    })().catch((err) => {
      console.error("[brand-kit] orchestrator crashed:", err);
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  return router;
}

// Helper exposed for the brand-kit orchestrator (will use it in Step 4).
export function recordProjectOutput(input: {
  projectId: string;
  kind: ProjectOutput["kind"];
  label: string;
  url?: string;
  filePath?: string;
  modelUsed?: string;
  prompt?: string;
  costCredits?: number;
  predictedVirality?: number;
  predictedViralityBreakdown?: ViralityBreakdown;
}): ProjectOutput {
  const result = sqlite.prepare(`
    INSERT INTO project_outputs (project_id, kind, label, url, file_path, model_used, prompt, cost_credits, predicted_virality, predicted_virality_breakdown_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.projectId,
    input.kind,
    input.label,
    input.url ?? null,
    input.filePath ?? null,
    input.modelUsed ?? null,
    input.prompt ?? null,
    input.costCredits ?? 0,
    input.predictedVirality ?? null,
    input.predictedViralityBreakdown ? JSON.stringify(input.predictedViralityBreakdown) : null,
  );
  // Update parent project cost + updated_at
  sqlite.prepare(`
    UPDATE projects SET
      cost_credits = cost_credits + ?,
      updated_at = datetime('now'),
      thumbnail_url = COALESCE(thumbnail_url, ?)
    WHERE id = ?
  `).run(input.costCredits ?? 0, input.url ?? null, input.projectId);

  const row = sqlite.prepare("SELECT * FROM project_outputs WHERE id = ?").get(result.lastInsertRowid) as Row;
  return rowToOutput(row);
}
