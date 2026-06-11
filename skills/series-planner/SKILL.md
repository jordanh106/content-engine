---
name: series-planner
description: Plans a full series arc — not a weekly calendar — for a single topic worth multiple pieces. Different angle per part, different platform per part, climax-first ordering, save-and-share progression. Use when a topic is too big for one piece. Adapted from Grow with Alex's "17 INSANE Claude Skills" video.
argument-hint: "<topic>" — the topic worth a series
context: fork
agent: Explore
allowed-tools: Read, Write, AskUserQuestion
---

# Series Planner — The arc planner

Some topics are too big for one piece. They have multiple legitimate angles, each of which makes a strong standalone piece, and which together form a series. Series Planner takes a topic and plans:
- How many parts (3-7 typical)
- Angle per part (no overlap, no repetition)
- Format per part (Reel, carousel, long-form, etc)
- Platform per part (where each lands hardest)
- Climax-first ordering (the surprising payoff goes EARLY, not at the end)
- The progression hook ("see Part 2 for...") that gets people watching the next one

Different from `/content-planner` — that's a weekly calendar across topics. Series Planner is one topic, multiple pieces, sequenced.

## When to use

- You've got a topic where you keep finding more to say (signal it's a series, not a single piece)
- A previous single piece performed well and the comments are asking follow-ups (turn into a series)
- You want to build authority in one specific area (a series compounds, single pieces don't)
- You're stuck on what to publish next and you have one strong topic in inventory

## How to use

```
/series-planner "Why every diet works (and why they all fail)"
```

Or with constraints:
```
/series-planner --parts 5 --platforms reels,youtube --audience adult "<topic>"
```

The skill outputs:
- Series concept (one-line description of the through-line)
- The arc (which angle each part takes, in order)
- Part-by-part breakdown (format, platform, hook draft, body outline, CTA into next part)
- A standalone test ("if someone sees Part 4 first, does it still work?")

## Example output (truncated)

**Series concept:** "Sustainable beats extreme (for people who don't have time to be extreme)"

**The arc:**
> Through-line: Every diet works, but only one type lasts. Most creators give framework #38 of the year. We're going to dismantle ALL of them then build the one that doesn't break in February.

**Part 1 — "Why busy professionals fail every diet (and it's not discipline)"**
- Angle: Reframe the enemy. The reason 32-45 professionals fail isn't willpower — it's the running marathon software on a phone that's already at 4% battery.
- Platform: YouTube
- Format: Long-form (8-12min)
- Hook (climax-first): "If you've quit 4 diets this year, you're not weak. You're running marathon software on a phone at 4%."
- Body outline: 4 levers → cost of layering protocols → exit
- CTA: "Part 2 names the 4 levers that actually move the needle when you're time-poor."

**Part 2 — "The 4 levers that actually move fat loss when you're time-poor"**
- Angle: The minimum effective dose, named.
- Platform: Instagram Reels (the actionable, save-able version) + YouTube Short (cross-post)
- Format: B (Checklist)
- Hook: "Fat loss when you're time-poor comes down to 4 levers. The other 17 things you've tried are noise."
- Body outline: Sleep > Protein > Walks > Strength. Each in one line.
- CTA: "Part 3 shows the exact post-meal walk protocol that works when you have 20 minutes."

**Part 3 — "The 20-minute post-meal walk that beats 10,000 steps for fat loss"**
- Angle: Mechanism-explainer that hits the highest search volume term in the series.
- Platform: Instagram Reels (search-discoverable + share-able)
- Format: F (Quick Tip) for IG + A (Explainer) version for YT Shorts
- Hook: "A 20-minute walk after dinner does more for fat loss than 10,000 steps you're stressing about hitting."
- ...

**Part 4 — ...**
**Part 5 — ...**

**Standalone test:**
> If someone sees Part 3 first (the search-friendly one), it works alone as a tip. They can scroll back to Part 1 if intrigued, but Part 3 isn't dependent on the rest. ✓ Pass.

## What the skill reads

- The topic (passed as arg)
- `industries/chiropractic/audiences.md` — for audience-specific angles
- `industries/chiropractic/hook-patterns.md` — to vary hook archetypes across parts (don't use myth opener 5 times)
- `industries/chiropractic/goal-lock.md` — series must serve the goal
- `formats/` — for format options per part
- Active platforms from `config.json`

## Cross-references

- `/content-planner` — weekly calendar; Series Planner is one topic deep
- `/video-director` — once series is planned, video-director scripts each part
- `Follow-Up Engine` (Alex's #9, not yet built here) — automates the "Part 2 of N" hook into each Part-N piece

## Why this works

1. **Series builds authority.** Standalone pieces evaporate. Series compounds — people who watched Part 1 watch Part 2 watch Part 3, and they remember you, not the algorithm.
2. **Each part is leveraged.** A series gives every piece a built-in CTA ("watch Part 2") and built-in context ("this is Part 3 of...").
3. **Climax-first per part AND per series.** Don't bury the payoff in Part 5. Open the series with the most surprising frame.
