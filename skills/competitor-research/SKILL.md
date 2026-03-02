---
name: competitor-research
description: Broad competitive landscape analysis for your niche. Identifies top creators, content trends, audience gaps, and positioning opportunities across platforms.
argument-hint: "[niche]" or "[niche] [platform]" or just run for active industry
context: fork
agent: Explore
allowed-tools: Bash, Read, Write, WebSearch, AskUserQuestion
---

# Competitor Research: Landscape Analysis

Map the competitive landscape for your niche. Identify who's winning, what's working, where the gaps are, and how to position your content to stand out.

## When to Use

- When starting content creation in a new niche
- Quarterly, to reassess the competitive landscape
- When entering a new platform (e.g., starting TikTok)
- When engagement stalls and you need strategic direction

## What It Does

1. Identifies the top 10-15 creators in your niche across platforms
2. Maps the content landscape: what topics are covered, what's missing
3. Analyzes engagement benchmarks (what's "good" in this niche)
4. Identifies positioning opportunities and underserved audiences
5. Produces a competitive brief with strategic recommendations

## How to Use

### Basic (uses active industry)
```
/competitor-research
```

### With niche specified
```
/competitor-research chiropractic
/competitor-research pediatric chiropractic tiktok
/competitor-research family wellness
```

### Platform-specific landscape
```
/competitor-research chiropractic instagram
/competitor-research chiropractic tiktok
```

## Step-by-Step Process

### Step 1: Load Context

Read these files:
- `industries/<industry>/config.json` - Our audiences, platforms, positioning
- `industries/<industry>/brand.md` - Our voice and differentiation
- `industries/<industry>/watchlist.md` - Already-tracked creators
- `industries/<industry>/content-library.md` - Our existing content (first section only, for topic coverage)

### Step 2: Research the Landscape

Run web searches to map the field:

1. `"top [niche] content creators [platform] [current year]"` - Major players
2. `"best [niche] accounts to follow [platform]"` - Curated lists
3. `"[niche] content trends [current year]"` - What's working across the niche
4. `"[niche] [specific audience] content [platform]"` - Audience-specific landscape (e.g., "prenatal chiropractic tiktok")
5. `"[niche] engagement rate benchmarks [platform]"` - Performance baselines
6. `"[niche] content strategy tips"` - Published strategies from niche leaders

### Step 3: Map Creators

Build a landscape map:

| Creator | Platform | Followers | Engagement Rate | Content Focus | Hook Style | Posting Freq |
|---------|----------|-----------|----------------|---------------|------------|--------------|

Categorize creators by tier:
- **Top tier** (100K+ followers): Market leaders, set trends
- **Mid tier** (10K-100K): Consistent performers, niche authority
- **Rising** (<10K but high engagement): Worth watching, may signal trends

### Step 4: Content Gap Analysis

Compare what the landscape covers vs. what's underserved:

| Topic/Audience | Coverage Level | Top Creator Covering It | Opportunity |
|---------------|---------------|------------------------|-------------|
| [audience from config] | Saturated/Moderate/Low/None | [who] | [what we could do differently] |

**Saturated areas** (everyone covers): Find a unique angle or avoid
**Underserved areas** (few or no creators): Opportunity to own the space
**Emerging areas** (growing but not crowded): Best timing to enter

### Step 5: Engagement Benchmarks

Establish what "good" looks like in this niche:

| Metric | Platform | Low | Average | High | Top 1% |
|--------|----------|-----|---------|------|--------|
| Views | TikTok | | | | |
| Engagement rate | Instagram | | | | |
| Save rate | Instagram | | | | |
| Comments | YouTube Shorts | | | | |

### Step 6: Positioning Recommendations

Based on the landscape analysis, recommend:

1. **Differentiation angle:** How to stand out from the pack
2. **Underserved audiences:** Which audience segments to prioritize
3. **Platform strategy:** Where to focus based on competition density
4. **Content type gaps:** Which formats (A-G) are underused by competitors
5. **Hook strategy:** Which hook types are overused vs. underused
6. **Posting cadence:** How our frequency compares and whether to adjust

### Step 7: Save and Offer Next Steps

Save to: `industries/<industry>/competitor-landscape-YYYY-MM-DD.md`

Suggest creators to add to `watchlist.md` for ongoing tracking.

Offer:
1. "Want me to add top creators to the watchlist?" (-> updates `watchlist.md`)
2. "Want me to deep-dive on any specific creator?" (-> `/creator-analysis`)
3. "Want me to scout for viral content in the gaps I found?" (-> `/viral-scout`)
4. "Want me to build a content calendar based on these opportunities?" (-> `/content-planner`)

## Output Format

```markdown
# Competitive Landscape: [Niche]

**Date:** [date]
**Platforms analyzed:** [platforms]
**Creators identified:** [count]

## Landscape Overview
[3-5 sentence summary of the competitive landscape]

## Top Creators

### Top Tier (100K+)
| Creator | Platform | Followers | Focus | Strength |
|---------|----------|-----------|-------|----------|

### Mid Tier (10K-100K)
| Creator | Platform | Followers | Focus | Strength |
|---------|----------|-----------|-------|----------|

### Rising
| Creator | Platform | Followers | Focus | Why Watching |
|---------|----------|-----------|-------|-------------|

## Content Gap Analysis
| Area | Coverage | Opportunity | Our Advantage |
|------|----------|-------------|---------------|

## Engagement Benchmarks
[platform-specific benchmark tables]

## Positioning Recommendations
1. **Differentiation:** ...
2. **Audiences to prioritize:** ...
3. **Platform focus:** ...
4. **Format gaps:** ...
5. **Hook strategy:** ...

## Suggested Watchlist Additions
| Creator | Platform | Why |
|---------|----------|-----|

## Action Items
1. ...
```

## Integration with Other Skills

```
/competitor-research  -> THIS SKILL maps the landscape
/creator-analysis     -> Deep-dives on specific creators found
/viral-scout          -> Discovers viral content in identified gaps
/content-planner      -> Uses positioning insights for calendar
```
