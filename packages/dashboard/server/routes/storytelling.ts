/**
 * Storytelling Reel Engine — orchestrator + per-shot reroll + assembly + bundle export.
 *
 * Pipeline: script (via /api/ingest/convert) → hook A/B picker → continuous voiceover →
 * parallel shot images (with Soul char auto-inject) → frame-pair Kling/Veo clips →
 * FFmpeg assembly (VO + ducked music + burnt captions).
 *
 * Quality tiers (Draft vs Hero) gate which Higgsfield models the orchestrator picks:
 *   - DRAFT: Soul V2 images (0.12cr) + Kling 3.0 single 5s preview clip (10cr). ~12cr total.
 *   - HERO:  Nano Banana Pro images (2cr) + Veo 3.1 4s pair clips. ~55cr per 30s reel.
 *
 * Per-shot reroll endpoints regenerate exactly one shot's image / motion / voiceover line
 * without rebuilding the whole reel.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { parseStorytellingStyles } from "../parsers/storytelling-styles.js";
import {
  isConfigured,
  generateImage,
  generateVideo,
  uploadMediaFromUrl,
  type HiggsfieldModelKey,
} from "../lib/higgsfield-client.js";
import {
  generateVoiceover,
  listVoices,
  cloneVoice,
  isVoiceProviderConfigured,
  activeVoiceProvider,
  readAudioCatalog,
} from "../lib/higgsfield-audio-client.js";
import { assembleReel, buildReelBundle } from "../lib/reel-assembly.js";
import { sqlite } from "../db.js";
import type {
  StorytellingHookVariant,
  StorytellingNarrativeLine,
  StorytellingReelManifest,
  StorytellingShotAsset,
  StorytellingTier,
} from "../../shared/types.js";

// ── Quality tiers ──────────────────────────────────────────────────────────

type TierConfig = {
  imageModel: HiggsfieldModelKey;
  imageCostCredits: number;
  motionModel: "seedance" | "kling" | "veo";
  motionCostCredits: number;
  motionDurationSec: number;
  /** Draft renders only one preview clip; Hero generates a clip per shot-pair. */
  singlePreviewClip: boolean;
  voicePace: number;
  useMusic: boolean;
};

const TIER_CONFIGS: Record<StorytellingTier, TierConfig> = {
  draft: {
    imageModel: "soul",
    imageCostCredits: 0.12,
    motionModel: "kling",
    motionCostCredits: 10,
    motionDurationSec: 5,
    singlePreviewClip: true,
    voicePace: 1.0,
    useMusic: false,
  },
  hero: {
    imageModel: "nano_banana_2",
    imageCostCredits: 2,
    motionModel: "veo",
    motionCostCredits: 11,
    motionDurationSec: 4,
    singlePreviewClip: false,
    voicePace: 0.95,
    useMusic: false, // music gen deferred to v2; Kling/Veo bundled audio carries the bed
  },
};

function getActiveSoulId(): { soulId: string; name: string } | null {
  try {
    const row = sqlite
      .prepare("SELECT soul_id, name FROM higgsfield_characters WHERE active = 1 LIMIT 1")
      .get() as { soul_id?: string; name?: string } | undefined;
    if (row?.soul_id) return { soulId: row.soul_id, name: row.name || "Active" };
    return null;
  } catch { return null; }
}

// ── DB helpers ─────────────────────────────────────────────────────────────

function loadReelManifest(reelId: string): StorytellingReelManifest | null {
  const row = sqlite.prepare(`
    SELECT * FROM storytelling_reels WHERE reel_id = ?
  `).get(reelId) as Record<string, unknown> | undefined;
  if (!row) return null;
  const shots = sqlite.prepare(`
    SELECT * FROM storytelling_shots WHERE reel_id = ? ORDER BY shot_index ASC
  `).all(reelId) as Array<Record<string, unknown>>;
  return {
    reelId,
    topic: row.topic as string,
    title: (row.title as string) || "",
    style: row.style as string,
    tier: row.tier as StorytellingTier,
    status: row.status as StorytellingReelManifest["status"],
    voiceover: row.voiceover_url ? {
      url: row.voiceover_url as string,
      durationSec: (row.voiceover_duration_sec as number) || 0,
      provider: (row.voiceover_provider as string) || "elevenlabs",
    } : null,
    music: row.music_url ? {
      url: row.music_url as string,
      durationSec: (row.music_duration_sec as number) || 0,
    } : null,
    shots: shots.map((s) => ({
      index: s.shot_index as number,
      text: s.text as string,
      imageUrl: (s.image_url as string) || null,
      imagePrompt: s.image_prompt as string,
      motionPrompt: s.motion_prompt as string,
      videoUrl: (s.video_url as string) || null,
      startSec: (s.start_sec as number) || 0,
      endSec: (s.end_sec as number) || 0,
      sfxBeat: (s.sfx_beat as string) || undefined,
    })),
    alternateHooks: row.alternate_hooks_json ? JSON.parse(row.alternate_hooks_json as string) : [],
    captionsSrt: (row.captions_srt as string) || "",
    finalMp4Url: (row.final_mp4_url as string) || null,
    cost: {
      actualCredits: (row.cost_credits as number) || 0,
      breakdown: row.cost_breakdown_json ? JSON.parse(row.cost_breakdown_json as string) : {},
    },
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    soulCharacterId: (row.soul_character_id as string) || null,
    voiceId: (row.voice_id as string) || null,
  };
}

function upsertReelRow(m: Partial<StorytellingReelManifest> & { reelId: string }) {
  const existing = sqlite.prepare("SELECT reel_id FROM storytelling_reels WHERE reel_id = ?").get(m.reelId);
  const params = {
    reel_id: m.reelId,
    topic: m.topic || "",
    title: m.title,
    style: m.style,
    tier: m.tier,
    status: m.status,
    total_duration_sec: 0, // updated on hook pick
    soul_character_id: m.soulCharacterId,
    voice_id: m.voiceId,
    voiceover_url: m.voiceover?.url,
    voiceover_duration_sec: m.voiceover?.durationSec,
    voiceover_provider: m.voiceover?.provider,
    music_url: m.music?.url,
    music_duration_sec: m.music?.durationSec,
    captions_srt: m.captionsSrt,
    final_mp4_url: m.finalMp4Url,
    alternate_hooks_json: m.alternateHooks ? JSON.stringify(m.alternateHooks) : null,
    cost_credits: m.cost?.actualCredits,
    cost_breakdown_json: m.cost?.breakdown ? JSON.stringify(m.cost.breakdown) : null,
  };
  if (existing) {
    sqlite.prepare(`UPDATE storytelling_reels SET
      topic = COALESCE(@topic, topic),
      title = COALESCE(@title, title),
      style = COALESCE(@style, style),
      tier = COALESCE(@tier, tier),
      status = COALESCE(@status, status),
      soul_character_id = COALESCE(@soul_character_id, soul_character_id),
      voice_id = COALESCE(@voice_id, voice_id),
      voiceover_url = COALESCE(@voiceover_url, voiceover_url),
      voiceover_duration_sec = COALESCE(@voiceover_duration_sec, voiceover_duration_sec),
      voiceover_provider = COALESCE(@voiceover_provider, voiceover_provider),
      music_url = COALESCE(@music_url, music_url),
      music_duration_sec = COALESCE(@music_duration_sec, music_duration_sec),
      captions_srt = COALESCE(@captions_srt, captions_srt),
      final_mp4_url = COALESCE(@final_mp4_url, final_mp4_url),
      alternate_hooks_json = COALESCE(@alternate_hooks_json, alternate_hooks_json),
      cost_credits = COALESCE(@cost_credits, cost_credits),
      cost_breakdown_json = COALESCE(@cost_breakdown_json, cost_breakdown_json),
      updated_at = datetime('now')
    WHERE reel_id = @reel_id`).run(params);
  } else {
    sqlite.prepare(`INSERT INTO storytelling_reels (
      reel_id, topic, title, style, tier, status, total_duration_sec, soul_character_id, voice_id,
      voiceover_url, voiceover_duration_sec, voiceover_provider,
      music_url, music_duration_sec, captions_srt, final_mp4_url,
      alternate_hooks_json, cost_credits, cost_breakdown_json
    ) VALUES (
      @reel_id, @topic, @title, @style, @tier, @status, @total_duration_sec, @soul_character_id, @voice_id,
      @voiceover_url, @voiceover_duration_sec, @voiceover_provider,
      @music_url, @music_duration_sec, @captions_srt, @final_mp4_url,
      @alternate_hooks_json, @cost_credits, @cost_breakdown_json
    )`).run(params);
  }
}

function upsertShot(reelId: string, shot: StorytellingShotAsset) {
  sqlite.prepare(`INSERT INTO storytelling_shots
    (reel_id, shot_index, text, image_prompt, motion_prompt, image_url, video_url, start_sec, end_sec, sfx_beat)
    VALUES (@reel_id, @shot_index, @text, @image_prompt, @motion_prompt, @image_url, @video_url, @start_sec, @end_sec, @sfx_beat)
    ON CONFLICT(reel_id, shot_index) DO UPDATE SET
      text = excluded.text,
      image_prompt = excluded.image_prompt,
      motion_prompt = excluded.motion_prompt,
      image_url = excluded.image_url,
      video_url = excluded.video_url,
      start_sec = excluded.start_sec,
      end_sec = excluded.end_sec,
      sfx_beat = excluded.sfx_beat
  `).run({
    reel_id: reelId,
    shot_index: shot.index,
    text: shot.text,
    image_prompt: shot.imagePrompt,
    motion_prompt: shot.motionPrompt,
    image_url: shot.imageUrl,
    video_url: shot.videoUrl,
    start_sec: shot.startSec,
    end_sec: shot.endSec,
    sfx_beat: shot.sfxBeat || null,
  });
}

function logReroll(reelId: string, shotIndex: number, type: string, previous: string, next: string, credits: number) {
  sqlite.prepare(`INSERT INTO storytelling_rerolls (reel_id, shot_index, reroll_type, previous_value, new_value, credits_spent) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(reelId, shotIndex, type, previous, next, credits);
}

// ── Script generation (calls /api/ingest/convert internally) ──────────────

type ConvertResponse = {
  title?: string;
  style?: string;
  hookArchetype?: string;
  hookVariants?: StorytellingHookVariant[];
  narrativeLines?: StorytellingNarrativeLine[];
  musicBrief?: string;
  cta?: { text: string; durationSec: number };
  captionsSrt?: string;
  complianceNotes?: string[];
  estimatedCostDraft?: number;
  estimatedCostHero?: number;
};

async function callIngestConvert(opts: { source: string; style: string; totalDurationSec: number; port: number }): Promise<ConvertResponse> {
  const url = `http://127.0.0.1:${opts.port}/api/ingest/convert`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: opts.source,
      outputFormat: "storytelling_reel",
      style: opts.style,
      totalDurationSec: opts.totalDurationSec,
    }),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`script gen failed ${response.status}: ${errText.slice(0, 400)}`);
  }
  return response.json() as Promise<ConvertResponse>;
}

// ── Image + video generation for one shot ─────────────────────────────────

async function generateShotImage(args: {
  prompt: string;
  styleResolution: string;
  tier: StorytellingTier;
  soulCharacterId?: string | null;
}): Promise<string> {
  const cfg = TIER_CONFIGS[args.tier];
  const isDraft = args.tier === "draft";
  const result = await generateImage({
    prompt: args.prompt,
    modelKey: cfg.imageModel,
    aspectRatio: "9:16",
    resolution: isDraft ? undefined : (args.styleResolution === "2k" ? "2k" : "1k"),
    quality: isDraft ? "2k" : undefined,
    customReferenceId: args.soulCharacterId || undefined,
  });
  return result.imageUrl;
}

async function generateShotClip(args: {
  motionPrompt: string;
  tier: StorytellingTier;
  startImageUrl: string;
  endImageUrl?: string;
  durationSec: number;
}): Promise<string> {
  const cfg = TIER_CONFIGS[args.tier];
  const startUploadId = await uploadMediaFromUrl(args.startImageUrl);
  const endUploadId = args.endImageUrl ? await uploadMediaFromUrl(args.endImageUrl) : undefined;
  const { videoUrl } = await generateVideo({
    prompt: args.motionPrompt,
    modelKey: cfg.motionModel,
    imageUploadIds: [startUploadId],
    endImageUploadId: endUploadId,
    duration: Math.min(args.durationSec, cfg.motionDurationSec),
    aspectRatio: "9:16",
    sound: cfg.motionModel === "kling" ? "on" : undefined,
  });
  return videoUrl;
}

// ── Captions: rebuild SRT from current shot timings ────────────────────────

function buildSrt(shots: StorytellingShotAsset[]): string {
  let out = "";
  shots.forEach((shot, i) => {
    const start = formatSrtTime(shot.startSec);
    const end = formatSrtTime(shot.endSec);
    out += `${i + 1}\n${start} --> ${end}\n${shot.text}\n\n`;
  });
  return out;
}

function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec - Math.floor(sec)) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

// ── Cost retiming after VO is known ────────────────────────────────────────

function distributeShotTimings(
  shots: Array<{ text: string; durationSec: number }>,
  totalDurationSec: number,
): Array<{ startSec: number; endSec: number }> {
  const charCounts = shots.map((s) => s.text.replace(/\s+/g, " ").trim().length || 1);
  const totalChars = charCounts.reduce((a, b) => a + b, 0);
  const result: Array<{ startSec: number; endSec: number }> = [];
  let cursor = 0;
  for (let i = 0; i < shots.length; i++) {
    const fraction = charCounts[i] / totalChars;
    const dur = Math.max(1.5, totalDurationSec * fraction);
    const start = cursor;
    const end = i === shots.length - 1 ? totalDurationSec : cursor + dur;
    result.push({ startSec: start, endSec: end });
    cursor = end;
  }
  return result;
}

// ── Router ─────────────────────────────────────────────────────────────────

export function createStorytellingRouter(stylesPath: string, reelsDataDir: string, voiceoversDataDir: string, port: number) {
  const router = Router();

  router.get("/styles", (_req, res) => {
    const styles = parseStorytellingStyles(stylesPath);
    res.json({ styles });
  });

  router.get("/audio/catalog", (_req, res) => {
    const repoRoot = path.resolve(reelsDataDir, "..", "..", "..", "..");
    res.json(readAudioCatalog(repoRoot));
  });

  router.get("/audio/voice-status", (_req, res) => {
    res.json({
      provider: activeVoiceProvider(),
      configured: isVoiceProviderConfigured(),
      hint: isVoiceProviderConfigured()
        ? null
        : "Set ELEVENLABS_API_KEY in packages/dashboard/.env. Free tier (10k chars/mo) is enough to start.",
    });
  });

  router.get("/audio/voices", async (_req, res) => {
    if (!isVoiceProviderConfigured()) {
      res.json({ voices: [], configured: false });
      return;
    }
    try {
      const voices = await listVoices();
      res.json({ voices, configured: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/storytelling/audio/voiceover
  router.post("/audio/voiceover", async (req, res) => {
    try {
      const { text, voiceId, stability, similarityBoost, style } = req.body as {
        text: string; voiceId: string; stability?: number; similarityBoost?: number; style?: number;
      };
      if (!text || !voiceId) {
        res.status(400).json({ error: "text and voiceId required" });
        return;
      }
      fs.mkdirSync(voiceoversDataDir, { recursive: true });
      const result = await generateVoiceover({
        text,
        voiceId,
        stability,
        similarityBoost,
        style,
        outDir: voiceoversDataDir,
      });
      res.json({
        url: result.publicUrl,
        durationSec: result.durationSec,
        provider: result.provider,
        characterCount: result.characterCount,
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/storytelling/audio/clone  (multipart with `file` field)
  router.post("/audio/clone", async (req, res) => {
    // For simplicity we accept a JSON body referencing an existing voiceovers/* path or remote URL.
    // (A real multipart UI for cloning can be added later — Jordan can record samples and upload.)
    try {
      const { audioUrl, name, description } = req.body as { audioUrl: string; name: string; description?: string };
      if (!audioUrl || !name) {
        res.status(400).json({ error: "audioUrl and name required" });
        return;
      }
      // Download to a tmp file
      const tmpPath = path.join(voiceoversDataDir, `_clone-${crypto.randomUUID()}.mp3`);
      const remote = await fetch(audioUrl);
      if (!remote.ok) {
        res.status(400).json({ error: `audioUrl unreachable ${remote.status}` });
        return;
      }
      fs.writeFileSync(tmpPath, Buffer.from(await remote.arrayBuffer()));
      const cloned = await cloneVoice({ audioPath: tmpPath, name, description });
      fs.unlinkSync(tmpPath);
      res.json(cloned);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // POST /api/storytelling/generate-reel — the main orchestrator
  // Body: { topic, style, tier, totalDurationSec?, soulCharacterId?, voiceId?, hookChoice?, reelId? }
  router.post("/generate-reel", async (req, res) => {
    if (!(await isConfigured())) {
      res.status(503).json({ error: "Higgsfield CLI not installed or not signed in. Run: higgsfield auth login" });
      return;
    }
    try {
      const {
        topic,
        style: styleKey,
        tier,
        totalDurationSec,
        soulCharacterId,
        voiceId: providedVoiceId,
        hookChoice,
        reelId: existingReelId,
      } = req.body as {
        topic: string;
        style: string;
        tier: StorytellingTier;
        totalDurationSec?: number;
        soulCharacterId?: string;
        voiceId?: string;
        hookChoice?: 0 | 1 | 2;
        reelId?: string;
      };

      if (!topic && !existingReelId) {
        res.status(400).json({ error: "topic required (or reelId for hook-pick continuation)" });
        return;
      }
      const tierCfg = TIER_CONFIGS[tier];
      if (!tierCfg) {
        res.status(400).json({ error: `tier must be 'draft' or 'hero'` });
        return;
      }
      const styles = parseStorytellingStyles(stylesPath);
      const style = styles.find((s) => s.key === styleKey) || styles[0];
      if (!style) {
        res.status(503).json({ error: `style "${styleKey}" not found` });
        return;
      }

      const duration = totalDurationSec || 30;
      const activeSoul = soulCharacterId || getActiveSoulId()?.soulId || null;
      const voiceId = providedVoiceId || style.voice.elevenlabs_voice_id;
      if (!voiceId) {
        res.status(400).json({ error: "voiceId required (style has no default voice)" });
        return;
      }

      // PHASE A — Script (only if no existing reelId, or hook hasn't been chosen yet)
      let reelId = existingReelId || crypto.randomUUID();
      const reelDir = path.join(reelsDataDir, reelId);
      fs.mkdirSync(reelDir, { recursive: true });

      let manifest = existingReelId ? loadReelManifest(existingReelId) : null;
      let script: ConvertResponse | null = null;

      if (!manifest || manifest.status === "scripting") {
        script = await callIngestConvert({
          source: topic,
          style: style.key,
          totalDurationSec: duration,
          port,
        });

        // Persist initial reel row
        upsertReelRow({
          reelId,
          topic,
          title: script.title || topic,
          style: style.key,
          tier,
          status: "awaiting_hook_choice",
          captionsSrt: script.captionsSrt || "",
          alternateHooks: script.hookVariants || [],
          soulCharacterId: activeSoul,
          voiceId,
          cost: { actualCredits: 0, breakdown: {} },
        });
        sqlite.prepare("UPDATE storytelling_reels SET total_duration_sec = ?, manifest_json = ?, updated_at = datetime('now') WHERE reel_id = ?")
          .run(duration, JSON.stringify(script), reelId);

        // Pre-store the post-hook narrativeLines as shots starting at index 1
        if (script.narrativeLines) {
          const lines = script.narrativeLines;
          const timings = distributeShotTimings(
            lines.map((l) => ({ text: l.text, durationSec: l.durationSec })),
            // Hook will take ~15% of total; remaining shots split the rest
            duration * 0.85,
          );
          const hookOffset = duration * 0.15;
          for (let i = 0; i < lines.length; i++) {
            upsertShot(reelId, {
              index: i + 1, // hook is index 0
              text: lines[i].text,
              imagePrompt: lines[i].imagePrompt,
              motionPrompt: lines[i].motionPrompt,
              imageUrl: null,
              videoUrl: null,
              startSec: hookOffset + timings[i].startSec,
              endSec: hookOffset + timings[i].endSec,
              sfxBeat: lines[i].sfxBeat,
            });
          }
        }

        // If client didn't pre-pick a hook, return the script for the picker UI.
        if (hookChoice === undefined) {
          const updated = loadReelManifest(reelId)!;
          res.json({
            reelId,
            status: "awaiting_hook_choice",
            title: updated.title,
            style: updated.style,
            tier,
            hookVariants: updated.alternateHooks,
            narrativeLines: script.narrativeLines || [],
            musicBrief: script.musicBrief,
            captionsSrt: updated.captionsSrt,
            complianceNotes: script.complianceNotes,
            estimatedCostDraft: script.estimatedCostDraft,
            estimatedCostHero: script.estimatedCostHero,
            voiceId,
            soulCharacterId: activeSoul,
            durationSec: duration,
          });
          return;
        }
      }

      // PHASE B — Hook is chosen. Persist it as shot 0 and continue.
      manifest = loadReelManifest(reelId)!;
      const pickedHookIdx = hookChoice ?? 0;
      const hook = manifest.alternateHooks[pickedHookIdx] || manifest.alternateHooks[0];
      if (!hook) {
        res.status(400).json({ error: "no hook variants available — script may have failed" });
        return;
      }
      const hookDuration = duration * 0.15;
      upsertShot(reelId, {
        index: 0,
        text: hook.text,
        imagePrompt: hook.imagePrompt,
        motionPrompt: hook.motionPrompt,
        imageUrl: null,
        videoUrl: null,
        startSec: 0,
        endSec: hookDuration,
      });
      sqlite.prepare("UPDATE storytelling_reels SET status = 'generating', updated_at = datetime('now') WHERE reel_id = ?").run(reelId);

      // PHASE C — Voiceover (single continuous call across hook + all narrative lines)
      manifest = loadReelManifest(reelId)!;
      const fullScript = manifest.shots
        .sort((a, b) => a.index - b.index)
        .map((s) => s.text)
        .join(" ");
      let voResult;
      try {
        voResult = await generateVoiceover({
          text: fullScript,
          voiceId,
          stability: style.voice.stability,
          similarityBoost: style.voice.similarity_boost,
          style: style.voice.style,
          outDir: voiceoversDataDir,
        });
      } catch (voErr) {
        sqlite.prepare("UPDATE storytelling_reels SET status = 'failed' WHERE reel_id = ?").run(reelId);
        res.status(503).json({
          error: voErr instanceof Error ? voErr.message : String(voErr),
          hint: "Add ELEVENLABS_API_KEY to packages/dashboard/.env (free tier at https://elevenlabs.io)",
          reelId,
        });
        return;
      }

      // Re-distribute shot timings using actual VO duration
      const refreshed = loadReelManifest(reelId)!;
      const newTimings = distributeShotTimings(
        refreshed.shots.map((s) => ({ text: s.text, durationSec: s.endSec - s.startSec || 1 })),
        voResult.durationSec,
      );
      for (let i = 0; i < refreshed.shots.length; i++) {
        const shot = refreshed.shots[i];
        upsertShot(reelId, { ...shot, startSec: newTimings[i].startSec, endSec: newTimings[i].endSec });
      }

      upsertReelRow({
        reelId,
        voiceover: { url: voResult.publicUrl, durationSec: voResult.durationSec, provider: voResult.provider },
      });

      // PHASE D — Parallel image generation for every shot
      const allShots = loadReelManifest(reelId)!.shots;
      const imageResults = await Promise.allSettled(allShots.map((s) =>
        generateShotImage({
          prompt: `${s.imagePrompt}. ${style.visual.aesthetic}`,
          styleResolution: style.visual.resolution,
          tier,
          soulCharacterId: activeSoul,
        }),
      ));
      let costAccum = voResult.durationSec * 0; // VO cost is in characters; not credit-charged the same way
      const costBreakdown: Record<string, number> = { voiceover: 0 };
      for (let i = 0; i < allShots.length; i++) {
        const r = imageResults[i];
        if (r.status === "fulfilled") {
          upsertShot(reelId, { ...allShots[i], imageUrl: r.value });
          costAccum += tierCfg.imageCostCredits;
          costBreakdown[`image_${i}`] = tierCfg.imageCostCredits;
        } else {
          console.error(`[storytelling] image ${i} failed:`, r.reason);
        }
      }

      // PHASE E — Motion clips
      const withImages = loadReelManifest(reelId)!.shots.filter((s) => s.imageUrl);
      if (tierCfg.singlePreviewClip) {
        // Draft: one motion preview clip from shot 0 → shot 1
        if (withImages.length >= 2) {
          try {
            const videoUrl = await generateShotClip({
              motionPrompt: `${withImages[0].motionPrompt}, then transitions to: ${withImages[1].motionPrompt}`,
              tier,
              startImageUrl: withImages[0].imageUrl!,
              endImageUrl: withImages[1].imageUrl!,
              durationSec: tierCfg.motionDurationSec,
            });
            upsertShot(reelId, { ...withImages[0], videoUrl });
            costAccum += tierCfg.motionCostCredits;
            costBreakdown["motion_preview"] = tierCfg.motionCostCredits;
          } catch (err) {
            console.error("[storytelling] draft preview clip failed:", err);
          }
        }
      } else {
        // Hero: pair clip per consecutive shot
        for (let i = 0; i < withImages.length - 1; i++) {
          try {
            const videoUrl = await generateShotClip({
              motionPrompt: withImages[i].motionPrompt,
              tier,
              startImageUrl: withImages[i].imageUrl!,
              endImageUrl: withImages[i + 1].imageUrl!,
              durationSec: tierCfg.motionDurationSec,
            });
            upsertShot(reelId, { ...withImages[i], videoUrl });
            costAccum += tierCfg.motionCostCredits;
            costBreakdown[`motion_${i}`] = tierCfg.motionCostCredits;
          } catch (err) {
            console.error(`[storytelling] hero clip ${i} failed:`, err);
          }
        }
      }

      // Refresh captions SRT from final timings
      const finalManifest = loadReelManifest(reelId)!;
      const newSrt = buildSrt(finalManifest.shots);
      upsertReelRow({
        reelId,
        status: "ready_for_assembly",
        captionsSrt: newSrt,
        cost: { actualCredits: costAccum, breakdown: costBreakdown },
      });

      const out = loadReelManifest(reelId)!;
      res.json({ ...out, costSummary: { creditsSpent: costAccum, breakdown: costBreakdown } });
    } catch (err) {
      console.error("[storytelling] generate-reel error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/storytelling/reels/:reelId — manifest for polling / Canvas state
  router.get("/reels/:reelId", (req, res) => {
    const manifest = loadReelManifest(req.params.reelId);
    if (!manifest) {
      res.status(404).json({ error: "reel not found" });
      return;
    }
    res.json(manifest);
  });

  // POST /api/storytelling/reels/:reelId/assemble — FFmpeg stitch
  router.post("/reels/:reelId/assemble", async (req, res) => {
    try {
      const reelId = req.params.reelId;
      const manifest = loadReelManifest(reelId);
      if (!manifest) {
        res.status(404).json({ error: "reel not found" });
        return;
      }
      if (!manifest.voiceover) {
        res.status(400).json({ error: "voiceover missing — re-run generate-reel" });
        return;
      }
      const shots = manifest.shots.filter((s) => s.videoUrl);
      if (shots.length === 0) {
        res.status(400).json({ error: "no shot videos available — generate motion clips first" });
        return;
      }
      const reelDir = path.join(reelsDataDir, reelId);
      const voPath = path.join(voiceoversDataDir, path.basename(manifest.voiceover.url));
      const result = await assembleReel({
        reelId,
        reelDir,
        shots: shots.map((s) => ({
          index: s.index,
          videoUrl: s.videoUrl!,
          startSec: s.startSec,
          endSec: s.endSec,
        })),
        voiceoverPath: voPath,
        musicPath: null,
        captionsSrt: manifest.captionsSrt,
        durationSec: manifest.voiceover.durationSec,
      });
      upsertReelRow({
        reelId,
        status: "assembled",
        finalMp4Url: result.publicUrl,
      });
      res.json({
        finalMp4Url: result.publicUrl,
        outputPath: result.outputPath,
        durationSec: result.durationSec,
      });
    } catch (err) {
      console.error("[storytelling] assemble error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /api/storytelling/reels/:reelId/bundle.zip — editor handoff bundle
  router.get("/reels/:reelId/bundle.zip", async (req, res) => {
    try {
      const reelId = req.params.reelId;
      const manifest = loadReelManifest(reelId);
      if (!manifest) {
        res.status(404).json({ error: "reel not found" });
        return;
      }
      if (!manifest.voiceover) {
        res.status(400).json({ error: "voiceover missing" });
        return;
      }
      const reelDir = path.join(reelsDataDir, reelId);
      const voPath = path.join(voiceoversDataDir, path.basename(manifest.voiceover.url));
      const finalPath = manifest.finalMp4Url ? path.join(reelDir, "final.mp4") : null;
      const readme = `# Storytelling Reel: ${manifest.title}

Style: ${manifest.style}
Tier: ${manifest.tier}
Duration: ${manifest.voiceover.durationSec.toFixed(1)}s
Credits spent: ${manifest.cost.actualCredits}

## Files
- \`clips/\` — per-shot motion clips in order
- \`voiceover.mp3\` — single-take continuous narration
- \`captions.srt\` — proportional caption timings
- \`final.mp4\` — auto-stitched output (also present if you ran assemble)
- \`manifest.json\` — full structured metadata

## Editor handoff (CapCut)
1. Drop \`clips/\` into the timeline in order.
2. Mute clip audio. Drop \`voiceover.mp3\` on the audio track.
3. Add your music underneath at -18dB. Use ducking on the music track.
4. Import \`captions.srt\` to caption track.
5. Export 9:16 1080×1920 at 30fps.
`;
      const result = await buildReelBundle({
        reelId,
        reelDir,
        voiceoverPath: voPath,
        musicPath: null,
        finalMp4Path: finalPath,
        captionsSrt: manifest.captionsSrt,
        manifestJson: manifest,
        readmeMarkdown: readme,
      });
      res.download(result.zipPath, `${reelId}-bundle.zip`);
    } catch (err) {
      console.error("[storytelling] bundle error:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // ── Per-shot reroll ───────────────────────────────────────────────────────

  router.post("/reels/:reelId/shots/:shotIndex/reroll-image", async (req, res) => {
    try {
      const reelId = req.params.reelId;
      const shotIndex = parseInt(req.params.shotIndex, 10);
      const manifest = loadReelManifest(reelId);
      if (!manifest) { res.status(404).json({ error: "reel not found" }); return; }
      const shot = manifest.shots.find((s) => s.index === shotIndex);
      if (!shot) { res.status(404).json({ error: `shot ${shotIndex} not found` }); return; }
      const { promptOverride } = req.body as { promptOverride?: string };
      const newPrompt = promptOverride || shot.imagePrompt;

      const styles = parseStorytellingStyles(stylesPath);
      const style = styles.find((s) => s.key === manifest.style) || styles[0];

      const newImageUrl = await generateShotImage({
        prompt: `${newPrompt}. ${style?.visual.aesthetic || ""}`,
        styleResolution: style?.visual.resolution || "2k",
        tier: manifest.tier,
        soulCharacterId: manifest.soulCharacterId,
      });
      const previous = shot.imageUrl || "";
      upsertShot(reelId, { ...shot, imageUrl: newImageUrl, imagePrompt: newPrompt });
      logReroll(reelId, shotIndex, "image", previous, newImageUrl, TIER_CONFIGS[manifest.tier].imageCostCredits);
      res.json({ shotIndex, imageUrl: newImageUrl, previous, creditsSpent: TIER_CONFIGS[manifest.tier].imageCostCredits });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/reels/:reelId/shots/:shotIndex/reroll-motion", async (req, res) => {
    try {
      const reelId = req.params.reelId;
      const shotIndex = parseInt(req.params.shotIndex, 10);
      const manifest = loadReelManifest(reelId);
      if (!manifest) { res.status(404).json({ error: "reel not found" }); return; }
      const shot = manifest.shots.find((s) => s.index === shotIndex);
      if (!shot || !shot.imageUrl) {
        res.status(400).json({ error: "shot has no image yet — reroll-image first" });
        return;
      }
      const { motionPromptOverride } = req.body as { motionPromptOverride?: string };
      const newMotion = motionPromptOverride || shot.motionPrompt;
      const nextShot = manifest.shots.find((s) => s.index === shotIndex + 1);
      const endImage = nextShot?.imageUrl || undefined;

      const newVideoUrl = await generateShotClip({
        motionPrompt: newMotion,
        tier: manifest.tier,
        startImageUrl: shot.imageUrl!,
        endImageUrl: endImage,
        durationSec: TIER_CONFIGS[manifest.tier].motionDurationSec,
      });
      const previous = shot.videoUrl || "";
      upsertShot(reelId, { ...shot, videoUrl: newVideoUrl, motionPrompt: newMotion });
      logReroll(reelId, shotIndex, "motion", previous, newVideoUrl, TIER_CONFIGS[manifest.tier].motionCostCredits);
      res.json({ shotIndex, videoUrl: newVideoUrl, previous, creditsSpent: TIER_CONFIGS[manifest.tier].motionCostCredits });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/reels/:reelId/shots/:shotIndex/reroll-line", async (req, res) => {
    try {
      const reelId = req.params.reelId;
      const shotIndex = parseInt(req.params.shotIndex, 10);
      const manifest = loadReelManifest(reelId);
      if (!manifest) { res.status(404).json({ error: "reel not found" }); return; }
      const shot = manifest.shots.find((s) => s.index === shotIndex);
      if (!shot) { res.status(404).json({ error: `shot ${shotIndex} not found` }); return; }
      const { text } = req.body as { text: string };
      if (!text) { res.status(400).json({ error: "text required" }); return; }

      // Regenerate voiceover for just this line (replaces the segment in the full VO file)
      const styles = parseStorytellingStyles(stylesPath);
      const style = styles.find((s) => s.key === manifest.style) || styles[0];
      const voiceId = manifest.voiceId || style?.voice.elevenlabs_voice_id;
      if (!voiceId) { res.status(400).json({ error: "no voice configured" }); return; }

      const voSegment = await generateVoiceover({
        text,
        voiceId,
        stability: style?.voice.stability,
        similarityBoost: style?.voice.similarity_boost,
        style: style?.voice.style,
        outDir: voiceoversDataDir,
      });
      const previous = shot.text;
      upsertShot(reelId, { ...shot, text });
      logReroll(reelId, shotIndex, "line", previous, text, 0);
      res.json({
        shotIndex,
        text,
        previous,
        segmentVoiceoverUrl: voSegment.publicUrl,
        note: "Line text + segment VO updated. Run /assemble to re-stitch the full reel with the new line.",
      });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
