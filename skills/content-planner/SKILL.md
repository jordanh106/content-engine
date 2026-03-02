---
name: content-planner
description: Turn research into a weekly content calendar. Reads /last30days output, industry config, and format templates to produce a structured content plan with format assignments and platform targeting.
argument-hint: "[industry] [week/month]" or just run after /last30days
context: fork
agent: Explore
allowed-tools: Bash, Read, Write, WebSearch, AskUserQuestion
---

# Content Planner: Research to Calendar

Transform trending topic research into a structured weekly content calendar.

## When to Use

- After running `/last30days [topic]` and reviewing the research output
- At the start of each week or month to plan content
- When you need to fill gaps in your content calendar
- When pivoting to cover trending topics quickly

## What It Does

1. Reads the most recent `/last30days` research output (if available)
2. Loads the active industry config from the content-engine repo
3. Cross-references trending topics against the existing content library
4. Produces a weekly content plan with:
   - Topic assignments for each posting slot
   - Format assignments (A-G) for each video
   - Platform targeting (which format goes where)
   - Priority scoring based on trend strength and content gaps

## How to Use

### Basic Usage
```
/content-planner
```
Reads the most recent last30days context file and the active industry config.

### With Industry Specified
```
/content-planner chiropractic
/content-planner dental
```

### With Time Range
```
/content-planner chiropractic this-week
/content-planner chiropractic february
```

## Step-by-Step Process

### Step 1: Load Context

Read these files (paths relative to the content-engine repo root):
- `industries/<industry>/config.json` - Audiences, conditions, platforms, posting cadence
- `industries/<industry>/content-library.md` - Existing video scripts (to avoid duplication)
- `industries/<industry>/brand.md` - Voice and content rules
- `industries/<industry>/hook-patterns.md` - Proven hook patterns by type and platform
- `industries/<industry>/idea-bank.md` - Staged content ideas awaiting scheduling
- `formats/*.md` - Available format templates

Check for optional intelligence sources:
```bash
cat ~/.local/share/last30days/out/last30days.context.md 2>/dev/null
ls industries/<industry>/viral-insights/scout-*.md 2>/dev/null | tail -1
ls industries/<industry>/viral-insights/patterns.md 2>/dev/null
```

If recent `/last30days` output exists, use it. If recent `/viral-scout` output exists, cross-reference patterns. If neither exists, suggest running `/last30days` or `/viral-scout` first, or proceed with evergreen content planning from the idea bank.

### Step 2: Identify Content Opportunities

Cross-reference these sources in priority order:

1. **Idea bank** - Check `idea-bank.md` for high-priority staged ideas first
2. **Viral patterns** - Check `viral-insights/patterns.md` for trending patterns to ride
3. **Trending topics** - From `/last30days` research (if available)
4. **Content gaps** - Conditions/topics in config.json that don't have videos in content-library.md yet
5. **Seasonal relevance** - Time-of-year appropriate topics
6. **Platform balance** - Ensure the week covers all target platforms (including TikTok)
7. **Performance data** - If `performance-log.md` exists, prioritize formats and hook types that historically perform well

### Step 3: Assign Formats

For each content opportunity, assign the best format:

| Topic Type | Recommended Format |
|-----------|-------------------|
| Explaining a condition or concept | A (Explainer) |
| Warning signs, symptoms, red flags | B (Checklist) |
| Practical exercise or technique | C (Demo) |
| Common misconception | D (Myth Buster) |
| Service/procedure walkthrough | E (Walkthrough) |
| Quick tip, "did you know", single fact | F (Quick Tip) |
| Patient testimonial, journey, social proof | G (Patient Story) |

### Step 4: Build the Calendar

Output a structured weekly plan. Each entry should reference a hook pattern from `hook-patterns.md`:

```
## Week of [Date]

### Monday - Instagram Reels
**Topic:** [Topic name]
**Format:** B (Checklist)
**Audience:** [Target audience from config]
**Hook:** [Suggested hook line]
**Hook pattern:** [Pattern type from hook-patterns.md, e.g., "Question Hook: Why does your..."]
**Trending signal:** [What from the research supports this topic]
**Source:** [idea-bank / viral-scout / last30days / content-gap / evergreen]

### Tuesday - TikTok
**Topic:** [Quick tip or myth buster]
**Format:** F (Quick Tip) or D (Myth Buster)
**Hook:** [Text-heavy hook optimized for TikTok]
**Hook pattern:** [Pattern type]

### Wednesday - YouTube Shorts
**Topic:** [Topic name]
**Format:** A (Explainer)
**Hook:** [Educational/question hook]
**Hook pattern:** [Pattern type]
...
```

**Platform distribution target per week:**
- Instagram Reels: 4-5 posts
- TikTok: 3-5 posts (primarily Format F and D)
- YouTube Shorts: 2-3 posts
- YouTube Long-form: 1 post
- Instagram Stories: Daily (not in calendar, organic)

### Step 5: Offer Next Steps

After presenting the calendar:

1. Move any idea-bank items that were scheduled to the "Archived" section of `idea-bank.md`
2. Ask:
   - "Want me to generate a full production plan for any of these?" (-> `/video-director`)
   - "Want to swap any topics or formats?"
   - "Should I research a specific topic deeper?" (-> `/last30days [topic] --deep`)
   - "Want me to scout for viral content in any of these topics?" (-> `/viral-scout`)

## Output Format

The calendar should be saved to:
```
industries/<industry>/calendar-week-YYYY-MM-DD.md
```

## Integration with Other Skills

```
/last30days [topic]       → Topic research feeds into this skill
/viral-scout [niche]      → Viral pattern research feeds into this skill
/creator-analysis         → Competitor insights feed into this skill
/competitor-research      → Landscape analysis informs positioning
/content-planner          → THIS SKILL produces the calendar
/video-director           → Takes individual calendar entries and produces full production plans
```
