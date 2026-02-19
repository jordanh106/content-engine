# Format B: "Signs Your [X] Needs [Y]" (The Checklist)

**Duration:** 30-45 seconds
**Best for:** Parents, shareability, saves
**Platform sweet spot:** Instagram Reels (checklists get saved and shared)

## Structure

| Segment | Time | Purpose |
|---------|------|---------|
| Hook | 0-3s | "Here are [X] signs your [subject] is telling you something" |
| Sign 1 | 3-10s | Visual + brief explanation |
| Sign 2 | 10-17s | Visual + brief explanation |
| Sign 3 | 17-24s | Visual + brief explanation |
| Signs 4-5 | 24-35s | Quick hits if needed |
| Wrap + CTA | 35-45s | "If you're seeing these, it's worth getting checked" |

## Cinema Studio Rig (Default)

- Camera: Sony Venice (clean, sharp)
- Lens: Canon K35 (bright, warm)
- Focal Length: 35mm
- Genre: Intimate
- Shots: 5-6 shots (one per sign + intro/outro), 2 seconds each

## Vibe Motion Graphics

### Animation Pacing

**Energy:** Building momentum. Each checklist item enters with consistent rhythm, creating a satisfying cadence. Tempo increases slightly toward the end.

### Scene Flow

| Scene | Duration | Component | Animation | Spring Config |
|-------|----------|-----------|-----------|---------------|
| Hook | 0-3s (0-90f) | `HookText` | Scale 1.2 to 1 + slide up 20px | damping: 15, stiffness: 200 |
| Title | 3-6s (90-180f) | `TitleCard` | Slide down from -60px | damping: 200 |
| Items | ~5s each | `ChecklistOverlay` (per item) | Slide from left -80px, checkmark scale pop delayed 12 frames | damping: 200 (slide), damping: 15 (checkmark) |
| Closing | 3s | `SectionCard` | Two-stage fade | damping: 200 |
| CTA | Final 3-5s | `CallToAction` | Scale 0.8 to 1, glow delayed 10 frames | damping: 12, stiffness: 180 |

### Item Sequencing

Each `ChecklistOverlay` gets equal screen time. For 5 items across ~25 seconds, that is 5 seconds (150 frames) per item. Allow 10 frames entrance, 120 frames hold, 20 frames exit. Items play sequentially via `<Series>`. The checkmark pops 12 frames after the slide completes, creating a two-beat rhythm: slide, then check.

### Cinema Studio Shot Direction

- **Hook (0-3s):** Close-up with direct eye contact. Confident delivery. Single warm key light.
- **Items (6-35s):** Each checklist item gets its own shot. Alternate between subject close-ups and contextual detail shots (hands, posture, movement). Each cut lands on the `ChecklistOverlay` entrance frame. Slow push-in or static, never panning.
- **Closing:** Pull back to a medium shot. Open, approachable framing.
- **CTA:** Same medium shot or gentle push-in. Leave lower third clear for text.

### Text Overlay Placement

ChecklistOverlay items use the left 60% of screen width, leaving right side for the visual. Number badges sit at the left margin (120px). Labels align beside the badge. Descriptions sit below. All within the 9:16 safe zone (120px sides, 250px top, 420px bottom).

## Voiceover Template

```
[Number] signs your [subject] is asking for help. And most [audience] miss number [highest].

Number one: [Sign with brief explanation]

Number two: [Sign with brief explanation]

Number three: [Sign with brief explanation]

[Optional: Numbers four and five, rapid fire]

If you checked more than two, it might be time to get things looked at. Save this so you remember.
```

## Remotion Composition: `Checklist`

Input schema fields:
- `title` (string) - Checklist topic
- `hookText` (string) - Opening line
- `items` (array) - Number + label + description for each sign
- `closingText` (string) - "How many did you check?" or custom
- `ctaText` (string) - Call to action
- `theme` (object) - Brand colors and fonts

## Platform Notes

- **Instagram Reels:** This format drives the most saves. End with "How many did you check?" to drive comments.
- **YouTube Shorts:** Add all signs as keywords in the description for search.
