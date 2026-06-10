---
name: goal-lock
description: The north-star filter. Locks a quarterly business goal once at the start of a quarter, then every subsequent skill output (scripts, captions, ideas, hooks) is filtered through "does this serve the goal?" Use at the start of every Claude session to anchor what counts as a win. Adapted from Grow with Alex's "17 INSANE Claude Skills" video.
argument-hint: "[goal text]" — set or update the locked goal; no args = print current goal
context: fork
agent: Explore
allowed-tools: Read, Write, Bash, AskUserQuestion
---

# Goal Lock — The north-star filter

Set one quarterly business goal. Every output downstream answers "does this move the needle on the goal?" If it doesn't, it gets cut or refocused.

Without this, AI outputs drift toward "interesting" or "viral" — neither of which necessarily move your business. With this, every piece of content has a stake.

## When to use

- **First thing every Claude session** in a content/marketing context — call `/goal-lock` to refresh your memory of the locked goal
- **At the start of a quarter** — call `/goal-lock "<goal text>"` to set or update the goal
- **When evaluating an idea, hook, or script** — call `/goal-lock evaluate <idea>` to score it against the goal
- **When generating ideas** — pass the goal text into the prompt as anchor context

## How to use

```
/goal-lock                                # print the current locked goal
/goal-lock "300 new paid members by Q3 EOQ at $149/mo via prenatal funnel"   # set/update goal
/goal-lock evaluate "Did-you-know carousel on chainsaw history"              # score an idea against the goal
```

## What the goal should look like

The goal must be: **specific, measurable, time-boxed, audience-anchored, and channel-anchored.**

Good goal:
> "300 new paid members by end of Q3 at $149/month, primarily driven by the prenatal funnel via Instagram Reels + booked consults."

Bad goal:
> "Grow on Instagram." (no number, no time, no audience)
> "Get more followers." (followers ≠ revenue)
> "Make great content." (subjective)

The acid test: if a piece of content goes viral but doesn't move the metric in the goal, it's a waste. If a piece of content gets 200 views but books 3 consults, it's a win.

## Files

The locked goal lives at `industries/chiropractic/goal-lock.md`:

```markdown
# Locked Goal — Q3 2026

300 new paid members by end of Q3 at $149/month, primarily driven by
the prenatal funnel via Instagram Reels + booked consults.

## Sub-targets (so we know we're on pace)
- 25 booked consults / month from Instagram Reels
- 12 of those consults convert to paid membership
- Saves ratio target: 7%+ on prenatal Reels
- Share rate target: 1.5%+ on prenatal Reels

## Filters every output must pass
1. Does this speak to a prenatal segment fear / search / DM question?
2. Does this drive toward a save → DM → consult flow, not just a view?
3. Is the CTA something prenatal moms will actually do (save for later, share with husband, DM "first visit")?

## Set / updated
- Date: 2026-05-26
- Author: Jordan
```

## Pipeline behavior

When other skills run (idea ranker, content-planner, video-director, hook-variations), they should:
1. Read `goal-lock.md` at startup
2. Pass the goal text into their prompt as anchor
3. Add a "goalAlignment" score (0-100) to every output
4. Surface this score in the UI

If `goal-lock.md` doesn't exist, the skill prompts the user to set one before continuing.

## Evaluation mode

```
/goal-lock evaluate "Did-you-know carousel on chainsaw history"
```

Produces:
```
Goal: 300 paid members by Q3 EOQ via prenatal funnel

Idea: Did-you-know carousel on chainsaw history
Audience match: NONE (general / brand-tangential, not prenatal)
Funnel match: WEAK (entertainment, doesn't lead to consult)
Goal alignment: 12/100

Verdict: SKIP. Either reframe to prenatal angle ("the surprising
history of the Webster technique") or shelve until you have
goal-relevant inventory done.
```

## Cross-references

- `industries/chiropractic/audiences.md` — persona definitions the goal references
- `packages/dashboard/server/lib/idea-ranker.ts` — should read goal-lock.md and add goalAlignment to the composite score
- `industries/chiropractic/brand-voice/voice-*.md` — voice must serve the goal

## Why this works

1. **Drift kills businesses.** Without a locked goal, every "interesting" idea looks viable. Goal Lock forces a stake.
2. **Compounds across every skill.** One file, read by every downstream output.
3. **Auditable.** When you look at last quarter's content and it didn't move the metric, you can see exactly which pieces failed the filter.
