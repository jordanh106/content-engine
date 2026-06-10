---
name: the-bridge
description: Hook surgery. Replaces a generic, slow, or scroll-past hook with an opening that leads with the climax. Use when an existing script, Reel, or carousel has a soft opening that buries the lede. Single-word trigger; one-pass fix. Adapted from Grow with Alex's "17 INSANE Claude Skills" video.
argument-hint: "<the current opening line you want fixed>" — paste the weak hook
context: fork
agent: Explore
allowed-tools: Read, Write, AskUserQuestion
---

# The Bridge — Hook surgery

Replace the opening of a script with one that leads with the climax. Stop telling viewers what's coming; show them the destination first, then walk them back.

Most weak hooks fall into three buckets:
1. **Setup hooks** — "Today I want to talk about..." (no stakes, no curiosity)
2. **Question hooks** — "Have you ever wondered..." (the viewer mentally answers and scrolls)
3. **List hooks** — "Here are 5 ways to..." (numerical, but no climax preview)

The fix: **climax-first.** Tell them the most surprising / dramatic / counterintuitive part of the payoff in line 1. Make the entire video feel like a backstop to that opening.

## When to use

- A script you wrote has an opening you're not happy with
- A Reel keeps getting under-100-view runs and you suspect the first 2 seconds
- A carousel cover slide reads like a textbook header
- You're stuck on how to start a long-form video

## How to use

```
/bridge "Today I want to talk about why pregnancy back pain happens."
```

The skill returns 3 climax-led replacements with the rationale for each. Pick the one that fits your voice.

## The rule the skill applies

A climax-led hook does one of these:

| Pattern | Example |
|---------|---------|
| **Reveal the outcome first** | "She booked her first consult after one Reel. Here's why it worked." |
| **State the contradiction** | "Your low back pain isn't from your back." |
| **Show the stake** | "If you wait until week 36 to address breech, your options collapse." |
| **Name the cost of inaction** | "Skip pelvic check pre-delivery and you're rolling dice on positioning." |
| **Lead with the surprising statistic** | "82% of pregnant women have a misalignment by week 30 — and most don't know." |

The skill picks the pattern that best matches the script's actual payoff, then rewrites.

## Example transformation

**Before:**
> "Today I want to talk about why pregnancy back pain happens and what you can do about it."

**After (3 options):**

1. **Reveal the outcome first:**
   > "Sarah's back pain disappeared after one adjustment at week 34. Here's the thing she didn't expect."

2. **State the contradiction:**
   > "Your pregnancy back pain isn't from your back. It's from your pelvis — and there's a fix."

3. **Show the stake:**
   > "Wait until week 36 to address pregnancy back pain, and your options shrink to 'just endure it.' Don't wait."

The script body stays the same. Only the bridge between scroll and content changes.

## What the skill needs

To do its job, the skill reads:
- The weak opening line (passed as arg)
- The rest of the script (Read tool — looks for nearest .md or active script in context)
- The brand voice doc (`industries/chiropractic/brand-voice/voice-*.md` — newest)
- The locked goal (`industries/chiropractic/goal-lock.md`)

If any are missing it falls back to defaults but flags it.

## Audience-aware variants

When the audience is known (passed as `--audience prenatal/infant/kids/etc`), the skill loads the persona's "hook archetypes that work" section from `audiences.md` and biases toward those patterns.

For example, prenatal audiences respond best to:
- Myth opener — "You probably think pregnancy back pain is just part of being pregnant."
- Story frame — "Sarah came in at 34 weeks..."

The skill defaults to those patterns over generic climax-first when audience is set.

## Cross-references

- `hook-variations` skill — generates 10 hook OPTIONS from scratch; The Bridge fixes ONE existing hook
- `industries/chiropractic/hook-patterns.md` — the canonical patterns
- `industries/chiropractic/audiences.md` — per-audience hook biases

## Why this works

1. **Climax-first wins the first 2 seconds.** Setup-first loses them.
2. **Surgical, not generative.** You already wrote the script — the body is yours. The skill only does the opening.
3. **Three options force a choice.** You pick the one in your voice, not the one the AI wrote.
