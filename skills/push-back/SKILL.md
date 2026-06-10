---
name: push-back
description: Forces the contrarian counter-narrative. Takes a topic everyone in your niche is saying the same thing about, and surfaces the unexpected angle that puts you on the side opposite consensus. Differentiation generator. Adapted from Grow with Alex's "17 INSANE Claude Skills" video.
argument-hint: "<topic>" — the consensus topic you want a counter-narrative for
context: fork
agent: Explore
allowed-tools: Read, Write, WebSearch, AskUserQuestion
---

# Push Back — The contrarian angle

Pick a topic. Find what every creator in the niche is saying about it. Generate the angle that takes the opposite side — credibly. Output is a position statement + the 3 best supporting points + the strongest objection you'll face + how to handle it.

This isn't contrarianism for clicks. It's about finding the angle where you're uniquely qualified, where consensus is lazy, and where saying the opposite is both true AND useful.

## When to use

- Every creator in the niche is making the same video and you don't want to add another one
- You're looking at a saturated topic (e.g., "5 stretches for low back pain") and want a different angle
- You're building authority in a segment and want a piece that sets you apart
- You're stuck because the obvious angle is boring

## How to use

```
/push-back "stretching the hamstrings to fix low back pain"
```

The skill:
1. Researches what the consensus view is (WebSearch + reads `viral-insights/*` + `creator-insights/*`)
2. Identifies what the consensus is missing or oversimplifying
3. Generates the counter-position, framed clearly
4. Lists the 3 best supporting points
5. Lists the strongest objection a viewer will raise
6. Drafts the response to that objection

## Example output

**Topic:** "Stretching the hamstrings to fix low back pain"

**Consensus view (from research):**
> Tight hamstrings pull on the pelvis → low back pain. Solution: stretch the hamstrings daily.

**Counter-position:**
> Stretching tight hamstrings is making your low back pain worse. The hamstrings are tight because they're stabilising — your pelvis is unstable. Stretching them removes the only thing holding you up.

**Supporting points (ranked):**
1. The hamstrings are reactive, not causal. If you palpate the sacrotuberous ligament during a hamstring stretch on a hypermobile pelvis, you can feel the SI joint widen — pain comes from joint, not muscle.
2. Patients with chronic low back pain often have hypermobile, not stiff, lumbar spines. Adding more range under-load worsens the underlying problem.
3. The cohort that actually responds to hamstring stretching is endurance athletes with iliopsoas dominance — not desk-job patients. Lumping them together is the mistake.

**Strongest objection:**
> "But my hamstrings feel better after stretching."

**How to handle it:**
> "Feel better in the moment, yes — short-term sensory change. But pain back next morning, often worse. That's the pattern: relief that doesn't last. If stretching worked we'd have solved low back pain in 1985."

**Topic match for our positioning:**
- Audience: adult (desk workers) + athlete (specifically running / lifting)
- Format: D (Myth Buster) or A (Explainer)
- Hook archetype: Myth opener
- Goal alignment: HIGH (positions us as the expert, prevents the "another stretching video" race-to-bottom)

## What the skill reads

- The topic (passed as arg)
- `industries/chiropractic/audiences.md` — to know which audience this lands with
- `industries/chiropractic/creator-insights/*` — to see what other creators have already said
- `industries/chiropractic/goal-lock.md` — counter-position must serve the goal
- WebSearch — for consensus capture
- `viral-insights/*` — to see what's currently trending against the consensus

## Cross-references

- `industries/chiropractic/hook-patterns.md` — counter-positions usually land as Myth Opener hooks
- `idea-ranker.ts` `competitiveGap` sub-score — Push Back is the active generator that complements that passive scorer
- `audiences.md` — to ensure the counter-position lands with at least one audience segment

## Why this works

1. **Saturated topics need contrast.** Adding the 100th "5 stretches" video is invisible. The "stretching is making it worse" video gets remembered.
2. **Credible counter-narrative is the moat.** Anyone can be contrarian. Few can be contrarian AND right. The skill enforces "credibly."
3. **Forces sharpness.** The objection-and-response section makes you ready for comments BEFORE publishing.
