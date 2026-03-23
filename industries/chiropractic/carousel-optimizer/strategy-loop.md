# Autoresearch: Carousel Content Strategy Optimization Loop

Run with: `/autoresearch` then provide these parameters inline.

## Configuration

```
Goal: Optimize carousel content strategy for maximum saves and shares
Scope: industries/chiropractic/carousel-strategy.md
Metric: composite engagement score for latest strategy version
Direction: higher is better
Verify: curl -s http://localhost:3001/api/carousels/metrics/score?strategyVersion=current | jq '.compositeScore'
Guard: node -e "const fs = require('fs'); const c = fs.readFileSync('industries/chiropractic/carousel-strategy.md','utf-8'); if(!c.includes('## Hook Patterns')) throw new Error('Missing required section');"
Iterations: 15
```

## What the Loop Modifies Per Iteration

The single editable asset is `industries/chiropractic/carousel-strategy.md`.

### Optimization Dimensions

Each iteration should modify ONE of these sections:

1. **Hook pattern rankings** - Reorder based on which patterns drive the most saves
2. **Slide count recommendations** - Adjust optimal count per platform (e.g., 5 vs 7 vs 10)
3. **Copy length targets** - Shorten or lengthen word counts per slide type
4. **CTA wording selection** - Promote CTAs with higher composite scores, demote underperformers
5. **Content structure by topic type** - Reorder slide flow, add/remove structural elements
6. **Formatting rules** - Emoji usage, capitalization, sentence structure
7. **Audience-specific adjustments** - Refine language and tone per demographic
8. **Visual-content alignment rules** - Tighten or relax constraints

### Constraints

- The file must remain valid Markdown
- All section headers (## level) must be preserved (downstream parsers may reference them)
- Hook patterns must include: pattern name, example, best platform, and why it works
- CTA wording must include percentage allocation per platform
- No emojis in examples (matches brand guidelines)

## How to Run

```bash
# Check current score baseline
curl -s http://localhost:3001/api/carousels/metrics/score | jq '.'

# Run the loop
/autoresearch
# When prompted, paste the configuration block above
```

## Reading Performance Data Before Each Iteration

Before modifying the strategy, the loop should check:

1. Current composite score: `curl -s http://localhost:3001/api/carousels/metrics/score`
2. Score by version: `curl -s http://localhost:3001/api/carousels/metrics/by-version`
3. Recent experiments: `curl -s http://localhost:3001/api/carousels/experiments`

This data informs which changes to try next. If saves are low, promote save-oriented hooks and CTAs. If shares are low, promote share-trigger CTAs and social currency hooks.

## Git as Memory

Each kept change is committed with a message describing what was modified and the resulting score delta. The git log of `carousel-strategy.md` becomes a record of content strategy evolution. The experiment log at `/api/carousels/experiments` maps strategy versions to composite scores.
