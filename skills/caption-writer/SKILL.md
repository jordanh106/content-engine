---
name: caption-writer
description: Generate platform-optimized post captions for a video — Instagram, TikTok, and YouTube — from a topic, hook, and target audience. Applies brand voice, platform character limits, and proven CTA patterns.
argument-hint: "[video topic or code] for [platform(s)]"
context: fork
agent: default
allowed-tools: Read, Write
---

# Caption Writer: Platform-Optimized Post Copy

Turn a video topic into ready-to-post captions for every platform. No editing required — just copy, paste, publish.

## When to Use

- After `/video-director` produces a production plan (captions are the last step before publishing)
- When moving a video to SCHEDULED status in the dashboard
- When repurposing a long-form video for short-form platforms
- When you need to write captions for multiple videos in batch

## What It Does

1. Reads brand voice, platform rules, and hook patterns
2. Generates captions for Instagram, TikTok, and/or YouTube
3. Applies platform-specific character limits, hashtag strategy, and CTA patterns
4. Outputs ready-to-copy captions with no placeholder text

## Step-by-Step Process

### Step 1: Load Context

Read these files:
- `industries/chiropractic/brand.md` — voice, tone, humor, patient-facing language rules
- `industries/chiropractic/hook-patterns.md` — CTA patterns by platform
- `industries/chiropractic/config.json` — audiences, platforms

If a video code was provided (e.g., "D1"), also read:
- `industries/chiropractic/content-library.md` — find the title, format, audience, and script summary

### Step 2: Understand the Video

Extract or infer:
- **Topic**: What is this video about? (1 sentence)
- **Format**: A-G (determines CTA style)
- **Primary audience**: Which segment from config.json?
- **Key takeaway**: What should the viewer remember? (1 sentence)
- **Hook used**: What hook type opened the video? (informs caption tone)
- **Main CTA**: What action do we want viewers to take?

### Step 3: Write Platform Captions

---

#### Instagram Reels Caption

**Rules:**
- Characters displayed before "more": 125 (front-load the value here)
- Total max: 2,200 characters, but aim for 150-300 words
- Hashtags: 3-5 highly relevant, at the end (not in the body)
- Emoji: 1-3 max, only if natural — never forced
- CTA pattern: Saves-optimized ("Save this for when you need it") outperforms comments-optimized ("Comment below")
- Tone: Educational + warm, matches brand voice
- First line: Echo or extend the hook — don't repeat it verbatim

**Structure:**
```
[First line — echo the hook value or extend the tension]

[Body: 2-4 short paragraphs or line-separated points, max 8-10 lines]
- Use line breaks for readability on mobile
- Include the key educational takeaway
- Cite the statistic or fact if the video uses one

[CTA — 1 line, saves-optimized or action-oriented]

[Hashtags — 3-5 specific, not generic]
```

**Output:**
```
[INSTAGRAM CAPTION — READY TO POST]

[full caption text]
```

---

#### TikTok Caption

**Rules:**
- Characters displayed: ~150 (crucial — users rarely tap "more")
- Aim for 80-120 characters max for highest click-through
- 1-3 hashtags maximum: 1 niche (#chiropractor or #familychiropractic), 1 trending if applicable, 1 broad (#wellness or #health)
- No emoji clutter — zero to one
- Tone: Punchy, direct, matches TikTok comment culture
- CTA: Drives comments or shares ("Tell me if this happens to you" / "Share with someone who needs this")
- First words: Reinforce the video's value in plain language — "The #1 reason babies arch their backs explained."

**Output:**
```
[TIKTOK CAPTION — READY TO POST]

[full caption text]
```

---

#### YouTube Shorts Description

**Rules:**
- First 100 characters: Most critical — appears in search results
- Total: 200-500 words for discoverability
- Include 3-5 natural keyword phrases (not stuffed — use in sentences)
- Structure: hook summary → what you'll learn → CTA → link/location note
- Chapters: Only if 60+ seconds; most Shorts don't need them
- CTA: Subscribe + related video ("Watch [title] next" if you have one)

**Output:**
```
[YOUTUBE SHORTS DESCRIPTION — READY TO POST]

[full description text]
```

---

### Step 4: Hashtag Research

For Instagram, choose from these categories:
- **Niche-specific** (best for discovery): #chiropractor, #familychiropractic, #prenatalchiropractic, #pediatricchiropractic, #woodstockga, #woodstockchiropractor
- **Condition-specific** (depends on video): #techNeck, #babyhealth, #pregnancywellness, #sciatica, #headacherelief
- **Lifestyle** (broad but relevant): #wellness, #holistichealth, #momlife, #parentingTips

Rotate hashtags — don't use the same 5 on every post. Use 3-5 per post maximum.

### Step 5: Optional — Batch Mode

If multiple video codes were provided, generate all captions at once, clearly separated by video code.

## Caption Quality Checklist

Before outputting, verify each caption:
- [ ] First 125 characters (IG) or 150 characters (TikTok) contain the primary value
- [ ] No emdashes — use commas, periods, or restructure
- [ ] No begging language ("Please follow", "If you enjoyed this")
- [ ] CTA is specific and action-oriented, not vague ("Save this so you have it when you need it" not "Let me know what you think")
- [ ] Hashtags are specific, not generic (#chiropractor not #health)
- [ ] Brand voice: warm, educational, never clinical or corporate
- [ ] No placeholder text — every caption is ready to paste

## Brand Voice Reminders

From brand.md:
- Speak directly to the patient: "you/your" not "patients often..."
- Educational but never intimidating
- Jordan's humor: deadpan asides, never mugging for the camera
- CTA as invitation, never demand
- No emdashes

## Output Format

Always output in this order:
1. Instagram caption (primary platform)
2. TikTok caption
3. YouTube Shorts description
4. Hashtag bank (10 rotation options beyond what was used)

Mark each section clearly so they can be copy-pasted independently.

## Integration

```
/video-director     → Produces the script and hook (input to this skill)
/caption-writer     → THIS SKILL: turns the video into platform copy
Dashboard           → Save captions to savedCaptions table via Metrics view
/repurpose          → If creating short-form cuts from long-form, run before caption-writer
```
