---
name: audience-pulse
description: Pulls fresh demand signal for one or all audience segments — Reddit threads, YouTube comments, Google "People Also Ask" — and writes audience-tagged digest files that auto-seed the Inspiration Inbox. Use weekly or before content planning to know exactly what each audience is asking about right now.
argument-hint: "[audience id]" (prenatal, infant, kids, athlete, adult, senior, general) or "all"
context: fork
agent: Explore
allowed-tools: Bash, Read, Write, WebSearch, WebFetch, AskUserQuestion
---

# Audience Pulse: Direct Demand Signal Per Segment

Listen to what each audience is asking, in their own words, from the places they actually post questions. Output: a structured demand file per audience that the dashboard's IdeaRanker auto-reads to seed audience-tagged ideas.

## When to Use

- **Weekly** (Tuesday morning is good — the dashboard's Home surface picks it up for the week ahead)
- Before running `/content-planner` so the planner has fresh demand context
- When a particular audience has gone quiet on engagement and you suspect drift
- When entering a new audience segment for the first time

## What It Does

1. Reads `industries/chiropractic/audiences.md` for the target segment(s) — pulls the verbatim search terms and DM questions to anchor the search
2. Pulls Reddit threads from audience-relevant subreddits (last 7-14 days, sorted by engagement)
3. Pulls Google "People Also Ask" / autocomplete for the audience's top 5 search terms
4. (Optional) Pulls YouTube comment threads on top niche videos using WebSearch
5. Distills raw signals into structured markdown — top questions, recurring themes, surprising signals, suggested idea triggers
6. Writes `industries/chiropractic/audience-demand/demand-{audience}-{YYYY-MM-DD}.md`
7. The dashboard's IdeaRanker reads these on the next refresh; the Inspiration Inbox auto-seeds with the "Suggested idea triggers" section

## How to Use

```
/audience-pulse prenatal       # one segment
/audience-pulse all            # loop through all 7
/audience-pulse adult senior   # subset
```

## Data sources by segment

The skill maintains a per-audience source map. Defaults for chiropractic:

| Audience | Subreddits | Search anchors (from audiences.md) |
|----------|-----------|-----------------------------------|
| prenatal | /r/BabyBumps, /r/BeyondTheBump, /r/PregnantOver30 | "Webster technique", "chiropractic pregnancy safe", "pubic symphysis pain" |
| infant | /r/Mommit, /r/breastfeeding, /r/Parenting | "torticollis baby", "infant chiropractor", "colic remedies" |
| kids | /r/Parenting, /r/parenting | "kids posture phones", "scoliosis screening", "growing pains" |
| athlete | /r/running, /r/weightroom, /r/AdvancedRunning | "low back deadlift", "chiropractor runners", "return to play" |
| adult | /r/ChronicPain, /r/ehlersdanlos, /r/posture | "tech neck", "morning stiffness", "sciatica desk job" |
| senior | /r/AskOldPeople, /r/AgingParents | "chiropractic seniors safe", "falls prevention", "arthritis pain" |
| general | /r/AskDocs, /r/Chiropractic | "first chiropractor visit", "how to choose chiropractor" |

The source map can be overridden by adding a `<!-- pulse-sources -->` block to the audience's section in `audiences.md`.

## Output format

`industries/chiropractic/audience-demand/demand-{audience}-{YYYY-MM-DD}.md`:

```markdown
# Demand Signal · Pregnancy & Postpartum (prenatal) · 2026-05-12

## Top questions (verbatim from sources)
1. "Is chiropractic actually safe during pregnancy?" — /r/BeyondTheBump · 47 comments · 2026-05-08 · https://reddit.com/...
2. "Webster technique for breech baby at 36 weeks — anyone tried this?" — /r/BabyBumps · 22 comments · 2026-05-10 · https://reddit.com/...
3. ...

## Recurring themes (mentioned in >=3 threads)
- Pelvic floor recovery (12 of 30 threads scanned)
- Safety concerns at >30 weeks (8 of 30)
- ...

## Surprising signals
- [Anything counter-intuitive that shows up — like a search term that wasn't in audiences.md but appeared often]

## Suggested idea triggers
These will be auto-seeded into the Inspiration Inbox with audience_tags=prenatal:

1. **Did-you-know carousel** — "Why your pelvis loosens in the 3rd trimester (and what to do about it)" — source: 12 /r/BeyondTheBump threads asking the same question this month
2. **Patient story (Format G)** — Webster-technique breech reversal at 36 weeks — source: 5 threads with this specific question, no creators in our space covering it well
3. ...

## Source map for this run
- Reddit subreddits scanned: /r/BabyBumps, /r/BeyondTheBump, /r/PregnantOver30
- Search anchors: "Webster technique", "chiropractic pregnancy safe", "pubic symphysis pain"
- Date range: 2026-05-05 to 2026-05-12
- Total threads sampled: ~50
```

## Pipeline

1. **Parse** target audiences from the argument (one, several, or "all")
2. **Load** `audiences.md` and pull the search terms / DM questions for each target
3. **Search** Reddit and Google for each anchor (use WebSearch and WebFetch directly — no API keys needed for public threads)
4. **Distill** results into the structured format using an inline Anthropic Haiku call (synthesizes raw signals into themes + suggested ideas)
5. **Write** the per-audience demand files
6. **Optionally** auto-seed the Inspiration Inbox via `POST /api/inbox/seed-from-demand` (this endpoint is built alongside this skill — runs locally against the dashboard SQLite)

## Implementation notes for the executing agent

- Use the `audience-pulse.py` script in this skill folder. It accepts `--audience prenatal` or `--audience all` and writes to the dated demand file.
- The script uses Python's `requests` library + the public Reddit JSON endpoint (`https://www.reddit.com/r/{sub}/top.json?t=week`). No auth required for public read.
- Google PAA: scrape from a `https://www.google.com/search?q=` SERP HTML via `requests` + simple regex — no API key needed but the script has built-in rate-limiting.
- Haiku call: uses `ANTHROPIC_API_KEY` from env, calls `claude-haiku-4-5-20251001` with the structured-prompt template baked into the script.
- The script does NOT post to the Inspiration Inbox API automatically — that's a follow-up step. For now the dashboard's IdeaRanker reads the demand files directly as a new source.

## Why this works

1. **Listening, not guessing.** Reddit + YT comments + PAA are the audience's actual voice. We've been inventing what they want; this captures what they say they want.
2. **Audience-tagged from the source.** Every suggested idea trigger lands in the inbox with its `audience_tags` pre-filled. The ranker can compute audience-fit instantly.
3. **Persisted to disk.** The viral-insights/ folder demonstrated this pattern works — markdown files in a known location that the dashboard reads. We extend the convention.
4. **Idea triggers are formatted, not free-form.** Each suggestion includes the format hint (carousel / patient story / etc.) so the develop step is one click.

## Cross-references

- Personas: `industries/chiropractic/audiences.md`
- IdeaRanker reads these files: `packages/dashboard/server/lib/idea-ranker.ts`
- The weekly n8n cron that runs this on a schedule: see "Audience Demand Weekly Digest" workflow (set up separately)
