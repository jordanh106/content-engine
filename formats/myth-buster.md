# Format D: "Myth vs. Truth" (The Myth Buster)

**Duration:** 15-30 seconds
**Best for:** Engagement, comments, shares
**Platform sweet spot:** Instagram Reels (controversy drives comments)

## Structure

| Segment | Time | Purpose |
|---------|------|---------|
| Myth statement | 0-5s | Bold text + voiceover delivering the common belief |
| Pause | 5-7s | Let it sit |
| Truth | 7-20s | What actually happens, with visual support |
| CTA | 20-30s | "Drop a comment if you believed this" |

## Cinema Studio Rig (Default)

- Camera: RED V-RAPTOR (sharp, detailed)
- Lens: Zeiss Ultra Prime (neutral, precise)
- Focal Length: 50mm
- Genre: Auto
- Shots: 2-3 shots (myth visual, truth visual, closer)

## Vibe Motion Graphics

### Animation Pacing

**Energy:** Fast, punchy, dramatic. This is the shortest format. Every animation hits hard and fast. The myth-to-truth reveal is the centerpiece moment.

### Scene Flow

| Scene | Duration | Component | Animation | Spring Config |
|-------|----------|-----------|-----------|---------------|
| Myth | 0-5s (0-150f) | `MythTruthReveal` (type: "myth") | Stamp scale 3 to 1 + rotation, text slide delayed 6 frames | damping: 8, stiffness: 200 |
| Pause | 5-7s (150-210f) | Hold | Myth text holds on screen. No new animation. Let it sit. | N/A |
| Truth | 7-15s (210-450f) | `MythTruthReveal` (type: "truth") | Stamp scale 3 to 1 + rotation, text slide delayed 6 frames | damping: 8, stiffness: 200 |
| Explanation | 15-22s (450-660f) | `SectionCard` | Two-stage fade | damping: 200 |
| CTA | Final 3-5s | `CallToAction` | Scale 0.8 to 1, glow delayed 10 frames | damping: 12, stiffness: 180 |

### Reveal Timing

The `MythTruthReveal` stamp animation is the signature moment. The stamp scales from 3x to 1x with a slight rotation, creating a dramatic "stamped" effect. The bouncy spring (damping: 8) gives it visible overshoot. The text slides in 6 frames after the stamp lands. Hold the myth for at least 2 seconds of silence before the truth reveal to build tension.

### Cinema Studio Shot Direction

- **Myth (0-5s):** Dramatic angle. Low key lighting, slightly desaturated. Subject delivers the myth with confidence. Tight framing, eye-level or slightly below. A single hard light source creates mood. Static camera.
- **Pause (5-7s):** Same shot holds. Silence. Let the myth sit.
- **Truth (7-15s):** Lighting shifts warmer. Cut to a different angle, slightly wider. The energy lifts. Subject breaks into the truth with authority.
- **Explanation (15-22s):** Cut to detail shot or B-roll that supports the explanation. Or hold on the subject for direct address.
- **CTA:** Medium shot, warm lighting, open framing. Inviting the viewer to comment.

### Text Overlay Placement

Myth and Truth stamps center-screen with maximum visual impact. Use the full safe zone width. Bold typography at 56px minimum for stamp text, 42px for supporting text. High contrast: myth uses red-tinted overlay, truth uses green/teal. All within the 9:16 safe zone (120px sides, 250px top, 420px bottom).

## Voiceover Template

```
MYTH: [Common belief stated confidently]

TRUTH: [What actually happens, stated simply]

[One sentence of brief explanation]

Did you believe this? Drop it in the comments.
```

## Remotion Composition: `MythBuster`

Input schema fields:
- `mythText` (string) - The common belief
- `truthText` (string) - The reality
- `explanationText` (string) - Brief explanation
- `ctaText` (string) - "Did you believe this?"
- `theme` (object) - Brand colors and fonts

## Platform Notes

- **Instagram Reels:** This is the shortest format. Fast, punchy, highly shareable. Comment engagement is the primary metric.
- **YouTube Shorts:** These perform well in "Did You Know" style compilations.
