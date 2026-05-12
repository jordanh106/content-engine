/**
 * Higgsfield Audio Client — voiceover, music, SFX, voice cloning.
 *
 * Higgsfield CLI v0.1.36 does not expose standalone TTS, music, or SFX models — audio is
 * bundled into video generation (Kling `sound: on/off`, Veo 3.1 native audio, Marketing
 * Studio Video `generate_audio`). For continuous narration we need an external TTS, so
 * v1 routes voiceover + cloning through ElevenLabs.
 *
 * SWAP POINT: when Higgsfield ships a Speak CLI subcommand, branch on provider in
 * generateVoiceover() — the route surface stays identical.
 *
 * Music + SFX are deferred to v2; helpers return null so callers can no-op cleanly.
 *
 * See industries/_shared/higgsfield-audio-catalog.json for the full capability map.
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_MODEL = "eleven_turbo_v2_5";

export type VoiceoverProvider = "elevenlabs" | "higgsfield";

export type GenerateVoiceoverParams = {
  text: string;
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  outDir: string;
};

export type GenerateVoiceoverResult = {
  mp3Path: string;
  publicUrl: string;
  durationSec: number;
  provider: VoiceoverProvider;
  voiceId: string;
  characterCount: number;
};

export type ClonedVoice = {
  voiceId: string;
  name: string;
  description?: string;
  category: "cloned" | "premade" | "generated";
};

export function isVoiceProviderConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function activeVoiceProvider(): VoiceoverProvider {
  return "elevenlabs";
}

/**
 * Generate a single-take voiceover for the full narrative.
 *
 * For long scripts we use one continuous synthesis call so pacing/inflection stays consistent;
 * we then split timing across shots proportionally (or via word-timing if a future ElevenLabs
 * SDK call returns word boundaries — currently the basic /text-to-speech endpoint does not).
 */
export async function generateVoiceover(params: GenerateVoiceoverParams): Promise<GenerateVoiceoverResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set. Add it to packages/dashboard/.env and restart the server. " +
      "Sign up free at https://elevenlabs.io (10k chars/mo free tier).",
    );
  }
  if (!params.text.trim()) throw new Error("voiceover text is empty");
  if (!params.voiceId) throw new Error("voiceId is required");

  fs.mkdirSync(params.outDir, { recursive: true });
  const id = crypto.randomUUID();
  const mp3Path = path.join(params.outDir, `${id}.mp3`);

  const url = `${ELEVENLABS_BASE}/text-to-speech/${encodeURIComponent(params.voiceId)}?output_format=mp3_44100_128`;
  const body = {
    text: params.text,
    model_id: DEFAULT_MODEL,
    voice_settings: {
      stability: params.stability ?? 0.5,
      similarity_boost: params.similarityBoost ?? 0.75,
      style: params.style ?? 0.4,
      use_speaker_boost: true,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "<no body>");
    throw new Error(`ElevenLabs TTS failed ${response.status}: ${errText.slice(0, 400)}`);
  }

  const arrayBuf = await response.arrayBuffer();
  fs.writeFileSync(mp3Path, Buffer.from(arrayBuf));

  // We don't get duration from ElevenLabs directly; estimate from chars at ~16 chars/sec at 0.95x pace.
  const charsPerSec = 16;
  const estimatedDuration = Math.max(2, params.text.replace(/\s+/g, " ").trim().length / charsPerSec);

  return {
    mp3Path,
    publicUrl: `/voiceovers/${path.basename(mp3Path)}`,
    durationSec: estimatedDuration,
    provider: "elevenlabs",
    voiceId: params.voiceId,
    characterCount: params.text.length,
  };
}

/**
 * List available voices: premade ElevenLabs voices + any voices Jordan has cloned.
 * The free tier ships with ~10 high-quality premade voices.
 */
export async function listVoices(): Promise<ClonedVoice[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return [];

  try {
    const response = await fetch(`${ELEVENLABS_BASE}/voices`, {
      method: "GET",
      headers: { "xi-api-key": apiKey, Accept: "application/json" },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { voices: Array<{ voice_id: string; name: string; description?: string; category?: string }> };
    return data.voices.map((v) => ({
      voiceId: v.voice_id,
      name: v.name,
      description: v.description,
      category: (v.category === "cloned" || v.category === "generated" ? v.category : "premade") as ClonedVoice["category"],
    }));
  } catch (err) {
    console.error("[voice] listVoices error", err);
    return [];
  }
}

/**
 * Clone a voice from a single audio sample. ElevenLabs instant voice cloning.
 * Requires Creator plan ($22/mo) for unlimited cloning, or free tier allows limited cloning.
 */
export async function cloneVoice(params: { audioPath: string; name: string; description?: string }): Promise<ClonedVoice> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set");
  if (!fs.existsSync(params.audioPath)) throw new Error(`audio file not found: ${params.audioPath}`);

  const form = new FormData();
  form.append("name", params.name);
  if (params.description) form.append("description", params.description);
  const fileBuf = fs.readFileSync(params.audioPath);
  const blob = new Blob([fileBuf], { type: "audio/mpeg" });
  form.append("files", blob, path.basename(params.audioPath));

  const response = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "<no body>");
    throw new Error(`ElevenLabs clone failed ${response.status}: ${errText.slice(0, 400)}`);
  }
  const data = (await response.json()) as { voice_id: string };
  return {
    voiceId: data.voice_id,
    name: params.name,
    description: params.description,
    category: "cloned",
  };
}

/**
 * Music generation — deferred to v2. Higgsfield CLI exposes no music model.
 * Returns null so callers can no-op. Hero reels fall back to Kling's bundled ambient audio
 * (or the user supplies a music file separately).
 */
export async function generateMusic(_params: { brief: string; durationSec: number; outDir: string }): Promise<{ mp3Path: string; publicUrl: string; durationSec: number } | null> {
  return null;
}

/**
 * SFX generation — deferred to v2. Same as music: Higgsfield CLI has no SFX model.
 * Kling `sound: on` provides ambient SFX per clip.
 */
export async function generateSFX(_params: { description: string; durationSec: number; outDir: string }): Promise<{ mp3Path: string; publicUrl: string; durationSec: number } | null> {
  return null;
}

/**
 * Get the audio catalog (what Higgsfield exposes, what we route through which provider).
 * Reads industries/_shared/higgsfield-audio-catalog.json.
 */
export function readAudioCatalog(repoRoot: string): Record<string, unknown> {
  const catalogPath = path.join(repoRoot, "industries", "_shared", "higgsfield-audio-catalog.json");
  if (!fs.existsSync(catalogPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  } catch {
    return {};
  }
}
