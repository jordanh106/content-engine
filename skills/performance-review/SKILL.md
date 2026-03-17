---
name: performance-review
description: Read real performance metrics from the dashboard database and compute which hook patterns, formats, and audience segments are winning. Outputs a data-driven strategy report that informs content planning.
argument-hint: "[optional: --platform instagram|tiktok|youtube] [--days 30]"
context: fork
agent: default
allowed-tools: Bash, Read, Write
---

# Performance Review: What's Actually Working

Read the dashboard's performance metrics and produce an evidence-based strategy report. This is the foundation of the self-improving content engine: it connects what you published to what performed, so every future planning session starts with real signal instead of guesswork.

## When to Use

- Before every `/content-planner` session (to inform which hooks and formats to prioritize)
- After running `strategy-optimizer` (to validate proposed changes)
- Before invoking `/hook-variations` (to get performance-weighted output)
- Weekly, after n8n Watchlist Intelligence runs

## What It Does

1. Queries the SQLite dashboard database for performance metrics
2. Joins metrics to video metadata (format, audience, hook pattern)
3. Computes weighted engagement score: `(0.4 × save_rate) + (0.3 × share_rate) + (0.3 × comment_rate)`
4. Ranks: hook patterns, formats, audience segments, and platforms by weighted engagement
5. Identifies patterns: what's consistently outperforming, what's underperforming
6. Outputs a structured "What's Working" report
7. Optionally saves report to `industries/<industry>/strategy-optimizer/results.md`

## Step-by-Step Process

### Step 1: Find the Database

The dashboard SQLite database is at:
```
packages/dashboard/data/dashboard.db
```

Use sqlite3 CLI to query it:
```bash
sqlite3 packages/dashboard/data/dashboard.db
```

If sqlite3 is not available, use the Node.js approach:
```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('packages/dashboard/data/dashboard.db');
// ... queries
"
```

### Step 2: Pull the Core Data

Run these queries to gather the performance picture:

**Query 1: Raw metrics with video metadata**
```sql
SELECT
  pm.video_code,
  pm.platform,
  pm.recorded_at,
  pm.views,
  pm.likes,
  pm.saves,
  pm.shares,
  pm.comments,
  pm.hook_pattern_used,
  pm.format_id,
  vs.production_style,
  vs.source_idea_topic
FROM performance_metrics pm
LEFT JOIN video_status vs ON pm.video_code = vs.video_code
WHERE pm.recorded_at >= date('now', '-30 days')
ORDER BY pm.recorded_at DESC;
```

**Query 2: Hook pattern performance (if hook_pattern_used is populated)**
```sql
SELECT
  hook_pattern_used,
  platform,
  COUNT(*) as video_count,
  AVG(CAST(saves AS FLOAT) / NULLIF(views, 0)) as avg_save_rate,
  AVG(CAST(shares AS FLOAT) / NULLIF(views, 0)) as avg_share_rate,
  AVG(CAST(comments AS FLOAT) / NULLIF(views, 0)) as avg_comment_rate
FROM performance_metrics
WHERE hook_pattern_used IS NOT NULL AND views > 0
GROUP BY hook_pattern_used, platform
ORDER BY avg_save_rate DESC;
```

**Query 3: Format performance**
```sql
SELECT
  pm.format_id,
  pm.platform,
  COUNT(*) as video_count,
  AVG(pm.views) as avg_views,
  AVG(CAST(pm.saves AS FLOAT) / NULLIF(pm.views, 0)) as avg_save_rate,
  AVG(CAST(pm.shares AS FLOAT) / NULLIF(pm.views, 0)) as avg_share_rate
FROM performance_metrics pm
WHERE pm.format_id IS NOT NULL AND pm.views > 0
GROUP BY pm.format_id, pm.platform
ORDER BY avg_save_rate DESC;
```

**Query 4: Overall performance range (to detect outliers)**
```sql
SELECT
  video_code,
  platform,
  views,
  saves,
  CAST(saves AS FLOAT) / NULLIF(views, 0) as save_rate
FROM performance_metrics
WHERE views > 0
ORDER BY save_rate DESC
LIMIT 10;
```

### Step 3: Compute Weighted Engagement Score

For each hook × platform combination with at least 2 data points:

```
weighted_engagement = (0.4 × avg_save_rate) + (0.3 × avg_share_rate) + (0.3 × avg_comment_rate)
```

Save rate is weighted highest (0.4) because it's the strongest proxy for genuine value — users save content they plan to return to or share.

### Step 4: Cross-Reference with hook-patterns.md

Read `industries/chiropractic/hook-patterns.md` to see which hook patterns are currently emphasized (listed first, marked as primary). Compare to what the data shows is actually performing.

**Flag discrepancies:**
- Patterns marked as high-priority in hook-patterns.md but underperforming in data → "Evidence mismatch: consider demoting"
- Patterns not marked as primary but outperforming → "Evidence suggests promoting"

### Step 5: Check the Idea Bank Lifecycle

Read `industries/chiropractic/idea-bank.md` and cross-reference archived ideas with their video codes. For any archived idea with a video code you can find in the metrics:

- Was a high-priority idea high-performing? (validate AI scoring)
- Was a "trending" idea still trending when published?
- Which categories (trending/evergreen/competitor/audience) produce highest-performing content?

### Step 6: Generate the Report

Output the report in this structure:

```markdown
# Performance Review — [Date]

## Data Coverage
- Period: last [N] days
- Videos with metrics: [count]
- Videos with hook_pattern_used: [count] ([percentage]% coverage)
- Total platforms tracked: [list]

---

## What's Working

### Top Hook Patterns (by weighted engagement)

| Hook Pattern | Platform | Videos | Avg Save Rate | Avg Share Rate | Weighted Score |
|-------------|----------|--------|--------------|----------------|----------------|
| [pattern] | [platform] | [n] | [x%] | [x%] | [score] |
...

**Key finding:** [1-2 sentence insight about what pattern is consistently winning]

### Top Formats (by save rate)

| Format | Name | Platform | Videos | Avg Save Rate | Avg Views |
|--------|------|----------|--------|--------------|-----------|
| [A-G] | [name] | [platform] | [n] | [x%] | [n] |
...

**Key finding:** [1-2 sentence insight]

### Outlier Videos (top 3 save rates)

| Video Code | Platform | Views | Save Rate | Hook Pattern | Format |
|-----------|---------|-------|-----------|-------------|--------|
...

**What they have in common:** [pattern observation]

---

## What's Underperforming

### Hook Patterns Below Average

| Hook Pattern | Platform | Videos | Avg Save Rate | vs. Avg | Verdict |
|-------------|----------|--------|--------------|---------|---------|
...

---

## Discrepancies vs. hook-patterns.md

| Pattern | Current Priority | Data Says | Recommendation |
|---------|----------------|-----------|----------------|
...

---

## Recommended Emphasis for Next Week

Based on [N] videos of data:

1. **Prioritize**: [hook type] on [platform] — [save rate] avg save rate ([n] videos)
2. **Experiment with**: [hook type] on [platform] — only [n] data points but trending up
3. **Reduce**: [hook type] on [platform] — consistently below average ([save rate] vs [avg] avg)

### Suggested Format Mix
- [format]: [N/week] (currently overrepresented/underrepresented)
- [format]: [N/week]

---

## Data Gaps

- [N] videos have no hook_pattern_used — these can't be analyzed by pattern
- Add hook pattern when recording metrics: open Metrics view, edit the entry

---

*Generated by /performance-review on [date]. Run again after next production batch to update.*
```

### Step 7: Save the Report

Save to:
```
industries/chiropractic/strategy-optimizer/performance-[YYYY-MM-DD].md
```

Create the directory if it doesn't exist.

Also append a summary line to `strategy-optimizer/results.md` (create if needed):
```
[date] | performance-review | [top hook] on [platform] = [score] weighted engagement | [bottom hook] underperforming by [X%]
```

## Important Notes

- **Minimum data**: Patterns need at least 2 videos to draw conclusions. Flag single-video "patterns" as insufficient.
- **Platform split**: Always separate by platform. A hook that kills on Instagram may bomb on TikTok.
- **Recency weight**: Data from the last 2 weeks should be weighted slightly higher than older data. Flag if only old data is available.
- **Hook pattern coverage**: If less than 50% of videos have `hook_pattern_used` populated, flag this prominently and recommend filling gaps before the analysis is reliable.
- **Format coverage**: If `format_id` is unpopulated, infer it from the video code prefix in content-library.md (e.g., "D" prefix = Format D).

## Integration

```
/performance-review        → Run standalone for weekly strategy check
/hook-variations           → Reads performance-review output for data-weighted hooks
/content-planner           → Reference performance-review report before planning
strategy-optimizer/program.md  → Consumes performance-review as part of autonomous loop
```
