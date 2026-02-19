# Cinema Studio Prompt Template

Quick-reference for writing production-quality Hero Frame prompts. Use alongside the video-director skill and industry-specific cinema-defaults.

## The 6-Layer Prompt Structure

Every Hero Frame prompt follows this order:

```
[SHOT TYPE + CAMERA ANGLE] of [SUBJECT],
[ENVIRONMENT],
[LIGHTING],
[CAMERA RIG],
[COMPOSITION],
[MOOD]
```

### Layer Breakdown

| Layer | What to Include | Example |
|-------|----------------|---------|
| **Shot + Angle** | Shot size + camera height/angle | `Medium close-up, eye level` |
| **Subject** | Age, appearance, clothing, expression, action, gesture | `A woman in her early 30s, dark hair pulled back, wearing soft grey athleisure, one hand resting on her lower back, expression of mild discomfort` |
| **Environment** | Location, era, set dressing, props | `Bright modern living room with white couch, green plants, clean wooden floor` |
| **Lighting** | Type, direction, color temp, quality | `Warm diffused window light from camera right, 4500K, soft quality` |
| **Camera Rig** | Body, lens, focal length (from cinema-defaults.md) | `ARRI Alexa, Cooke lens, 35mm` |
| **Composition** | Framing, depth of field, foreground/background, space for overlays | `Shallow depth of field, subject centered with negative space above for text overlay` |
| **Mood** | 2-3 tone words, genre | `Intimate, empathetic, wellness` |

## Before/After Examples

### Generic (Bad)
```
Pregnant woman in comfortable clothing, hand on lower back, warm home environment,
soft natural lighting, 32 weeks pregnant
```

### Production-Quality (Good)
```
Medium shot, eye level. A woman in her early 30s, 32 weeks pregnant, wearing soft grey
athleisure, one hand resting on her lower back, expression of mild discomfort. Bright
modern living room with white couch and green plants. Warm diffused window light from
camera right, color temperature 4500K, soft quality. ARRI Alexa, Cooke lens, 35mm.
Shallow depth of field, subject centered with negative space above for text overlay.
Intimate, empathetic, wellness.
```

### Dramatic/Cinematic (Benchmark)
```
Extreme close-up of a modern chainsaw blade. Every tooth of the chain rendered in sharp
metallic detail. Dark steel against pure black background. A single cold blue light source
from camera left catches the chain teeth, creating hard reflections. Anamorphic lens flare
streaks horizontally. RED V-RAPTOR, Panavision C Series, 50mm. Industrial, ominous,
cinematic.
```

## Quick-Reference Tables

### Shot Types

| Shot | When to Use |
|------|------------|
| `extreme wide shot` | Establishing location, environments |
| `wide shot` | Full body, showing environment |
| `medium shot` | Waist up, general purpose |
| `medium close-up` | Chest up, conversation |
| `close-up` | Face, emotion, detail |
| `extreme close-up` | Texture, eyes, objects, micro detail |
| `over-the-shoulder shot` | Two-person framing |
| `bird's eye view` | Top-down perspective |

### Lighting Types

| Type | Prompt Term | Best For |
|------|------------|----------|
| Natural | `natural lighting`, `sunlight` | Authentic, daytime |
| Diffused | `diffused lighting`, `soft light` | Even, gentle, wellness |
| Golden Hour | `golden hour light` | Warm, emotional |
| Practical | `practical lighting`, `lamplight` | Visible in-scene sources |
| Rim | `rim light`, `edge light` | Subject separation |
| Side | `side lighting` | Dramatic shadows |
| Low Key | `low key lighting` | Dark, moody |
| Volumetric | `volumetric lighting`, `god rays` | Atmospheric |

Always specify: **direction** (`from camera left`), **color temperature** (`warm 3200K`, `cool 5600K`), and **quality** (`soft`, `harsh`, `diffused`).

### Camera Movements

One movement per shot produces the best results:

| Movement | Prompt Term | Best For |
|----------|------------|----------|
| Static | `static shot` | Dialogue, text overlays |
| Push-in | `slow push in`, `dolly in` | Building intensity |
| Pull-back | `pull back`, `dolly out` | Revealing context |
| Pan | `pan left`, `pan right` | Scanning environment |
| Tilt | `tilt up`, `tilt down` | Vertical reveals |
| Orbit | `orbit`, `arc shot` | Subject showcase |
| Crane | `crane up`, `crane down` | Dramatic vertical sweep |
| Tracking | `tracking shot` | Following movement |

Speed modifiers: `slow`, `smooth`, `rapid`. Add `speed ramp` for dramatic reveals.

### Camera Rigs (Common)

| Camera Body | Character | Best For |
|-------------|-----------|----------|
| ARRI Alexa | Warm, cinematic | Narrative, storytelling, wellness |
| RED V-RAPTOR | Sharp, precise | Modern, clean, product |
| Sony Venice | Clean, versatile | All-purpose |
| ARRI Flex | Dark, grainy | Vintage, moody |

| Lens | Character | Best For |
|------|-----------|----------|
| Cooke | Warm bokeh | Character-driven, intimate |
| Canon K35 | Bright, warm | Energetic, inviting |
| Zeiss Ultra Prime | Neutral, clean | Default starting point |
| Panavision C Series | Anamorphic flares | Dramatic, cinematic |

| Focal Length | Effect |
|-------------|--------|
| 14mm | Wide, environment visible |
| 24mm | Standard cinematic, versatile |
| 35mm | Natural perspective, dialogue |
| 50mm | Strong bokeh, portraits |

## Format-Specific Shot Patterns

### Explainer (A) - 3-4 shots
- **Hook:** Medium close-up, shallow DOF, direct eye contact. Warm key light. Static or slow push-in.
- **Sections:** Alternate angles, mix medium shots with detail inserts. Cuts align with SectionCard entrances. Slow dolly or static.
- **Stat moment:** Single steady shot. Let the graphic carry the visual weight.
- **CTA:** Return to opening angle or new medium close-up. Warm, headroom for text.

### Checklist (B) - 5-6 shots
- **Hook:** Close-up, direct eye contact. Confident delivery. Single warm key light.
- **Per item:** Each sign gets its own shot. Alternate subject close-ups with contextual details. Cuts land on ChecklistOverlay entrance. Static or slow push-in.
- **Closing:** Pull back to medium shot. Open, approachable.
- **CTA:** Medium shot, gentle push-in. Lower third clear.

### Demo (C) - 3-4 shots
- **Hook:** Medium close-up, subject facing camera. Relatable.
- **Steps:** Full body or three-quarter. 24mm lens for full-body visibility. Instructions overlay while subject demonstrates. Slow, steady. No fast cuts during instruction.
- **Key Cue:** Close-up on the body part being cued.
- **Frequency + CTA:** Medium shot, direct address.

### MythBuster (D) - 2-3 shots
- **Myth:** Dramatic angle. Low key lighting, desaturated. Tight framing, eye-level or below. Hard light. Static.
- **Truth:** Lighting shifts warmer. Different angle, slightly wider. Energy lifts.
- **CTA:** Medium shot, warm lighting, inviting.

### Walkthrough (E) - 4-6 shots
- **Hook:** Warm medium shot. Soft lighting with fill. Direct address. Slow push-in.
- **Steps:** Show actual environment and process. Cooke lenses for warm bokeh. Slow, smooth movements only. Cuts align with StepIndicator entrances.
- **Reassurance:** Close-up, warm and genuine.
- **CTA:** Pull back to medium. Open, welcoming.

## 9:16 Composition Rules

- **Top 250px:** Reserved for platform UI (username, follow button)
- **Bottom 420px:** Reserved for platform UI (description, share/like buttons)
- **Side margins:** 120px each side
- **Usable safe zone:** ~840x1250px centered
- Center subjects in the middle 60% of the frame
- Use shallow depth of field to separate subject from background
- For text overlay shots, include `"negative space above for text overlay"` in the prompt

## Character Consistency (Multi-Shot)

When the same person appears across multiple shots:
1. Write a "Character DNA" block: `"woman in her 30s, auburn hair in low bun, navy blazer over white blouse, warm complexion"`
2. Reuse the identical description in every prompt
3. Keep clothing and styling identical
4. Reference face detail in the first shot only; use `"the subject"` in subsequent shots

## Quality Keywords

Add as appropriate: `cinematic`, `photorealistic`, `shallow depth of field`, `film grain`, `anamorphic`. Reference cinematographers for style: `Roger Deakins cinematography` (naturalistic), `Wes Anderson framing` (symmetrical).

## See Also

- `/video-director` skill: Full production plan generation with prompt engineering guidance
- `industries/<industry>/cinema-defaults.md`: Industry-specific default camera rigs
- `industries/<industry>/production-guides/cinema-studio-guide.md`: Deep-dive platform reference
- `workflows/ai-generation-guide.md`: End-to-end AI video production workflow
