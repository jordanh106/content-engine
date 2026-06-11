---
name: refresh-voice
description: Refresh the Living Brand Voice doc by distilling voice patterns from the last 4 weeks of published scripts + top-performing captions. Writes a dated voice-{YYYY-MM-DD}.md the dashboard reads on its next refresh. Every AI route in the system reads from this file, so the refresh compounds — one good distillation pass improves every output for the week.
argument-hint: "(no args — operates on active industry)"
context: fork
agent: Explore
allowed-tools: Bash, Read, Write
---

# Refresh Brand Voice: Living Document Distillation

Update the brand voice document by reading what's actually been working — your published scripts, your top-performing captions, your evolving phrasing. The dashboard reads this on every AI call, so refresh = every output improves.

## When to Use

- **Weekly** (Sunday night or Monday morning before content planning — the Weekly Studio chain runs this automatically Sunday 8pm)
- After a campaign or push that introduced new phrasing you want canonized
- When AI Suggest output starts to feel generic or off-brand — your voice has evolved, the doc hasn't
- After Jordan refines `industries/chiropractic/brand.md` (the constitution) and you want the live voice to re-align

## What It Does

1. Reads `industries/chiropractic/brand.md` as the **constitution** (must not be contradicted)
2. Reads the last 4 weeks of published scripts (joins `content-library.md` with `video_status` table for published status + `script_versions` for the actual prose)
3. Reads top-decile `performance_metrics` to identify which scripts actually performed
4. Reads the previous voice doc (`voice-{prior_date}.md`) to surface what changed
5. Calls Claude Haiku to distill: style block + signature phrases + tone descriptors + diff from last week
6. Writes `industries/chiropractic/brand-voice/voice-{YYYY-MM-DD}.md`

The dashboard's `getCurrentBrandVoice()` reader (in `packages/dashboard/server/lib/brand-voice.ts`) picks the newest dated file automatically on next call.

## How to Use

```
/refresh-voice
```

That's it. No args. The skill is idempotent — re-running on the same day overwrites that day's file.

## Output structure

`industries/chiropractic/brand-voice/voice-{YYYY-MM-DD}.md`:

```markdown
# Brand Voice — 2026-05-13

## Style block (the prompt-ready 5-bullet guide)
- Warm, plain, friendly...
- No emdashes...
- ... [5 bullets total, evolved from last week if patterns warrant]

## Signature phrases (recurring in top performers)
- "the thing most people get wrong" — appears 4 times in top decile
- "here's the part that surprised me" — appears 3 times
- ...

## Tone descriptors (3-5 adjectives, ranked)
1. Warm
2. Curious
3. ...

## What changed from last week
- Added: signature phrase "the thing most people get wrong" — new pattern in top performers
- Dropped: tone descriptor "playful" — Sept's top performers were more measured
- ...

## Constitution alignment check
- Aligns with brand.md voice section: ✓
- Aligns with no-emdash rule: ✓
- Tension flagged: [any conflict between what performed vs constitution]
```

## Implementation notes

- Uses `python3 skills/refresh-voice/refresh-voice.py` (run directly or via the skill invocation)
- Auto-loads `packages/dashboard/.env` for the `ANTHROPIC_API_KEY` (same pattern as `/audience-pulse`)
- Reads from the dashboard SQLite at `packages/dashboard/data/dashboard.db`
- The Haiku call is constitution-anchored — the model is told "must not contradict brand.md, but evolve based on what's performing"
- Idempotent: re-running on the same day overwrites the same dated file

## Why this works

1. **Compounds.** Every AI Suggest, every script refinement, every caption generator, every planner call reads from this one file. One good distillation = every output for the week improves.
2. **Grounded in performance.** Top decile by `saves + shares * 2` — actual outcome data, not vibes about what's good.
3. **Constitution-respecting.** `brand.md` is the floor. The Living Voice can evolve above it but can't contradict it.
4. **Versioned + diffable.** Each week's voice has a "what changed" section so drift is auditable and reversible.

## Cross-references

- Read by: `packages/dashboard/server/lib/brand-voice.ts` (the central reader every route uses)
- Constitution: `industries/chiropractic/brand.md`
- Weekly cron: the n8n "Weekly Studio Chain" workflow runs this Sunday 8pm Eastern before generating idea cards
