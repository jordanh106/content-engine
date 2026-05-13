import fs from "fs";
import path from "path";
import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { parseMasterBlueprint } from "../parsers/master-blueprint.js";
import { parseStorytellingStyles } from "../parsers/storytelling-styles.js";
import { sqlite } from "../db.js";
import { getCurrentBrandVoice, formatBrandVoiceForPrompt } from "../lib/brand-voice.js";

type ConvertOutputFormat = "reel" | "tiktok" | "short" | "carousel" | "long" | "storytelling_reel";

const FORMAT_SPECS: Record<ConvertOutputFormat, { label: string; duration: string; spec: string }> = {
  reel: {
    label: "Instagram Reel",
    duration: "30-45s",
    spec: "9:16 vertical, hook in first 1-2s, slower cuts. Optimize for SAVES. 4-5 per week cadence.",
  },
  tiktok: {
    label: "TikTok",
    duration: "6-15s",
    spec: "9:16 vertical, text-heavy overlays, trending sounds, rapid cuts. Optimize for shares + completion.",
  },
  short: {
    label: "YouTube Short",
    duration: "30-60s",
    spec: "9:16 vertical, slightly more educational, can be denser than TikTok. Optimize for watch time.",
  },
  carousel: {
    label: "Instagram Carousel",
    duration: "5-7 slides",
    spec: "1080x1350 portrait or 1080x1080 square. Cover slide must hook. Each slide one idea. Optimize for SAVES and shares.",
  },
  long: {
    label: "YouTube Long-form",
    duration: "3-10 min",
    spec: "16:9 horizontal. Pattern: you speaking (real) > Remotion graphic > B-roll > back to you. Optimize for retention curve.",
  },
  storytelling_reel: {
    label: "Storytelling Reel",
    duration: "15-60s",
    spec: "9:16 vertical narrative reel. Voiceover-driven. One sentence per shot. Style-defined visual + motion + audio. Returns 3 A/B hook variants and narrativeLines[].",
  },
};

type UrlFetchResult = {
  url: string;
  title: string;
  content: string;
  sourceType: "youtube" | "instagram" | "tiktok" | "web" | "unfetched";
  fetched: boolean;
  warning?: string;
};

function lookupCreatorVideoByUrl(url: string): { title: string | null; handle: string | null; views: number | null } | null {
  try {
    // creator_videos table stores videoUrl; match by normalized URL prefix to handle ?utm params
    const baseUrl = url.split("?")[0].replace(/\/$/, "");
    const row = sqlite
      .prepare(
        `SELECT video_title as title, creator_handle as handle, views FROM creator_videos
         WHERE video_url LIKE ? OR video_url = ?
         ORDER BY id DESC LIMIT 1`,
      )
      .get(`${baseUrl}%`, baseUrl) as { title: string | null; handle: string | null; views: number | null } | undefined;
    return row || null;
  } catch {
    return null;
  }
}

async function fetchUrlContent(url: string): Promise<UrlFetchResult> {
  const cleanUrl = url.trim();

  // YouTube
  const ytMatch = cleanUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) {
    try {
      const oembed = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(cleanUrl)}&format=json`, {
        signal: AbortSignal.timeout(8000),
      });
      if (oembed.ok) {
        const data = (await oembed.json()) as { title?: string; author_name?: string };
        return {
          url: cleanUrl,
          title: data.title || "YouTube Video",
          content: `YouTube video: "${data.title || "(no title)"}" by ${data.author_name || "Unknown"}.`,
          sourceType: "youtube",
          fetched: true,
        };
      }
    } catch { /* fall through */ }
    return { url: cleanUrl, title: "YouTube Video", content: `YouTube URL only (oEmbed unavailable): ${cleanUrl}`, sourceType: "youtube", fetched: false, warning: "Could not fetch video metadata" };
  }

  // Instagram (reel, post, or tv) — try local lookup first since IG blocks server fetches
  const igMatch = cleanUrl.match(/instagram\.com\/(?:reel|p|tv)\/([a-zA-Z0-9_-]+)/);
  if (igMatch) {
    const local = lookupCreatorVideoByUrl(cleanUrl);
    if (local && local.title) {
      return {
        url: cleanUrl,
        title: local.title.slice(0, 100),
        content: `Instagram post${local.handle ? ` by @${local.handle}` : ""}:\n"${local.title}"${local.views ? `\nViews: ${local.views}` : ""}`,
        sourceType: "instagram",
        fetched: true,
      };
    }
    // Try TikTok-style oEmbed for IG (deprecated but sometimes works)
    try {
      const oembed = await fetch(`https://api.instagram.com/oembed?url=${encodeURIComponent(cleanUrl)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (oembed.ok) {
        const data = (await oembed.json()) as { title?: string; author_name?: string };
        if (data.title) {
          return {
            url: cleanUrl,
            title: data.title.slice(0, 100),
            content: `Instagram post${data.author_name ? ` by @${data.author_name}` : ""}:\n"${data.title}"`,
            sourceType: "instagram",
            fetched: true,
          };
        }
      }
    } catch { /* fall through */ }
    return {
      url: cleanUrl,
      title: "Instagram Post (not fetched)",
      content: `Instagram URL: ${cleanUrl}\n\nNOTE: Instagram blocks direct fetching. To get the actual post caption and content, first add this URL via the Discover Feed (which uses Xpoz to import the caption). For now, treat the URL as a thematic anchor only — DO NOT invent specific content. Instead, ask the user for the actual caption or topic.`,
      sourceType: "instagram",
      fetched: false,
      warning: "Instagram content not fetched — add via Discover Feed first or paste the caption manually",
    };
  }

  // TikTok
  const tiktokMatch = cleanUrl.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (tiktokMatch) {
    try {
      const oembed = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`, {
        signal: AbortSignal.timeout(6000),
      });
      if (oembed.ok) {
        const data = (await oembed.json()) as { title?: string; author_name?: string };
        return {
          url: cleanUrl,
          title: (data.title || "TikTok Video").slice(0, 100),
          content: `TikTok${data.author_name ? ` by @${data.author_name}` : ""}:\n"${data.title || "(no caption)"}"`,
          sourceType: "tiktok",
          fetched: true,
        };
      }
    } catch { /* fall through */ }
    // Local lookup fallback
    const local = lookupCreatorVideoByUrl(cleanUrl);
    if (local && local.title) {
      return {
        url: cleanUrl,
        title: local.title.slice(0, 100),
        content: `TikTok${local.handle ? ` by @${local.handle}` : ""}:\n"${local.title}"`,
        sourceType: "tiktok",
        fetched: true,
      };
    }
    return { url: cleanUrl, title: "TikTok Video", content: `TikTok URL: ${cleanUrl}`, sourceType: "tiktok", fetched: false, warning: "Could not fetch TikTok metadata" };
  }

  // Generic web
  try {
    const res = await fetch(cleanUrl, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ContentEngine/1.0)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : cleanUrl;

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();

    return {
      url: cleanUrl,
      title,
      content: stripped.slice(0, 5000),
      sourceType: "web",
      fetched: true,
    };
  } catch (e) {
    return {
      url: cleanUrl,
      title: cleanUrl,
      content: `Web URL (fetch failed): ${cleanUrl}. Error: ${e instanceof Error ? e.message : String(e)}`,
      sourceType: "web",
      fetched: false,
      warning: "Web fetch failed",
    };
  }
}

function buildStorytellingPrompt(opts: {
  style: ReturnType<typeof parseStorytellingStyles>[number];
  totalDurationSec: number;
  topic: string;
  sourceTitle: string;
  sourceContent: string;
  sourceType: string;
  groundingNote: string;
}): string {
  const { style, totalDurationSec, sourceTitle, sourceContent, sourceType, groundingNote, topic } = opts;
  const expectedShots = (() => {
    if (totalDurationSec <= 15) return style.pacing.shotsFor15s;
    if (totalDurationSec <= 30) return style.pacing.shotsFor30s;
    if (totalDurationSec <= 45) return style.pacing.shotsFor45s;
    return style.pacing.shotsFor60s;
  })();
  const sfxList = style.audio_palette.sfx_beats.map((b) => `"${b}"`).join(", ");
  const negativePrompts = style.visual.negativePrompts.join("; ");

  return `You are the Storytelling Reel Engine. Convert the source material into a cinematic narrative reel script in the ${style.displayName} style. Output a JSON object — no markdown, no code fence, no preface.

${groundingNote}

STYLE PRESET: ${style.displayName}
Tagline: ${style.tagline}
Voice direction: ${style.voice.direction}
Visual aesthetic: ${style.visual.aesthetic}
Visual composition formula: ${style.visual.compositionFormula}
Avoid in images: ${negativePrompts}
Motion direction: ${style.motion.direction}
Music brief: ${style.audio_palette.music_brief}
SFX palette: [${sfxList}]
Hook archetypes for this style: ${style.hookArchetypes.join(", ")}

TARGET: A ${totalDurationSec}-second 9:16 narrative reel with ~${expectedShots} shots (one sentence per shot, average ${style.pacing.averageShotSec}s per shot). The reel follows a 4-act structure: HOOK (sentence 1 — must stop the scroll), SETUP (sentences 2-4, establish stakes), TWIST/RISING (sentences 4-N-1, building intrigue), PAYOFF (final sentence, satisfying or open-ended). NO chiropractic angle — this is pure narrative entertainment.

TOPIC (what the reel is about): ${topic || sourceTitle}

SOURCE MATERIAL (${sourceType}):
Title: ${sourceTitle}
Content:
${sourceContent.slice(0, 5000)}

RULES:
- One narrative line = one sentence = one image = one motion clip. Sentences must each stand alone visually.
- No emdashes. Use commas or periods.
- Each imagePrompt follows the composition formula above. Photo-real (or as specified in aesthetic). Stay 9:16 vertical.
- Each motionPrompt is a single short directive (3-8 words) like "slow dolly in", "drift-up reveal", "parallax push past instrument". Match the style's motion direction.
- imagePrompt must be self-contained (no references to "the previous shot"). Each image must work as a single still.
- HOOK VARIANTS: produce 3 distinct openings — one Stakes Setter (numerical/scale), one Open Loop (question/mystery), one Counter-Intuition (surprising claim). Each is a complete first shot (text + imagePrompt + motionPrompt).
- narrativeLines covers shots 2 through N (skipping the hook, which is selected from variants downstream). sentenceIndex starts at 1 for the post-hook line.
- captionsSrt is standard SRT with proportional timing: split the total duration by character count across all lines (hook variant 0 is assumed; downstream will adjust if a different variant is picked).
- musicBrief is a single paragraph describing the score the music model should generate.
- complianceNotes is an array of 3-5 short strings about how this hits the style brief (pacing, voice match, archetype use).

OUTPUT JSON SHAPE (exactly this):
{
  "title": "<reel title, under 80 chars>",
  "style": "${style.key}",
  "hookArchetype": "<one of: ${style.hookArchetypes.join(" | ")}>",
  "hookVariants": [
    { "text": "<sentence>", "imagePrompt": "<full prompt>", "motionPrompt": "<short directive>" },
    { "text": "<sentence>", "imagePrompt": "<full prompt>", "motionPrompt": "<short directive>" },
    { "text": "<sentence>", "imagePrompt": "<full prompt>", "motionPrompt": "<short directive>" }
  ],
  "narrativeLines": [
    {
      "sentenceIndex": 1,
      "text": "<one sentence>",
      "imagePrompt": "<full image prompt following composition formula>",
      "motionPrompt": "<3-8 word motion directive>",
      "sfxBeat": "<optional — one of the SFX palette items, or omit>",
      "durationSec": <number, target ${style.pacing.averageShotSec}>
    }
  ],
  "musicBrief": "<one paragraph describing the score>",
  "cta": { "text": "<one short line for the final beat>", "durationSec": 2 },
  "captionsSrt": "<full SRT with proportional timing>",
  "complianceNotes": ["<note>", "<note>"],
  "estimatedCostDraft": <number, default 12>,
  "estimatedCostHero": <number, default 55>
}`;
}

export function createIngestRouter(industryDir: string) {
  const router = Router();
  const blueprintPath = path.join(industryDir, "master-blueprint.md");
  const brandPath = path.join(industryDir, "brand.md");
  const stylesPath = path.resolve(industryDir, "..", "_shared", "storytelling-styles.md");

  // POST /api/ingest/convert
  // Body: { source: string (url or raw text), outputFormat: ConvertOutputFormat, audience?: string, pillar?: string,
  //         style?: string (storytelling_reel only), totalDurationSec?: number (storytelling_reel only) }
  // Returns: { title, hook, script, shotList, captions, complianceNotes, sourceTitle }  (legacy formats)
  //          { title, style, hookVariants, narrativeLines, musicBrief, cta, captionsSrt, complianceNotes, ... } (storytelling_reel)
  router.post("/convert", async (req, res) => {
    let client: Anthropic | null = null;
    try {
      client = new Anthropic();
    } catch {
      res.status(503).json({ error: "AI unavailable. Set ANTHROPIC_API_KEY." });
      return;
    }

    try {
      const { source, sourceUrls, outputFormat, audience, pillar, style: styleKey, totalDurationSec } = req.body as {
        source: string;
        sourceUrls?: string[];
        outputFormat: ConvertOutputFormat;
        audience?: string;
        pillar?: string;
        style?: string;
        totalDurationSec?: number;
      };

      if ((!source || source.trim().length < 5) && (!sourceUrls || sourceUrls.length === 0)) {
        res.status(400).json({ error: "source required (URL or text)" });
        return;
      }
      if (!FORMAT_SPECS[outputFormat]) {
        res.status(400).json({ error: `outputFormat must be one of: ${Object.keys(FORMAT_SPECS).join(", ")}` });
        return;
      }

      // Build the source content from explicit URLs + free text
      const allUrls: string[] = [];
      if (sourceUrls && sourceUrls.length > 0) allUrls.push(...sourceUrls);

      let sourceTitle = "Custom input";
      let sourceContent = "";
      let sourceType: string = "text";
      const fetchResults: UrlFetchResult[] = [];
      const warnings: string[] = [];

      // If `source` is itself a single URL, treat it as one
      const rawSource = (source || "").trim();
      if (rawSource && /^https?:\/\//i.test(rawSource) && !allUrls.includes(rawSource)) {
        allUrls.push(rawSource);
      } else if (rawSource && !rawSource.startsWith("http")) {
        sourceContent += rawSource + "\n\n";
      }

      // Fetch every URL
      for (const url of allUrls) {
        const result = await fetchUrlContent(url);
        fetchResults.push(result);
        sourceContent += `Source URL: ${result.url}\n${result.content}\n\n`;
        if (result.warning) warnings.push(`${result.url}: ${result.warning}`);
      }

      if (fetchResults.length === 1) {
        sourceTitle = fetchResults[0].title;
        sourceType = fetchResults[0].sourceType;
      } else if (fetchResults.length > 1) {
        sourceTitle = `${fetchResults.length} sources combined`;
        sourceType = "multi";
      }

      // If user provided BOTH text and URL(s), prefix text label
      if (rawSource && !rawSource.startsWith("http") && allUrls.length > 0) {
        sourceContent = `User context:\n${rawSource}\n\n${sourceContent}`;
      }

      // Refusal guard: if all URLs failed to fetch AND there's no text, refuse rather than hallucinate
      const noFetchedContent = fetchResults.length > 0 && fetchResults.every((r) => !r.fetched);
      const hasUserText = rawSource && !rawSource.startsWith("http") && rawSource.length >= 10;
      if (noFetchedContent && !hasUserText) {
        res.status(422).json({
          error: "Could not fetch any source content",
          warnings,
          unfetchedUrls: fetchResults.map((r) => r.url),
          hint: "Instagram URLs need to be added via Discover Feed first, or paste the post caption as text. Otherwise the AI would hallucinate content unrelated to the actual post.",
        });
        return;
      }

      // Load blueprint + Living Brand Voice (centralized)
      const blueprint = parseMasterBlueprint(blueprintPath);
      const brandVoice = formatBrandVoiceForPrompt(getCurrentBrandVoice(industryDir));

      const formatSpec = FORMAT_SPECS[outputFormat];

      // Build a strict grounding instruction based on what we actually have
      const groundingNote = (() => {
        if (allUrls.length === 0) {
          return "GROUNDING RULES:\n1. Use the user's text as the literal topic. Stay tight to what they wrote.\n2. Do not substitute a different topic just because it's more 'on-brand'.";
        }
        const fetchedCount = fetchResults.filter((r) => r.fetched).length;
        if (fetchedCount === 0) {
          return `GROUNDING RULES:\n1. ALL ${allUrls.length} source URL(s) could NOT be fetched.\n${hasUserText ? "2. Use the user's text as the only ground truth.\n3. DO NOT invent details about the linked posts." : "2. DO NOT invent details about the linked posts."}`;
        }
        return `GROUNDING RULES (CRITICAL):\n1. The source material below is the SUBJECT of the script. The script MUST be about the same topic as the source.\n2. Extract the actual topic from the source TITLE and CONTENT. Do NOT default to a generic back-pain or posture script just because this is a chiropractic practice.\n3. If the source is about exercise X, write a chiropractic angle on exercise X. If the source is about condition Y, write about condition Y. The chiropractic lens applies to the source's actual subject, not a replacement subject.\n4. If the fetched content is only a title (no body), use that title as the literal topic. Do NOT invent a different topic.\n5. ${fetchedCount < allUrls.length ? `Note: only ${fetchedCount} of ${allUrls.length} URLs fetched — refer to unfetched ones only generically.` : "All sources fetched successfully."}`;
      })();

      // Build the system/user prompt — storytelling_reel branches to a narrative prompt,
      // all other formats use the chiropractic-educational converter.
      let promptContent: string;
      let resolvedStyleKey: string | undefined;
      if (outputFormat === "storytelling_reel") {
        const styles = parseStorytellingStyles(stylesPath);
        const selectedStyle = styles.find((s) => s.key === (styleKey || "science_mystery")) || styles[0];
        if (!selectedStyle) {
          res.status(503).json({ error: `No storytelling styles found at ${stylesPath}` });
          return;
        }
        resolvedStyleKey = selectedStyle.key;
        promptContent = buildStorytellingPrompt({
          style: selectedStyle,
          totalDurationSec: totalDurationSec || 30,
          topic: rawSource && !rawSource.startsWith("http") ? rawSource : sourceTitle,
          sourceTitle,
          sourceContent,
          sourceType,
          groundingNote,
        });
      } else {
        promptContent = `You are the Content Conversion Engine. Take the source material below and convert it into a production-ready ${formatSpec.label} script that complies with the Master Blueprint and uses the practice's brand voice. The chiropractic perspective is a LENS applied to the source's actual topic — it does NOT replace the source topic.

${groundingNote}

MASTER BLUEPRINT (structural rules to follow):
${blueprint ? blueprint.raw.slice(0, 6000) : "No blueprint available."}

BRAND VOICE (tone to apply):
${brandVoice}

SOURCE MATERIAL (${sourceType}):
Title: ${sourceTitle}
Content:
${sourceContent.slice(0, 5000)}

OUTPUT FORMAT: ${formatSpec.label} (${formatSpec.duration})
Spec: ${formatSpec.spec}
Target audience: ${audience || "general adult patient population"}
Content pillar: ${pillar || "Educate"}

Generate a complete production-ready output as JSON. Return ONLY valid JSON, no markdown, no code fence. Shape:

{
  "title": "<concise video title under 80 chars>",
  "hookArchetype": "<one of: Pattern Interrupt, Statistic Stop, Question Curiosity, Demonstration Open, Contrarian Snapback, Identity Hook>",
  "hook": {
    "visual": "<what viewer SEES in seconds 0-3>",
    "text": "<bold on-screen text overlay, max 12 words>",
    "spoken": "<what creator SAYS, under 12 words, ends in tension>",
    "audio": "<trending sound, SFX, or silence cue>"
  },
  "script": "<full script with delivery cues in [brackets] - no emdashes. Structure: hook (0-3s), context (3-6s), conflict (6-12s), re-hook 1, context 2, conflict 2, optional re-hook 2, payoff + CTA. Match target duration.>",
  "shotList": [
    { "second": 0, "shot": "<camera angle + framing>", "action": "<what happens>", "textOverlay": "<on-screen text or null>" }
  ],
  "cta": {
    "type": "<save | share | comment | follow | dm>",
    "phrasing": "<exact CTA wording>",
    "timing": "<when in the video>"
  },
  "caption": "<social caption with line breaks, no emdashes, 1-3 emojis max, includes 5-8 hashtags at end>",
  "complianceNotes": "<one paragraph: which blueprint requirements this hits and any caveats>"
}`;
      }

      const response = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: outputFormat === "storytelling_reel" ? 4000 : 2500,
        messages: [
          {
            role: "user",
            content: promptContent,
          },
        ],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No AI response" });
        return;
      }

      const raw = textBlock.text.trim();
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        res.status(500).json({ error: "AI returned non-JSON", raw });
        return;
      }

      const parsed = JSON.parse(jsonMatch[0]);
      res.json({
        ...parsed,
        sourceTitle,
        sourceType,
        outputFormat,
        outputLabel: formatSpec.label,
        outputDuration: formatSpec.duration,
        ...(resolvedStyleKey ? { style: resolvedStyleKey } : {}),
        ...(totalDurationSec ? { totalDurationSec } : {}),
        sourceUrls: allUrls,
        fetchResults: fetchResults.map((r) => ({ url: r.url, fetched: r.fetched, sourceType: r.sourceType, title: r.title })),
        warnings,
      });
    } catch (error) {
      console.error("[ingest] POST /convert error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Helper: list available output formats
  router.get("/formats", (_req, res) => {
    res.json({ formats: Object.entries(FORMAT_SPECS).map(([key, val]) => ({ key, ...val })) });
  });

  return router;
}
