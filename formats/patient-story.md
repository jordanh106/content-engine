# Format G: "Patient Story" (The Testimonial)

**Duration:** 15-30 seconds
**Best for:** Social proof, patient journeys, testimonials, trust building
**Platform sweet spot:** Instagram Reels + Facebook (warm, shareable, builds trust)

## Structure

| Segment | Time | Purpose |
|---------|------|---------|
| Hook | 0-5s | Personal, relatable opening line |
| Quote | 5-15s | Patient's own words with attribution |
| Stat (optional) | 15-22s | Supporting data point for credibility |
| CTA | Final 4-5s | Invitation to book or learn more |

## Cinema Studio Rig (Default)

- Camera: ARRI Alexa Mini (warm, cinematic skin tones)
- Lens: Cooke S4/i 50mm (warm, gentle fall-off)
- Focal Length: 50mm
- Genre: Auto
- Shots: 3-4 shots (establishing, medium close-up for quote, detail, CTA)

## Vibe Motion Graphics

### Animation Pacing

**Energy:** Warm, personal, building. Slower springs than other formats. Let the quote breathe. The stat (if present) adds a punctuation of credibility before the CTA.

### Scene Flow

| Scene | Duration | Component | Animation | Spring Config |
|-------|----------|-----------|-----------|---------------|
| Hook | 0-5s (0-150f) | `HookText` | Scale 1.4 to 1, clip-path reveal | damping: 10, stiffness: 280 |
| Quote | 5-15s (150-450f) | `QuoteCard` | Text fade-in, attribution slide delayed 12 frames | damping: 200 |
| Stat | 15-22s (450-660f) | `StatCard` (optional) | Number count-up, label fade | damping: 12, stiffness: 160 |
| CTA | Final 4-5s | `CallToAction` | Scale 0.8 to 1, glow delayed 10 frames | damping: 12, stiffness: 180 |

### Cinema Studio Shot Direction

- **Hook (0-5s):** Warm lighting, slightly soft focus. Medium shot of the practice or waiting room. Establish warmth and safety.
- **Quote (5-15s):** Medium close-up. Natural light or soft key. The patient's words appear as motion graphics over ambient footage. Intimate framing.
- **Stat (15-22s):** Cut to detail shot (hands adjusting, X-ray, posture check) while the stat overlays.
- **CTA:** Open framing, inviting smile, warm tones. The practice is a welcoming place.

### Text Overlay Placement

Quote text centered at 48px with quotation marks. Attribution below at 32px. Stat value large (80px) centered, label beneath. All within the 9:16 safe zone (120px sides, 250px top, 420px bottom).

## Voiceover Template

```
[HOOK - warm, empathetic opening]

[QUOTE - patient's actual words, read naturally]

[STAT - optional supporting number]

[CTA - warm invitation, no pressure]
```

## Remotion Composition: `PatientStory`

Input schema fields:
- `hookText` (string) - Warm, relatable hook
- `quote` (string) - Patient's words
- `attribution` (string) - Patient name/initial
- `role` (string, optional) - Context (e.g., "Patient, 8 months postpartum")
- `stat` (object, optional) - { value, label }
- `ctaText` (string) - Warm CTA
- `theme` (object) - Brand colors and fonts

## Platform Versions

| Platform | Aspect | Resolution |
|----------|--------|------------|
| TikTok / Reels / Shorts | 9:16 | 1080x1920 |
| Instagram Feed | 4:5 | 1080x1350 |
| YouTube / Website | 16:9 | 1920x1080 |

## Platform Notes

- **Instagram Reels:** Primary platform. Warm stories build trust and drive DMs. Pin to profile for social proof.
- **Facebook:** Patient stories perform exceptionally well. Share in local community groups.
- **TikTok:** Works when framed as a transformation story. "Before and after" angle increases engagement.
