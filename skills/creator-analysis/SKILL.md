---
name: creator-analysis
description: Analyze a specific content creator's patterns, hooks, formats, and engagement. Builds a creator profile with actionable insights. Run on a single creator or the full watchlist.
argument-hint: "@handle" or "--watchlist" or "[creator name] [platform]"
context: fork
agent: Explore
allowed-tools: Bash, Read, Write, WebSearch, AskUserQuestion
---

# Creator Analysis: Competitor & Inspiration Research

Deep-dive analysis of a specific content creator's strategy. Extracts hook patterns, format preferences, posting cadence, engagement signals, and content gaps you can fill.

## When to Use

- When you discover a creator doing well in your niche
- Periodically (monthly) to analyze watchlist creators
- Before entering a new content topic to see who's already there
- When your engagement drops and you need competitive intelligence

## What It Does

1. Searches for the creator's recent content across platforms
2. Analyzes their hook patterns, formats, and posting cadence
3. Identifies their top-performing content and what made it work
4. Spots content gaps they're not covering that you can own
5. Extracts reusable patterns adapted to your brand voice
6. Saves the analysis for future reference

## How to Use

### Single creator
```
/creator-analysis @drjason_dc
/creator-analysis "Dr. Jason chiropractic" tiktok
```

### Full watchlist
```
/creator-analysis --watchlist
```
Runs analysis on all creators in `industries/<industry>/watchlist.md`.

### Quick comparison
```
/creator-analysis @creator1 vs @creator2
```

## Step-by-Step Process

### Step 1: Load Context

Read these files:
- `industries/<industry>/watchlist.md` - Current watchlist
- `industries/<industry>/hook-patterns.md` - Known hook patterns (to identify what they use)
- `industries/<industry>/config.json` - Our audiences and platforms

If analyzing a watchlist creator, read their existing profile:
- `industries/<industry>/creator-insights/<handle>.md` (if exists, compare new vs. old)

### Step 2: Research the Creator

Run web searches:
1. `"[handle] [platform] most popular videos"` - Their top content
2. `"[handle] [platform] [current year]"` - Recent content
3. `"[handle] followers engagement"` - Audience size and engagement rate
4. `"[handle] content strategy"` or `"[handle] interview"` - Any public discussion of their approach

Extract:
- **Profile overview:** Follower count, platform focus, niche positioning
- **Top 5-10 videos:** Topic, hook, estimated views/engagement, format type
- **Posting frequency:** How often, which platforms, consistency
- **Content themes:** What topics they cover repeatedly
- **Visual style:** Editing pace, text overlays, color grading, on-camera vs. voiceover

### Step 3: Pattern Analysis

**Hook patterns used:**
| Hook Type | Frequency | Example | Performance |
|-----------|-----------|---------|-------------|

**Format preferences:**
| Content Type | Our Format Match | Frequency | Notes |
|-------------|-----------------|-----------|-------|

**Content pillars:**
| Pillar | % of Content | Performance | Notes |
|--------|-------------|-------------|-------|

**Posting cadence:**
| Platform | Frequency | Best Day/Time | Notes |
|----------|-----------|---------------|-------|

### Step 4: Identify Opportunities

**What they do well (learn from):**
- List 3-5 specific strengths with examples

**What they don't cover (gaps to fill):**
- List audiences, topics, or formats they ignore
- These are opportunities for differentiation

**Hooks worth adapting:**
- List 3-5 hook patterns from their best content, rewritten in our brand voice

**Format ideas:**
- List any creative format approaches worth testing

### Step 5: Save Analysis

Save to: `industries/<industry>/creator-insights/<handle>.md`

Update `industries/<industry>/watchlist.md` with the "Last Analyzed" date.

If new hook patterns are discovered, suggest additions to `hook-patterns.md`.
If content ideas emerge, suggest additions to `idea-bank.md`.

### Step 6: Offer Next Steps

1. "Want me to add these hooks to the hook pattern library?"
2. "Want me to add content ideas to the idea bank?"
3. "Want me to add this creator to the watchlist?" (if not already on it)
4. "Want me to analyze another creator?"
5. "Want me to run a full watchlist analysis?"

## Output Format

### Creator Profile Structure

```markdown
# Creator Analysis: [Handle]

**Platform:** [primary platform]
**Followers:** [count]
**Niche:** [their positioning]
**Analyzed:** [date]

## Overview
[2-3 sentence summary of who they are and what they do]

## Top Performing Content
| # | Topic | Hook | Est. Views | Hook Type | Our Format |
|---|-------|------|-----------|-----------|------------|
| 1 | | | | | |

## Patterns
### Hook Preferences
[table of hook types they use most]

### Format Preferences
[table of content types mapped to our A-G]

### Posting Cadence
[frequency and platforms]

## Strengths (Learn From)
1. ...

## Gaps (Opportunities for Us)
1. ...

## Hooks Worth Adapting
| Their Hook | Our Version | Format | Platform |
|-----------|-------------|--------|----------|

## Content Ideas Inspired By This Creator
| Idea | Format | Hook Angle | Priority |
|------|--------|------------|----------|
```

## Integration with Other Skills

```
/viral-scout          -> Discovers creators worth analyzing
/creator-analysis     -> THIS SKILL deep-dives on creators
/content-planner      -> Uses insights to inform calendar
/video-director       -> Uses adapted hooks in production plans
```
