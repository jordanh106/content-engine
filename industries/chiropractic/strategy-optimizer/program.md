# Strategy Optimizer: Autonomous Weekly Loop

This is the agent's standing instructions for the strategy optimization loop. Invoke by telling Claude: "Run the strategy optimizer."

The loop runs in the spirit of Karpathy's autoresearch: make a change → measure the metric → keep or discard → repeat. Here, the "model" is the content strategy, the "training file" is hook-patterns.md, and the metric is weighted engagement score from real audience data.

---

## The Metric

```
weighted_engagement = (0.4 × save_rate) + (0.3 × share_rate) + (0.3 × comment_rate)
```

Where each rate = metric / views for that video.

- Save rate weighted highest: saves signal genuine value (users return to this content)
- Share rate: measures virality and referral potential
- Comment rate: measures community engagement and controversy

A strategy change is worth "keeping" if it's predicted to increase weighted_engagement for the next 2-week production cycle.

---

## Loop Execution

Run this loop each time you're invoked. Complete all steps autonomously before producing output.

### Step 1: Run /performance-review

First, check if a recent performance review exists:
```
industries/chiropractic/strategy-optimizer/performance-[recent date].md
```

If the most recent is less than 7 days old, read it. If older or missing, invoke `/performance-review` to generate fresh data before proceeding.

### Step 2: Read Current Strategy State

Read these files to understand what the strategy currently emphasizes:
- `industries/chiropractic/hook-patterns.md` — which hook types are listed first (implicit priority)
- `industries/chiropractic/idea-bank.md` — current distribution of idea categories
- `industries/chiropractic/watchlist-insights/` — latest watchlist intelligence report (most recent file)
- `industries/chiropractic/viral-insights/patterns.md` — cumulative viral patterns

### Step 3: Identify Discrepancies

Compare the performance data to the current strategy emphasis. For each finding:

**Format: "KEEP" if the current emphasis is validated by data**
```
KEEP: Question Hooks on Instagram — current priority matches data
  Evidence: 18.2% avg save rate (n=8), 2.1x above library average
  Confidence: HIGH (n≥5 with consistent results)
```

**Format: "PROMOTE" if data shows an underemphasized pattern is winning**
```
PROMOTE: Myth/Contrarian Hooks on TikTok — not currently top priority but outperforming
  Evidence: 22.1% avg save rate (n=4), highest of any hook/platform combo
  Confidence: MEDIUM (n<5, but consistent trend)
  Proposed change: Move to second priority for TikTok content in hook-patterns.md
```

**Format: "DEMOTE" if a high-priority pattern is underperforming**
```
DEMOTE: Did You Know Hooks on TikTok — currently listed but data shows weakness
  Evidence: 8.3% avg save rate (n=6), 0.4x library average
  Confidence: HIGH (n≥5, consistent underperformance across 4+ weeks)
  Proposed change: Add performance note to hook-patterns.md; deprioritize for TikTok
```

**Format: "INVESTIGATE" if data is insufficient or contradictory**
```
INVESTIGATE: Pattern Interrupt Hooks — only 2 data points
  Evidence: One outlier (31% save rate), one average (9% save rate)
  Confidence: LOW (n<3)
  Action: Continue testing before drawing conclusions
```

### Step 4: Propose Changes

Based on Step 3, generate a specific, minimal set of proposed changes. Changes should be:
- **Additive only**: Don't delete patterns from hook-patterns.md — add performance annotations
- **Specific**: "Move Question Hook to position #1 for Instagram" not "use more good hooks"
- **Justified**: Every change cites the data that supports it
- **Conservative**: Only make changes when confidence is HIGH or at least 4 data points exist

**Types of allowed changes:**
1. Add performance annotation to existing hook pattern entry (e.g., `[IG: 18.2% save rate, n=8, HIGH]`)
2. Reorder hook patterns within a platform section based on evidence
3. Add a new "Data-validated top performers" section to hook-patterns.md (don't modify existing structure)
4. Add/promote ideas in idea-bank.md from categories that are producing high-performing content
5. Add an observation to watchlist notes if competitor behavior aligns with a high-performing pattern

**Never:**
- Delete proven hook patterns (data is from one practice; patterns may still work with different angles)
- Change more than 3 things in a single loop run
- Make changes without at least 2 data points as evidence

### Step 5: Apply Changes

For each approved change:

1. Make the edit to `hook-patterns.md` or `idea-bank.md`
2. Note what changed and why

Example annotation to add to a hook-patterns.md entry:
```
*Performance data (2026-03): avg save rate 18.2% on Instagram (n=8), 2.1x library avg. Highest-performing hook type for this platform.*
```

### Step 6: Write to results.md

Append a timestamped entry to `strategy-optimizer/results.md`:

```markdown
## [YYYY-MM-DD] Strategy Loop Run

**Data coverage:** [N] videos, [N] with hook_pattern_used

**Changes made:** [N]

### Findings
- [KEEP/PROMOTE/DEMOTE/INVESTIGATE] + one-line summary for each finding

### Changes Applied
1. [Specific change made] — Evidence: [data citation]
2. ...

### No-action items (insufficient data)
- [Pattern]: [N] data points, monitoring

**Predicted impact:** [brief prediction of what this week's content should achieve if changes are implemented]

**Next run:** [date + 7 days]
```

### Step 7: Report to User

Provide a concise summary:

```
Strategy Optimizer — [date]

Analyzed [N] videos from the last [N] days.

Changes made ([N]):
• [Change 1] — [evidence]
• [Change 2] — [evidence]

Monitoring ([N]):
• [Pattern] — need more data (n=[N])

No changes needed ([N]):
• [Pattern] — current strategy matches data

Next: Run /performance-review again after the next production batch to track progress.
```

---

## Principles

**Data beats assumptions.** If the data contradicts what "should" work, trust the data. Your specific audience in Woodstock, GA with prenatal/pediatric focus will respond differently than a generic chiropractic audience.

**Compound improvement.** Each loop run makes the next loop run more useful. After 8 runs (2 months), you'll have genuine insight that no external research tool can provide.

**Minimum changes.** The instinct is to change everything when you see the data. Resist it. Change one or two things, see if the needle moves, then change more. This is the autoresearch lesson: one variable at a time.

**Cover your uncertainty.** A change based on 2 data points is a hypothesis, not a conclusion. Label it as such. Revisit in 2 weeks.

---

## Trigger Schedule

Ideally run after each n8n Watchlist Intelligence report (Wednesday evenings). The workflow has already ingested fresh creator data — running strategy-optimizer afterward connects the competitive picture to your performance picture.

Can also be run manually anytime after publishing a new batch of content.

---

## Bootstrapping (First Run)

On the first run, `hook_pattern_used` and `format_id` will likely be NULL for most records. This is expected. The first run will:

1. Analyze what little data exists
2. Produce a "Data Gap" report identifying which videos are missing hook metadata
3. Recommend manually tagging the top 10 published videos with their hook patterns
4. Set a baseline weighted_engagement score for comparison in future runs

Even one loop run with sparse data establishes the baseline. The system improves with each production cycle.
