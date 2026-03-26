import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  LayoutGrid, Plus, ChevronRight, RotateCcw, Copy, Check, ExternalLink,
  BarChart2, Layers, X, Loader2, Image, ChevronDown,
} from "lucide-react";
import { cn } from "../utils/cn.js";
import { ViewHelp } from "./ui/ViewHelp.js";
import { FeatureHint } from "./ui/FeatureHint.js";
import { VIEW_HELP, FEATURE_HINTS } from "../shared/help-content.js";
import { useOnboarding } from "./OnboardingProvider.js";
import type { GeneratedCarousel, CarouselSlide, DashboardView } from "../shared/types.js";

// ─── Constants ────────────────────────────────────────────────────────────────

const ARCHETYPES = [
  { id: "teacher",      label: "Teacher"      },
  { id: "fortuneteller",label: "Fortuneteller"},
  { id: "contrarian",   label: "Contrarian"   },
  { id: "experimenter", label: "Experimenter" },
  { id: "magician",     label: "Magician"     },
  { id: "investigator", label: "Investigator" },
] as const;

type ArchetypeId = (typeof ARCHETYPES)[number]["id"];

const ARCHETYPE_META: Record<ArchetypeId, { icon: string; descriptor: string; exampleHook: string }> = {
  teacher:      { icon: "📚", descriptor: "Pain point → clear method",   exampleHook: "5 things your doctor wants you to know about [topic]" },
  fortuneteller:{ icon: "🔮", descriptor: "Present → predict future",    exampleHook: "[Topic] is about to change. Here's why." },
  contrarian:   { icon: "⚡", descriptor: "Challenge the common belief", exampleHook: "Stop believing this about [topic]" },
  experimenter: { icon: "🧪", descriptor: "Test + reveal the result",    exampleHook: "I tried [X] for [Y time]. Here's what happened." },
  magician:     { icon: "✨", descriptor: "Unexpected reveal → explain", exampleHook: "[Surprising thing]. That's not what you think." },
  investigator: { icon: "🔍", descriptor: "Hidden element → reveal",     exampleHook: "[Topic] is hiding something nobody talks about." },
};

const HOOK_PATTERNS = [
  { id: "listicle", stars: 5, name: "Listicle Promise",  template: "5 things your [professional] wants you to know about [topic]" },
  { id: "myth",     stars: 4, name: "Myth Opener",       template: "Stop believing this about [topic]" },
  { id: "stat",     stars: 4, name: "Stat Anchor",       template: "[Startling number]% of [group] get this wrong about [topic]" },
  { id: "regret",   stars: 3, name: "Regret Frame",      template: "I wish I knew this about [topic] sooner" },
  { id: "quick",    stars: 3, name: "Quick Win",         template: "Fix your [problem] in [short time]" },
  { id: "counter",  stars: 3, name: "Contrarian Hook",   template: "[Common advice] is making your [condition] worse" },
];

const CTA_TEMPLATES = [
  { id: "save",    text: "Save this for your next visit",       stars: 5, platform: "Instagram" },
  { id: "share",   text: "Share this with someone who needs it",stars: 4, platform: "LinkedIn"  },
  { id: "follow",  text: "Follow for more tips like this",      stars: 3, platform: "All"       },
  { id: "book",    text: "Book your first visit — link in bio", stars: 3, platform: "Action"    },
  { id: "comment", text: "Which one surprised you most?",       stars: 2, platform: "TikTok"    },
];

const CTA_DEFAULTS: Record<string, string> = {
  instagram: "Save this for your next visit",
  linkedin:  "Share this with someone who needs it",
  tiktok:    "Which one surprised you most?",
};

const WORD_TARGETS: Record<string, { hook: [number, number]; topic: [number, number] }> = {
  instagram_portrait: { hook: [10, 15], topic: [6, 10] },
  instagram_square:   { hook: [8,  12], topic: [6, 10] },
  linkedin:           { hook: [10, 15], topic: [8, 14] },
  tiktok:             { hook: [6,  10], topic: [4, 8]  },
};

const DEFAULT_POINTS = [
  "Your strongest argument or most surprising fact",
  "The counterintuitive point most people get wrong",
  "The practical takeaway your audience can act on today",
];

function substituteHookVars(template: string, topic: string, audience: string): string {
  const t = topic.trim() || "[topic]";
  const g = audience ? audience.split(" / ")[0].toLowerCase() : "[group]";
  // Extract core noun phrase from topic (strip leading question words + trailing verb phrases)
  const subject = t
    .replace(/^(why|how|what|the truth about|stop|fix|signs|things|(\d+)\s+signs?\s+(your)?)\s*/i, "")
    .replace(/\s+(keeps?|is|are|needs?|wants?|will|can|should)\s+.*$/i, "")
    .trim() || t;
  return template
    .replace(/\[topic\]/gi, t)
    .replace(/\[professional\]/gi, "chiropractor")
    .replace(/\[group\]/gi, g)
    .replace(/\[problem\]/gi, subject)
    .replace(/\[condition\]/gi, subject)
    .replace(/\[short time\]/gi, "30 seconds")
    .replace(/\[Y time\]/gi, "30 days")
    .replace(/\[X\]/gi, subject)
    .replace(/\[Startling number\]/gi, "80")
    .replace(/\[Common advice\]/gi, `"${subject} will fix itself"`)
    .replace(/\[Surprising thing\]/gi, `What ${subject} actually does`);
}

const FALLBACK_AUDIENCES = [
  "New Moms / Young Families",
  "Weekend Warriors / Active Adults",
  "Aging Adults / 55+",
  "Remote Workers / Desk Workers",
  "Student Athletes",
  "Prenatal / Postnatal",
  "General / All Ages",
];

type SparkStarter = {
  icon: string;
  topic: string;
  archetype: ArchetypeId;
  audience: string;
  platformKey: string;
  aspectRatio: string;
};

const SPARK_STARTERS: SparkStarter[] = [
  { icon: "⚡", topic: "Text neck: the silent epidemic most people ignore",          archetype: "contrarian",    audience: "Remote Workers / Desk Workers",   platformKey: "instagram", aspectRatio: "4:5" },
  { icon: "📋", topic: "5 signs your spine needs attention today",                   archetype: "teacher",       audience: "General / All Ages",             platformKey: "instagram", aspectRatio: "4:5" },
  { icon: "🔮", topic: "What actually happens during a chiropractic adjustment",     archetype: "fortuneteller", audience: "General / All Ages",             platformKey: "linkedin",  aspectRatio: "1:1" },
  { icon: "🔍", topic: "Why your back pain keeps coming back",                       archetype: "investigator",  audience: "Weekend Warriors / Active Adults",platformKey: "instagram", aspectRatio: "4:5" },
  { icon: "✨", topic: "Pregnancy posture: what we never tell new moms",             archetype: "magician",      audience: "New Moms / Young Families",      platformKey: "instagram", aspectRatio: "1:1" },
  { icon: "🧪", topic: "I adjusted 3 patients this week with the same hidden issue", archetype: "experimenter",  audience: "Aging Adults / 55+",             platformKey: "linkedin",  aspectRatio: "1:1" },
];

const PLATFORM_OPTIONS = [
  { platform: "instagram", aspectRatio: "4:5", label: "Instagram (Portrait)", slides: 7, abbr: "IG" },
  { platform: "instagram", aspectRatio: "1:1", label: "Instagram (Square)",   slides: 7, abbr: "IG" },
  { platform: "linkedin",  aspectRatio: "1:1", label: "LinkedIn",             slides: 6, abbr: "LI" },
  { platform: "tiktok",    aspectRatio: "9:16",label: "TikTok",               slides: 7, abbr: "TT" },
] as const;

type PlatformOption = (typeof PLATFORM_OPTIONS)[number];

const SLIDE_TYPE_STYLES: Record<string, { label: string; color: string }> = {
  cover:   { label: "Cover",   color: "bg-violet-100 text-violet-700 border-violet-200" },
  content: { label: "Content", color: "bg-surface-hover text-themed-secondary border-themed"   },
  rehook:  { label: "Rehook",  color: "bg-sky-100 text-sky-700 border-sky-200"         },
  cta:     { label: "CTA",     color: "bg-teal-100 text-teal-700 border-teal-200"      },
};

const STATUS_STYLES: Record<string, { label: string; color: string; next: GeneratedCarousel["status"] }> = {
  generating: { label: "Generating", color: "bg-amber-100 text-amber-700",    next: "completed" },
  completed:  { label: "Completed",  color: "bg-emerald-100 text-emerald-700",next: "failed"    },
  failed:     { label: "Failed",     color: "bg-rose-100 text-rose-700",      next: "generating"},
};

// ─── Word count badge ─────────────────────────────────────────────────────────

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function WordCountBadge({ text, targets }: { text: string; targets: [number, number] }) {
  const count = wordCount(text);
  const [min, max] = targets;
  if (!text.trim()) return <span className="text-[11px] text-themed-muted">{min}–{max} words optimal</span>;
  if (count >= min && count <= max) return <span className="text-[11px] text-emerald-500 font-bold">{count} words ✓</span>;
  if (count < min) return <span className="text-[11px] text-themed-muted">{count} / {min}+ words</span>;
  return <span className="text-[11px] text-amber-500 font-bold">{count} words (aim for {max})</span>;
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <span className="text-[10px] text-amber-400 tracking-tight">
      {"★".repeat(count)}{"☆".repeat(max - count)}
    </span>
  );
}

// ─── Slide Editor Card ─────────────────────────────────────────────────────────

type SlideEditorProps = {
  slide: CarouselSlide;
  isActive: boolean;
  carouselId: number;
  platform: string;
  onUpdated: () => void;
};

function SlideEditor({ slide, isActive, carouselId, platform, onUpdated }: SlideEditorProps) {
  const [heading, setHeading] = useState(slide.heading ?? "");
  const [bodyText, setBodyText] = useState(slide.bodyText ?? "");
  const [visualSuggestion, setVisualSuggestion] = useState(slide.visualSuggestion ?? "");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setter(e.target.value);
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/carousels/${carouselId}/slides/${slide.slideIndex}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heading, bodyText, visualSuggestion }),
      });
      setDirty(false);
      onUpdated();
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setHeading(slide.heading ?? "");
    setBodyText(slide.bodyText ?? "");
    setVisualSuggestion(slide.visualSuggestion ?? "");
    setDirty(false);
  };

  const typeStyle = SLIDE_TYPE_STYLES[slide.slideType] ?? SLIDE_TYPE_STYLES.content;
  const isPortrait = platform === "instagram" && platform.includes("portrait");
  const aspectClass = isPortrait ? "aspect-[4/5]" : "aspect-square";

  if (!isActive) return null;

  return (
    <div className="space-y-4">
      {/* Slide preview card */}
      <div className={cn(
        "w-full max-w-[280px] mx-auto rounded-2xl border border-themed bg-gradient-to-br from-slate-50 to-white shadow-sm overflow-hidden",
        aspectClass
      )}>
        <div className="h-full flex flex-col p-4 gap-2">
          <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border self-start", typeStyle.color)}>
            {typeStyle.label}
          </span>
          <p className="text-sm font-black text-themed leading-tight flex-1">
            {heading || <span className="text-themed-muted italic">Heading…</span>}
          </p>
          <p className="text-xs text-themed-secondary leading-snug">
            {bodyText || <span className="text-themed-muted italic">Body copy…</span>}
          </p>
          {visualSuggestion && (
            <p className="text-[10px] italic text-themed-muted border-t border-themed-subtle pt-1.5">
              Visual: {visualSuggestion}
            </p>
          )}
        </div>
      </div>

      {/* Edit fields */}
      <div className="space-y-3">
        <div>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted block mb-1.5">
            Heading <span className="text-themed-muted normal-case tracking-normal font-normal">(max 8 words)</span>
          </label>
          <input
            type="text"
            value={heading}
            onChange={handleChange(setHeading)}
            placeholder="Bold, attention-grabbing headline"
            className="w-full text-base bg-surface-elevated border border-themed rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 text-themed placeholder-slate-300"
          />
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted block mb-1.5">
            Body <span className="text-themed-muted normal-case tracking-normal font-normal">(max 20 words)</span>
          </label>
          <textarea
            value={bodyText}
            onChange={handleChange(setBodyText)}
            placeholder="Supporting detail or key insight"
            rows={2}
            className="w-full text-base bg-surface-elevated border border-themed rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 text-themed placeholder-slate-300"
          />
        </div>
        <div>
          <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted block mb-1.5">
            Visual Direction
          </label>
          <input
            type="text"
            value={visualSuggestion}
            onChange={handleChange(setVisualSuggestion)}
            placeholder="What should this slide look like?"
            className="w-full text-sm bg-surface-elevated border border-themed rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 text-themed-secondary placeholder-slate-300"
          />
        </div>
        {dirty && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : null}
              Save
            </button>
            <button onClick={handleRevert} className="text-xs text-themed-muted hover:text-themed-secondary flex items-center gap-1">
              <RotateCcw size={10} /> Revert
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Carousel Card (library list) ─────────────────────────────────────────────

type CarouselCardProps = {
  carousel: GeneratedCarousel;
  isActive: boolean;
  onSelect: () => void;
};

function CarouselCard({ carousel, isActive, onSelect }: CarouselCardProps) {
  const title = carousel.ideaTopic
    ? carousel.ideaTopic.split(" ").slice(0, 6).join(" ")
    : carousel.hookLine?.slice(0, 40) ?? "Untitled";

  const platConfig = PLATFORM_OPTIONS.find(
    (p) => p.platform === carousel.platform
  );

  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-xl border transition-all",
        isActive
          ? "border-violet-400 bg-violet-50"
          : "border-themed bg-surface-elevated hover:border-violet-300 hover:bg-surface-hover"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-bold text-themed leading-snug line-clamp-2">{title}</p>
        <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-hover text-themed-tertiary shrink-0">
          {platConfig?.abbr ?? carousel.platform.slice(0, 2).toUpperCase()}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
          STATUS_STYLES[carousel.status]?.color ?? "bg-surface-hover text-themed-tertiary"
        )}>
          {STATUS_STYLES[carousel.status]?.label ?? carousel.status}
        </span>
        <span className="text-[10px] text-themed-muted">{carousel.slideCount} slides</span>
        <span className="text-[10px] text-themed-muted">{new Date(carousel.createdAt).toLocaleDateString()}</span>
      </div>
    </button>
  );
}

// ─── Analytics Panel ──────────────────────────────────────────────────────────

type AnalyticsPanelProps = {
  carousels: GeneratedCarousel[];
  open: boolean;
  onToggle: () => void;
};

function AnalyticsPanel({ carousels, open, onToggle }: AnalyticsPanelProps) {
  const scored = carousels.filter((c) => c.compositeScore !== null && c.compositeScore > 0);
  const topPerformer = scored.length > 0
    ? scored.reduce((a, b) => (a.compositeScore! > b.compositeScore! ? a : b))
    : null;

  const byCounts = carousels.reduce<Record<string, number>>((acc, c) => {
    acc[c.platform] = (acc[c.platform] ?? 0) + 1;
    return acc;
  }, {});

  const latestVersioned = carousels.find((c) => c.templateVersion);

  return (
    <div className={cn(
      "border-l border-themed bg-surface-hover transition-all overflow-hidden",
      open ? "w-[260px] shrink-0" : "w-0"
    )}>
      {open && (
        <div className="p-4 space-y-4 w-[260px]">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">Analytics</p>
            <button onClick={onToggle} className="text-themed-muted hover:text-themed-secondary">
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-bold text-themed-tertiary uppercase tracking-wider">Library</p>
            <p className="text-2xl font-black text-themed">{carousels.length}</p>
            <p className="text-[10px] text-themed-muted">carousels total</p>
          </div>

          {Object.keys(byCounts).length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-themed-tertiary uppercase tracking-wider">By Platform</p>
              {Object.entries(byCounts).map(([p, n]) => (
                <div key={p} className="flex items-center justify-between">
                  <span className="text-[11px] text-themed-secondary capitalize">{p.replace("_", " ")}</span>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-1.5 bg-violet-400 rounded-full"
                      style={{ width: `${Math.max(8, (n / carousels.length) * 60)}px` }}
                    />
                    <span className="text-[10px] font-bold text-themed-tertiary">{n}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {topPerformer && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-themed-tertiary uppercase tracking-wider">Top Score</p>
              <p className="text-[11px] font-semibold text-themed-secondary line-clamp-2">
                {topPerformer.ideaTopic ?? topPerformer.hookLine?.slice(0, 40)}
              </p>
              <p className="text-xs font-black text-emerald-600">
                {topPerformer.compositeScore?.toFixed(3)}
              </p>
            </div>
          )}

          {latestVersioned && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-themed-tertiary uppercase tracking-wider">Versions</p>
              {latestVersioned.templateVersion && (
                <p className="text-[10px] text-themed-tertiary">Template <span className="font-mono text-violet-600">{latestVersioned.templateVersion}</span></p>
              )}
              {latestVersioned.strategyVersion && (
                <p className="text-[10px] text-themed-tertiary">Strategy <span className="font-mono text-violet-600">{latestVersioned.strategyVersion}</span></p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main CarouselLab ──────────────────────────────────────────────────────────

type CarouselLabProps = {
  onNavigate?: (view: DashboardView) => void;
};

export function CarouselLab({ onNavigate: _onNavigate }: CarouselLabProps) {
  const queryClient = useQueryClient();
  const { trackEvent } = useOnboarding();

  // ── Library state
  const [activeCarouselId, setActiveCarouselId] = useState<number | null>(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  // ── Creator mode
  type Mode = "fresh" | "from-video";
  const [mode, setMode] = useState<Mode>("fresh");

  // ── Fresh start form
  const [platform, setPlatform] = useState<PlatformOption>(PLATFORM_OPTIONS[0]);
  const [audience, setAudience] = useState("");
  const [archetype, setArchetype] = useState<ArchetypeId | "">("");
  const [topic, setTopic] = useState("");
  const [hookLine, setHookLine] = useState("");
  const [talkingPoints, setTalkingPoints] = useState<string[]>(["", "", ""]);
  const [ctaText, setCtaText] = useState(CTA_DEFAULTS.instagram);
  const [ctaMode, setCtaMode] = useState<"preset" | "custom">("preset");

  // ── From video form
  const [videoSearch, setVideoSearch] = useState("");
  const [selectedVideoCode, setSelectedVideoCode] = useState<string | null>(null);

  // ── Slide editor state
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // ── Copy / Canva modal
  const [copied, setCopied] = useState(false);
  const [canvaModalOpen, setCanvaModalOpen] = useState(false);
  const [manualCanvaUrl, setManualCanvaUrl] = useState("");
  const [canvaSaved, setCanvaSaved] = useState(false);

  // ── Hook pattern panel
  const [showHookPatterns, setShowHookPatterns] = useState(false);
  const [pendingHookReplace, setPendingHookReplace] = useState<number | null>(null);

  // ── Fetch all carousels
  const { data: carousels = [] } = useQuery<GeneratedCarousel[]>({
    queryKey: ["carousels-lab"],
    queryFn: async () => {
      const res = await fetch("/api/carousels");
      if (!res.ok) throw new Error("Failed to fetch carousels");
      return res.json();
    },
    refetchInterval: 5000,
  });

  // ── Fetch industry config for dynamic audience list
  const { data: industryConfig } = useQuery<{ audiences?: Array<{ label: string }> }>({
    queryKey: ["industry-config"],
    queryFn: () => fetch("/api/videos/config/industry").then((r) => r.json()),
  });
  const audiences = industryConfig?.audiences?.map((a) => a.label) ?? FALLBACK_AUDIENCES;

  // ── Fetch video library for From Video picker
  const { data: videos = [] } = useQuery<{ code: string; title: string; format: string; audience: string }[]>({
    queryKey: ["videos-summary"],
    queryFn: async () => {
      const res = await fetch("/api/videos?limit=100");
      if (!res.ok) return [];
      const data = await res.json();
      return (data.videos ?? data).map((v: Record<string, unknown>) => ({
        code: v.code,
        title: v.title,
        format: v.format,
        audience: v.audience,
      }));
    },
  });

  const activeCarousel = carousels.find((c) => c.id === activeCarouselId) ?? null;

  // ── Platform-derived helpers
  const platformKey = platform.platform === "instagram"
    ? (platform.aspectRatio === "4:5" ? "instagram_portrait" : "instagram_square")
    : platform.platform;
  const wordTargets = WORD_TARGETS[platformKey] ?? WORD_TARGETS.instagram_portrait;

  // ── Progressive disclosure phases
  const showPhase2 = !!archetype;
  const showPhase3 = topic.trim().split(/\s+/).filter(Boolean).length >= 3;

  // ── Handle platform change (auto-update CTA default)
  const handlePlatformChange = (opt: PlatformOption) => {
    setPlatform(opt);
    if (ctaMode === "preset") {
      setCtaText(CTA_DEFAULTS[opt.platform] ?? CTA_TEMPLATES[0].text);
    }
  };

  // ── Apply a spark starter
  const applySparkStarter = (spark: SparkStarter) => {
    const platOpt = PLATFORM_OPTIONS.find(
      (p) => p.platform === spark.platformKey && p.aspectRatio === spark.aspectRatio
    ) ?? PLATFORM_OPTIONS[0];
    setPlatform(platOpt);
    setArchetype(spark.archetype);
    setAudience(spark.audience);
    setTopic(spark.topic);
    setCtaText(CTA_DEFAULTS[spark.platformKey] ?? CTA_TEMPLATES[0].text);
    setCtaMode("preset");
    setMode("fresh");
    setActiveCarouselId(null);
  };

  // ── Auto-detect point count from topic pattern (e.g., "5 signs..." → 5 empty fields)
  useEffect(() => {
    const match = topic.match(/^(\d+)\s+(signs?|reasons?|ways?|things?|tips?|facts?|steps?)/i);
    if (match) {
      const count = Math.min(parseInt(match[1], 10), 6);
      if (count !== talkingPoints.length && talkingPoints.every((p) => !p.trim())) {
        setTalkingPoints(Array(count).fill(""));
      }
    }
  }, [topic]);

  // ── Generate mutation (Fresh Start)
  const generateMutation = useMutation({
    mutationFn: async () => {
      const pts = talkingPoints.filter((p) => p.trim());
      const res = await fetch("/api/carousels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform.platform,
          aspectRatio: platform.aspectRatio,
          hookLine: hookLine || topic,
          talkingPoints: pts.length > 0 ? pts : [topic],
          ctaText: ctaText || "Save this and book a consult",
          ideaTopic: topic,
          hookArchetype: archetype || null,
          audience: audience || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate");
      return res.json() as Promise<GeneratedCarousel>;
    },
    onSuccess: (carousel) => {
      queryClient.invalidateQueries({ queryKey: ["carousels-lab"] });
      setActiveCarouselId(carousel.id);
      setActiveSlideIndex(0);
      trackEvent("create-carousel");
    },
  });

  // ── Generate from video mutation
  const fromVideoMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVideoCode) throw new Error("No video selected");
      const res = await fetch(`/api/carousels/${selectedVideoCode}/from-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform.platform,
          aspectRatio: platform.aspectRatio,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate from video");
      return res.json() as Promise<GeneratedCarousel>;
    },
    onSuccess: (carousel) => {
      queryClient.invalidateQueries({ queryKey: ["carousels-lab"] });
      setActiveCarouselId(carousel.id);
      setActiveSlideIndex(0);
      trackEvent("create-carousel");
    },
  });

  // ── Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/carousels/${id}`, { method: "DELETE" });
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ["carousels-lab"] });
      if (activeCarouselId === id) setActiveCarouselId(null);
    },
  });

  // ── Suggest content points via Claude
  const suggestPointsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/carousels/suggest-points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          audience: audience || undefined,
          archetype: archetype || undefined,
          hookLine: hookLine || undefined,
          platform: platform.platform,
          aspectRatio: platform.aspectRatio,
          count: talkingPoints.length,
        }),
      });
      if (!res.ok) throw new Error("Failed to suggest points");
      return res.json() as Promise<{ points: string[] }>;
    },
    onSuccess: (data) => {
      setTalkingPoints(data.points);
    },
  });

  // ── Retry failed/stuck carousel
  const retryMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/carousels/${id}/retry`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to retry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["carousels"] });
    },
  });

  // ── Copy all slides as text
  const handleCopyText = useCallback(() => {
    if (!activeCarousel?.slides) return;
    const text = activeCarousel.slides.map((s, i) => {
      const type = SLIDE_TYPE_STYLES[s.slideType]?.label ?? s.slideType;
      return `SLIDE ${i + 1} — ${type.toUpperCase()}\n${s.heading ?? ""}\n${s.bodyText ?? ""}\nVisual: ${s.visualSuggestion ?? ""}`;
    }).join("\n\n─────────────────\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [activeCarousel]);

  // ── Save Canva URL manually
  const handleSaveCanvaUrl = async () => {
    if (!activeCarouselId || !manualCanvaUrl.trim()) return;
    await fetch(`/api/carousels/${activeCarouselId}/canva`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canvaDesignUrl: manualCanvaUrl.trim() }),
    });
    queryClient.invalidateQueries({ queryKey: ["carousels-lab"] });
    setCanvaSaved(true);
    setTimeout(() => { setCanvaSaved(false); setCanvaModalOpen(false); }, 1500);
  };

  const filteredVideos = videoSearch.trim()
    ? videos.filter((v) =>
        v.code.toLowerCase().includes(videoSearch.toLowerCase()) ||
        v.title.toLowerCase().includes(videoSearch.toLowerCase())
      )
    : videos.slice(0, 20);

  const isGenerating = generateMutation.isPending || fromVideoMutation.isPending;
  const slides = activeCarousel?.slides ?? [];

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Library + Spark Starters ──────────────────────────────── */}
      <div className="w-[260px] shrink-0 border-r border-themed bg-surface-hover flex flex-col overflow-hidden">
        <div className="p-3 border-b border-themed">
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} className="text-violet-600" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-tertiary">Carousel Lab</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {carousels.length === 0 ? (
            /* Empty state: Spark Starters fill the panel */
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-themed-muted pt-1">Spark Starters</p>
              <p className="text-[11px] text-themed-muted leading-relaxed">Tap any to pre-fill the form and jump straight to generating.</p>
              {SPARK_STARTERS.map((spark) => {
                const meta = ARCHETYPE_META[spark.archetype];
                return (
                  <button
                    key={spark.topic}
                    onClick={() => applySparkStarter(spark)}
                    className="w-full text-left p-3 rounded-xl border border-themed bg-surface-elevated hover:border-violet-400 hover:bg-violet-50 transition-all group"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{spark.icon}</span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-themed-muted group-hover:text-violet-600">
                        {spark.archetype}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-themed-secondary line-clamp-3 leading-snug">{spark.topic}</p>
                    <p className="text-[10px] text-themed-muted mt-0.5 truncate">{meta.descriptor}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            /* Library exists: show carousels + spark starters collapsed */
            <>
              {carousels.map((c) => (
                <CarouselCard
                  key={c.id}
                  carousel={c}
                  isActive={activeCarouselId === c.id}
                  onSelect={() => { setActiveCarouselId(c.id); setActiveSlideIndex(0); }}
                />
              ))}
              <div className="pt-1 border-t border-themed">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-themed-muted mb-1.5">Spark Starters</p>
                <div className="space-y-1.5">
                  {SPARK_STARTERS.map((spark) => (
                    <button
                      key={spark.topic}
                      onClick={() => applySparkStarter(spark)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-themed bg-surface-elevated hover:border-violet-400 hover:bg-violet-50 transition-all group flex items-center gap-2"
                    >
                      <span className="text-sm shrink-0">{spark.icon}</span>
                      <p className="text-[11px] font-semibold text-themed-secondary line-clamp-1 group-hover:text-violet-700">{spark.topic}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-3 border-t border-themed">
          <button
            onClick={() => setActiveCarouselId(null)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-violet-600 text-white text-[11px] font-bold hover:bg-violet-700 transition-colors"
          >
            <Plus size={12} /> New Carousel
          </button>
        </div>
      </div>

      {/* ── Center: Creator + Editor ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-surface-elevated border-b border-themed px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted">
              {activeCarousel
                ? (activeCarousel.ideaTopic ?? activeCarousel.hookLine?.slice(0, 40) ?? "Carousel")
                : "New Carousel"}
            </h1>
            {activeCarousel?.canvaDesignUrl && (
              <a
                href={activeCarousel.canvaDesignUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] font-bold text-teal-600 hover:text-teal-700"
              >
                <ExternalLink size={10} /> Open in Canva
              </a>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAnalyticsOpen((v) => !v)}
              className="flex items-center gap-1 text-[10px] font-bold text-themed-muted hover:text-themed-secondary"
            >
              <BarChart2 size={12} /> Analytics
            </button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {/* ── Creator (shown when no active carousel) */}
          {!activeCarousel && (
            <div className="bg-surface-elevated border border-themed rounded-2xl p-5 space-y-5">
              {/* Mode toggle */}
              <div className="flex items-center gap-2">
                {(["fresh", "from-video"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "px-4 py-2 rounded-full text-xs font-bold border transition-colors",
                      mode === m
                        ? "bg-violet-600 text-white border-violet-600"
                        : "bg-surface-elevated text-themed-tertiary border-themed hover:border-violet-400"
                    )}
                  >
                    {m === "fresh" ? "Fresh Start" : "From Video"}
                  </button>
                ))}
              </div>

              {mode === "fresh" && (
                <>
                  {/* Phase 1: Platform + Archetype (always visible) */}

                  {/* Platform */}
                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted block mb-2">Platform</label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORM_OPTIONS.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handlePlatformChange(opt)}
                          className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold border transition-colors",
                            platform === opt
                              ? "bg-violet-600 text-white border-violet-600"
                              : "bg-surface-elevated text-themed-tertiary border-themed hover:border-violet-400"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Archetype — visual card grid */}
                  <FeatureHint
                    id="carousel-archetype"
                    content={FEATURE_HINTS["carousel-archetype"]?.content ?? "Pick your hook archetype — the creative persona that shapes your cover slide."}
                    side="bottom"
                  >
                    <div>
                      <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted block mb-2">
                        Your Voice <span className="text-themed-muted normal-case tracking-normal font-normal">(pick your hook archetype)</span>
                      </label>

                      {archetype ? (
                        /* Collapsed — show selected archetype */
                        <div className="flex items-start gap-3 p-4 rounded-xl border border-violet-200 bg-violet-50">
                          <span className="text-2xl">{ARCHETYPE_META[archetype].icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-black text-violet-800 capitalize">{archetype}</p>
                            <p className="text-xs text-violet-600">{ARCHETYPE_META[archetype].descriptor}</p>
                            <p className="text-[11px] italic text-themed-tertiary mt-1 line-clamp-1">
                              e.g. "{ARCHETYPE_META[archetype].exampleHook}"
                            </p>
                          </div>
                          <button
                            onClick={() => setArchetype("")}
                            className="text-xs font-bold text-violet-500 hover:text-violet-700 shrink-0 mt-0.5"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        /* Expanded 2x3 card grid */
                        <div className="grid grid-cols-2 gap-2.5">
                          {ARCHETYPES.map((a) => {
                            const meta = ARCHETYPE_META[a.id];
                            return (
                              <button
                                key={a.id}
                                onClick={() => setArchetype(a.id)}
                                className="text-left p-4 rounded-xl border border-themed bg-surface-elevated hover:border-violet-400 hover:bg-violet-50 transition-all group"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xl">{meta.icon}</span>
                                  <span className="text-sm font-black text-themed-secondary group-hover:text-violet-700">{a.label}</span>
                                </div>
                                <p className="text-xs text-themed-tertiary leading-relaxed mb-1.5">{meta.descriptor}</p>
                                <p className="text-[11px] italic text-themed-muted line-clamp-2">"{meta.exampleHook}"</p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </FeatureHint>

                  {/* Phase 2: Audience + Topic (visible after archetype picked) */}
                  {showPhase2 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Audience */}
                      <div>
                        <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted block mb-1.5">Audience</label>
                        <select
                          value={audience}
                          onChange={(e) => setAudience(e.target.value)}
                          className="w-full text-sm bg-surface-elevated border border-themed rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 text-themed-secondary"
                        >
                          <option value="">Any audience</option>
                          {audiences.map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                      </div>

                      {/* Topic with word count */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted">Topic</label>
                          <WordCountBadge text={topic} targets={wordTargets.topic} />
                        </div>
                        <textarea
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          placeholder="e.g. Text neck and forward head posture"
                          rows={2}
                          className="w-full text-base bg-surface-elevated border border-themed rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-300 text-themed placeholder-slate-400"
                        />
                      </div>
                    </div>
                  )}

                  {/* Phase 3: Hook, Content Points, CTA (visible after 3+ words in topic) */}
                  {showPhase3 && (
                    <div className="space-y-4 animate-in fade-in duration-200">
                      {/* Cover Hook with quick-fill */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted">
                            Cover Hook <span className="text-themed-muted normal-case tracking-normal font-normal">(optional)</span>
                          </label>
                          <WordCountBadge text={hookLine} targets={wordTargets.hook} />
                        </div>
                        <input
                          type="text"
                          value={hookLine}
                          onChange={(e) => setHookLine(e.target.value)}
                          placeholder="e.g. Your neck will pay for your phone habit."
                          className="w-full text-base bg-surface-elevated border border-themed rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 text-themed placeholder-slate-400"
                        />

                        {/* Hook pattern quick-fill */}
                        <button
                          onClick={() => setShowHookPatterns((v) => !v)}
                          className="mt-2 flex items-center gap-1 text-xs font-bold text-violet-500 hover:text-violet-700"
                        >
                          <ChevronDown size={11} className={cn("transition-transform", showHookPatterns && "rotate-180")} />
                          Use a proven pattern
                        </button>

                        {showHookPatterns && (
                          <div className="mt-2 border border-themed rounded-xl overflow-hidden">
                            {HOOK_PATTERNS.map((pat, i) => (
                              <div
                                key={pat.id}
                                className={cn(
                                  "flex items-start gap-3 px-3 py-3 hover:bg-violet-50 transition-colors",
                                  i < HOOK_PATTERNS.length - 1 && "border-b border-themed-subtle"
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <Stars count={pat.stars} />
                                    <span className="text-xs font-bold text-themed-secondary">{pat.name}</span>
                                  </div>
                                  <p className="text-[11px] italic text-themed-tertiary line-clamp-1">"{pat.template}"</p>
                                </div>
                                <button
                                  onClick={() => {
                                    if (hookLine.trim() && pendingHookReplace !== i) {
                                      setPendingHookReplace(i);
                                      return;
                                    }
                                    setHookLine(substituteHookVars(pat.template, topic, audience));
                                    setShowHookPatterns(false);
                                    setPendingHookReplace(null);
                                  }}
                                  className={cn(
                                    "shrink-0 text-xs font-bold mt-0.5",
                                    pendingHookReplace === i
                                      ? "text-rose-500 hover:text-rose-700"
                                      : "text-violet-500 hover:text-violet-700"
                                  )}
                                >
                                  {pendingHookReplace === i ? "Replace?" : "Use"}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Talking points */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <div className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted">Content Points</div>
                            <div className="text-[11px] text-themed-muted normal-case tracking-normal font-normal">One per slide, 3-5 recommended</div>
                          </div>
                          {topic.trim().split(/\s+/).length >= 3 && (
                            <button
                              onClick={() => suggestPointsMutation.mutate()}
                              disabled={suggestPointsMutation.isPending}
                              className="text-[11px] font-bold text-violet-500 hover:text-violet-700 disabled:opacity-40 flex items-center gap-1 shrink-0"
                            >
                              {suggestPointsMutation.isPending ? (
                                <span className="animate-pulse">Thinking...</span>
                              ) : (
                                <>✦ Suggest</>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {talkingPoints.map((pt, i) => (
                            <div key={i} className="flex gap-2 items-center">
                              <span className="text-xs font-bold text-themed-muted w-5 shrink-0">{i + 1}.</span>
                              <textarea
                                rows={2}
                                value={pt}
                                onChange={(e) => {
                                  const next = [...talkingPoints];
                                  next[i] = e.target.value;
                                  setTalkingPoints(next);
                                }}
                                placeholder={DEFAULT_POINTS[i] ?? `Point ${i + 1}`}
                                className="flex-1 text-sm bg-surface-elevated border border-themed rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 text-themed-secondary placeholder-slate-300 resize-y"
                              />
                              {talkingPoints.length > 1 && (
                                <button
                                  onClick={() => setTalkingPoints(talkingPoints.filter((_, j) => j !== i))}
                                  className="text-themed-muted hover:text-rose-400"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                          {talkingPoints.length < 6 && (
                            <button
                              onClick={() => setTalkingPoints([...talkingPoints, ""])}
                              className="text-xs text-violet-500 hover:text-violet-700 font-bold"
                            >
                              + Add point
                            </button>
                          )}
                        </div>
                      </div>

                      {/* CTA — ranked presets + custom */}
                      <div>
                        <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted block mb-2">Call to Action</label>
                        <div className="border border-themed rounded-xl overflow-hidden">
                          {CTA_TEMPLATES.map((cta, i) => {
                            const isSelected = ctaMode === "preset" && ctaText === cta.text;
                            return (
                              <button
                                key={cta.id}
                                onClick={() => { setCtaMode("preset"); setCtaText(cta.text); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors",
                                  i < CTA_TEMPLATES.length && "border-b border-themed-subtle",
                                  isSelected ? "bg-violet-50" : "bg-surface-elevated hover:bg-surface-hover"
                                )}
                              >
                                <div className={cn(
                                  "w-3.5 h-3.5 rounded-full border-2 shrink-0 transition-colors",
                                  isSelected ? "border-violet-600 bg-violet-600" : "border-themed"
                                )} />
                                <div className="flex-1 min-w-0">
                                  <p className={cn("text-sm font-semibold", isSelected ? "text-violet-800" : "text-themed-secondary")}>
                                    {cta.text}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Stars count={cta.stars} />
                                  <span className="text-[10px] text-themed-muted">{cta.platform}</span>
                                </div>
                              </button>
                            );
                          })}

                          {/* Custom CTA option */}
                          <button
                            onClick={() => setCtaMode("custom")}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-3 text-left transition-colors",
                              ctaMode === "custom" ? "bg-violet-50" : "bg-surface-elevated hover:bg-surface-hover"
                            )}
                          >
                            <div className={cn(
                              "w-3.5 h-3.5 rounded-full border-2 shrink-0",
                              ctaMode === "custom" ? "border-violet-600 bg-violet-600" : "border-themed"
                            )} />
                            <span className="text-sm font-semibold text-themed-tertiary">Custom…</span>
                          </button>
                        </div>

                        {ctaMode === "custom" && (
                          <input
                            type="text"
                            value={ctaMode === "custom" ? ctaText : ""}
                            onChange={(e) => setCtaText(e.target.value)}
                            placeholder="Write your own call to action"
                            className="mt-2 w-full text-base bg-surface-elevated border border-themed rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-violet-300 text-themed placeholder-slate-400"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Generate button */}
                  <button
                    onClick={() => generateMutation.mutate()}
                    disabled={
                      isGenerating ||
                      !topic.trim() && !hookLine.trim()
                    }
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? (
                      <><Loader2 size={12} className="animate-spin" /> Generating…</>
                    ) : (
                      <><Layers size={12} /> Generate Carousel</>
                    )}
                  </button>
                </>
              )}

              {mode === "from-video" && (
                <>
                  {/* Platform for from-video */}
                  <div>
                    <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted block mb-2">Platform</label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORM_OPTIONS.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handlePlatformChange(opt)}
                          className={cn(
                            "px-4 py-2 rounded-full text-xs font-bold border transition-colors",
                            platform === opt
                              ? "bg-violet-600 text-white border-violet-600"
                              : "bg-surface-elevated text-themed-tertiary border-themed hover:border-violet-400"
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-black uppercase tracking-[0.12em] text-themed-muted block mb-1.5">Search Video Library</label>
                      <input
                        type="text"
                        value={videoSearch}
                        onChange={(e) => setVideoSearch(e.target.value)}
                        placeholder="Search by code or title…"
                        className="w-full text-sm bg-surface-elevated border border-themed rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-300 text-themed placeholder-slate-400"
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredVideos.map((v) => (
                        <button
                          key={v.code}
                          onClick={() => setSelectedVideoCode(selectedVideoCode === v.code ? null : v.code)}
                          className={cn(
                            "w-full text-left px-3 py-2 rounded-xl border text-[11px] transition-colors",
                            selectedVideoCode === v.code
                              ? "border-violet-400 bg-violet-50 font-bold text-violet-800"
                              : "border-themed bg-surface-elevated hover:border-violet-300 text-themed-secondary"
                          )}
                        >
                          <span className="font-mono text-[9px] text-themed-muted mr-2">{String(v.code)}</span>
                          {String(v.title).slice(0, 60)}
                          <span className="ml-2 text-[9px] text-themed-muted">{String(v.format)} · {String(v.audience)}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => fromVideoMutation.mutate()}
                    disabled={isGenerating || !selectedVideoCode}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isGenerating ? (
                      <><Loader2 size={12} className="animate-spin" /> Generating…</>
                    ) : (
                      <><Layers size={12} /> Generate Carousel</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Slide Editor (shown when active carousel exists) */}
          {activeCarousel && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-[9px] font-bold px-2 py-0.5 rounded-full",
                    STATUS_STYLES[activeCarousel.status]?.color ?? "bg-surface-hover text-themed-tertiary"
                  )}>
                    {STATUS_STYLES[activeCarousel.status]?.label ?? activeCarousel.status}
                  </span>
                  <span className="text-[10px] text-themed-muted capitalize">{activeCarousel.platform}</span>
                  {activeCarousel.hookArchetype && (
                    <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                      {activeCarousel.hookArchetype}
                    </span>
                  )}
                  {activeCarousel.audience && (
                    <span className="text-[10px] text-themed-muted">{activeCarousel.audience}</span>
                  )}
                </div>
                <button
                  onClick={() => { if (confirm("Delete this carousel?")) deleteMutation.mutate(activeCarousel.id); }}
                  className="text-themed-muted hover:text-rose-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>

              {activeCarousel.hookLine && (
                <p className="text-sm font-bold italic text-themed-secondary bg-violet-50 border border-violet-100 rounded-xl px-4 py-3">
                  "{activeCarousel.hookLine}"
                </p>
              )}

              {slides.length > 0 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {slides.map((s, i) => {
                    const ts = SLIDE_TYPE_STYLES[s.slideType] ?? SLIDE_TYPE_STYLES.content;
                    return (
                      <button
                        key={i}
                        onClick={() => setActiveSlideIndex(i)}
                        className={cn(
                          "shrink-0 flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border transition-all",
                          activeSlideIndex === i
                            ? "border-violet-400 bg-violet-50 ring-2 ring-violet-300 ring-offset-1"
                            : "border-themed bg-surface-elevated hover:border-violet-300"
                        )}
                      >
                        <span className="text-[9px] font-black text-themed-tertiary">{i + 1}</span>
                        <span className={cn("text-[8px] font-bold px-1.5 py-0.5 rounded-full", ts.color)}>
                          {ts.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {slides.length > 0 ? (
                <div className="bg-surface-elevated border border-themed rounded-2xl p-5">
                  <FeatureHint id="carousel-slide-editor" content="Edit each slide's heading, body copy, and visual direction. Changes save directly to the database — use Revert to undo." side="top">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-themed-muted mb-4">
                      Edit Slide {activeSlideIndex + 1}
                    </p>
                  </FeatureHint>

                  {/* Show slide image if available */}
                  {slides[activeSlideIndex]?.imagePath && (
                    <div className="mb-4 rounded-xl overflow-hidden border border-themed">
                      <img
                        src={slides[activeSlideIndex].imagePath!}
                        alt={`Slide ${activeSlideIndex + 1}`}
                        className="w-full h-auto"
                      />
                    </div>
                  )}

                  <SlideEditor
                    slide={slides[activeSlideIndex]}
                    isActive={true}
                    carouselId={activeCarousel.id}
                    platform={activeCarousel.platform}
                    onUpdated={() => queryClient.invalidateQueries({ queryKey: ["carousels-lab"] })}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-sm text-themed-muted py-8">
                  {activeCarousel.status === "generating" ? (
                    <>
                      <Loader2 size={24} className="animate-spin text-teal-500" />
                      <p className="font-medium text-themed-secondary">Generating AI slide images...</p>
                      <p className="text-xs text-themed-muted">This takes ~30 seconds for {activeCarousel.slideCount} slides. Page auto-refreshes.</p>
                    </>
                  ) : (
                    <>
                      <Image size={14} />
                      <p>No slides yet.</p>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-themed-subtle">
                <button
                  onClick={handleCopyText}
                  disabled={slides.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-40 transition-colors"
                >
                  {copied ? <Check size={10} /> : <Copy size={10} />}
                  {copied ? "Copied!" : "Copy Slide Text"}
                </button>

                {(activeCarousel.status === "failed" || activeCarousel.status === "generating") && (
                  <button
                    onClick={() => retryMutation.mutate(activeCarousel.id)}
                    disabled={retryMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border border-violet-500 text-violet-600 hover:bg-violet-50 disabled:opacity-40 transition-colors"
                  >
                    <RotateCcw size={10} className={retryMutation.isPending ? "animate-spin" : ""} />
                    {retryMutation.isPending ? "Retrying..." : "Retry"}
                  </button>
                )}

                <FeatureHint id="carousel-canva-push" content="After saving, run /carousel-lab push [id] in Claude Code to create a Canva design. The URL will appear here when done." side="top">
                  <button
                    onClick={() => setCanvaModalOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border border-teal-500 text-teal-600 hover:bg-teal-50 transition-colors"
                  >
                    <ExternalLink size={10} /> Push to Canva
                  </button>
                </FeatureHint>

                <span className="text-[10px] text-themed-muted">
                  ID: <span className="font-mono">{activeCarousel.id}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {VIEW_HELP.CAROUSEL_LAB && <ViewHelp {...VIEW_HELP.CAROUSEL_LAB} />}
      </div>

      {/* ── Right: Analytics ─────────────────────────────────────────────── */}
      <AnalyticsPanel
        carousels={carousels}
        open={analyticsOpen}
        onToggle={() => setAnalyticsOpen(false)}
      />

      {/* ── Canva Push Modal ─────────────────────────────────────────────── */}
      {canvaModalOpen && activeCarousel && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-surface-elevated rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-themed">Push to Canva</p>
              <button onClick={() => setCanvaModalOpen(false)} className="text-themed-muted hover:text-themed-secondary">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-themed-secondary">
              Run this command in Claude Code to create a Canva presentation with your slides:
            </p>

            <div className="bg-slate-900 text-teal-300 font-mono text-xs rounded-xl p-3 flex items-start justify-between gap-2">
              <span>/carousel-lab push {activeCarousel.id}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`/carousel-lab push ${activeCarousel.id}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="text-themed-tertiary hover:text-teal-300 shrink-0"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>

            <p className="text-[11px] text-themed-tertiary">
              The skill will use Canva MCP to create a designed presentation with your brand kit, then save the URL here automatically.
            </p>

            <div className="border-t border-themed-subtle pt-3 space-y-2">
              <p className="text-[10px] text-themed-muted">Already have the Canva URL? Paste it directly:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCanvaUrl}
                  onChange={(e) => setManualCanvaUrl(e.target.value)}
                  placeholder="https://www.canva.com/design/…"
                  className="flex-1 text-xs bg-surface-hover border border-themed rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-300"
                />
                <button
                  onClick={handleSaveCanvaUrl}
                  disabled={!manualCanvaUrl.trim()}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40"
                >
                  {canvaSaved ? "Saved!" : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
