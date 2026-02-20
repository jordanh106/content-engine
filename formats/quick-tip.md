# Format F: "Quick Tip" (The Micro-Content)

**Duration:** 6-15 seconds
**Best for:** TikTok micro-content, quick health tips, "did you know" facts
**Platform sweet spot:** TikTok (ultra-short, high replay value)

## Structure

| Segment | Time | Purpose |
|---------|------|---------|
| Hook | 0-2s | One punchy line to stop the scroll |
| Tip | 2-10s | Kinetic text reveals the tip word by word |
| CTA | 10-15s | Quick save/share prompt |

## Cinema Studio Rig (Default)

- Camera: Sony FX3 (handheld, natural motion)
- Lens: Sony 24mm f/1.4 GM (wide, immersive)
- Focal Length: 24mm
- Genre: Auto
- Shots: 1 continuous shot (no cuts)

## Vibe Motion Graphics

### Animation Pacing

**Energy:** Ultra-fast, punchy. Every frame counts. Kinetic text fires rapidly with tight delays between words. The hook must land within 2 seconds. No dead time.

### Scene Flow

| Scene | Duration | Component | Animation | Spring Config |
|-------|----------|-----------|-----------|---------------|
| Hook | 0-2s (0-60f) | `HookText` | Scale 1.4 to 1, clip-path reveal in 10 frames | damping: 10, stiffness: 280 |
| Tip | 2-10s (60-300f) | `KineticText` | Per-word spring with staggered delays | damping: 10, stiffness: 180 |
| CTA | Final 3-5s | `CallToAction` | Scale 0.8 to 1, glow delayed 10 frames | damping: 12, stiffness: 180 |

### Cinema Studio Shot Direction

- **Hook (0-2s):** Close-up, direct eye contact. Handheld energy. Fast zoom or whip pan to grab attention.
- **Tip (2-10s):** Motion graphics only, or split screen with B-roll. Let the kinetic text carry the content.
- **CTA:** Quick lower-third or full-screen card. Keep it snappy.

### Text Overlay Placement

Large, centered kinetic text at 72px. Bold, high contrast. Emphasized words scale up to 1.3x with brand color. All within the 9:16 safe zone (120px sides, 250px top, 420px bottom).

## Voiceover Template

```
[HOOK - one sentence, punchy]

[TIP - 3-8 words, each landing with emphasis]

Save this for later.
```

## Remotion Composition: `QuickTip`

Input schema fields:
- `hookText` (string) - One punchy hook line
- `tipWords` (array) - Words with delay, optional scale and color
- `ctaText` (string) - "Save this"
- `theme` (object) - Brand colors and fonts

## Platform Versions

| Platform | Aspect | Resolution |
|----------|--------|------------|
| TikTok / Reels / Shorts | 9:16 | 1080x1920 |
| Instagram Feed | 4:5 | 1080x1350 |
| YouTube / Website | 16:9 | 1920x1080 |

## Platform Notes

- **TikTok:** Primary platform for this format. Ultra-short, high replay value. Target 6-10 seconds for maximum completion rate.
- **Instagram Reels:** Works well as a "quick save" post. Add text overlay with the tip for accessibility.
- **YouTube Shorts:** Can be grouped into compilations of 3-5 tips.
