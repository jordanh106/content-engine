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
- `formats/*.md` - Available format templates

Check for recent last30days output:
```bash
cat ~/.local/share/last30days/out/last30days.context.md 2>/dev/null
```

If no recent research exists, suggest running `/last30days [industry] content trends` first, or proceed with evergreen content planning.

### Step 2: Identify Content Opportunities

Cross-reference:
- **Trending topics** from last30days research (if available)
- **Content gaps** - conditions/topics in config.json that don't have videos in content-library.md yet
- **Seasonal relevance** - time-of-year appropriate topics
- **Platform balance** - ensure the week covers all target platforms

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

Output a structured weekly plan:

```
## Week of [Date]

### Monday - Instagram Reels
**Topic:** [Topic name]
**Format:** B (Checklist)
**Audience:** [Target audience from config]
**Hook:** [Suggested hook line]
**Trending signal:** [What from the research supports this topic]

### Tuesday - Real Footage Day
**Topic:** [Behind the scenes / patient interaction / personality content]
**Notes:** [Filming notes]

### Wednesday - YouTube Shorts
**Topic:** [Topic name]
**Format:** A (Explainer)
...
```

### Step 5: Offer Next Steps

After presenting the calendar, ask:
1. "Want me to generate a full production plan for any of these?" (→ `/video-director`)
2. "Want to swap any topics or formats?"
3. "Should I research a specific topic deeper?" (→ `/last30days [topic] --deep`)

## Output Format

The calendar should be saved to:
```
industries/<industry>/calendar-week-YYYY-MM-DD.md
```

## Integration with Other Skills

```
/last30days [topic]     → Research feeds into this skill
/content-planner        → THIS SKILL produces the calendar
/video-director         → Takes individual calendar entries and produces full production plans
```
