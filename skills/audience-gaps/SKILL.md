---
name: audience-gaps
description: Surfaces the silent questions your audience is asking while watching a specific piece of content — the questions they'd never type into a comment but would absolutely DM you about. Per-piece, not market-wide. Run BEFORE publishing to find what the script doesn't answer. Adapted from Grow with Alex's "17 INSANE Claude Skills" video.
argument-hint: "<script or carousel text>" — paste the piece you're about to publish
context: fork
agent: Explore
allowed-tools: Read, Write, AskUserQuestion
---

# Audience Gaps — The silent-question surfacer

For a piece of content you're about to publish, surface the 3-5 questions your target audience will silently ask while watching. These are the questions:
- They won't comment publicly (too vulnerable, or "stupid question" fear)
- They might DM you about (if the piece is good enough)
- That, if you addressed them in the piece, would dramatically increase save rate

Different from `/audience-pulse` — that captures MARKET-WIDE demand from Reddit + Google PAA. Audience Gaps is PER-PIECE — what THIS specific Reel leaves unanswered.

## When to use

- BEFORE publishing a Reel, carousel, or video
- During script edits — to find the "wait, but what about..." moment that's missing
- After a piece underperformed — to figure out what it left on the table
- When repurposing — to find the follow-up content the original piece naturally creates

## How to use

```
/audience-gaps "<paste the script or carousel body here>"
```

Or with an audience override:
```
/audience-gaps --audience prenatal "<script>"
```

The skill reads the script, loads the target audience's persona, and returns the silent questions ranked by how likely each is to convert into a save / DM / consult booking.

## Example output

**Input script:**
> "20-minute walk after dinner does more for fat loss than 10,000 steps you're stressing about hitting. Because it's not about the step count — it's about timing. Walking after meals spikes blood sugar regulation before it gets stored. Ten thousand steps scattered across a chaotic day is a number you chase and usually miss. Three short walks tied to your meals is a system you actually keep. And here's the part nobody mentions: you'll do it again tomorrow."

**Audience:** adult (desk workers)

**Output — silent questions ranked:**

**Q1: "Okay, but does one walk after my biggest meal actually do anything, or do I need to do it after every meal?"**
- Why they're asking: The script contradicts itself mid-way. The body says "three short walks tied to your meals" but the headline says "one 20-minute walk."
- Cost of not addressing: Comment confusion + low save rate (people save when an idea is one clear actionable thing).
- Fix: Choose one. If it's three walks, say so up front. If one walk after the biggest meal does it, say that and cut "tied to your meals."

**Q2: "Does this still work if dinner is at 9pm?"**
- Why they're asking: This audience eats late. The script assumes early dinner.
- Cost of not addressing: 30%+ of the audience falls off here.
- Fix: One line — "Works the same if dinner is at 9. Walk at 9:30."

**Q3: "What counts as a walk — pacing around the house? Treadmill? Outside?"**
- Why they're asking: Compliance question. People want permission to do the lazy version.
- Cost of not addressing: Lower follow-through → no compounding benefit → they don't credit you with the win.
- Fix: "Anything that gets your heart rate up 10bpm above resting. Treadmill, pacing, mall walking all count."

**Q4: "Will this conflict with [intermittent fasting / OMAD / other diet protocol]?"**
- Why they're asking: This audience layers protocols. They want to know if they have to choose.
- Cost: Lower if you're not targeting that sub-segment.
- Fix: Optional — "If you fast, walk after your eating window opens."

## What the skill reads

- The piece (passed as arg or from active file)
- `industries/chiropractic/audiences.md` — pulls the target audience's "what they DM or ask in person" section
- `industries/chiropractic/goal-lock.md` — surfaces gaps especially in light of the goal (e.g. if goal is consult bookings, prioritise questions that resolve booking friction)

## Pipeline integration

Two natural places to wire this in:

1. **Pre-publish step in `/video-director`** — before locking a script, run audience-gaps and surface the top 2 silent questions for the writer to choose to address or knowingly skip.

2. **Post-publish learning loop** — for any piece that underperforms, run audience-gaps retroactively and add the surfaced questions to the Inspiration Inbox as follow-up content ideas.

## Cross-references

- `industries/chiropractic/audiences.md` — source of "what they DM" sections
- `/audience-pulse` skill — captures market demand; Audience Gaps captures per-piece demand
- `industries/chiropractic/hook-patterns.md` — silent questions often become next-piece hooks

## Why this works

1. **Save rate is gated by question-resolution.** A piece that answers the silent question gets saved. One that doesn't get scrolled past.
2. **Comments lie.** Public comments are performance. DMs are honest. Audience Gaps writes for the DM-version of your audience.
3. **Self-feeding.** Every gap surfaced is a next-piece idea. The skill creates inventory while improving the current piece.
