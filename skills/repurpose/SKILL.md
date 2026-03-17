---
name: repurpose
description: Take a long-form script or YouTube video and generate short-form platform variants — 15s TikTok cut, 30s Instagram Reel, 60s YouTube Short. Multiplies output from every long-form production with no extra ideation.
argument-hint: "[video code or topic] from [source format: long-form|youtube|script]"
context: fork
agent: default
allowed-tools: Read, Write
---

# Repurpose: Long → Short Form Multiplication

Turn one long-form production into three short-form platform cuts. The hook changes. The format compresses. The audience gets the best 15-60 seconds. You shoot once, publish four times.

## When to Use

- After producing a YouTube long-form video (3-10 min)
- When a long `/video-director` production plan exists and you want short-form cuts
- When a library entry is marked as YouTube long-form and you want to extract Reels/Shorts/TikTok cuts
- When a full script exists and you want to extract the highest-value segment

## What It Does

1. Reads the source script or production plan
2. Identifies the 1-3 highest-value segments (maximum information density, strongest hook potential)
3. Generates 3 compressed variants: 15s TikTok, 30s Instagram Reel, 60s YouTube Short
4. For each: produces a new hook, compressed script, and platform-specific shot adjustments
5. Generates captions for all 3 variants (or passes to `/caption-writer`)

## Step-by-Step Process

### Step 1: Load Source Material

If a video code was given:
1. Check `industries/chiropractic/production-plans/` for an existing plan file matching the code
2. If not found, check `industries/chiropractic/content-library.md` for the script

If a raw script was pasted, work directly from that.

Read:
- `industries/chiropractic/hook-patterns.md` — for short-form hook options
- `industries/chiropractic/brand.md` — voice rules
- `industries/chiropractic/config.json` — platform rules (platform section)

### Step 2: Identify the High-Value Segments

From the source script, identify:

**For TikTok (15s / ~37 words):**
Find the single most surprising or counterintuitive claim. The one fact or insight that would make someone stop scrolling. Usually it's buried in the middle of the long-form — pull it to the front.

**For Instagram Reel (30s / ~75 words):**
Find the best educational segment: a clear problem → clear solution arc that stands alone. Should include a moment of empathy and a practical takeaway.

**For YouTube Short (60s / ~150 words):**
Find the core argument of the video: the "why this matters" + "what to do" that covers the main thesis. Can include more context than the shorter cuts.

### Step 3: Write Each Variant

For each variant, produce:

**Header:**
```
## [Platform] Cut — [Duration]s

**Source segment:** [timestamp range or section title from original]
**Hook type:** [which hook archetype from hook-patterns.md]
**Target audience:** [primary segment]
```

**New Hook (rewritten for short-form):**
The hook must work differently than the long-form opener. Long-form earns attention; short-form steals it. Rewrite for pattern interrupt or immediate value delivery.

```
HOOK: "[Hook text — under 10 words for TikTok, under 15 for Reel, under 20 for Short]"
```

**Compressed Script:**
- Delivery cues in brackets: `[Pause]`, `[Deadpan]`, `[Fast]`
- No emdashes
- Match word count to target duration (2.5 words/second)
- End with a CTA that's platform-appropriate

**Shot Adjustments (from the original plan):**
List which shots from the original plan can be reused, which need to be trimmed, and if any new shots are needed.

```
Shot reuse:
- Shot 1 (intro setup): Trim to first 3s only
- Shot 4 (demonstration): Use in full
- Shot 7 (CTA): Replace with short-form CTA shot

New shots needed:
- Opening reaction shot (0.5s) — captures audience before hook
```

**Remotion Data (if applicable):**
If the variant uses motion graphics, provide compressed Remotion JSON matching the appropriate format schema. Short-form variants typically use Format F (Quick Tip) or a compressed Format A/B.

---

#### 15s TikTok Cut Template

```
Duration: 13-17s
Words: 30-40
Format: F (Quick Tip) or compressed D (Myth Buster)
Hook: Pattern Interrupt or Myth/Contrarian (highest engagement for 15s format)
Structure:
  [0-2s]  Hook (text overlay + spoken)
  [2-10s] The single insight
  [10-13s] Why it matters (one line)
  [13-15s] CTA (save this / follow / share)
```

#### 30s Instagram Reel Template

```
Duration: 28-32s
Words: 70-80
Format: B (Checklist) or D (Myth Buster) or compressed A (Explainer)
Hook: Question or Emotional Story (saves-optimized)
Structure:
  [0-2s]  Hook
  [2-20s] Core value (2-3 points or a complete problem/solution)
  [20-27s] Implication / why you should care
  [27-30s] CTA (save this for when you need it)
```

#### 60s YouTube Short Template

```
Duration: 55-65s
Words: 140-160
Format: A (Explainer) or E (Walkthrough)
Hook: Question or Statistic (retention-optimized)
Structure:
  [0-3s]  Hook
  [3-40s] Educational core (3-4 clear points)
  [40-55s] Takeaway and context
  [55-60s] CTA (subscribe / comment / related video)
```

---

### Step 4: Output All Variants

```markdown
# Repurpose Plan: [Source Video Code/Title]

**Source:** [video code or description]
**Original duration:** [N] minutes
**Variants produced:** 3 (15s TikTok, 30s IG Reel, 60s YouTube Short)

---

## Variant 1: 15s TikTok Cut

[Full output per template above]

---

## Variant 2: 30s Instagram Reel

[Full output per template above]

---

## Variant 3: 60s YouTube Short

[Full output per template above]

---

## What to Shoot (if additional footage needed)

[List any new shots not in the original production plan]

## Caption Notes

Run `/caption-writer [source code]-tiktok`, `/caption-writer [source code]-reel`, and `/caption-writer [source code]-short` to generate post copy for each variant.

Or paste the hook and key takeaway from each variant directly into `/caption-writer`.
```

### Step 5: Save Repurpose Plan

Save to:
```
industries/chiropractic/production-plans/[source-code]-repurpose.md
```

## Compression Principles

**What to keep:**
- The single most surprising or counterintuitive claim
- The practical "what to do" instruction
- The emotional hook that makes it personal

**What to cut:**
- Setup and context (long-form earns this; short-form can't afford it)
- Secondary examples (keep the best one)
- Qualifications and caveats (save for captions or comments)
- Transitions between sections

**What to replace:**
- Long-form hooks with short-form pattern interrupts
- Gradual builds with immediate payoffs
- Multi-part CTAs with single, specific actions

## Quality Rules

- [ ] Each variant can stand alone — no "as I mentioned earlier" references
- [ ] Hook is completely rewritten for short-form (not copied from long-form)
- [ ] Word count matches target duration (±10%)
- [ ] No emdashes anywhere
- [ ] CTA is platform-specific (saves for IG, shares/comments for TikTok, subscribe for YT)
- [ ] The best insight from the original is in position #1, not buried at 30s

## Integration

```
/video-director     → Produces the long-form plan (source for this skill)
/repurpose          → THIS SKILL: extracts 3 short-form variants
/caption-writer     → Generates post copy for each variant
/hook-variations    → If you want options for the variant hooks before writing
Dashboard           → Create separate video entries for each variant (suffix: -tiktok, -reel, -short)
```
