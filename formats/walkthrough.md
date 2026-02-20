# Format E: "What Happens During [X]" (The Walkthrough)

**Duration:** 45-60 seconds
**Best for:** Anxiety reduction, new customer/patient conversion
**Platform sweet spot:** YouTube Shorts (people search for "what to expect")

## Structure

| Segment | Time | Purpose |
|---------|------|---------|
| Hook | 0-5s | "Here's exactly what happens when [you/your child] gets [service]" |
| Step 1 | 5-15s | What happens first (consultation, assessment) |
| Step 2 | 15-30s | The service itself (with reassuring language) |
| Step 3 | 30-45s | What to expect after |
| Reassurance + CTA | 45-60s | "It's [gentle/safe/effective] and [audience]-specific" |

## Cinema Studio Rig (Default)

- Camera: ARRI Alexa (warm, professional)
- Lens: Cooke (warm bokeh)
- Focal Length: 35mm
- Genre: Intimate
- Shots: 4-6 shots walking through each step visually

## Vibe Motion Graphics

### Animation Pacing

**Energy:** Gentle, reassuring. Calm and steady. This format reduces anxiety, so animations should feel smooth and unhurried. Longer holds, softer entrances, no snappy or bouncy springs.

### Scene Flow

| Scene | Duration | Component | Animation | Spring Config |
|-------|----------|-----------|-----------|---------------|
| Hook | 0-5s (0-150f) | `HookText` | Scale 1.2 to 1 + slide up 20px | damping: 15, stiffness: 200 |
| Title | 5-8s (150-240f) | `TitleCard` | Slide down from -60px, subtitle delayed 8 frames | damping: 200 |
| Steps | ~10-12s each | `StepIndicator` (per step) | Slide up 50px, description delayed 8 frames | damping: 200 |
| Reassurance | 5s | `SectionCard` | Two-stage fade: label then text | damping: 200 |
| CTA | Final 5s | `CallToAction` | Scale 0.8 to 1, glow delayed 10 frames | damping: 12, stiffness: 180 |

### Step Sequencing

Steps play sequentially via `<Series>`. Each step gets generous screen time (10-12 seconds) because this format prioritizes comprehension over speed. For 3 steps across ~35 seconds, allocate 11-12 seconds (330-360 frames) per step: 10 frames entrance, ~300 frames hold, 20 frames exit. The step number and label enter together as a unit, description follows 8 frames later. Use smooth (damping: 200) springs throughout. No bouncy or snappy animations.

### Cinema Studio Shot Direction

- **Hook (0-5s):** Warm, inviting medium shot. Soft lighting with fill. Subject speaks directly to camera with an empathetic, reassuring tone. Shallow depth of field. Slow push-in (0.25x speed).
- **Title (5-8s):** Can hold the same warm shot while the title card overlays.
- **Steps (8-45s):** Show the actual environment and process. For "Assessment," show the consultation space. For "The Service," show gentle, non-threatening angles of the service being performed. For "After," show the patient/client leaving relaxed. Use Cooke lenses for warm bokeh. Slow, smooth camera movements only. Each cut aligns with a new StepIndicator entrance.
- **Reassurance:** Close-up on subject's face, warm and genuine. Direct address.
- **CTA:** Pull back to medium shot. Open, welcoming framing. Headroom for text overlay.

### Text Overlay Placement

StepIndicator overlays sit in the upper third to keep the visual scene visible below. Use gentle colors from the theme (avoid red, harsh contrast). Step numbers use the heading font at 48px. Descriptions use the body font at 36px. Reassurance text centers mid-screen. All within the 9:16 safe zone (120px sides, 250px top, 420px bottom).

## Voiceover Template

```
A lot of [audience] want to know: what actually happens during [service]? Here's the honest answer.

First, [step one in warm, simple language].

Then, [step two, emphasizing gentleness and safety].

After that, [what to expect, including normal responses].

That's it. It's [gentle/safe/effective], and it's designed specifically for [audience / condition].

If you've been thinking about it, this is your sign.
```

## Remotion Composition: `Walkthrough`

Input schema fields:
- `title` (string) - Service/procedure name
- `hookText` (string) - "Here's exactly what happens..."
- `steps` (array) - Step number + label + description
- `reassuranceText` (string) - Closing reassurance line
- `ctaText` (string) - Call to action
- `theme` (object) - Brand colors and fonts

## Platform Versions

| Platform | Aspect | Resolution |
|----------|--------|------------|
| TikTok / Reels / Shorts | 9:16 | 1080x1920 |
| Instagram Feed | 4:5 | 1080x1350 |
| YouTube / Website | 16:9 | 1920x1080 |

## Platform Notes

- **YouTube Shorts:** "What to expect" is a high-intent search query. Optimize descriptions with the service name + "what to expect" + "first visit."
- **Instagram Reels:** Share this in DMs to potential new customers/patients considering their first appointment.
