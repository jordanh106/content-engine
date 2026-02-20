# Format C: "The Exercise/Tutorial" (The Demo)

**Duration:** 30-60 seconds
**Best for:** Actionable value, saves, return viewers
**Platform sweet spot:** Both (exercise/tutorial content saves well everywhere)

## Structure

| Segment | Time | Purpose |
|---------|------|---------|
| Hook | 0-3s | "Try this if you [experience condition]" |
| Setup | 3-10s | Why this exercise/technique helps, what it targets |
| Demo | 10-40s | Visual demonstration with voiceover cues |
| Frequency | 40-50s | "Do this [X] times a day for [Y] weeks" |
| CTA | 50-60s | "Save this and try it today" |

## Cinema Studio Rig (Default)

- Camera: Sony Venice (clean, sharp)
- Lens: Canon K35 (bright, warm)
- Focal Length: 24mm (full body visible)
- Genre: Intimate
- Shots: 3-4 shots showing setup, movement, and key form cues

## Vibe Motion Graphics

### Animation Pacing

**Energy:** Clear, instructional. Steady beat. Each step holds long enough for the viewer to absorb the instruction before the next appears.

### Scene Flow

| Scene | Duration | Component | Animation | Spring Config |
|-------|----------|-----------|-----------|---------------|
| Hook | 0-3s (0-90f) | `HookText` | Scale 1.2 to 1 + slide up 20px | damping: 15, stiffness: 200 |
| Title | 3-6s (90-180f) | `TitleCard` | Slide down from -60px | damping: 200 |
| Steps | ~6-8s each | `StepIndicator` (per step) | Slide up 50px, description delayed 8 frames | damping: 200 |
| Key Cue | 3s | `SectionCard` | Two-stage fade: "Key cue" label, then cue text | damping: 200 |
| Frequency | 3s | `FrequencyCard` | Key cue slide 40px, badge scale pop delayed 8 frames | damping: 200 (slide), damping: 12 (badge) |
| CTA | Final 3-5s | `CallToAction` | Scale 0.8 to 1, glow delayed 10 frames | damping: 12, stiffness: 180 |

### Step Sequencing

Steps play sequentially via `<Series>`. Each `StepIndicator` shows the step number, label, and description. The step number and label enter together, description follows 8 frames later. Hold each step for the full duration so viewers can follow along. For 4 steps across 24 seconds, allocate 6 seconds (180 frames) per step: 10 frames entrance, 150 frames hold, 20 frames exit.

### Cinema Studio Shot Direction

- **Hook (0-3s):** Medium close-up, subject facing camera. Establishes relatability.
- **Title (3-6s):** Can hold the same shot or cut to a wider angle showing the exercise space.
- **Steps (10-40s):** Full body or three-quarter shot showing the exercise movement. Camera stays wide enough to see form. Use a 24mm lens for full-body visibility. Each step instruction overlays as the subject demonstrates. Slow, steady shots. No fast cuts during instruction.
- **Key Cue:** Close-up on the body part being cued (neck angle, hand position, etc.).
- **Frequency + CTA:** Return to medium shot. Subject faces camera for direct address.

### Text Overlay Placement

StepIndicator overlays sit in the lower third of the safe zone so they do not obscure the exercise demonstration. Step numbers anchor to the left margin. FrequencyCard centers horizontally. All within the 9:16 safe zone (120px sides, 250px top, 420px bottom).

## Voiceover Template

```
If you [condition/symptom], try this.

This is [exercise/technique name]. It targets [what it does in plain language].

[Step-by-step instruction: "Start by... Then... Hold for..."]

The key is [one form cue that matters most].

Do this [frequency]. You should start noticing a difference within [timeframe].

Save this and try it today.
```

## Remotion Composition: `Demo`

Input schema fields:
- `title` (string) - Exercise/technique name
- `hookText` (string) - "Try this if you..."
- `steps` (array) - Instruction text for each step
- `keyCue` (string) - Most important form cue
- `frequency` (string) - "3x daily for 2 weeks"
- `ctaText` (string) - Call to action
- `theme` (object) - Brand colors and fonts

## Platform Versions

| Platform | Aspect | Resolution |
|----------|--------|------------|
| TikTok / Reels / Shorts | 9:16 | 1080x1920 |
| Instagram Feed | 4:5 | 1080x1350 |
| YouTube / Website | 16:9 | 1920x1080 |

## Platform Notes

- **Instagram Reels:** Add "Save this" in the caption. Exercise content has high save rates.
- **YouTube Shorts:** Include the exercise name and condition in the title for search discovery.
