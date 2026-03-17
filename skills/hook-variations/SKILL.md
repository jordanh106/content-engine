---
name: hook-variations
description: Generate 10 performance-weighted hook variations for a video topic. Uses real performance data from the dashboard to rank hooks by predicted save rate, not just creative preference.
argument-hint: "[topic] for [platform] as [format A-G]"
context: fork
agent: default
allowed-tools: Bash, Read, Write
---

# Hook Variations: Data-Weighted Hook Generation

Generate 10 hook options for a video topic — ranked by predicted save rate based on your actual audience data, not AI guesses.

## When to Use

- Before committing to a hook in `/video-director`
- When a video isn't performing and you're considering a re-hook
- When planning a series and want the strongest possible first-video hook
- Any time you want options ranked by evidence rather than instinct

## What It Does

1. Reads recent performance data from the dashboard
2. Reads your proven hook patterns from hook-patterns.md
3. Generates 10 hook variations across all 6 hook archetypes
4. Ranks them by predicted save rate (based on historical pattern performance)
5. Labels each with confidence level and risk/reward profile

## Step-by-Step Process

### Step 1: Load Context

Read these files:
- `industries/chiropractic/hook-patterns.md` — all hook categories, archetypes, and patterns
- `industries/chiropractic/brand.md` — voice, tone, humor rules
- `industries/chiropractic/config.json` — audiences and conditions
- `industries/chiropractic/strategy-optimizer/` — most recent performance report (if exists)

### Step 2: Get Performance Data

Check if a recent `/performance-review` report exists in `strategy-optimizer/`:
```bash
ls -t industries/chiropractic/strategy-optimizer/performance-*.md 2>/dev/null | head -1
```

If found and less than 14 days old, read the "Top Hook Patterns" table from it.

If no data exists yet, note this and proceed without performance weighting (label all hooks as "No data — run /performance-review to enable scoring").

### Step 3: Extract Performance Weights

From the performance report, build a lookup table:

```
hook_pattern | platform | avg_save_rate | confidence
question     | instagram | 18.2%        | HIGH (n=8)
myth         | tiktok    | 22.1%        | MEDIUM (n=4)
statistic    | instagram | 11.3%        | HIGH (n=6)
...
```

If the target platform has no data for a hook type, use the cross-platform average or mark as "Untested."

### Step 4: Generate 10 Variations

For the given topic, generate exactly 10 hooks covering all 6 archetypes from hook-patterns.md:

**Archetypes to cover:**
1. Question Hook — direct audience question creating curiosity gap
2. Statistic/Surprising Fact Hook — data or number that reframes the topic
3. Myth/Contrarian Hook — challenges conventional belief
4. Emotional/Story Hook — opens with a moment or feeling
5. Pattern Interrupt Hook — breaks expected format (starts mid-sentence, unusual premise)
6. "Did You Know" / Discovery Hook — positions creator as guide to hidden knowledge

Generate at least 1-2 variations per archetype, more for archetypes with proven performance data.

**For each hook, include:**
- The hook text (ready to say verbatim)
- Archetype category
- Platform optimization notes (text overlay copy if under 8 words for TikTok)
- Predicted save rate or "Untested"
- Confidence level (HIGH/MEDIUM/LOW/UNTESTED)
- Risk/Reward profile: SAFE (proven), EXPERIMENT (less data, upside potential), WILD CARD (untested archetype)

### Step 5: Output the Ranked List

Sort by predicted save rate (high to low), with UNTESTED hooks listed separately at the end.

```markdown
# Hook Variations: [Topic]
**Platform:** [platform] | **Format:** [A-G] | **Target audience:** [audience segment]

---

## Ranked by Predicted Save Rate

### 1. [Hook text]
**Category:** Myth/Contrarian
**Predicted save rate:** 22.1% (based on 4 previous Myth hooks on TikTok)
**Confidence:** MEDIUM
**Profile:** EXPERIMENT — fewer data points but trending up
**TikTok text overlay:** "[Under 8 words]"
**Why this works:** [1 sentence on psychological mechanism]

---

### 2. [Hook text]
**Category:** Question
**Predicted save rate:** 18.2% (based on 8 previous Question hooks on Instagram)
**Confidence:** HIGH
**Profile:** SAFE — proven performer, consistent results
**Platform note:** [delivery note]
**Why this works:** [1 sentence]

---

[... continue through all 10 ...]

---

## Untested / No Data

### 9. [Hook text]
**Category:** Pattern Interrupt
**Predicted save rate:** Unknown — no history for this archetype on [platform]
**Confidence:** UNTESTED
**Profile:** WILD CARD — could outperform or underperform significantly
**Why this could work:** [creative rationale]

---

## My Pick

**Primary recommendation:** #[N] — [Hook text]
**Reasoning:** [1-2 sentences on why this specific combination of archetype, topic, and audience should work]

**Test pair:** If you want to A/B test, pair #[N] (SAFE) with #[N] (EXPERIMENT) — close enough in topic to be comparable, different enough in archetype to generate real signal for /performance-review.
```

## Important Notes

- **Platform matters**: Don't generate platform-agnostic hooks. Every hook should be optimized for the specific platform, especially TikTok (text overlay length) vs. Instagram (visual-first setup) vs. YouTube (longer setup acceptable).
- **Topic specificity**: Generic hooks underperform. "Are you doing this wrong?" is weaker than "Are you holding your newborn in a way that's actually straining their spine?"
- **Brand voice**: Read brand.md before writing. Jordan's voice is deadpan, warm, never begging. Hooks that "beg" for engagement underperform in this niche.
- **6-word rule for TikTok text overlay**: If the hook exceeds 6 words, provide a shortened version for the text overlay. Long overlays get scrolled past.
- **Kallaway Framework**: Apply the 4-component alignment from hook-patterns.md — Visual → Text → Spoken → Audio — when specifying how each hook should be delivered. Text overlay should precede spoken word by 0.5-1s on TikTok.

## Integration

```
/performance-review     → Run first to populate save rate data
/hook-variations        → THIS SKILL generates ranked options
/video-director         → Takes the chosen hook as primary; uses others as variations
strategy-optimizer      → Learns from which hook you chose and how it performed
```
