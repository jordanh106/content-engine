---
name: viral-scout
description: Discover top-performing viral videos in your niche across TikTok, Instagram Reels, and YouTube Shorts. Extracts hook patterns, format trends, and engagement signals. Builds a cumulative pattern database.
argument-hint: "[niche/topic]" or "[niche] [platform]" or just run for active industry
context: fork
agent: Explore
allowed-tools: Bash, Read, Write, WebSearch, AskUserQuestion
---

# Viral Scout: Niche Content Discovery

Find top-performing short-form videos in your niche, extract what makes them work, and build a local pattern database that improves your content strategy over time.

## When to Use

- Weekly, before running `/content-planner` to inform the next calendar
- When entering a new topic area or audience segment
- When content performance plateaus and you need fresh patterns
- After a competitor posts something that clearly outperforms the norm

## What It Does

1. Searches for top-performing videos in your niche across platforms
2. Extracts patterns: hook type, format, duration, engagement signals
3. Identifies outlier content (videos that significantly overperform their creator's average)
4. Categorizes findings by hook type, content pillar, audience, and platform
5. Updates the cumulative pattern file with recurring trends
6. Saves individual scout reports with dated findings

## How to Use

### Basic (uses active industry)
```
/viral-scout
```

### With niche keyword
```
/viral-scout chiropractic
/viral-scout pediatric chiropractic
/viral-scout posture correction
```

### Platform-specific
```
/viral-scout chiropractic tiktok
/viral-scout back pain instagram
/viral-scout spine health youtube
```

### Deep dive on a specific trend
```
/viral-scout "neck cracking ASMR"
/viral-scout "before and after posture"
```

## Step-by-Step Process

### Step 1: Load Context

Read these files (paths relative to content-engine repo root):
- `industries/<industry>/config.json` - Audiences, conditions, platforms
- `industries/<industry>/hook-patterns.md` - Existing hook pattern library (to avoid duplicating known patterns)
- `industries/<industry>/viral-insights/patterns.md` - Cumulative patterns (if exists)

### Step 2: Search for Top Content

Run multiple web searches targeting different angles:

**Search queries to run (adapt to niche):**
1. `"viral [niche] tiktok [current year]"` - Platform-specific viral content
2. `"top [niche] reels [current month] [current year]"` - Recent top performers
3. `"most saved [niche] short form video"` - High-save content (algorithmic gold)
4. `"[niche] content creator millions views"` - Outlier content analysis
5. `"trending [niche] video hooks"` - Hook-specific trends
6. `"[specific audience] [niche] viral"` - Audience-targeted content (e.g., "pregnancy chiropractic viral")

For each search, extract:
- Video topic and angle
- Hook style (first 1-3 seconds: question, stat, myth, story, pattern interrupt)
- Estimated duration
- Platform it performed on
- Engagement signals (views, likes, saves, shares mentioned)
- What made it stand out (visual style, pacing, controversy, relatability)

### Step 3: Analyze Patterns

Group findings by:

**Hook patterns** - Which hook types appear most in top content?
| Hook Type | Frequency | Avg Engagement | Best Platform |
|-----------|-----------|---------------|---------------|

**Format trends** - What content structures are working?
| Format | Description | Our Format Match (A-G) | Frequency |
|--------|-------------|----------------------|-----------|

**Topic hotspots** - What topics are over-indexing right now?
| Topic | Platform | Why It's Hot | Our Audience Match |
|-------|----------|-------------|-------------------|

**Visual/editing trends** - What production styles are trending?
| Trend | Description | How We Can Apply |
|-------|-------------|-----------------|

### Step 4: Score Relevance

For each finding, score on three dimensions:
- **Relevance** (1-5): How close is this to our niche and audience?
- **Adaptability** (1-5): How easily can we create our version?
- **Timeliness** (1-5): Is this trending now or evergreen?

Focus the report on findings scoring 10+ total.

### Step 5: Update Pattern Database

**Append to cumulative patterns file:** `industries/<industry>/viral-insights/patterns.md`

Only add patterns that:
- Appear in 3+ separate viral videos (not one-offs)
- Score 10+ on the relevance scale
- Are not already in the hook-patterns.md library

**If a truly new hook pattern is discovered**, add it to `industries/<industry>/hook-patterns.md` in the appropriate category.

### Step 6: Generate Recommendations

For each high-scoring pattern, output:
1. **Content idea** - A specific video concept adapted to our brand
2. **Suggested format** (A-G)
3. **Hook** - Written in our brand voice using the pattern
4. **Platform** - Where to publish first
5. **Priority** - High/Medium/Low based on timeliness

### Step 7: Save and Offer Next Steps

Save the scout report to:
```
industries/<industry>/viral-insights/scout-YYYY-MM-DD.md
```

Offer:
1. "Want me to add the top ideas to the idea bank?" (-> appends to `idea-bank.md`)
2. "Want me to build a content calendar from these?" (-> `/content-planner`)
3. "Want a full production plan for any of these?" (-> `/video-director`)
4. "Want to deep dive on a specific creator?" (-> `/creator-analysis`)

## Output Format

### Scout Report Structure

```markdown
# Viral Scout Report - [Date]

**Niche:** [niche]
**Platforms searched:** [platforms]
**Videos analyzed:** [count]

## Top Patterns This Period

### 1. [Pattern Name]
- **Hook type:** [question/stat/myth/story/interrupt]
- **Example:** "[actual hook from viral video]"
- **Why it works:** [analysis]
- **Our adaptation:** "[hook rewritten in our voice]"
- **Suggested format:** [A-G]
- **Platform:** [platform]
- **Priority:** [High/Medium/Low]

### 2. ...

## Format Trends
[table of trending formats and their match to A-G]

## Topic Hotspots
[table of trending topics with audience match]

## New Hook Patterns Discovered
[any patterns not yet in hook-patterns.md]

## Recommendations
[5-10 specific content ideas ranked by priority]
```

## Integration with Other Skills

```
/viral-scout          -> THIS SKILL discovers patterns
/creator-analysis     -> Deep dive on specific creators found
/content-planner      -> Uses patterns to inform calendar
/video-director       -> Uses hooks and formats for production plans
/last30days           -> Complementary: topics vs. video patterns
```
