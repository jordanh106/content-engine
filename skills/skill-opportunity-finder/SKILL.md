---
name: skill-opportunity-finder
description: The meta-skill. Scans your Claude chat history (and your shell command history, and your written brief drafts) for patterns you keep retyping or workflows you keep re-running manually — and surfaces them as candidate skills to build. The single highest-leverage skill in the system because it compounds. Adapted from Grow with Alex's "17 INSANE Claude Skills" video.
argument-hint: "[lookback days]" — how far back to scan, default 30
context: fork
agent: Explore
allowed-tools: Bash, Read, Write, Grep, AskUserQuestion
---

# Skill Opportunity Finder — The meta-scanner

This is the skill that builds more skills. It scans how you actually use Claude (and your terminal, and your dashboard) for the patterns you keep re-typing or re-running manually — then ranks them by leverage as candidate skills to build.

Alex's framing from the video:
> "Skill Opportunity Finder will scan all of your Claude chats and find patterns that you often repeat that you should have skills for. This is probably the biggest game changer in this whole video because if you use Claude for even a few hours a week there's going to be tons of data and things you can do to build a better system."

## When to use

- **Monthly** — to surface what's accumulated as repeatable since last month
- **After a heavy work week** — when you can feel that you've been retyping the same kind of prompt
- **When you want to know "what should my next skill be?"** — let the data answer

## How to use

```
/skill-opportunity-finder                       # last 30 days, all sources
/skill-opportunity-finder 90                    # last 90 days
/skill-opportunity-finder --source claude       # only Claude chat patterns
/skill-opportunity-finder --source shell        # only shell-command patterns
```

## What it scans

| Source | How it scans | Signal |
|--------|--------------|--------|
| Claude project transcripts | Greps `~/.claude/projects/-Users-jordanharper-Desktop-content-engine/*.jsonl` for recurring user-message patterns | Same kind of question being asked repeatedly |
| Shell history | `~/.zsh_history` / `~/.bash_history` for command patterns | Same multi-step command sequences being run manually |
| Skill invocations | `~/.claude/projects/.../*.jsonl` for `Skill(...)` calls | Most-used skills (validates current set); least-used skills (candidates to retire) |
| Brief edits | Recent commits to `industries/chiropractic/idea-bank.md`, `inbox`, project briefs | Manual ideation patterns that could be agent-ised |
| n8n executions log | `/api/executions?limit=200` | Workflows that run frequently → candidates to simplify, or hot paths where new sibling workflows would help |

## What it surfaces

For each candidate skill it finds, it outputs:

```
─────────────────────────────────────────────────
CANDIDATE: <name>
─────────────────────────────────────────────────
Pattern observed:
  - <user message pattern verbatim, with 2-3 examples>
Frequency: <N times in last 30 days>
Time spent per occurrence (estimate): <minutes>
Annual time saved if turned into a skill: <hours>

Suggested skill spec:
  - Name: <kebab-case-name>
  - Trigger: /<command>
  - Args: <what the user passes>
  - What it does: <one sentence>
  - What it reads: <files / APIs>
  - What it writes: <output location>

Why it scored high:
  - <leverage signal: frequency × time × repeatability>

To build it now: pipe this candidate into /skill-creator
```

## Example findings (illustrative — from a real Jordan session)

**Candidate 1: "rewrite-in-jordan-voice"**
- Pattern: "Rewrite this in my voice, no marketing speak..." appears 14 times in 30 days
- Existing skills don't cover this directly (brand-voice is a doc, not a rewrite action)
- Time saved if skill: ~15 min × 14 = 3.5 hr/month
- Suggested trigger: `/voice-rewrite "<text>"`

**Candidate 2: "verify-goal-alignment-on-existing-idea"**
- Pattern: "Does this idea actually serve the goal of X?" appears 9 times in 30 days
- Could be handled by `/goal-lock evaluate` (just built)
- Status: COVERED by goal-lock — skip

**Candidate 3: "git-status-then-typecheck-then-commit"**
- Pattern: Shell history shows the same 4-command sequence run 22 times in 30 days
- Suggested trigger: `/ship "<commit message>"` — runs git status, npx tsc --noEmit, then commits if clean
- Time saved: ~2 min × 22 = 44 min/month (lower leverage but high frequency)

**Candidate 4: "carousel-from-published-script"**
- Pattern: "Turn this script into a carousel" appears 7 times in 30 days
- Time spent: ~25 min per occurrence (3 hours/month)
- Status: PARTIAL — repurpose skill covers it but doesn't auto-route through carousel templates. Specialise.

Output is ranked by `frequency × time × repeatability_score` — the top 5 are surfaced for review.

## What the skill writes

A dated report at `industries/chiropractic/skill-opportunities/opps-{YYYY-MM-DD}.md` — same convention as viral-insights/, audience-demand/, etc.

After Jordan reviews the report, he can either:
1. Run `/skill-creator <candidate-name>` to scaffold each one
2. Manually update an existing skill to cover the gap
3. Mark the candidate as "covered" or "skip" so it doesn't get re-surfaced next month

## Files

- Report output: `industries/chiropractic/skill-opportunities/opps-{date}.md`
- Suppression list: `industries/chiropractic/skill-opportunities/skipped.md` (candidates Jordan has explicitly declined; the skill respects this on next run)

## Cross-references

- `/skill-creator` (Anthropic's built-in) — turns a candidate into an actual skill file
- `skills/` directory — what already exists; the scanner deduplicates against this
- CLAUDE.md skill table — should be in sync with `skills/` directory

## Why this works

1. **The data already exists.** Your chat history is a record of what you actually need. Stop guessing at the next skill.
2. **Compounds.** Every skill built saves time; every hour saved is an hour available to build more skills.
3. **Reveals blind spots.** Some patterns you don't notice because they feel "normal" — the scanner sees frequency in cold numbers.
4. **Prevents skill bloat.** Surfaces what's *not* being used too, so the skills library doesn't accumulate dead weight.

## Why Alex called these "the meta skills"

He said skills 16 + 17 (Opportunity Finder + Builder) "literally everyone has to be using." Reason: they're the only skills whose output is more skills. They compound. Every other skill saves you N hours per week. Meta-skills save you N skills per month. Different unit.
