# Format A: "What Is [X]?" (The Explainer)

**Duration:** 30-45 seconds
**Best for:** Education, awareness, SEO discovery
**Platform sweet spot:** YouTube Shorts (educational hooks perform best)

## Structure

| Segment | Time | Purpose |
|---------|------|---------|
| Hook | 0-3s | Question or surprising statement that stops the scroll |
| What's happening | 3-15s | Simple explanation with visual support |
| Why it matters | 15-25s | The consequence of ignoring it, or the connection most people miss |
| What you can do | 25-35s | Brief actionable step or "here's how we help" |
| CTA | 35-45s | Follow for more, share with someone who needs this |

## Cinema Studio Rig (Default)

- Camera: ARRI Alexa (warm, professional)
- Lens: Cooke (character-driven bokeh)
- Focal Length: 35mm
- Genre: Intimate
- Shots: 3-4 shots, 2-3 seconds each

## Vibe Motion Graphics

### Animation Pacing

**Energy:** Steady, educational. Medium tempo. Each scene breathes before the next enters.

### Scene Flow

| Scene | Duration | Component | Animation | Spring Config |
|-------|----------|-----------|-----------|---------------|
| Hook | 0-3s (0-90f) | `HookText` | Scale 1.2 to 1 + slide up 20px | damping: 15, stiffness: 200 |
| Title | 3-6s (90-180f) | `TitleCard` | Slide down from -60px, subtitle delayed 8 frames | damping: 200 |
| Sections | Variable | `SectionCard` (per section) | Two-stage fade: label first, text 6 frames later | damping: 200 |
| Stat | 3s before CTA | `StatCard` (if stat provided) | Scale 0.5 to 1, label fade delayed 10 frames | damping: 12, stiffness: 200 |
| CTA | Final 3-5s | `CallToAction` | Scale 0.8 to 1, glow delayed 10 frames | damping: 12, stiffness: 180 |

### Section Timing

Each `SectionCard` uses its own `durationInSeconds` field. Allow 10 frames (0.33s) entrance + 8 frames (0.27s) exit. Hold the content for the remainder. Sections play sequentially via `<Series>`.

### Cinema Studio Shot Direction

- **Hook (0-3s):** Medium close-up, shallow depth of field, subject looking into camera. Warm key light from camera-right. Static or slow push-in (0.5x speed).
- **Sections (3-35s):** Cut between 2-3 angles. Mix medium shots with detail inserts. Each cut aligns with a new SectionCard entrance. Slow dolly or static shots, never handheld.
- **Stat moment:** Hold on a single steady shot. Let the motion graphic carry the visual weight.
- **CTA:** Return to the opening angle or a new medium close-up. Warm, inviting framing with headroom for text overlay.

### Text Overlay Placement

Keep all text within the 9:16 safe zone (120px side margins, 250px top, 420px bottom). SectionCard labels sit in the upper third. Stat values center-screen. CTA text sits in the lower safe zone above the platform UI.

## Voiceover Template

```
[Hook question or statement]

Here's what's actually happening. [Simple explanation using everyday language, not jargon]

And here's why that matters. [Consequence or connection]

[What they can do about it / how your service helps]

If this sounds like you [or your child / or someone you know], share this with someone who needs to hear it.
```

## Remotion Composition: `Explainer`

Input schema fields:
- `title` (string) - Topic name for title card
- `hookText` (string) - Text overlay for first 3 seconds
- `sections` (array) - Label + text + duration for each segment
- `stat` (optional) - Value + label for stat card
- `ctaText` (string) - Call to action text
- `theme` (object) - Brand colors and fonts

## Platform Versions

| Platform | Aspect | Resolution |
|----------|--------|------------|
| TikTok / Reels / Shorts | 9:16 | 1080x1920 |
| Instagram Feed | 4:5 | 1080x1350 |
| YouTube / Website | 16:9 | 1920x1080 |

## Platform Notes

- **Instagram Reels:** Add trending audio if it fits. First frame needs text overlay.
- **YouTube Shorts:** Description should include condition keywords and common search questions.
