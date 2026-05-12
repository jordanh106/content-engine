import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Film, ChevronRight, Sparkles, AlertCircle, Check, Download, Play } from "lucide-react";
import type {
  StorytellingStyle,
  StorytellingHookVariant,
  StorytellingReelManifest,
  StorytellingTier,
  StorytellingNarrativeLine,
} from "../../shared/types.js";
import { Button } from "./Button.js";
import { Pill } from "./Pill.js";
import { ModalHeader } from "./ModalHeader.js";

type Step = "setup" | "hook" | "generating" | "ready";

type Props = {
  open: boolean;
  onClose: () => void;
};

type StylesResponse = { styles: StorytellingStyle[] };
type VoiceStatusResponse = { provider: string; configured: boolean; hint: string | null };
type Voice = { voiceId: string; name: string; description?: string; category: string };
type VoicesResponse = { voices: Voice[]; configured: boolean };

type GenerateReelPhaseAResponse = {
  reelId: string;
  status: string;
  title: string;
  style: string;
  tier: StorytellingTier;
  hookVariants: StorytellingHookVariant[];
  narrativeLines: StorytellingNarrativeLine[];
  voiceId: string;
  durationSec: number;
  estimatedCostDraft?: number;
  estimatedCostHero?: number;
};

const TIER_COSTS: Record<StorytellingTier, { credits: number; minutes: number; blurb: string }> = {
  draft: { credits: 12, minutes: 3, blurb: "Storyboard images + 1 preview clip. Soul V2 + Kling 5s. Best for script validation." },
  hero: { credits: 55, minutes: 10, blurb: "Per-shot pair clips with Veo 3.1 + Nano Banana Pro images. Final-quality output." },
};

const DURATION_OPTIONS = [15, 30, 45, 60] as const;

export const StorytellingReelStarter: React.FC<Props> = ({ open, onClose }) => {
  const [step, setStep] = useState<Step>("setup");
  const [topic, setTopic] = useState("");
  const [styles, setStyles] = useState<StorytellingStyle[]>([]);
  const [styleKey, setStyleKey] = useState<string>("science_mystery");
  const [tier, setTier] = useState<StorytellingTier>("draft");
  const [durationSec, setDurationSec] = useState<number>(30);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState<string>("");
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatusResponse | null>(null);

  const [reelId, setReelId] = useState<string | null>(null);
  const [phaseA, setPhaseA] = useState<GenerateReelPhaseAResponse | null>(null);
  const [pickedHook, setPickedHook] = useState<number | null>(null);
  const [manifest, setManifest] = useState<StorytellingReelManifest | null>(null);
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const activeStyle = useMemo(() => styles.find((s) => s.key === styleKey), [styles, styleKey]);

  // Load styles + voice status when opened
  useEffect(() => {
    if (!open) return;
    fetch("/api/storytelling/styles")
      .then((r) => r.json() as Promise<StylesResponse>)
      .then((d) => setStyles(d.styles))
      .catch((e) => setErrMsg(String(e)));
    fetch("/api/storytelling/audio/voice-status")
      .then((r) => r.json() as Promise<VoiceStatusResponse>)
      .then(setVoiceStatus);
    fetch("/api/storytelling/audio/voices")
      .then((r) => r.json() as Promise<VoicesResponse>)
      .then((d) => setVoices(d.voices));
  }, [open]);

  // Auto-pick the style's default voice when style changes
  useEffect(() => {
    if (activeStyle?.voice.elevenlabs_voice_id && !voiceId) {
      setVoiceId(activeStyle.voice.elevenlabs_voice_id);
    }
  }, [activeStyle, voiceId]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setStep("setup");
      setReelId(null);
      setPhaseA(null);
      setPickedHook(null);
      setManifest(null);
      setBusy(false);
      setErrMsg(null);
    }
  }, [open]);

  if (!open) return null;

  const estCost = TIER_COSTS[tier].credits;
  const estMinutes = TIER_COSTS[tier].minutes;

  const runPhaseA = async () => {
    if (!topic.trim() || topic.trim().length < 5) {
      setErrMsg("Enter a topic (at least 5 characters).");
      return;
    }
    setErrMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/storytelling/generate-reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          style: styleKey,
          tier,
          totalDurationSec: durationSec,
          voiceId: voiceId || undefined,
        }),
      });
      const data = (await res.json()) as GenerateReelPhaseAResponse & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `Status ${res.status}`);
      setReelId(data.reelId);
      setPhaseA(data);
      setPickedHook(0);
      setStep("hook");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const runPhaseB = async () => {
    if (!reelId || pickedHook === null) return;
    setErrMsg(null);
    setBusy(true);
    setStep("generating");
    try {
      const res = await fetch("/api/storytelling/generate-reel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          style: styleKey,
          tier,
          totalDurationSec: durationSec,
          voiceId: voiceId || undefined,
          hookChoice: pickedHook,
          reelId,
        }),
      });
      const data = (await res.json()) as StorytellingReelManifest & { error?: string; hint?: string };
      if (!res.ok || data.error) {
        throw new Error(`${data.error || `Status ${res.status}`}${data.hint ? `\n${data.hint}` : ""}`);
      }
      setManifest(data);
      setStep("ready");
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
      setStep("hook");
    } finally {
      setBusy(false);
    }
  };

  const assembleReel = async () => {
    if (!reelId) return;
    setBusy(true);
    setErrMsg(null);
    try {
      const res = await fetch(`/api/storytelling/reels/${reelId}/assemble`, { method: "POST" });
      const data = await res.json() as { finalMp4Url?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || "assemble failed");
      // Refresh manifest
      const fresh = await fetch(`/api/storytelling/reels/${reelId}`).then((r) => r.json());
      setManifest(fresh);
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        <ModalHeader
          eyebrow="Storytelling Reel Engine"
          title={stepTitle(step)}
          icon={<Film size={20} />}
          onClose={onClose}
        />

        {/* Error banner */}
        {errMsg && (
          <div className="px-6 py-3 bg-rose-50 border-b border-rose-200 text-[12px] text-rose-700 flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            <span className="whitespace-pre-line">{errMsg}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === "setup" && (
            <SetupStep
              topic={topic} setTopic={setTopic}
              styles={styles} styleKey={styleKey} setStyleKey={setStyleKey}
              tier={tier} setTier={setTier}
              durationSec={durationSec} setDurationSec={setDurationSec}
              voices={voices} voiceId={voiceId} setVoiceId={setVoiceId}
              voiceStatus={voiceStatus}
              activeStyle={activeStyle}
              estCost={estCost} estMinutes={estMinutes}
            />
          )}

          {step === "hook" && phaseA && (
            <HookPickerStep
              variants={phaseA.hookVariants}
              picked={pickedHook ?? 0}
              setPicked={setPickedHook}
              narrativeLines={phaseA.narrativeLines}
              styleName={activeStyle?.displayName || phaseA.style}
            />
          )}

          {step === "generating" && (
            <GeneratingStep tier={tier} estMinutes={estMinutes} />
          )}

          {step === "ready" && manifest && (
            <ReadyStep manifest={manifest} reelId={reelId!} onAssemble={assembleReel} busy={busy} />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {step === "setup" && (
              <span>~<strong className="text-slate-700">{estCost} credits</strong> · ~{estMinutes} min · {durationSec}s reel</span>
            )}
            {step === "hook" && <span>Pick a hook to lock in the script direction</span>}
            {step === "generating" && <span>Generating shots... this takes ~{estMinutes} minutes</span>}
            {step === "ready" && manifest && (
              <span>{manifest.shots.length} shots · {manifest.cost.actualCredits.toFixed(1)} credits spent</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "setup" && (
              <Button
                variant="primary"
                onClick={runPhaseA}
                disabled={busy || !topic.trim()}
                icon={busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              >
                Write Script
              </Button>
            )}
            {step === "hook" && (
              <Button
                variant="primary"
                onClick={runPhaseB}
                disabled={busy || pickedHook === null}
                icon={busy ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
              >
                Generate Reel
              </Button>
            )}
            {step === "ready" && manifest && !manifest.finalMp4Url && (
              <Button
                variant="primary"
                tone="amber"
                onClick={assembleReel}
                disabled={busy}
                icon={busy ? <Loader2 size={12} className="animate-spin" /> : <Film size={12} />}
              >
                Stitch Final MP4
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

function stepTitle(step: Step): string {
  switch (step) {
    case "setup": return "New Storytelling Reel";
    case "hook": return "Pick Your Hook";
    case "generating": return "Generating Reel";
    case "ready": return "Reel Ready";
  }
}

// ── Sub-steps ────────────────────────────────────────────────────────────

const SetupStep: React.FC<{
  topic: string; setTopic: (s: string) => void;
  styles: StorytellingStyle[]; styleKey: string; setStyleKey: (s: string) => void;
  tier: StorytellingTier; setTier: (t: StorytellingTier) => void;
  durationSec: number; setDurationSec: (n: number) => void;
  voices: Voice[]; voiceId: string; setVoiceId: (s: string) => void;
  voiceStatus: VoiceStatusResponse | null;
  activeStyle: StorytellingStyle | undefined;
  estCost: number; estMinutes: number;
}> = ({ topic, setTopic, styles, styleKey, setStyleKey, tier, setTier, durationSec, setDurationSec, voices, voiceId, setVoiceId, voiceStatus, activeStyle }) => {
  return (
    <div className="space-y-6">
      {/* Topic */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Topic</label>
        <textarea
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. The 1970 Apollo 13 oxygen tank explosion"
          rows={2}
          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-medium resize-none bg-white"
        />
        {activeStyle?.exampleReels && activeStyle.exampleReels.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {activeStyle.exampleReels.slice(0, 4).map((ex) => (
              <button
                key={ex}
                onClick={() => setTopic(ex)}
                className="px-2 py-1 rounded-full bg-slate-100 hover:bg-amber-100 text-[10px] text-slate-600 hover:text-amber-700 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Style picker */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Style</label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {styles.map((s) => {
            const isActive = s.key === styleKey;
            return (
              <button
                key={s.key}
                onClick={() => setStyleKey(s.key)}
                className={`text-left p-3 rounded-2xl border transition-all ${
                  isActive ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/20 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-bold text-slate-900 leading-tight">{s.displayName}</p>
                  {s.key === "science_mystery" && (
                    <Pill variant="warning" className="px-1.5 py-0.5 text-[8px] tracking-[0.18em]">Flagship</Pill>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1 leading-snug line-clamp-2">{s.tagline}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tier + duration */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Quality Tier</label>
          <div className="grid grid-cols-2 gap-2">
            {(["draft", "hero"] as StorytellingTier[]).map((t) => {
              const isActive = t === tier;
              return (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`text-left p-3 rounded-2xl border-2 transition-all ${
                    isActive ? "border-teal-500 bg-teal-50 shadow-md" : "border-slate-200 hover:border-slate-300 bg-white"
                  }`}
                >
                  <p className="text-[13px] font-bold text-slate-900 capitalize">{t}</p>
                  <p className="text-[10px] text-slate-500 mt-1 leading-snug">~{TIER_COSTS[t].credits}cr · ~{TIER_COSTS[t].minutes}min</p>
                  <p className="text-[9px] text-slate-400 mt-1 leading-snug line-clamp-2">{TIER_COSTS[t].blurb}</p>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Duration</label>
          <div className="grid grid-cols-4 gap-2">
            {DURATION_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => setDurationSec(d)}
                className={`p-3 rounded-2xl border transition-all ${
                  d === durationSec ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/20 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"
                }`}
              >
                <p className="text-[14px] font-bold text-slate-900">{d}s</p>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            ~{activeStyle ? (durationSec <= 15 ? activeStyle.pacing.shotsFor15s : durationSec <= 30 ? activeStyle.pacing.shotsFor30s : durationSec <= 45 ? activeStyle.pacing.shotsFor45s : activeStyle.pacing.shotsFor60s) : 6} shots
          </p>
        </div>
      </div>

      {/* Voice */}
      <div>
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 block">Narrator Voice</label>
        {!voiceStatus?.configured ? (
          <div className="px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span>{voiceStatus?.hint || "Voice provider not configured."}</span>
          </div>
        ) : (
          <select
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none text-sm font-medium bg-white"
          >
            <option value="">Use style default ({activeStyle?.voice.elevenlabs_voice_name})</option>
            {voices.map((v) => (
              <option key={v.voiceId} value={v.voiceId}>{v.name}{v.category === "cloned" ? " (cloned)" : ""}</option>
            ))}
          </select>
        )}
        {activeStyle && (
          <p className="text-[10px] text-slate-500 mt-1.5 italic">{activeStyle.voice.direction}</p>
        )}
      </div>
    </div>
  );
};

const HookPickerStep: React.FC<{
  variants: StorytellingHookVariant[];
  picked: number;
  setPicked: (n: number) => void;
  narrativeLines: StorytellingNarrativeLine[];
  styleName: string;
}> = ({ variants, picked, setPicked, narrativeLines, styleName }) => {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">3 hook openings · {styleName}</p>
        <p className="text-sm text-slate-600 mt-1">Each opens the reel with a different angle. Pick the one that best stops the scroll.</p>
      </div>
      <div className="space-y-3">
        {variants.map((v, i) => {
          const isActive = picked === i;
          return (
            <button
              key={i}
              onClick={() => setPicked(i)}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${
                isActive ? "border-teal-500 bg-teal-50 ring-2 ring-teal-500/20 shadow-sm" : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                  isActive ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500"
                }`}>{String.fromCharCode(65 + i)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium text-slate-900 leading-snug">{v.text}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100">Motion: {v.motionPrompt}</span>
                  </div>
                  <details className="mt-2 group">
                    <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600">image prompt</summary>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{v.imagePrompt}</p>
                  </details>
                </div>
                {isActive && <Check size={16} className="text-teal-600 shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="pt-3 border-t border-slate-200">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Follow-up shots ({narrativeLines.length})</p>
        <div className="space-y-1.5">
          {narrativeLines.map((line) => (
            <div key={line.sentenceIndex} className="flex items-start gap-2 text-[11px] text-slate-600">
              <span className="text-slate-400 font-mono shrink-0">{line.sentenceIndex}.</span>
              <span className="leading-snug">{line.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const GeneratingStep: React.FC<{ tier: StorytellingTier; estMinutes: number }> = ({ tier, estMinutes }) => (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <Loader2 size={32} className="text-teal-600 animate-spin" />
    <p className="text-lg font-serif font-bold text-slate-900 mt-4">Generating your reel</p>
    <p className="text-[12px] text-slate-500 mt-2 max-w-md">
      {tier === "draft" ? "Drafting storyboard images and a preview clip" : "Generating per-shot images and frame-pair motion clips"}.
      This takes about {estMinutes} minutes. The reel will persist to your dashboard regardless of whether this modal stays open.
    </p>
  </div>
);

const ReadyStep: React.FC<{
  manifest: StorytellingReelManifest;
  reelId: string;
  onAssemble: () => void;
  busy: boolean;
}> = ({ manifest, reelId }) => {
  const shotsWithImages = manifest.shots.filter((s) => s.imageUrl);
  const shotsWithVideo = manifest.shots.filter((s) => s.videoUrl);
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-serif font-bold text-slate-900">{manifest.title}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Pill variant="accent">{manifest.style.replace(/_/g, " ")}</Pill>
          <Pill variant="muted">{manifest.tier}</Pill>
          <Pill variant="warning">{manifest.cost.actualCredits.toFixed(1)}cr</Pill>
          <Pill variant="info">{shotsWithImages.length}/{manifest.shots.length} images · {shotsWithVideo.length} clips</Pill>
        </div>
      </div>

      {manifest.finalMp4Url && (
        <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-[9/16] max-h-[400px] mx-auto">
          <video controls className="w-full h-full object-contain">
            <source src={manifest.finalMp4Url} type="video/mp4" />
          </video>
        </div>
      )}

      {/* Shot grid */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Shots</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {manifest.shots.map((shot) => (
            <div key={shot.index} className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              {shot.imageUrl ? (
                <img src={shot.imageUrl} alt="" loading="lazy" className="w-full aspect-[9/16] object-cover" />
              ) : (
                <div className="w-full aspect-[9/16] bg-slate-100 flex items-center justify-center">
                  <Loader2 size={16} className="text-slate-400 animate-spin" />
                </div>
              )}
              <div className="p-2">
                <p className="text-[10px] text-slate-500 font-mono">Shot {shot.index}</p>
                <p className="text-[11px] text-slate-700 leading-snug line-clamp-2">{shot.text}</p>
                <div className="mt-1.5 flex gap-1">
                  <RerollBtn reelId={reelId} shotIndex={shot.index} type="image" />
                  {shot.imageUrl && <RerollBtn reelId={reelId} shotIndex={shot.index} type="motion" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200">
        {manifest.finalMp4Url && (
          <Button as="a" variant="primary" href={manifest.finalMp4Url} download icon={<Download size={11} />}>
            Download MP4
          </Button>
        )}
        <Button as="a" variant="primary" tone="slate" href={`/api/storytelling/reels/${reelId}/bundle.zip`} download icon={<Download size={11} />}>
          Editor Bundle
        </Button>
        {manifest.voiceover && (
          <Button as="a" variant="secondary" href={manifest.voiceover.url} target="_blank" rel="noreferrer" icon={<Play size={11} />}>
            Voiceover
          </Button>
        )}
      </div>
    </div>
  );
};

const RerollBtn: React.FC<{ reelId: string; shotIndex: number; type: "image" | "motion" }> = ({ reelId, shotIndex, type }) => {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    try {
      await fetch(`/api/storytelling/reels/${reelId}/shots/${shotIndex}/reroll-${type}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="px-2 py-1 rounded-full bg-slate-100 hover:bg-teal-50 text-[9px] uppercase tracking-widest text-slate-600 hover:text-teal-700 disabled:opacity-50 transition-colors flex items-center gap-1 font-bold"
    >
      {busy ? <Loader2 size={10} className="animate-spin" /> : "↻"} {type}
    </button>
  );
};
