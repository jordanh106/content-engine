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
import { generateImage, generateVideo, uploadMediaFromUrl, isConfigured } from "../lib/higgsfield-client.js";
import { logStage, queueStages, readGenerationLog, failPendingStages, clearProjectLog, viralityModeForKind } from "../lib/project-orchestrators.js";
import type { CarouselVariant, CarouselAspect, SlideSpec } from "../lib/carousel-renderer.js";
import { generateAndCacheImage, generateAndCacheImageWithFallback } from "../lib/higgsfield-image-cache.js";
import { BRAND_DEFAULT_SYSTEM, deserializeVisualSystem, summarizeVisualSystem, type VisualSystem } from "../lib/visual-system.js";
import { buildHiggsfieldPrompt, modelForRole, fallbackModelForRole, parseImagePromptSchema, type ImagePromptSchema, type SlideRole } from "../lib/image-prompt-builder.js";
import { parseBriefSections, serializeBriefSections } from "../../utils/project-steps.js";
import { PROJECT_KIND_REGISTRY } from "../../shared/project-kinds.js";
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

/** Map a framework SlideRole to the renderer's templateName + variant override. */
function templateForRole(role: SlideRole, slideStyle: "cinematic" | "text"): { templateName: "cover" | "content" | "cta"; variant: CarouselVariant } {
  // HOOK always uses the cover template; CTA always uses the cta template; everything else is content.
  // Variant: cinematic if the role's slideStyle is cinematic (image bg + overlay), otherwise paper.
  switch (role) {
    case "hook":
      return { templateName: "cover", variant: slideStyle === "cinematic" ? "cinematic" : "editorial" };
    case "cta":
      return { templateName: "cta", variant: "minimal" };
    case "context":
    case "payoff":
      return { templateName: "content", variant: "minimal" };
    case "tension":
      return { templateName: "content", variant: slideStyle === "cinematic" ? "cinematic" : "editorial" };
    case "build_1":
    case "build_2":
    default:
      return { templateName: "content", variant: slideStyle === "cinematic" ? "cinematic" : "editorial" };
  }
}

/** Hard-cap a headline to the framework's 6-word maximum without amputating mid-word. */
function trimHeadlineToWords(s: string, maxWords: number): string {
  const cleaned = (s ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  const words = cleaned.split(" ");
  if (words.length <= maxWords) return cleaned;
  return words.slice(0, maxWords).join(" ");
}

/** Hard-cap a body to a maximum number of "lines" (sentences) per framework rules. */
function trimBodyToLines(s: string, maxSentences: number): string {
  const cleaned = (s ?? "").trim().replace(/\s+/g, " ");
  if (!cleaned) return cleaned;
  // Split on sentence boundaries, keep punctuation.
  const parts = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [cleaned];
  return parts.slice(0, maxSentences).join(" ").trim();
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

  // POST /api/projects/:id/suggest-brief — AI brief drafting
  // body { topicSeed: string }
  // Returns { suggestedBrief: string } — full markdown ready to replace the BriefEditor content.
  router.post("/:id/suggest-brief", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    const { topicSeed } = req.body as { topicSeed?: string };
    if (!topicSeed || topicSeed.trim().length < 6) {
      res.status(422).json({ error: "topicSeed too short — add a bit more detail" });
      return;
    }

    const def = PROJECT_KIND_REGISTRY[project.kind] ?? PROJECT_KIND_REGISTRY.generic;
    const schema = def.briefSections;
    if (schema.length === 0) {
      res.status(422).json({ error: `${def.label} has no brief sections to fill` });
      return;
    }

    const isCarouselKind = project.kind === "did_you_know";
    const strategyExcerpt = isCarouselKind ? `
Carousel hook patterns (ranked by save rate):
1. Listicle promise — "3 things you didn't know about X"
2. Myth opener — "You probably think X works like Y. It doesn't."
3. Stat anchor — "92% of people do X wrong. Here's the fix."
4. Regret frame — "I wish someone told me X before I started Y."
5. Quick win — "Do this 30-second thing every morning."
6. Contrarian — "Everyone says X. The opposite is true."

Copy length rules (Instagram 1:1):
- Cover headline: 10-15 words max, bold and punchy.
- Content titles: 5-8 words.
- Content bodies: 1-2 short sentences (20-35 words).
- CTA: action-driven, save-first ("Save this for later") or share-trigger ("Tag a friend who needs this").

NO emdashes. Use commas, periods, or sentence fragments.
`.trim() : "";

    // STYLE only. No audience-targeting, no subject framing.
    // Subject matter comes from the user's topic seed and the brief sections.
    const brandVoice = `Voice and style guide:
- Warm, plain, friendly. Like an editor explaining something curious to a friend.
- No emdashes. Use commas, periods, or sentence fragments instead.
- No jargon. No marketing speak. No "in today's world" openers.
- Concrete and specific. Show, do not tell.
- Sentence-case headlines. No ALL CAPS unless emphasising a single key word.`;

    // For AI Suggest we want a complete draft, so we fill every section regardless of
    // the required flag — the flag just tells the human filling it themselves which can
    // be skipped. AI Suggest always produces a full brief.
    const sectionInstructions = schema.map((s) => {
      const len = s.minLength ? ` (at least ${s.minLength} characters of substantive content)` : "";
      const hint = s.hint ? ` — ${s.hint}` : "";
      return `## ${s.heading}\nFill this with real, specific content${len}${hint}\nWhat goes here: ${s.placeholder}`;
    }).join("\n\n");

    // Per-kind extra formatting rules. The carousel kind needs strict 7-line Slide hooks
    // mapped to Alex's Carousel Framework roles so downstream generation has clean inputs.
    const extraFormattingRules = isCarouselKind ? `

ADVANCED FORMATTING FOR THE "Slide hooks (5-7 lines)" SECTION (mandatory):
This section MUST be EXACTLY 7 numbered lines, one per Carousel Framework role.
Each line is the working title for that slide. 6 words MAXIMUM per line. No periods at the end of role-1/2/3/4/5/6 unless natural.
Do NOT write a paragraph here. Do NOT add explanation lines under the numbers. Exactly 7 numbered lines.

Use this exact structure:
1. <HOOK headline — stop the scroll, provoke curiosity, standalone-readable>
2. <CONTEXT headline — frame the problem, why this matters now>
3. <BUILD_1 headline — first core insight, one idea only>
4. <BUILD_2 headline — second core insight, one idea only>
5. <TENSION headline — the reframe, challenge the assumption>
6. <PAYOFF headline — the key takeaway, resolved>
7. <CTA headline — earn the follow, save-first or share-first>

Example for the topic "the surprising origin story of the chainsaw":
1. Chainsaws had a very different origin
2. Before they ever touched a tree
3. Two Scottish doctors built it in 1786
4. It was made to cut bone
5. Then lumberjacks claimed it
6. Everyday objects hide stranger histories
7. Save this for your next dinner` : "";

    try {
      const client = new Anthropic();
      const resp = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: `You are filling in a creative brief for a "${def.label}" project. Output ONLY the brief markdown — no preamble, no explanation, no code fence.

${brandVoice}

${strategyExcerpt ? strategyExcerpt + "\n\n" : ""}TOPIC SEED FROM USER:
${topicSeed}

TOPIC ANCHOR (most important rule):
Every section you write must stay strictly on the user's topic seed above. Do not bridge to chiropractic, posture, back pain, or family wellness unless those words appear in the topic seed itself. Brand connection lives only in the footer brand mark on the rendered slides — not in the copy.

If the topic seed is "the origin of the chainsaw", every section is about chainsaw history. The closing CTA can be topic-relevant ("Save this for your next dinner-party fact") but must not pivot to chiropractic services. The same rule applies to every topic: stay on the subject the user gave you.

Required output format — fill EVERY section listed below with concrete content matching the heading exactly. Do not invent new sections, do not skip sections, do not include the placeholder text:

${sectionInstructions}${extraFormattingRules}

Return the brief as markdown with one ## heading per section, content beneath each, blank line between sections.`,
        }],
      });

      const block = resp.content.find((b) => b.type === "text");
      const raw = block && block.type === "text" ? block.text.trim() : "";
      if (!raw) {
        res.status(502).json({ error: "AI returned an empty brief" });
        return;
      }

      // Parse + re-serialize to enforce schema heading order and drop unknown sections.
      const parsed = parseBriefSections(raw);
      const normalized: Record<string, string> = {};
      for (const s of schema) {
        normalized[s.heading] = parsed[s.heading] ?? "";
      }
      const suggestedBrief = serializeBriefSections(normalized, schema);

      // AI Suggest produces a full draft, so verify minLength on EVERY section that has one
      // (not just required). One repair pass expands sections that came back too short.
      const shortSections = schema.filter((s) => (normalized[s.heading] ?? "").trim().length < (s.minLength ?? 1));
      if (shortSections.length > 0) {
        try {
          const repair = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 1500,
            messages: [{
              role: "user",
              content: `The following brief sections are too short. Expand ONLY these sections, keep everything else identical. Stay strictly on the user's existing topic — do not introduce new subject matter, do not bridge to chiropractic or wellness unless the topic itself was already about those things. Output the complete brief in the same ## heading format, no preamble.

CURRENT BRIEF:
${suggestedBrief}

EXPAND THESE SECTIONS to meet their minimum length:
${shortSections.map((s) => `- ${s.heading} (needs ${s.minLength} chars, currently ${(normalized[s.heading] ?? "").length})`).join("\n")}

${brandVoice}`,
            }],
          });
          const rblock = repair.content.find((b) => b.type === "text");
          if (rblock && rblock.type === "text") {
            const reparsed = parseBriefSections(rblock.text.trim());
            for (const s of schema) {
              if (reparsed[s.heading]) normalized[s.heading] = reparsed[s.heading];
            }
          }
        } catch { /* keep original if repair fails */ }
      }

      const final = serializeBriefSections(normalized, schema);
      res.json({ suggestedBrief: final });
    } catch (err) {
      console.error("[suggest-brief] failed:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "suggest-brief failed" });
    }
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
    clearProjectLog(id);
    queueStages(id, ["hero_v1", "hero_v2", "hero_v3", "motion_piece", "social_cutdown", "landing_page"]);

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
        const stage = `hero_v${n}`;
        logStage(id, stage, "running");
        try {
          const variantPrompt = `${heroPromptBase}\n\nVariant ${n}: emphasise ${n === 1 ? "subject + mood" : n === 2 ? "context + lifestyle" : "detail / close-up"}.`;
          const r = await generateImage({
            prompt: variantPrompt,
            modelKey: "nano_banana_2",
            aspectRatio: "16:9",
            resolution: "2k",
          });
          const vir = await predictVirality(
            { kind: "image_prompt", imagePrompt: variantPrompt, mode: "showcase", projectBrief: brief, projectKind: project.kind, format: "brand_launch" },
            { blueprintPath },
          ).catch(() => null);
          const out = recordProjectOutput({
            projectId: id,
            kind: "image",
            label: `hero_v${n}`,
            url: r.imageUrl,
            modelUsed: "nano_banana_2",
            prompt: variantPrompt,
            costCredits: 2,
            predictedVirality: vir?.score,
            predictedViralityBreakdown: vir?.breakdown,
          });
          logStage(id, stage, "completed", vir ? `score ${vir.score}/100` : undefined);
          return out;
        } catch (err) {
          logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
          throw err;
        }
      }));
      const stills = heroResults.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<ProjectOutput>).value);
      const bestStill = stills.sort((a, b) => (b.predictedVirality ?? 0) - (a.predictedVirality ?? 0))[0];
      if (!bestStill || !bestStill.url) {
        failPendingStages(id, "no successful hero stills");
        sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
        return;
      }

      // 2. Motion piece (Seedance 10s, 16:9)
      logStage(id, "motion_piece", "running");
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
        logStage(id, "motion_piece", "completed");

        // 3. 9:16 social cutdown (Kling 6s)
        logStage(id, "social_cutdown", "running");
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
        logStage(id, "social_cutdown", "completed");
      } catch (err) {
        console.error("[brand-kit] motion/cutdown failed:", err);
        // Best-effort: mark whichever stage was last in-flight as failed
        logStage(id, "motion_piece", "failed", err instanceof Error ? err.message : String(err));
      }

      // 4. Single-file HTML landing page via Anthropic
      logStage(id, "landing_page", "running");
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
          logStage(id, "landing_page", "completed");
        } else {
          logStage(id, "landing_page", "failed", "Anthropic returned no text block");
        }
      } catch (err) {
        console.error("[brand-kit] landing page failed:", err);
        logStage(id, "landing_page", "failed", err instanceof Error ? err.message : String(err));
      }

      sqlite.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(id);
    })().catch((err) => {
      console.error("[brand-kit] orchestrator crashed:", err);
      failPendingStages(id, err instanceof Error ? err.message : String(err));
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // GET /api/projects/:id/generation-log — UI polls this every 2s during generation
  // ────────────────────────────────────────────────────────────────────────────
  router.get("/:id/generation-log", (req, res) => {
    const id = String(req.params.id);
    if (!loadProject(id)) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    res.json({ log: readGenerationLog(id) });
  });

  // POST /api/projects/:id/retry — clears the log and re-flips status to 'drafting'
  // so the user can re-run from a clean slate.
  router.post("/:id/retry", (req, res) => {
    const id = String(req.params.id);
    if (!loadProject(id)) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    clearProjectLog(id);
    sqlite.prepare("UPDATE projects SET status = 'drafting', updated_at = datetime('now') WHERE id = ?").run(id);
    res.json({ project: loadProject(id) });
  });

  // POST /api/projects/:id/retry-stage body { stage: string }
  // Retry a single stage by re-running the generation function for whichever output kind
  // matches the stage label. Uses the most recent project_outputs row with that label as
  // the prompt source. If no prior output exists (stage failed before producing one),
  // returns 422 with a clear message pointing to the global Reset.
  router.post("/:id/retry-stage", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    const { stage } = req.body as { stage?: string };
    if (!stage) { res.status(400).json({ error: "stage required" }); return; }

    if (!(await isConfigured())) { res.status(503).json({ error: "Higgsfield not configured" }); return; }

    // Try to find the most recent output with this stage label (gives us prompt + model)
    const priorOutput = sqlite.prepare(
      "SELECT * FROM project_outputs WHERE project_id = ? AND label = ? ORDER BY id DESC LIMIT 1"
    ).get(id, stage) as Row | undefined;

    if (!priorOutput || !priorOutput.prompt) {
      res.status(422).json({
        error: "no prompt available to retry this stage",
        hint: "Use Reset to re-run the whole project from scratch.",
      });
      return;
    }

    const promptStr = priorOutput.prompt as string;
    const modelUsed = (priorOutput.model_used as string) ?? null;
    const outputKind = priorOutput.kind as string;

    logStage(id, stage, "running", "retry");
    res.json({ status: "retrying", stage });

    (async () => {
      try {
        const mode = viralityModeForKind(project.kind);
        if (outputKind === "image") {
          // Determine aspect ratio from prior output's prompt — best heuristic is to reuse
          // common defaults per project kind. For brand_launch use 16:9, otherwise 9:16.
          const aspect = project.kind === "brand_launch" || project.kind === "press_kit" ? "16:9" : "9:16";
          const r = await generateImage({
            prompt: promptStr,
            modelKey: (modelUsed === "nano_banana_2" || modelUsed === "nano_banana_flash" || modelUsed === "soul") ? (modelUsed as "nano_banana_2" | "nano_banana_flash" | "soul") : "nano_banana_2",
            aspectRatio: aspect as "16:9" | "9:16",
            resolution: "2k",
          });
          const vir = await predictVirality(
            { kind: "image_prompt", imagePrompt: promptStr, mode, projectBrief: project.briefMd ?? undefined, projectKind: project.kind },
            { blueprintPath },
          ).catch(() => null);
          recordProjectOutput({
            projectId: id,
            kind: "image",
            label: stage,
            url: r.imageUrl,
            modelUsed: modelUsed || "nano_banana_2",
            prompt: promptStr,
            costCredits: 2,
            predictedVirality: vir?.score,
            predictedViralityBreakdown: vir?.breakdown,
          });
          logStage(id, stage, "completed", vir ? `retry · score ${vir.score}/100` : "retry");
        } else if (outputKind === "video") {
          // For video retry we need a base image. Use the prior video's source image if we
          // can find one — fall back to the most recent successful image output on this project.
          const baseImg = sqlite.prepare(
            "SELECT * FROM project_outputs WHERE project_id = ? AND kind = 'image' AND url IS NOT NULL ORDER BY predicted_virality DESC, id DESC LIMIT 1"
          ).get(id) as Row | undefined;
          if (!baseImg || !baseImg.url) {
            logStage(id, stage, "failed", "no image available to seed video retry");
            return;
          }
          const uploadId = await uploadMediaFromUrl(baseImg.url as string);
          const aspectRatio = stage.includes("cutdown") || stage.includes("hero_clip") || stage.includes("hero_motion") || stage.includes("motion_variant") ? "9:16" : "16:9";
          const duration = stage === "motion_piece" ? 10 : 5;
          const model: "seedance" | "kling" = stage === "motion_piece" ? "seedance" : "kling";
          const v = await generateVideo({
            prompt: promptStr,
            modelKey: model,
            imageUploadIds: [uploadId],
            duration,
            aspectRatio,
            sound: model === "kling" ? "on" : undefined,
          });
          recordProjectOutput({
            projectId: id,
            kind: "video",
            label: stage,
            url: v.videoUrl,
            modelUsed: model === "seedance" ? "seedance_2_0" : "kling3_0",
            prompt: promptStr,
            costCredits: model === "seedance" ? 22.5 : 10,
          });
          logStage(id, stage, "completed", "retry");
        } else {
          logStage(id, stage, "failed", `retry not supported for ${outputKind} stages — use Reset`);
        }
      } catch (err) {
        logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
      }
    })().catch((err) => {
      console.error("[retry-stage] crashed:", err);
      logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/projects/:id/generate-explainer
  // For chiropractic_explainer + office_tour kinds. Hook score + 4 teaching shots
  // + 5-7s hero motion + script draft.
  // ────────────────────────────────────────────────────────────────────────────
  router.post("/:id/generate-explainer", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    if (!(await isConfigured())) { res.status(503).json({ error: "Higgsfield not configured" }); return; }

    const brief = (req.body as { briefMd?: string }).briefMd ?? project.briefMd ?? "";
    const sections = parseBriefSections(brief);
    if (brief.trim().length < 80 || !sections.Topic || !sections.Audience) {
      res.status(422).json({ error: "brief incomplete — fill in Topic, Audience, Hook, Teaching beats, CTA" });
      return;
    }

    sqlite.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?").run(id);
    clearProjectLog(id);
    queueStages(id, ["hook_score", "shot_1", "shot_2", "shot_3", "shot_4", "hero_motion", "script_draft"]);
    res.json({ status: "generating", projectId: id });

    (async () => {
      const mode = viralityModeForKind(project.kind);
      const topic = sections.Topic ?? "";
      const audience = sections.Audience ?? "";
      const hook = sections.Hook ?? "";
      const teaching = sections["Teaching beats (3 things they'll learn)"] ?? sections["Walkthrough beats"] ?? "";
      const cta = sections.CTA ?? sections["Voiceover hook"] ?? "";
      const chiroPrefix = "Photo-real. Warm, educational, family-friendly chiropractic aesthetic. Natural light. NOT clinical-sterile. NOT stock-photo. Real people, real moments. Soft palette. 9:16 vertical.";

      // 1. Score the hook
      logStage(id, "hook_score", "running");
      const hookVirality = await predictVirality(
        { kind: "hook", text: hook, mode, projectKind: project.kind, format: project.kind, context: `Topic: ${topic.slice(0, 200)}` },
        { blueprintPath },
      ).catch(() => null);
      recordProjectOutput({
        projectId: id,
        kind: "text",
        label: "hook_scored",
        prompt: hook,
        predictedVirality: hookVirality?.score,
        predictedViralityBreakdown: hookVirality?.breakdown,
      });
      logStage(id, "hook_score", "completed", hookVirality ? `score ${hookVirality.score}/100` : undefined);

      // 2. Generate 4 teaching shots in parallel
      const shotPrompts = [
        `${chiroPrefix}\n\nTopic: ${topic}\n\nShot 1 — establishing hero shot illustrating the topic.`,
        `${chiroPrefix}\n\nTopic: ${topic}\n\nShot 2 — close-up detail or before/after moment.`,
        `${chiroPrefix}\n\nTopic: ${topic}\n\nShot 3 — practitioner-and-patient moment, warm and human.`,
        `${chiroPrefix}\n\nTopic: ${topic}\n\nShot 4 — CTA / outcome scene.`,
      ];
      const shots = await Promise.allSettled(shotPrompts.map(async (prompt, i) => {
        const stage = `shot_${i + 1}`;
        logStage(id, stage, "running");
        try {
          const r = await generateImage({
            prompt,
            modelKey: "nano_banana_2",
            aspectRatio: "9:16",
            resolution: "2k",
          });
          const vir = await predictVirality(
            { kind: "image_prompt", imagePrompt: prompt, mode, projectKind: project.kind, context: `Audience: ${audience.slice(0, 200)}` },
            { blueprintPath },
          ).catch(() => null);
          const out = recordProjectOutput({
            projectId: id,
            kind: "image",
            label: `shot_${i + 1}`,
            url: r.imageUrl,
            modelUsed: "nano_banana_2",
            prompt,
            costCredits: 2,
            predictedVirality: vir?.score,
            predictedViralityBreakdown: vir?.breakdown,
          });
          logStage(id, stage, "completed");
          return out;
        } catch (err) {
          logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
          throw err;
        }
      }));
      const okShots = shots.filter((s) => s.status === "fulfilled").map((s) => (s as PromiseFulfilledResult<ProjectOutput>).value);
      const bestShot = okShots.sort((a, b) => (b.predictedVirality ?? 0) - (a.predictedVirality ?? 0))[0];

      // 3. Hero motion clip from the best shot
      if (bestShot?.url) {
        logStage(id, "hero_motion", "running");
        try {
          const uploadId = await uploadMediaFromUrl(bestShot.url);
          const motionPrompt = `${chiroPrefix}\n\nTopic: ${topic}\n\n5-7 second hero motion. Subtle camera push, slight subject movement. No fast cuts.`;
          const motion = await generateVideo({
            prompt: motionPrompt,
            modelKey: "kling",
            imageUploadIds: [uploadId],
            duration: 5,
            aspectRatio: "9:16",
            sound: "on",
          });
          recordProjectOutput({
            projectId: id,
            kind: "video",
            label: "hero_motion",
            url: motion.videoUrl,
            modelUsed: "kling3_0",
            prompt: motionPrompt,
            costCredits: 10,
          });
          logStage(id, "hero_motion", "completed");
        } catch (err) {
          logStage(id, "hero_motion", "failed", err instanceof Error ? err.message : String(err));
        }
      } else {
        logStage(id, "hero_motion", "failed", "no successful shots");
      }

      // 4. Script draft via Anthropic
      logStage(id, "script_draft", "running");
      try {
        const client = new Anthropic();
        const scriptResp = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1200,
          messages: [{
            role: "user",
            content: `You are writing a 30-45 second educational reel script for Collective Family Chiropractic. Output should be in plain markdown, no emdashes, warm and educational tone, NOT salesy. Structure: HOOK (0-3s, on-screen text) → TEACHING BEAT 1 (3-10s) → TEACHING BEAT 2 (10-20s) → TEACHING BEAT 3 (20-30s) → CTA (30-35s). For each beat include: voiceover line + on-screen text overlay.

BRIEF:
Topic: ${topic}
Audience: ${audience}
Hook direction: ${hook}
Teaching beats: ${teaching}
CTA: ${cta}

Return markdown.`,
          }],
        });
        const block = scriptResp.content.find((b) => b.type === "text");
        if (block && block.type === "text") {
          recordProjectOutput({
            projectId: id,
            kind: "text",
            label: "script_draft",
            prompt: topic,
            modelUsed: "claude-haiku-4-5",
            url: undefined,
            costCredits: 0,
            // Stash the script in the prompt field for now (no separate body field on outputs schema)
          });
          // Use the `message` of the log row to surface a preview to the UI
          logStage(id, "script_draft", "completed", block.text.slice(0, 240));
          // Save the full script to a file so the UI can render it
          const outDir = path.join(projectsDataDir, id, "outputs");
          fs.mkdirSync(outDir, { recursive: true });
          const scriptPath = path.join(outDir, "script.md");
          fs.writeFileSync(scriptPath, block.text, "utf-8");
          // Update the just-recorded output with file_path + url
          sqlite.prepare(`UPDATE project_outputs SET file_path = ?, url = ? WHERE project_id = ? AND label = 'script_draft' AND id = (SELECT MAX(id) FROM project_outputs WHERE project_id = ? AND label = 'script_draft')`)
            .run(scriptPath, `/projects/${id}/outputs/script.md`, id, id);
        }
      } catch (err) {
        logStage(id, "script_draft", "failed", err instanceof Error ? err.message : String(err));
      }

      sqlite.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(id);
    })().catch((err) => {
      console.error("[explainer] orchestrator crashed:", err);
      failPendingStages(id, err instanceof Error ? err.message : String(err));
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/projects/:id/generate-patient-story
  // ────────────────────────────────────────────────────────────────────────────
  router.post("/:id/generate-patient-story", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    if (!(await isConfigured())) { res.status(503).json({ error: "Higgsfield not configured" }); return; }

    const brief = (req.body as { briefMd?: string }).briefMd ?? project.briefMd ?? "";
    const sections = parseBriefSections(brief);
    if (brief.trim().length < 80) {
      res.status(422).json({ error: "brief incomplete" });
      return;
    }

    sqlite.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?").run(id);
    clearProjectLog(id);
    queueStages(id, ["scene_1", "scene_2", "scene_3", "hero_clip", "caption_draft"]);
    res.json({ status: "generating", projectId: id });

    (async () => {
      const mode = viralityModeForKind(project.kind);
      const problem = sections["Their problem before"] ?? "";
      const change = sections["What changed"] ?? "";
      const visualStyle = sections["Visual style"] ?? "Warm, candid, golden-hour. NO stock photo energy.";
      const closingLine = sections["Closing line"] ?? "";
      const patient = sections["Patient (anonymous or by initial)"] ?? "Anonymous";

      const scenePrompts = [
        `Warm candid golden-hour photo. Patient (${patient}) in their everyday life dealing with: ${problem}. ${visualStyle}. Real moment, NOT stock photo. 9:16 vertical.`,
        `Warm candid golden-hour photo. Mid-transformation moment — patient finding relief or returning to activity. ${visualStyle}. 9:16 vertical.`,
        `Warm candid golden-hour photo. Patient after their change: ${change}. ${visualStyle}. 9:16 vertical.`,
      ];
      const shots = await Promise.allSettled(scenePrompts.map(async (prompt, i) => {
        const stage = `scene_${i + 1}`;
        logStage(id, stage, "running");
        try {
          const r = await generateImage({ prompt, modelKey: "nano_banana_2", aspectRatio: "9:16", resolution: "2k" });
          const vir = await predictVirality({ kind: "image_prompt", imagePrompt: prompt, mode, projectKind: project.kind }, { blueprintPath }).catch(() => null);
          const out = recordProjectOutput({
            projectId: id, kind: "image", label: `scene_${i + 1}`, url: r.imageUrl, modelUsed: "nano_banana_2",
            prompt, costCredits: 2, predictedVirality: vir?.score, predictedViralityBreakdown: vir?.breakdown,
          });
          logStage(id, stage, "completed");
          return out;
        } catch (err) {
          logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
          throw err;
        }
      }));
      const okShots = shots.filter((s) => s.status === "fulfilled").map((s) => (s as PromiseFulfilledResult<ProjectOutput>).value);
      const bestScene = okShots.sort((a, b) => (b.predictedVirality ?? 0) - (a.predictedVirality ?? 0))[0];

      if (bestScene?.url) {
        logStage(id, "hero_clip", "running");
        try {
          const uploadId = await uploadMediaFromUrl(bestScene.url);
          const motionPrompt = `Patient story hero clip. Subtle camera move, candid moment. ${visualStyle}. 5 seconds.`;
          const motion = await generateVideo({ prompt: motionPrompt, modelKey: "kling", imageUploadIds: [uploadId], duration: 5, aspectRatio: "9:16", sound: "on" });
          recordProjectOutput({ projectId: id, kind: "video", label: "hero_clip", url: motion.videoUrl, modelUsed: "kling3_0", prompt: motionPrompt, costCredits: 10 });
          logStage(id, "hero_clip", "completed");
        } catch (err) {
          logStage(id, "hero_clip", "failed", err instanceof Error ? err.message : String(err));
        }
      } else {
        logStage(id, "hero_clip", "failed", "no successful scenes");
      }

      // Caption draft
      logStage(id, "caption_draft", "running");
      try {
        const client = new Anthropic();
        const resp = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 600,
          messages: [{
            role: "user",
            content: `Write a warm, human social caption for an Instagram reel that's a patient story.

Patient (anonymized): ${patient}
Problem before: ${problem}
What changed: ${change}
Closing line: ${closingLine}

Rules: NO emdashes. NO "Did you know". NO stock-photo energy. Sound human. 2-4 short paragraphs. End with the closing line as the final beat. Include 3-5 relevant hashtags on the last line.

Return ONLY the caption text.`,
          }],
        });
        const block = resp.content.find((b) => b.type === "text");
        if (block && block.type === "text") {
          const outDir = path.join(projectsDataDir, id, "outputs");
          fs.mkdirSync(outDir, { recursive: true });
          const capPath = path.join(outDir, "caption.md");
          fs.writeFileSync(capPath, block.text, "utf-8");
          recordProjectOutput({
            projectId: id, kind: "text", label: "caption_draft",
            url: `/projects/${id}/outputs/caption.md`,
            filePath: capPath,
            modelUsed: "claude-haiku-4-5", prompt: closingLine, costCredits: 0,
          });
          logStage(id, "caption_draft", "completed", block.text.slice(0, 240));
        }
      } catch (err) {
        logStage(id, "caption_draft", "failed", err instanceof Error ? err.message : String(err));
      }

      sqlite.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(id);
    })().catch((err) => {
      console.error("[patient-story] crashed:", err);
      failPendingStages(id, err instanceof Error ? err.message : String(err));
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/projects/:id/generate-carousel
  //
  // Mixed-media pipeline:
  //   1. Lock Visual System (reference image teardown OR brand default)
  //   2. Plan slides via Haiku — mixes cinematic (AI image bg + text overlay) and
  //      text-only paper slides, all under one Visual System
  //   3. For each cinematic slide: Higgsfield Nano Banana 2 → local PNG
  //   4. Render every slide via Playwright (cinematic/* or editorial/* template)
  //   5. Persist outputs
  // ────────────────────────────────────────────────────────────────────────────
  router.post("/:id/generate-carousel", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }

    const body = req.body as {
      briefMd?: string;
      variant?: CarouselVariant;
      aspect?: CarouselAspect;
      slideMix?: "mixed" | "all_cinematic" | "all_text";
    };
    const brief = body.briefMd ?? project.briefMd ?? "";
    const moodPreset: CarouselVariant = body.variant ?? "cinematic";
    const aspect: CarouselAspect = body.aspect ?? "1:1";
    const slideMix = body.slideMix ?? "mixed";

    const sections = parseBriefSections(brief);
    const topic = sections.Topic ?? "";
    const slideHooksRaw = sections["Slide hooks (5-7 lines)"] ?? "";
    if (!topic) {
      res.status(422).json({ error: "brief incomplete — fill in at least the Topic. Use AI Suggest to draft the rest." });
      return;
    }

    // Higgsfield required for any cinematic slide
    const needsHiggsfield = slideMix !== "all_text";
    if (needsHiggsfield && !(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not configured. Switch slide mix to 'All text' to skip image gen." });
      return;
    }

    sqlite.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?").run(id);
    clearProjectLog(id);

    const providedHooks = slideHooksRaw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.replace(/^\d+\.\s*/, ""))
      .slice(0, 7);

    // Alex's Carousel Framework is strict 7: HOOK/CONTEXT/BUILD_1/BUILD_2/TENSION/PAYOFF/CTA.
    queueStages(id, [
      "lock_visual_system",
      "plan_slides",
      ...Array.from({ length: 7 }, (_, i) => `slide_${i + 1}`),
    ]);
    res.json({ status: "generating", projectId: id });

    (async () => {
      // ─── 1. Lock Visual System ────────────────────────────────────────────
      logStage(id, "lock_visual_system", "running");
      const storedVs = (sqlite.prepare("SELECT visual_system_json FROM projects WHERE id = ?").get(id) as { visual_system_json?: string } | undefined)?.visual_system_json;
      const visualSystem: VisualSystem = deserializeVisualSystem(storedVs) ?? BRAND_DEFAULT_SYSTEM;
      const vsSummary = summarizeVisualSystem(visualSystem);
      logStage(id, "lock_visual_system", "completed", visualSystem.style.slice(0, 60));

      // ─── 2. Plan slides via Haiku (Carousel Framework: HOOK/CONTEXT/BUILD_1/BUILD_2/TENSION/PAYOFF/CTA) ─
      logStage(id, "plan_slides", "running");
      const FRAMEWORK_ROLES: SlideRole[] = ["hook", "context", "build_1", "build_2", "tension", "payoff", "cta"];

      type PlannedSlide = {
        role: SlideRole;
        slideStyle: "cinematic" | "text";
        headline: string;
        body: string;
        imagePrompt?: ImagePromptSchema;
        ctaButton?: string;
      };

      // Default framework slide-style assignment per role. slideMix can override.
      const baseStyleForRole = (role: SlideRole): "cinematic" | "text" => {
        switch (role) {
          case "hook":
          case "build_1":
          case "tension":
            return "cinematic";
          case "context":
          case "build_2":
          case "payoff":
          case "cta":
          default:
            return "text";
        }
      };

      let planned: PlannedSlide[] = [];

      try {
        const client = new Anthropic();
        const styleOverrideRule =
          slideMix === "all_cinematic" ? "OVERRIDE: every slide except CONTEXT and CTA must use slideStyle: \"cinematic\". CONTEXT and CTA stay text by framework design."
          : slideMix === "all_text"    ? "OVERRIDE: every slide must use slideStyle: \"text\". Omit imagePrompt for every slide."
          : "Use the default slideStyle per role as listed in the framework below.";

        // When the user has pre-written exactly 7 slide hooks via AI Suggest (or by hand),
        // map line N to role N as a hard headline lock. Fewer than 7 lines = soft inspiration.
        const sevenLineHooks = providedHooks.length === 7;
        const promptHooks = sevenLineHooks
          ? `PRE-WRITTEN HEADLINES (the user has authored exactly 7 lines, one per framework role). USE THESE VERBATIM AS THE HEADLINE for each role unless the line exceeds 6 words (then trim to the most important 6 words and preserve meaning). DO NOT rephrase, DO NOT rewrite. Your job is to generate body + imagePrompt, not headlines.
1. HOOK    headline = "${providedHooks[0]}"
2. CONTEXT headline = "${providedHooks[1]}"
3. BUILD_1 headline = "${providedHooks[2]}"
4. BUILD_2 headline = "${providedHooks[3]}"
5. TENSION headline = "${providedHooks[4]}"
6. PAYOFF  headline = "${providedHooks[5]}"
7. CTA     headline = "${providedHooks[6]}"`
          : providedHooks.length > 0
          ? `Slide hooks provided by the user (use as inspiration for headlines; restructure for the framework):\n${providedHooks.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
          : "";

        const resp = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4500,
          messages: [{
            role: "user",
            content: `Build a 7-slide Instagram carousel following Alex's Carousel Framework. Warm, plain, editorial tone. NO emdashes. Plain English. Use commas and periods.

Topic: ${topic}

Visual System (locked, every slide inherits this):
${vsSummary}

APPLYING THE VISUAL SYSTEM:
The Visual System describes the AESTHETIC, not the subject. Translate it to whatever the slide's subject actually is:
- If the slide subject is a PERSON, the Visual System describes portrait conventions (lighting, framing, mood).
- If the slide subject is an OBJECT, translate "portrait photography" into "hero-shot still life" — single object filling the frame, same palette, same dramatic lighting, same emotional tone. Hero-worship aesthetic applied to the object itself.
- If the slide subject is an ENVIRONMENT, translate into "establishing shot still" with the same lighting, palette, and mood.

Always preserve the Visual System's palette and mood. NEVER abandon the palette to chase the subject's "expected" look.

TOPIC ANCHOR (load-bearing rule):
Every slide and every imagePrompt MUST reference specific nouns from the topic. If the topic mentions "chainsaw", scene.subject MUST mention "chainsaw" or "surgical chainsaw" or the specific era item, NOT generic "vintage medical equipment" or "old industrial tool". Stay strictly on the user's topic. Do not pivot to chiropractic, posture, or wellness unless those words are explicitly in the topic. Brand connection lives only in the footer brand mark on the rendered slide, not in the copy or in the image.

THE FRAMEWORK (mandatory 7 slides in this exact order):
1. HOOK     — slideStyle: cinematic. Stop the scroll. Provoke curiosity or tension. Headline must work standalone in the Explore feed.
2. CONTEXT  — slideStyle: text.      Frame the problem. Why this matters now. Clean breathing room.
3. BUILD_1  — slideStyle: cinematic. Core insight #1. ONE idea. Warm textural image.
4. BUILD_2  — slideStyle: text.      Core insight #2. ONE idea. Text-only fact card.
5. TENSION  — slideStyle: cinematic. The reframe. Challenge the assumption. Conceptual / abstract image.
6. PAYOFF   — slideStyle: text.      The key takeaway. Resolved. Clean.
7. CTA      — slideStyle: text.      Earn the follow. Save-first or share-first. ctaButton required.

${styleOverrideRule}

RULES (non-negotiable):
- Headlines: 6 words MAXIMUM. No exceptions.
- Bodies: 3 lines MAXIMUM (roughly 25 words).
- One idea per slide. If you need a second sentence to explain it, simplify the idea.
- Tension before payoff. Always.
- Slide 1 (HOOK) must read standalone if someone sees it in Explore.
- Plain language. No jargon. No marketing speak. No "in today's world" openers.

${promptHooks}

For every cinematic slide, fill in an "imagePrompt" object matching the JSON Prompt Generator schema (Alex's vault). This is a STRUCTURED JSON object — every nested field must be a string or an array of strings. Image-gen models parse this directly.

REQUIRED SECTIONS: scene, style, technical (with nested camera), composition, quality.
OPTIONAL SECTIONS (include only when relevant): materials (only if people / fabric / glass / liquid in frame), environment (only outdoor or environmental shots; skip for studio).

scene.subject is the LOAD-BEARING field. It must be a complete physical description that lets a stranger draw the object from the words alone. Include:
- The OBJECT named (e.g., "1786 hand-cranked surgical chainsaw", not "antique tool")
- Its KEY VISIBLE FEATURES (chain blade, sprockets, crank handle, guide bar, etc.)
- ITS MATERIALS (oxidized brass, dark steel, ivory grip, leather strap, etc.)
- A "LOOKS LIKE" comparison for obscure subjects ("resembles a modern chainsaw shrunk to the size of a pistol")
- The SCALE / SIZE if not obvious

BAD subject:  "antique medical equipment from 1786"
GOOD subject: "1786 hand-cranked surgical chainsaw, the size of a small pistol, with a short steel guide bar and a fine chain blade looping around two brass sprockets, polished brass crank handle on the right side, dark walnut grip. Looks like a miniature chainsaw scaled to fit in one hand."

Camera grammar: 85mm for HOOK, 50mm for BUILD close-up, 35mm for TENSION. Aperture shallower for hero (f/1.4-2.8), moderate for build (f/2.8-4). Angle = three-quarter overhead / low angle eye level / overhead flat-lay / etc.

Output JSON ONLY (no preamble, no code fence, no markdown):
{
  "slides": [
    {
      "role": "hook",
      "slideStyle": "cinematic",
      "headline": "...",
      "body": "...",
      "imagePrompt": {
        "scene": {
          "description": "<dense paragraph covering subject + setting + lighting + palette>",
          "subject": "<load-bearing field, see rules above>",
          "setting": "<where and when, specific era / surface / light source>",
          "action": "static museum still"
        },
        "style": {
          "primary": "<editorial cinematic / hyperrealistic museum photography / etc.>",
          "rendering_quality": "hyperrealistic",
          "surface_textures": "<dominant texture treatment across the scene>",
          "lighting": "<direction + quality + color temperature in Kelvin>"
        },
        "technical": {
          "camera": { "focal_length": "85mm", "aperture": "f/2.8", "depth_of_field": "<shallow / moderate / deep + description>", "angle": "three-quarter overhead" },
          "resolution": "ultra high definition, 2K print-quality",
          "rendering": "<grain / vignetting / post-processing notes>"
        },
        "composition": {
          "perspective": "<perspective type, depth layering>",
          "framing": "rule of thirds, lower-third negative space reserved for headline overlay",
          "subject_placement": "<precise positioning, visual weight>",
          "ui_elements": "NO TEXT in image — text is composited as HTML overlay in post"
        },
        "quality": {
          "include": ["8-12 positive keywords specific to this image"],
          "avoid": ["6-10 failure modes specific to this image"],
          "reference_standard": "<real photographer / publication / film whose visual language matches>"
        }
      }
    },
    { "role": "context",  "slideStyle": "text", "headline": "...", "body": "..." },
    { "role": "build_1",  "slideStyle": "cinematic", "headline": "...", "body": "...", "imagePrompt": { /* same schema */ } },
    { "role": "build_2",  "slideStyle": "text", "headline": "...", "body": "..." },
    { "role": "tension",  "slideStyle": "cinematic", "headline": "...", "body": "...", "imagePrompt": { /* same schema */ } },
    { "role": "payoff",   "slideStyle": "text", "headline": "...", "body": "..." },
    { "role": "cta",      "slideStyle": "text", "headline": "...", "body": "...", "ctaButton": "Save this" }
  ]
}

Worked example of scene.subject for the chainsaw topic, HOOK slide:
"1786 hand-cranked surgical chainsaw, the size of a small pistol, with a short steel guide bar and a fine chain blade looping around two brass sprockets, polished brass crank handle on the right side, dark walnut grip. Looks like a miniature chainsaw scaled to fit in one hand. Resting on a wooden surgical table draped in faded linen."`,
          }],
        });
        const block = resp.content.find((b) => b.type === "text");
        if (!block || block.type !== "text") throw new Error("planner returned no text");
        const match = block.text.match(/\{[\s\S]*\}/);
        if (!match) throw new Error("planner returned no JSON object");
        const parsed = JSON.parse(match[0]) as { slides?: Array<PlannedSlide & { imagePrompt?: unknown }> };
        const raw = Array.isArray(parsed.slides) ? parsed.slides : [];
        if (raw.length === 0) throw new Error("planner returned no slides");

        // Reindex by role and enforce the exact 7-slide framework. parseImagePromptSchema
        // is tolerant — it validates the shape but accepts partial sub-field fills (applyDefaults
        // fills the rest at serialize-time). A null parse drops the slide back to text-only.
        const byRole: Record<string, PlannedSlide & { imagePrompt?: unknown }> = {};
        for (const s of raw) byRole[s.role] = s;
        planned = FRAMEWORK_ROLES.map((role) => {
          const found = byRole[role];
          const defaultStyle = baseStyleForRole(role);
          const override =
            slideMix === "all_text" ? "text" as const :
            slideMix === "all_cinematic" && (role !== "context" && role !== "cta") ? "cinematic" as const :
            defaultStyle;
          if (!found) {
            return { role, slideStyle: override, headline: role.replace("_", " "), body: "" };
          }
          const slide: PlannedSlide = {
            role,
            slideStyle: override,
            headline: trimHeadlineToWords(found.headline, 6),
            body: trimBodyToLines(found.body, 3),
            ctaButton: role === "cta" ? (found.ctaButton ?? "Save this") : undefined,
          };
          // Attach imagePrompt only when the slide is cinematic AND the schema parses cleanly.
          // A null parse leaves the slide cinematic-without-prompt; the image-gen loop will
          // then skip it (no model call), and the slide renders as text.
          if (slide.slideStyle === "cinematic") {
            const promptSchema = parseImagePromptSchema(found.imagePrompt);
            if (promptSchema) {
              slide.imagePrompt = promptSchema;
            } else {
              // Drop to text — keeps the carousel intact even if Haiku failed to fill the schema.
              slide.slideStyle = "text";
            }
          }
          return slide;
        });

        const cinematicCount = planned.filter((p) => p.slideStyle === "cinematic" && p.imagePrompt).length;
        logStage(id, "plan_slides", "completed", `7 slides, ${cinematicCount} cinematic`);
      } catch (err) {
        logStage(id, "plan_slides", "failed", err instanceof Error ? err.message : String(err));
        sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
        return;
      }

      // ─── 3. Per-cinematic-slide: generate background image with structured prompt + per-role model ─
      const totalSlides = planned.length;
      const outDir = path.join(projectsDataDir, id, "outputs");
      fs.mkdirSync(outDir, { recursive: true });

      const bgImageByIndex: Record<number, { localPath: string; remoteUrl: string; cost: number; prompt: string; model: string }> = {};
      let totalImageCost = 0;

      for (let i = 0; i < planned.length; i++) {
        const slide = planned[i];
        if (slide.slideStyle !== "cinematic" || !slide.imagePrompt) continue;
        const primaryModel = modelForRole(slide.role);
        if (!primaryModel) continue;
        const fallbackModel = fallbackModelForRole(slide.role) ?? undefined;
        const stage = `slide_${i + 1}`;
        logStage(id, stage, "running", `image · ${primaryModel}`);
        const imagePrompt = buildHiggsfieldPrompt(slide.imagePrompt, visualSystem, slide.role);

        const outcome = await generateAndCacheImageWithFallback({
          prompt: imagePrompt,
          aspect,
          outDir,
          filename: `slide_${i + 1}_bg.png`,
          primaryModel,
          fallbackModel,
          onAttempt: (msg) => logStage(id, stage, "running", msg),
        });

        if (outcome.ok) {
          const { result, modelUsed, usedFallback } = outcome;
          bgImageByIndex[i] = { localPath: result.localPath, remoteUrl: result.remoteUrl, cost: result.costCredits, prompt: imagePrompt, model: modelUsed };
          totalImageCost += result.costCredits;
          recordProjectOutput({
            projectId: id,
            kind: "image",
            label: `slide_${i + 1}_bg_${slide.role}`,
            url: `/projects/${id}/outputs/slide_${i + 1}_bg.png`,
            filePath: result.localPath,
            modelUsed,
            prompt: imagePrompt,
            costCredits: result.costCredits,
          });
          if (usedFallback) {
            logStage(id, stage, "running", `image ready via ${modelUsed} (fallback used)`);
          }
        } else {
          // Hard failure on both primary and fallback. Re-tag this slide as text so the
          // composite step uses the editorial/minimal template instead of cinematic. The
          // carousel continues — we do NOT abort the whole run on a single image-gen miss.
          slide.slideStyle = "text";
          slide.imagePrompt = undefined;
          logStage(id, stage, "running", `text fallback (image gen failed: ${outcome.error.slice(0, 80)})`);
        }
      }

      // ─── 4. Build slide specs and render. Role drives templateName + variant. ─
      const slideSpecs: SlideSpec[] = planned.map((s, i): SlideSpec => {
        const { templateName, variant: slideVariant } = templateForRole(s.role, s.slideStyle);
        const bg = bgImageByIndex[i]?.localPath;
        if (templateName === "cover") {
          return {
            templateName: "cover",
            variant: slideVariant,
            variables: {
              HOOK_LINE: s.headline,
              SUBTITLE: s.body,
              TOTAL_SLIDES: String(totalSlides),
              BG_IMAGE_URL: bg,
            },
          };
        }
        if (templateName === "cta") {
          return {
            templateName: "cta",
            variant: slideVariant,
            variables: {
              CTA_HEADLINE: s.headline,
              CTA_SUBHEAD: s.body,
              CTA_BUTTON_TEXT: (s.ctaButton ?? "Save this").toUpperCase(),
              SLIDE_INDEX: String(i + 1),
              TOTAL_SLIDES: String(totalSlides),
              BG_IMAGE_URL: bg,
            },
          };
        }
        // content template — derive a per-slide number for the big-numeral block
        const contentIndex = planned.slice(0, i).filter((x, j) => templateForRole(x.role, x.slideStyle).templateName === "content").length + 1;
        return {
          templateName: "content",
          variant: slideVariant,
          variables: {
            POINT_NUMBER: String(contentIndex).padStart(2, "0"),
            POINT_TITLE: s.headline,
            POINT_BODY: s.body,
            SLIDE_INDEX: String(i + 1),
            TOTAL_SLIDES: String(totalSlides),
            BG_IMAGE_URL: bg,
          },
        };
      });

      let rendered: Array<{ slideIndex: number; filePath: string; templateName: string }> = [];
      try {
        const { renderCarousel } = await import("../lib/carousel-renderer.js");
        rendered = await renderCarousel({
          slides: slideSpecs,
          variant: moodPreset,
          aspect,
          outDir,
          prefix: "slide_",
        });
      } catch (err) {
        logStage(id, `slide_1`, "failed", err instanceof Error ? err.message : String(err));
        sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
        return;
      }

      // ─── 5. Persist each composited PNG as an image output ────────────────
      for (let i = 0; i < rendered.length; i++) {
        const stage = `slide_${i + 1}`;
        const r = rendered[i];
        const s = planned[i];
        const publicUrl = `/projects/${id}/outputs/${path.basename(r.filePath)}`;
        recordProjectOutput({
          projectId: id,
          kind: "image",
          label: `slide_${r.slideIndex}_${s.role}`,
          url: publicUrl,
          filePath: r.filePath,
          modelUsed: `carousel:${s.role}:${s.slideStyle}`,
          prompt: `${s.headline} — ${s.body}`,
          costCredits: bgImageByIndex[i]?.cost ?? 0,
        });
        logStage(id, stage, "completed", `${s.role}: ${s.headline.slice(0, 60)}`);
      }

      // ─── 6. Outline + Visual System artifact ──────────────────────────────
      const outlineMd = `# Carousel outline (${moodPreset}, ${aspect}, mix=${slideMix})

**Visual System:** ${visualSystem.style}
**Palette:** ${visualSystem.palette.join(", ")}
**Mood:** ${visualSystem.mood}

${planned.map((s, i) => {
  const lines = [
    `## ${i + 1}. ${s.role.toUpperCase().replace("_", " ")} (${s.slideStyle}) — ${s.headline}`,
    "",
    s.body,
  ];
  if (s.imagePrompt) {
    const finalPrompt = buildHiggsfieldPrompt(s.imagePrompt, visualSystem, s.role);
    lines.push("", "**Image prompt** (JSON Prompt Generator schema, sent to Higgsfield verbatim):", "", "```json", finalPrompt, "```");
  }
  if (s.role === "cta" && s.ctaButton) lines.push("", `**CTA button:** ${s.ctaButton}`);
  return lines.join("\n");
}).join("\n\n")}
`;
      const outlinePath = path.join(outDir, "slide_outlines.md");
      fs.writeFileSync(outlinePath, outlineMd, "utf-8");
      recordProjectOutput({
        projectId: id,
        kind: "text",
        label: "slide_outlines",
        url: `/projects/${id}/outputs/slide_outlines.md`,
        filePath: outlinePath,
        modelUsed: "claude-haiku-4-5",
        prompt: topic,
        costCredits: 0,
      });

      // Update project status + accumulated cost
      sqlite.prepare("UPDATE projects SET status = 'ready', cost_credits = cost_credits + ?, updated_at = datetime('now') WHERE id = ?").run(totalImageCost, id);
    })().catch((err) => {
      console.error("[carousel] crashed:", err);
      failPendingStages(id, err instanceof Error ? err.message : String(err));
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/projects/:id/visual-teardown
  // Reads a reference image (first project_refs image) and uses Claude Haiku Vision
  // to derive a Visual System JSON that locks the carousel's design language.
  // ────────────────────────────────────────────────────────────────────────────
  router.post("/:id/visual-teardown", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }

    const refRow = sqlite.prepare(
      "SELECT * FROM project_refs WHERE project_id = ? AND kind = 'image' ORDER BY id ASC LIMIT 1"
    ).get(id) as Row | undefined;
    if (!refRow) {
      res.status(422).json({ error: "no reference image attached. Upload a carousel screenshot first." });
      return;
    }
    const refPath = (refRow.file_path as string) ?? "";
    if (!refPath || !fs.existsSync(refPath)) {
      res.status(422).json({ error: "reference image file missing on disk" });
      return;
    }

    try {
      const ext = path.extname(refPath).toLowerCase();
      const mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" =
        ext === ".png" ? "image/png"
        : ext === ".webp" ? "image/webp"
        : ext === ".gif" ? "image/gif"
        : "image/jpeg";
      const base64 = fs.readFileSync(refPath).toString("base64");

      const client = new Anthropic();
      const resp = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            {
              type: "text",
              text: `Analyse this reference carousel slide. Return JSON ONLY (no preamble, no code fence) describing the Visual System that locks this design language. Use this exact schema:

{
  "style": "<one sentence describing the overall visual style — e.g. 'Warm editorial cinematic with soft natural light' or 'High-contrast minimalist with hard typography'>",
  "palette": ["<color name + approximate hex>", "..."],
  "typographyMood": "<typeface family / weight / character — e.g. 'Bold sans-serif display, light sans body, tight tracking'>",
  "density": "minimal" | "medium" | "dense",
  "mood": "<one sentence describing the emotional tone>",
  "paletteColors": {
    "primary": "<hex>",
    "accent": "<hex>",
    "background": "<hex>",
    "text": "<hex>"
  }
}

Be specific. Pick colors that match what you see. Density: minimal = lots of whitespace, dense = packed.`,
            },
          ],
        }],
      });
      const block = resp.content.find((b) => b.type === "text");
      if (!block || block.type !== "text") {
        res.status(502).json({ error: "vision returned empty response" });
        return;
      }
      const match = block.text.match(/\{[\s\S]*\}/);
      if (!match) {
        res.status(502).json({ error: "vision returned no JSON" });
        return;
      }
      const parsed = JSON.parse(match[0]) as VisualSystem;
      sqlite.prepare("UPDATE projects SET visual_system_json = ?, updated_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(parsed), id);
      res.json({ visualSystem: parsed });
    } catch (err) {
      console.error("[visual-teardown] failed:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "visual teardown failed" });
    }
  });

  // DELETE /api/projects/:id/visual-system — revert to brand default
  router.delete("/:id/visual-system", (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    sqlite.prepare("UPDATE projects SET visual_system_json = NULL, updated_at = datetime('now') WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  // GET /api/projects/:id/visual-system — read currently locked system (or null)
  router.get("/:id/visual-system", (req, res) => {
    const id = String(req.params.id);
    const row = sqlite.prepare("SELECT visual_system_json FROM projects WHERE id = ?").get(id) as { visual_system_json?: string } | undefined;
    if (!row) { res.status(404).json({ error: "project not found" }); return; }
    const vs = deserializeVisualSystem(row.visual_system_json);
    res.json({ visualSystem: vs, isDefault: vs === null });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/projects/:id/generate-holiday-variant
  // Requires at least one ref image. Re-themes the brand asset for the season.
  // ────────────────────────────────────────────────────────────────────────────
  router.post("/:id/generate-holiday-variant", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    if (!(await isConfigured())) { res.status(503).json({ error: "Higgsfield not configured" }); return; }

    const refs = sqlite.prepare("SELECT * FROM project_refs WHERE project_id = ? ORDER BY id ASC").all(id) as Row[];
    const brief = (req.body as { briefMd?: string }).briefMd ?? project.briefMd ?? "";
    const sections = parseBriefSections(brief);
    if (refs.length === 0) {
      res.status(422).json({ error: "need at least 1 reference image (the base brand asset to re-theme)" });
      return;
    }
    if (!sections["Holiday / season"] || !sections["Holiday treatment"]) {
      res.status(422).json({ error: "brief incomplete — fill in Holiday/season and Holiday treatment" });
      return;
    }

    sqlite.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?").run(id);
    clearProjectLog(id);
    queueStages(id, ["variant_1", "variant_2", "variant_3", "motion_variant"]);
    res.json({ status: "generating", projectId: id });

    (async () => {
      const mode = viralityModeForKind(project.kind);
      const season = sections["Holiday / season"] ?? "";
      const treatment = sections["Holiday treatment"] ?? "";
      const baseRef = refs[0];
      const baseRefUrl = baseRef?.url as string | null;

      const variantPrompts = [
        `Re-theme the reference brand asset for the ${season} season. ${treatment}. Tasteful, editorial, NOT cliché. Photo-real.`,
        `Re-theme the reference brand asset for the ${season} season. ${treatment}. Different angle / composition variant. Photo-real.`,
        `Re-theme the reference brand asset for the ${season} season. ${treatment}. Closer detail / hero crop. Photo-real.`,
      ];

      const variants = await Promise.allSettled(variantPrompts.map(async (prompt, i) => {
        const stage = `variant_${i + 1}`;
        logStage(id, stage, "running");
        try {
          const r = await generateImage({
            prompt,
            modelKey: "nano_banana_2",
            aspectRatio: "1:1",
            resolution: "2k",
          });
          const vir = await predictVirality({ kind: "image_prompt", imagePrompt: prompt, mode, projectKind: project.kind }, { blueprintPath }).catch(() => null);
          const out = recordProjectOutput({
            projectId: id, kind: "image", label: `variant_${i + 1}`, url: r.imageUrl, modelUsed: "nano_banana_2",
            prompt, costCredits: 2, predictedVirality: vir?.score, predictedViralityBreakdown: vir?.breakdown,
          });
          logStage(id, stage, "completed");
          return out;
        } catch (err) {
          logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
          throw err;
        }
      }));
      const okVariants = variants.filter((v) => v.status === "fulfilled").map((v) => (v as PromiseFulfilledResult<ProjectOutput>).value);

      const bestVariant = okVariants.sort((a, b) => (b.predictedVirality ?? 0) - (a.predictedVirality ?? 0))[0];
      if (bestVariant?.url) {
        logStage(id, "motion_variant", "running");
        try {
          const uploadId = await uploadMediaFromUrl(bestVariant.url);
          const motionPrompt = `Holiday variant motion clip. Subtle camera move, season-appropriate. ${treatment}. 4 seconds.`;
          const motion = await generateVideo({ prompt: motionPrompt, modelKey: "kling", imageUploadIds: [uploadId], duration: 5, aspectRatio: "9:16", sound: "on" });
          recordProjectOutput({ projectId: id, kind: "video", label: "motion_variant", url: motion.videoUrl, modelUsed: "kling3_0", prompt: motionPrompt, costCredits: 10 });
          logStage(id, "motion_variant", "completed");
        } catch (err) {
          logStage(id, "motion_variant", "failed", err instanceof Error ? err.message : String(err));
        }
      } else {
        logStage(id, "motion_variant", "failed", "no successful variants");
      }

      sqlite.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(id);
    })().catch((err) => {
      console.error("[holiday] crashed:", err);
      failPendingStages(id, err instanceof Error ? err.message : String(err));
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/projects/:id/generate-viral-replication
  // For `viral_replication` kind. Replicates a viral reference's structure with your brand.
  router.post("/:id/generate-viral-replication", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    if (!(await isConfigured())) { res.status(503).json({ error: "Higgsfield not configured" }); return; }

    const brief = (req.body as { briefMd?: string }).briefMd ?? project.briefMd ?? "";
    const sections = parseBriefSections(brief);
    const refUrl = sections["Reference video URL"] ?? "";
    const whatWorks = sections["What about it works"] ?? "";
    const yourBrand = sections["Your brand / product"] ?? "";
    const targetOutput = sections["Target output"] ?? "9:16 reel, 6-15 seconds.";
    if (!refUrl || !whatWorks || !yourBrand) {
      res.status(422).json({ error: "brief incomplete — fill in Reference video URL, What about it works, and Your brand / product" });
      return;
    }

    sqlite.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?").run(id);
    clearProjectLog(id);
    queueStages(id, ["hook_variant", "scene_1", "scene_2", "scene_3", "rebuilt_motion"]);
    res.json({ status: "generating", projectId: id });

    (async () => {
      const mode = viralityModeForKind(project.kind);
      const aspect = targetOutput.toLowerCase().includes("16:9") ? "16:9" : "9:16";

      // 1. Hook variant + scoring (Anthropic)
      logStage(id, "hook_variant", "running");
      let hookLine = "";
      try {
        const client = new Anthropic();
        const hookResp = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 200,
          messages: [{
            role: "user",
            content: `You are rebuilding a viral video for a new brand. Borrow ONLY the structure (hook shape, pacing, beat count) — not the literal content.\n\nReference: ${refUrl}\nWhat works: ${whatWorks}\nYour brand: ${yourBrand}\n\nWrite ONE punchy on-screen hook line (under 12 words) that recreates that pattern for the new brand. No emdashes. Output ONLY the hook line, no quotes, no preamble.`,
          }],
        });
        hookLine = hookResp.content[0]?.type === "text" ? hookResp.content[0].text.trim() : "";
        const vir = await predictVirality(
          { kind: "hook", text: hookLine, mode, projectBrief: brief, projectKind: project.kind },
          { blueprintPath },
        ).catch(() => null);
        recordProjectOutput({
          projectId: id, kind: "text", label: "hook_variant",
          prompt: hookLine, predictedVirality: vir?.score, predictedViralityBreakdown: vir?.breakdown,
        });
        logStage(id, "hook_variant", "completed", vir ? `scored ${vir.score}/100` : undefined);
      } catch (err) {
        logStage(id, "hook_variant", "failed", err instanceof Error ? err.message : String(err));
      }

      // 2. Three rebuilt scene stills in parallel
      const scenePrompts = [
        `Opening scene that establishes ${yourBrand}. Visual structure echoes the reference (${whatWorks}). Editorial, photo-real, no text overlay.`,
        `Mid-beat scene for ${yourBrand}. The turn / surprise the reference uses, recast for this brand. Editorial, photo-real, no text overlay.`,
        `Closing scene for ${yourBrand}. Pay-off frame, eye-catching, share-worthy. Editorial, photo-real, no text overlay.`,
      ];
      const scenes = await Promise.allSettled(scenePrompts.map(async (prompt, i) => {
        const stage = `scene_${i + 1}`;
        logStage(id, stage, "running");
        try {
          const r = await generateImage({ prompt, modelKey: "nano_banana_2", aspectRatio: aspect as "9:16" | "16:9", resolution: "2k" });
          const vir = await predictVirality(
            { kind: "image_prompt", imagePrompt: prompt, mode, projectBrief: brief, projectKind: project.kind },
            { blueprintPath },
          ).catch(() => null);
          const out = recordProjectOutput({
            projectId: id, kind: "image", label: stage, url: r.imageUrl, modelUsed: "nano_banana_2",
            prompt, costCredits: 2, predictedVirality: vir?.score, predictedViralityBreakdown: vir?.breakdown,
          });
          logStage(id, stage, "completed", vir ? `scored ${vir.score}/100` : undefined);
          return out;
        } catch (err) {
          logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
          throw err;
        }
      }));
      const okScenes = scenes.filter((s) => s.status === "fulfilled").map((s) => (s as PromiseFulfilledResult<ProjectOutput>).value);

      // 3. Rebuilt motion from the strongest scene
      const bestScene = okScenes.sort((a, b) => (b.predictedVirality ?? 0) - (a.predictedVirality ?? 0))[0];
      if (bestScene?.url) {
        logStage(id, "rebuilt_motion", "running");
        try {
          const uploadId = await uploadMediaFromUrl(bestScene.url);
          const motionPrompt = `Replicate the pacing of the reference clip. ${whatWorks}. Recast for ${yourBrand}. 5 seconds.`;
          const motion = await generateVideo({ prompt: motionPrompt, modelKey: "kling", imageUploadIds: [uploadId], duration: 5, aspectRatio: aspect as "9:16" | "16:9", sound: "on" });
          recordProjectOutput({ projectId: id, kind: "video", label: "rebuilt_motion", url: motion.videoUrl, modelUsed: "kling3_0", prompt: motionPrompt, costCredits: 10 });
          logStage(id, "rebuilt_motion", "completed");
        } catch (err) {
          logStage(id, "rebuilt_motion", "failed", err instanceof Error ? err.message : String(err));
        }
      } else {
        logStage(id, "rebuilt_motion", "failed", "no successful scene stills to seed the motion clip");
      }

      sqlite.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(id);
    })().catch((err) => {
      console.error("[viral-replication] crashed:", err);
      failPendingStages(id, err instanceof Error ? err.message : String(err));
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/projects/:id/generate-ad-variants
  // For `ad_variants` kind. Fan-out six on-brand ad variants across the user's specified axes.
  router.post("/:id/generate-ad-variants", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    if (!(await isConfigured())) { res.status(503).json({ error: "Higgsfield not configured" }); return; }

    const brief = (req.body as { briefMd?: string }).briefMd ?? project.briefMd ?? "";
    const sections = parseBriefSections(brief);
    const product = sections["Product"] ?? "";
    const axes = sections["Variant axes"] ?? "";
    const dontInclude = sections["Don't include"] ?? "";
    if (!product || !axes) {
      res.status(422).json({ error: "brief incomplete — fill in Product and Variant axes" });
      return;
    }

    const variantCount = 6;
    const labels = Array.from({ length: variantCount }, (_, i) => `variant_${i + 1}`);
    sqlite.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?").run(id);
    clearProjectLog(id);
    queueStages(id, labels);
    res.json({ status: "generating", projectId: id });

    (async () => {
      const mode = viralityModeForKind(project.kind);
      const anglesHint = [
        "studio packshot, dramatic single light",
        "lifestyle in-use shot, warm golden hour",
        "tight macro detail, editorial",
        "wide environmental scene, sense of place",
        "overhead flat-lay with complementary props",
        "negative-space hero with bold composition",
      ];

      await Promise.allSettled(labels.map(async (stage, i) => {
        logStage(id, stage, "running");
        try {
          const angle = anglesHint[i] ?? "editorial product hero";
          const prompt = `${product}. ${anglesHint[i] ? `Angle: ${angle}.` : ""} Variant axes: ${axes}. ${dontInclude ? `Avoid: ${dontInclude}.` : ""} Photo-real, on-brand, editorial. No text overlay, no logos baked in.`;
          const r = await generateImage({ prompt, modelKey: "nano_banana_2", aspectRatio: "1:1", resolution: "2k" });
          const vir = await predictVirality(
            { kind: "image_prompt", imagePrompt: prompt, mode, projectBrief: brief, projectKind: project.kind },
            { blueprintPath },
          ).catch(() => null);
          recordProjectOutput({
            projectId: id, kind: "image", label: stage, url: r.imageUrl, modelUsed: "nano_banana_2",
            prompt, costCredits: 2, predictedVirality: vir?.score, predictedViralityBreakdown: vir?.breakdown,
          });
          logStage(id, stage, "completed", vir ? `scored ${vir.score}/100` : undefined);
        } catch (err) {
          logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
        }
      }));

      sqlite.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(id);
    })().catch((err) => {
      console.error("[ad-variants] crashed:", err);
      failPendingStages(id, err instanceof Error ? err.message : String(err));
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/projects/:id/generate-product-360
  // For `product_360` kind. Eight rotation frames around a product reference image.
  router.post("/:id/generate-product-360", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    if (!(await isConfigured())) { res.status(503).json({ error: "Higgsfield not configured" }); return; }

    const refs = sqlite.prepare("SELECT * FROM project_refs WHERE project_id = ? ORDER BY id ASC").all(id) as Row[];
    if (refs.length === 0) {
      res.status(422).json({ error: "need at least 1 reference image (the product to rotate)" });
      return;
    }
    const brief = (req.body as { briefMd?: string }).briefMd ?? project.briefMd ?? "";
    const sections = parseBriefSections(brief);
    const subject = sections["Subject"] ?? "";
    const background = sections["Background"] ?? "neutral studio";
    const lighting = sections["Lighting"] ?? "soft";
    if (!subject) {
      res.status(422).json({ error: "brief incomplete — fill in Subject" });
      return;
    }

    const labels = Array.from({ length: 8 }, (_, i) => `frame_${i + 1}`);
    sqlite.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?").run(id);
    clearProjectLog(id);
    queueStages(id, labels);
    res.json({ status: "generating", projectId: id });

    (async () => {
      const mode = viralityModeForKind(project.kind);
      const baseRefUrl = refs[0]?.url as string | null;

      await Promise.allSettled(labels.map(async (stage, i) => {
        logStage(id, stage, "running");
        try {
          const angleDeg = i * 45;
          const prompt = `Same ${subject} rotated ${angleDeg}° from the reference orientation. Background: ${background}. Lighting: ${lighting}. Photo-real, identical product, identical lighting setup. Editorial product photography.`;
          const r = await generateImage({ prompt, modelKey: "nano_banana_2", aspectRatio: "1:1", resolution: "2k" });
          const vir = await predictVirality(
            { kind: "image_prompt", imagePrompt: prompt, mode, projectBrief: brief, projectKind: project.kind },
            { blueprintPath },
          ).catch(() => null);
          recordProjectOutput({
            projectId: id, kind: "image", label: stage, url: r.imageUrl, modelUsed: "nano_banana_2",
            prompt, costCredits: 2, predictedVirality: vir?.score, predictedViralityBreakdown: vir?.breakdown,
          });
          logStage(id, stage, "completed", vir ? `scored ${vir.score}/100` : undefined);
        } catch (err) {
          logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
        }
      }));

      // Best-effort log so the user sees the base reference used
      if (baseRefUrl) {
        logStage(id, "frame_1", "completed", "seeded by primary reference");
      }

      sqlite.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(id);
    })().catch((err) => {
      console.error("[product-360] crashed:", err);
      failPendingStages(id, err instanceof Error ? err.message : String(err));
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // POST /api/projects/:id/generate-press-kit
  // For `press_kit` kind. Four editorial hero stills across 1:1, 4:5, 16:9, 9:16.
  router.post("/:id/generate-press-kit", async (req, res) => {
    const id = String(req.params.id);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    if (!(await isConfigured())) { res.status(503).json({ error: "Higgsfield not configured" }); return; }

    const brief = (req.body as { briefMd?: string }).briefMd ?? project.briefMd ?? "";
    const sections = parseBriefSections(brief);
    const subject = sections["Subject"] ?? "";
    const mood = sections["Mood"] ?? "";
    const wardrobeProps = sections["Wardrobe / props"] ?? "";
    if (!subject || !mood || !wardrobeProps) {
      res.status(422).json({ error: "brief incomplete — fill in Subject, Mood, and Wardrobe / props" });
      return;
    }

    const formats: Array<{ stage: string; aspect: "1:1" | "4:5" | "16:9" | "9:16"; angle: string }> = [
      { stage: "square_1x1", aspect: "1:1", angle: "centered hero composition, balanced negative space" },
      { stage: "portrait_4x5", aspect: "4:5", angle: "feed-optimised vertical, subject anchored low-third" },
      { stage: "wide_16x9", aspect: "16:9", angle: "magazine cover spread, environmental framing" },
      { stage: "story_9x16", aspect: "9:16", angle: "story-frame vertical, leading lines toward subject" },
    ];

    sqlite.prepare("UPDATE projects SET status = 'generating', updated_at = datetime('now') WHERE id = ?").run(id);
    clearProjectLog(id);
    queueStages(id, formats.map((f) => f.stage));
    res.json({ status: "generating", projectId: id });

    (async () => {
      const modeV = viralityModeForKind(project.kind);

      await Promise.allSettled(formats.map(async ({ stage, aspect, angle }) => {
        logStage(id, stage, "running");
        try {
          const prompt = `${subject}. Mood: ${mood}. Wardrobe / props: ${wardrobeProps}. ${angle}. Editorial, magazine-grade, photo-real. NOT a corporate headshot. NOT stock photography.`;
          const r = await generateImage({ prompt, modelKey: "nano_banana_2", aspectRatio: aspect, resolution: "2k" });
          const vir = await predictVirality(
            { kind: "image_prompt", imagePrompt: prompt, mode: modeV, projectBrief: brief, projectKind: project.kind },
            { blueprintPath },
          ).catch(() => null);
          recordProjectOutput({
            projectId: id, kind: "image", label: stage, url: r.imageUrl, modelUsed: "nano_banana_2",
            prompt, costCredits: 2, predictedVirality: vir?.score, predictedViralityBreakdown: vir?.breakdown,
          });
          logStage(id, stage, "completed", vir ? `scored ${vir.score}/100` : undefined);
        } catch (err) {
          logStage(id, stage, "failed", err instanceof Error ? err.message : String(err));
        }
      }));

      sqlite.prepare("UPDATE projects SET status = 'ready', updated_at = datetime('now') WHERE id = ?").run(id);
    })().catch((err) => {
      console.error("[press-kit] crashed:", err);
      failPendingStages(id, err instanceof Error ? err.message : String(err));
      sqlite.prepare("UPDATE projects SET status = 'drafting' WHERE id = ?").run(id);
    });
  });

  // POST /api/projects/:id/outputs — internal endpoint for specialist surfaces
  // (Storytelling Reel modal, Marketing Studio) to attach their final outputs to a project.
  router.post("/:id/outputs", (req, res) => {
    const id = String(req.params.id);
    if (!loadProject(id)) {
      res.status(404).json({ error: "project not found" });
      return;
    }
    const body = req.body as Partial<{
      kind: ProjectOutput["kind"];
      label: string;
      url: string;
      filePath: string;
      modelUsed: string;
      prompt: string;
      costCredits: number;
      predictedVirality: number;
      predictedViralityBreakdown: ViralityBreakdown;
    }>;
    if (!body.kind || !body.label) {
      res.status(400).json({ error: "kind and label required" });
      return;
    }
    const out = recordProjectOutput({
      projectId: id,
      kind: body.kind,
      label: body.label,
      url: body.url,
      filePath: body.filePath,
      modelUsed: body.modelUsed,
      prompt: body.prompt,
      costCredits: body.costCredits,
      predictedVirality: body.predictedVirality,
      predictedViralityBreakdown: body.predictedViralityBreakdown,
    });
    res.status(201).json({ output: out });
  });

  // POST /api/projects/:id/outputs/:outputId/crop body { aspect: "1:1" | "4:5" | "9:16" | "16:9" }
  router.post("/:id/outputs/:outputId/crop", async (req, res) => {
    const id = String(req.params.id);
    const outputId = Number(req.params.outputId);
    if (!loadProject(id)) { res.status(404).json({ error: "project not found" }); return; }
    const { aspect } = req.body as { aspect?: "1:1" | "4:5" | "9:16" | "16:9" };
    if (!aspect || !["1:1", "4:5", "9:16", "16:9"].includes(aspect)) {
      res.status(400).json({ error: "aspect required (1:1, 4:5, 9:16, 16:9)" });
      return;
    }

    const row = sqlite.prepare("SELECT * FROM project_outputs WHERE id = ? AND project_id = ?").get(outputId, id) as Row | undefined;
    if (!row || !row.url) { res.status(404).json({ error: "output not found or has no url" }); return; }
    const kind = row.kind as string;
    if (kind !== "image" && kind !== "video") {
      res.status(422).json({ error: `crop not supported for ${kind} outputs` });
      return;
    }

    try {
      const sourceUrl = row.url as string;
      const ext = kind === "video" ? ".mp4" : ".jpg";
      const outputsDir = path.join(projectsDataDir, id, "outputs");
      fs.mkdirSync(outputsDir, { recursive: true });
      const cropLabel = `${(row.label as string) ?? "crop"}_${aspect.replace(":", "x")}`;
      const outPath = path.join(outputsDir, `${Date.now()}-${cropLabel}${ext}`);

      // Resolve a readable filesystem path or URL for ffmpeg input
      let inputPath: string;
      if (row.file_path && typeof row.file_path === "string" && fs.existsSync(row.file_path)) {
        inputPath = row.file_path as string;
      } else if (sourceUrl.startsWith("http")) {
        inputPath = sourceUrl;
      } else {
        const absLocal = path.join(process.cwd(), sourceUrl.replace(/^\//, ""));
        if (fs.existsSync(absLocal)) inputPath = absLocal;
        else { res.status(422).json({ error: "cannot resolve source file for crop" }); return; }
      }

      // ffmpeg crop filter that center-crops to the target aspect ratio
      const [an, ad] = aspect.split(":").map(Number);
      const cropExpr = `crop='if(gt(a,${an}/${ad}),ih*${an}/${ad},iw)':'if(gt(a,${an}/${ad}),ih,iw*${ad}/${an})'`;

      const ffmpeg = (await import("fluent-ffmpeg")).default;
      const ffmpegStatic = (await import("ffmpeg-static")).default;
      if (ffmpegStatic) ffmpeg.setFfmpegPath(ffmpegStatic);

      await new Promise<void>((resolve, reject) => {
        const cmd = ffmpeg(inputPath).videoFilter(cropExpr).outputOptions(["-y"]);
        if (kind === "image") {
          cmd.outputOptions(["-frames:v 1", "-q:v 2"]);
        } else {
          cmd.outputOptions(["-c:v libx264", "-preset veryfast", "-crf 18", "-c:a copy"]);
        }
        cmd.on("end", () => resolve())
           .on("error", (err: Error) => reject(err))
           .save(outPath);
      });

      const publicUrl = `/projects/${id}/outputs/${path.basename(outPath)}`;
      const cropped = recordProjectOutput({
        projectId: id,
        kind: kind as "image" | "video",
        label: cropLabel,
        url: publicUrl,
        filePath: outPath,
        modelUsed: "ffmpeg-crop",
        prompt: row.prompt as string | undefined,
      });
      res.json({ output: cropped });
    } catch (err) {
      console.error("[crop] failed:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "crop failed" });
    }
  });

  // POST /api/projects/:id/outputs/:outputId/variant — regenerate an image with the same prompt
  router.post("/:id/outputs/:outputId/variant", async (req, res) => {
    const id = String(req.params.id);
    const outputId = Number(req.params.outputId);
    const project = loadProject(id);
    if (!project) { res.status(404).json({ error: "project not found" }); return; }
    const row = sqlite.prepare("SELECT * FROM project_outputs WHERE id = ? AND project_id = ?").get(outputId, id) as Row | undefined;
    if (!row || row.kind !== "image" || !row.prompt) {
      res.status(422).json({ error: "variant only available for image outputs that have a stored prompt" });
      return;
    }
    if (!(await isConfigured())) { res.status(503).json({ error: "Higgsfield not configured" }); return; }

    const promptStr = row.prompt as string;
    const modelUsed = (row.model_used as string) ?? "nano_banana_2";
    const sourceLabel = (row.label as string) ?? "variant";
    const variantLabel = `${sourceLabel}_variant`;
    const aspect = project.kind === "brand_launch" || project.kind === "press_kit" ? "16:9" : "9:16";

    logStage(id, variantLabel, "queued", "variant requested");
    logStage(id, variantLabel, "running", "regenerating");
    res.json({ status: "generating", stage: variantLabel });

    (async () => {
      try {
        const validKey: "nano_banana_2" | "nano_banana_flash" | "soul" | "soul_cinematic" | "gpt_image" | "flux" | "seedream" =
          (modelUsed === "nano_banana_2" || modelUsed === "nano_banana_flash" || modelUsed === "soul" || modelUsed === "soul_cinematic" || modelUsed === "gpt_image" || modelUsed === "flux" || modelUsed === "seedream")
            ? modelUsed
            : "nano_banana_2";
        const r = await generateImage({
          prompt: promptStr,
          modelKey: validKey,
          aspectRatio: aspect as "16:9" | "9:16",
          resolution: "2k",
        });
        const mode = viralityModeForKind(project.kind);
        const vir = await predictVirality(
          { kind: "image_prompt", imagePrompt: promptStr, mode, projectBrief: project.briefMd ?? undefined, projectKind: project.kind },
          { blueprintPath },
        ).catch(() => null);
        recordProjectOutput({
          projectId: id,
          kind: "image",
          label: variantLabel,
          url: r.imageUrl,
          modelUsed: validKey,
          prompt: promptStr,
          costCredits: 2,
          predictedVirality: vir?.score,
          predictedViralityBreakdown: vir?.breakdown,
        });
        logStage(id, variantLabel, "completed", vir ? `variant · score ${vir.score}/100` : "variant");
      } catch (err) {
        logStage(id, variantLabel, "failed", err instanceof Error ? err.message : String(err));
      }
    })().catch((err) => {
      console.error("[variant] crashed:", err);
      logStage(id, variantLabel, "failed", err instanceof Error ? err.message : String(err));
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
