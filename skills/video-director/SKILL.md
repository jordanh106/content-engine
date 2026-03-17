---
name: video-director
description: Turn a content plan entry into a complete video production plan. Generates voiceover script, Cinema Studio shot prompts, Remotion data, and CapCut assembly instructions.
argument-hint: "[topic] as [format]" or "[video code from library]"
context: fork
agent: Explore
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# Video Director: Script to Production Plan

Transform a topic and format assignment into a complete, production-ready video plan.

## When to Use

- After `/content-planner` assigns a topic and format
- When you want to create a new video not yet in the content library
- When you want to expand a content library entry into a full production plan (like the 3 example videos in the chiropractic library)
- When adapting an existing video concept to a different industry

## What It Does

Produces a complete production plan containing:
1. **Voiceover script** with delivery cues, ready to record
2. **Cinema Studio shot list** with Hero Frame prompts and camera movements
3. **Remotion data JSON** matching the composition's Zod schema (for motion graphics)
4. **Vibe Motion graphic prompts** (if Cinema Studio workflow)
5. **CapCut assembly instructions** (shot order, transitions, music notes)
6. **Platform-specific notes** (captions, hashtags, description keywords)

## How to Use

### From a Content Planner Entry
```
/video-director "What Is Tech Neck?" as explainer
```

### From an Existing Library Code
```
/video-director D1
```
This expands the D1 entry from the content library into a full production plan (like the 3 example videos).

### For a New Topic
```
/video-director "Why Deep Squats Are Good for You" as demo for chiropractic
```

### For a Different Industry
```
/video-director "What Is a Root Canal?" as walkthrough for dental
```

## Step-by-Step Process

### Step 1: Load Context

Read these files (paths relative to content-engine repo root):
- `formats/<format>.md` - The assigned format template
- `industries/<industry>/brand.md` - Voice, tone, humor rules
- `industries/<industry>/cinema-defaults.md` - Default camera rigs
- `industries/<industry>/config.json` - Audience segments and conditions
- `industries/<industry>/hook-patterns.md` - Proven hook patterns by type and platform

If a library code was given (e.g., "D1"), also read:
- `industries/<industry>/content-library.md` - Find the existing entry

### Step 2: Research the Topic

If the topic requires medical, technical, or factual accuracy:
1. Check if the content library already has a script for this topic
2. If not, use your training knowledge to ensure accuracy
3. Note any claims that should include supporting data

### Step 3: Write the Voiceover Script

Follow the format template's voiceover structure. Apply the brand voice from brand.md.

**Script rules:**
- Include delivery cues in brackets: `[Warm, empathetic]`, `[Pause 2 seconds]`, `[Deadpan]`
- Match the target duration for the format (word count ~ duration x 2.5)
- Use "you/your" language, not clinical third-person
- No emdashes. Use commas, periods, or restructure.
- End with a clear CTA that matches the format's style
- Select the primary hook from `hook-patterns.md` based on topic type and target platform

### Step 3b: Generate Hook Variations

For every video, output 3 hook alternatives so the creator can A/B test or pick the strongest:

```
## Hook Variations

**Primary (best match for format + platform):**
"[hook text]"
Pattern: [pattern type from hook-patterns.md]

**Variation A (Question):**
"[question-based hook]"
Pattern: Question Hook

**Variation B (Statistic/Contrarian):**
"[stat or myth-based hook]"
Pattern: [Statistic Hook or Myth Hook]
```

Tag each variation with its hook pattern type for performance tracking.

At the bottom of the production plan, include a metadata block for feedback loop tracking:

```
## Production Metadata

hookPatternUsed: [primary hook pattern type, e.g. "question", "myth_contrarian", "statistic", "story_emotional", "pattern_interrupt", "did_you_know"]
formatId: [A|B|C|D|E|F|G]
targetPlatform: [Instagram|TikTok|YouTube]
sourceIdeaTopic: [the exact topic string from idea-bank.md, if this came from an idea bank entry, otherwise "original"]
```

This block enables the strategy optimizer to link production decisions to performance outcomes. When the video is published and metrics are recorded, the dashboard can populate `hookPatternUsed` and `formatId` in the performance_metrics table.

### Step 3c: Platform-Specific Hook Optimization

Adjust the hook based on the target platform:

**TikTok hooks (Format F, D primarily):**
- Text overlay on first frame is mandatory (many watch muted)
- Get to the point in 1-2 seconds max
- Controversial or curiosity hooks outperform educational hooks
- Pattern interrupts get the most shares
- Keep total hook to under 8 words for text overlay

**Instagram Reels hooks (all formats):**
- Visual-first: start with movement, face close-up, or before/after
- Saves-optimized CTAs ("save this") outperform likes
- Slightly longer setup acceptable (2-3s)
- Carousel-style info hooks work well with checklists

**YouTube Shorts hooks (Format A, C, E primarily):**
- Educational/question hooks get the best retention
- Longer setup acceptable (3-5s)
- First frame becomes auto-thumbnail (design accordingly)
- "Part 1 of X" series hooks drive subscriptions

### Step 4: Build the Shot List

For each segment of the script, produce a shot table:

| Shot | Duration | Hero Frame Prompt | Camera Movement | Speed | Audio Alignment |
|------|----------|-------------------|-----------------|-------|-----------------|
| 1 | Xs | [Detailed prompt] | [Movement] | [Speed] | "Plays during [script line]" |

#### Hero Frame Prompt Structure

Every prompt must include these 6 layers in order:

```
[SHOT TYPE + CAMERA ANGLE] of [SUBJECT: age, appearance, clothing, expression, action],
[ENVIRONMENT: location, set dressing, props, era],
[LIGHTING: type, direction, color temperature, quality],
[CAMERA: body, lens, focal length from cinema-defaults.md],
[COMPOSITION: framing, depth of field, foreground/background],
[MOOD: tone words, genre, energy]
```

**Before/After example:**

BAD: `"Pregnant woman in comfortable clothing, hand on lower back, warm home environment, soft natural lighting"`

GOOD: `"Medium shot, eye level. A woman in her early 30s, 32 weeks pregnant, wearing soft grey athleisure, one hand resting on her lower back, expression of mild discomfort. Bright modern living room with white couch and green plants. Warm diffused window light from camera right, color temperature 4500K, soft quality. ARRI Alexa, Cooke lens, 35mm. Shallow depth of field, subject centered with negative space above for text overlay. Intimate, empathetic, wellness."`

#### Shot Type Reference

| Shot | Term | Use |
|------|------|-----|
| Extreme Wide | `extreme wide shot` | Establishing location |
| Wide | `wide shot` | Full environment with subject |
| Medium | `medium shot` | Waist up |
| Medium Close-up | `medium close-up` | Chest up |
| Close-up | `close-up` | Face/detail |
| Extreme Close-up | `extreme close-up` | Texture, eyes, micro detail |
| Over-the-Shoulder | `over-the-shoulder shot` | Conversation framing |
| Bird's Eye | `bird's eye view` | Top-down perspective |

#### Lighting Vocabulary

Use specific lighting types, not vague terms like "warm" or "nice":

| Type | Prompt Term | Effect |
|------|------------|--------|
| Natural | `natural lighting`, `sunlight` | Authentic |
| Diffused | `diffused lighting`, `soft light` | Even, gentle |
| Golden Hour | `golden hour light` | Warm, romantic |
| Practical | `practical lighting`, `lamplight` | Visible sources in scene |
| Rim Lighting | `rim light` | Edge glow, subject separation |
| Side Lighting | `side lighting` | Strong shadows, depth |
| Low Key | `low key lighting` | Dark, moody |
| Volumetric | `volumetric lighting`, `god rays` | Visible light beams |

Always specify: direction (`from camera left`), color temperature (`warm 3200K`, `cool 5600K`), and quality (`soft`, `harsh`, `diffused`).

#### Camera Movement Reference

One movement per shot produces the best AI results. Use these terms:

| Movement | Term | Best For |
|----------|------|----------|
| Static | `static shot` | Dialogue, text overlay moments |
| Push-in | `slow push in`, `dolly in` | Building intensity |
| Pull-back | `pull back`, `dolly out` | Revealing context |
| Pan | `pan left`, `pan right` | Scanning environment |
| Tilt | `tilt up`, `tilt down` | Vertical reveals |
| Orbit | `orbit clockwise`, `arc shot` | Subject showcase |
| Crane | `crane up`, `crane down` | Dramatic vertical sweep |
| Tracking | `tracking shot` | Following movement |

Speed modifiers: `slow` (restrained), `smooth` (controlled), `rapid` (energetic). Add `speed ramp` for dramatic reveals (slow then fast, or fast then slow).

#### Composition Rules for 9:16 Vertical

- **Leave negative space** in the upper 250px and lower 420px for platform UI and text overlays
- **Center subjects** in the middle 60% of the frame for 9:16 content
- **Use shallow depth of field** to separate subject from background
- **Specify foreground/background** elements when you want layered depth
- For text overlay shots, note: `"negative space above for text overlay"` or `"clean background for motion graphics"`

#### Character Consistency

When the same person appears across multiple shots:
- Create a "Character DNA" block and reuse it in every prompt: `"woman in her 30s, auburn hair in low bun, navy blazer over white blouse, warm complexion"`
- Keep clothing and styling identical across shots
- Include faces only in the first shot of a multi-shot sequence to prevent drift
- Use general references in subsequent shots: "the subject," "she"

#### Quality-Boosting Keywords

Add as appropriate: `cinematic`, `photorealistic`, `shallow depth of field`, `film grain`, `anamorphic`. Reference specific cinematographers for style: `Roger Deakins cinematography` (naturalistic), `Wes Anderson framing` (symmetrical).

### Step 5: Generate Remotion Data

Output a JSON object matching the format's Remotion composition schema. Every format includes a `theme` object.

#### Theme (all formats)

| Field | Type | Default (Collective Family) |
|-------|------|-----------------------------|
| `primaryColor` | color | `"#0d9488"` |
| `accentColor` | color | `"#faf5ef"` |
| `darkBackground` | color | `"#1a1a2e"` |
| `lightBackground` | color | `"#faf5ef"` |
| `textColor` | color | `"#ffffff"` |
| `headingFont` | string | `"Georgia"` |
| `bodyFont` | string | `"Nunito Sans"` |

Always include all 7 fields. Use the defaults above unless a different brand is specified.

---

#### Format A: Explainer

| Field | Type | Constraints |
|-------|------|-------------|
| `title` | string | Required |
| `hookText` | string | Required |
| `sections` | array | 1-6 items. Each: `{ label, text, durationInSeconds }` (duration: 1-30) |
| `stat` | object | Optional. `{ value, label }` |
| `ctaText` | string | Required |
| `theme` | Theme | Required |

```json
{
  "title": "What Is Tech Neck?",
  "hookText": "That neck pain you feel after scrolling? It has a name.",
  "sections": [
    { "label": "What's happening", "text": "When you look down at your phone, your head shifts forward. That puts up to 60 pounds of extra pressure on your spine.", "durationInSeconds": 6 },
    { "label": "Why it matters", "text": "Over time, this changes the curve of your neck. It leads to headaches, shoulder tension, and even numbness in your hands.", "durationInSeconds": 6 },
    { "label": "What you can do", "text": "Bring your phone to eye level. Take breaks every 20 minutes. And if it's already causing pain, get it checked before it gets worse.", "durationInSeconds": 6 }
  ],
  "stat": { "value": "60 lbs", "label": "of extra pressure on your spine" },
  "ctaText": "Share this with someone who's always on their phone.",
  "theme": { "primaryColor": "#0d9488", "accentColor": "#faf5ef", "darkBackground": "#1a1a2e", "lightBackground": "#faf5ef", "textColor": "#ffffff", "headingFont": "Georgia", "bodyFont": "Nunito Sans" }
}
```

---

#### Format B: Checklist

| Field | Type | Constraints |
|-------|------|-------------|
| `title` | string | Required |
| `hookText` | string | Required |
| `items` | array | 2-7 items. Each: `{ number, label, description }` |
| `closingText` | string | Required |
| `ctaText` | string | Required |
| `theme` | Theme | Required |

```json
{
  "title": "Signs Your Baby Needs Help",
  "hookText": "5 signs your baby is trying to tell you something. Most parents miss number 4.",
  "items": [
    { "number": 1, "label": "Head always tilted one way", "description": "This could indicate torticollis from birth positioning." },
    { "number": 2, "label": "Trouble latching on one side", "description": "Neck tension can make it painful to turn, affecting feeding." },
    { "number": 3, "label": "Arching their back constantly", "description": "Often dismissed as colic, but may signal spinal discomfort." },
    { "number": 4, "label": "Skipping crawling", "description": "Going straight to walking can mean retained primitive reflexes." },
    { "number": 5, "label": "One flat spot on the head", "description": "Plagiocephaly often comes from restricted neck movement." }
  ],
  "closingText": "How many did you check?",
  "ctaText": "Save this so you remember what to watch for.",
  "theme": { "primaryColor": "#0d9488", "accentColor": "#faf5ef", "darkBackground": "#1a1a2e", "lightBackground": "#faf5ef", "textColor": "#ffffff", "headingFont": "Georgia", "bodyFont": "Nunito Sans" }
}
```

---

#### Format C: Demo

| Field | Type | Constraints |
|-------|------|-------------|
| `title` | string | Required |
| `hookText` | string | Required |
| `steps` | array | 1-8 items. Each: `{ instruction }` |
| `keyCue` | string | Required. Key form/safety cue |
| `frequency` | string | Required. How often to perform |
| `ctaText` | string | Required |
| `theme` | Theme | Required |

```json
{
  "title": "Chin Tucks",
  "hookText": "If you sit at a desk all day, try this.",
  "steps": [
    { "instruction": "Sit up straight with your shoulders relaxed." },
    { "instruction": "Pull your chin straight back, like you're making a double chin." },
    { "instruction": "Hold for 5 seconds. You should feel a stretch at the base of your skull." },
    { "instruction": "Release slowly. That's one rep." }
  ],
  "keyCue": "Keep your eyes level. Don't tilt your head up or down.",
  "frequency": "3 sets of 10, twice daily",
  "ctaText": "Save this and try it today.",
  "theme": { "primaryColor": "#0d9488", "accentColor": "#faf5ef", "darkBackground": "#1a1a2e", "lightBackground": "#faf5ef", "textColor": "#ffffff", "headingFont": "Georgia", "bodyFont": "Nunito Sans" }
}
```

---

#### Format D: MythBuster

**No `title` or `hookText` fields.** This format has only 4 text fields plus theme.

| Field | Type | Constraints |
|-------|------|-------------|
| `mythText` | string | Required. The myth statement |
| `truthText` | string | Required. The truth rebuttal |
| `explanationText` | string | Required. Supporting explanation |
| `ctaText` | string | Required |
| `theme` | Theme | Required |

```json
{
  "mythText": "Cracking your knuckles causes arthritis.",
  "truthText": "Research shows zero connection between knuckle cracking and arthritis.",
  "explanationText": "That popping sound is just gas bubbles releasing in the joint fluid. A 60-year self-experiment by Dr. Donald Unger proved it. He cracked only one hand daily for decades. No difference.",
  "ctaText": "Did you believe this? Drop it in the comments.",
  "theme": { "primaryColor": "#0d9488", "accentColor": "#faf5ef", "darkBackground": "#1a1a2e", "lightBackground": "#faf5ef", "textColor": "#ffffff", "headingFont": "Georgia", "bodyFont": "Nunito Sans" }
}
```

---

#### Format E: Walkthrough

| Field | Type | Constraints |
|-------|------|-------------|
| `title` | string | Required |
| `hookText` | string | Required |
| `steps` | array | 2-8 items. Each: `{ stepNumber, label, description }` |
| `reassuranceText` | string | Required. Closing reassurance |
| `ctaText` | string | Required |
| `theme` | Theme | Required |

```json
{
  "title": "Your First Chiropractic Visit",
  "hookText": "Nervous about your first adjustment? Here's exactly what happens.",
  "steps": [
    { "stepNumber": 1, "label": "Assessment", "description": "We talk about what's going on, look at your posture, and check your range of motion. No surprises." },
    { "stepNumber": 2, "label": "The Adjustment", "description": "Gentle, specific pressure to the areas that need it. You might hear a pop. That's completely normal." },
    { "stepNumber": 3, "label": "After", "description": "Some people feel relief right away. Others feel a little sore, like after a workout. Both are normal." }
  ],
  "reassuranceText": "That's it. It's gentle, it's safe, and it's designed to help your body work better.",
  "ctaText": "If you've been thinking about it, this is your sign.",
  "theme": { "primaryColor": "#0d9488", "accentColor": "#faf5ef", "darkBackground": "#1a1a2e", "lightBackground": "#faf5ef", "textColor": "#ffffff", "headingFont": "Georgia", "bodyFont": "Nunito Sans" }
}
```

### Step 5b: Vibe Motion Graphics Direction

For each Remotion component in the composition, specify animation behavior that goes beyond the default. This ensures the motion graphics feel intentional and polished rather than generic.

#### Timing System (at 30fps)

| Animation | Frames | Duration | Notes |
|-----------|--------|----------|-------|
| Text entrance (slide + fade) | 8-10 | ~300ms | Ease-out: starts fast, slows to rest |
| Text exit (fade + slide) | 6-8 | ~230ms | Ease-in: accelerates away |
| Scene transition | 15-20 | ~600ms | Spring with damping: 200 |
| Stagger between list items | 3-4 | ~100ms | Cascade effect |
| Title/hook card hold | 60-90 | 2-3s | Minimum read time |
| Content card hold | 90-120 | 3-4s | Per section/item |
| CTA hold | 90-150 | 3-5s | Longer for action |

#### Spring Configs by Component

| Component | Spring Config | Effect |
|-----------|--------------|--------|
| TitleCard, SectionCard | `damping: 200` | Smooth, professional slide |
| StatCard, CallToAction | `damping: 12, stiffness: 200` | Satisfying snap with tiny bounce |
| MythTruthReveal | `damping: 8, stiffness: 200` | Dramatic stamp with visible bounce |
| ChecklistOverlay items | `damping: 200` + 3-frame stagger | Clean cascade |
| HookText | `damping: 10, stiffness: 280` | Scale 1.4 to 1, attention-grabbing |
| KineticText | `damping: 10, stiffness: 180` | Per-word stagger, emphasis glow |
| FrequencyCard badge | `damping: 12, stiffness: 180` | Pop-in scale effect |

#### Format-Specific Animation Pacing

| Format | Energy | Animation Speed | Notes |
|--------|--------|----------------|-------|
| Explainer (A) | Steady, educational | Medium (10-frame entrances) | Two-stage reveals: label then text |
| Checklist (B) | Building momentum | Medium-fast (8-frame entrances, 3-frame stagger) | Each item builds on previous |
| Demo (C) | Clear, instructional | Slow-medium (12-frame entrances) | Hold instructions longer for reading |
| MythBuster (D) | Fast, punchy | Fast (6-frame entrances) | Myth stamp is dramatic, truth is quick |
| Walkthrough (E) | Gentle, reassuring | Slow (12-frame entrances) | Progress dots add continuity |
| Quick Tip (F) | Ultra-fast, punchy | Very fast (4-frame entrances) | KineticText word-by-word reveal |
| Patient Story (G) | Warm, personal | Slow-medium (10-frame entrances) | Hold QuoteCard longer for impact |

#### 9:16 Safe Zones for Text Overlays

All text must stay within these margins to avoid platform UI obstruction:

| Zone | Margin | Reason |
|------|--------|--------|
| Top | 250px from top | Username, follow button |
| Bottom | 420px from bottom | Description, share/like buttons |
| Left | 120px from left | Edge clipping |
| Right | 120px from right | Share/like column |
| **Usable area** | **~840x1250px centered** | Safe for all platforms |

#### What to Specify Per Scene

For each Remotion scene in the production plan, note:
1. **Which component** renders (TitleCard, SectionCard, StatCard, etc.)
2. **Entry animation** (slide direction, spring config if non-default)
3. **Hold duration** in seconds
4. **Voiceover sync point** ("appears when VO says '...'")
5. **Text contrast** method if overlaying video ("semi-transparent dark panel at 60% opacity")

#### Amateur vs. Professional Checklist

- Use ease-out for entrances, ease-in for exits. Never linear.
- One focal point per frame. Never animate two elements simultaneously.
- Consistent timing across similar elements (all list items same speed).
- Sync text reveals to voiceover cadence, not arbitrary timing.
- Keep minimum 4.5:1 contrast ratio between text and background.
- Use bold sans-serif at 42px minimum for mobile readability.

---

#### Format F: Quick Tip

| Field | Type | Constraints |
|-------|------|-------------|
| `hookText` | string | Required |
| `tipWords` | array | 1-20 items. Each: `{ text, delay, scale?, color? }` |
| `ctaText` | string | Required |
| `theme` | Theme | Required |

Duration rule: 1s per 3 words + 1s buffer. Target 6-15s total.

```json
{
  "hookText": "Did you know this about your spine?",
  "tipWords": [
    { "text": "Your", "delay": 0 },
    { "text": "spine", "delay": 5, "scale": 1.3, "color": "#0d9488" },
    { "text": "controls", "delay": 10 },
    { "text": "everything.", "delay": 15, "scale": 1.2 }
  ],
  "ctaText": "Follow for more quick tips.",
  "theme": { "primaryColor": "#0d9488", "accentColor": "#faf5ef", "darkBackground": "#1a1a2e", "lightBackground": "#faf5ef", "textColor": "#ffffff", "headingFont": "Georgia", "bodyFont": "Nunito Sans" }
}
```

---

#### Format G: Patient Story

| Field | Type | Constraints |
|-------|------|-------------|
| `hookText` | string | Required |
| `quote` | string | Required |
| `attribution` | string | Required |
| `role` | string | Optional |
| `stat` | object | Optional. `{ value, label }` |
| `ctaText` | string | Required |
| `theme` | Theme | Required |

```json
{
  "hookText": "This mom's story changed how we think about pediatric care.",
  "quote": "After three visits, my daughter was sleeping through the night for the first time in months.",
  "attribution": "Sarah M.",
  "role": "Mom of 2",
  "stat": { "value": "3 visits", "label": "to better sleep" },
  "ctaText": "Every family has a story. What's yours?",
  "theme": { "primaryColor": "#0d9488", "accentColor": "#faf5ef", "darkBackground": "#1a1a2e", "lightBackground": "#faf5ef", "textColor": "#ffffff", "headingFont": "Georgia", "bodyFont": "Nunito Sans" }
}
```

---

### Step 6: Write Assembly Instructions

Specify:
- Shot sequence and transitions
- Background music mood and volume
- Caption highlight keywords
- Export format (9:16, 1080x1920)

### Step 7: Add Platform Notes

- **Instagram Reels:** Suggested hashtags, caption text, audio notes, saves-optimized CTA
- **TikTok:** Text overlay copy for first frame, trending sound suggestion, comment-driving CTA
- **YouTube Shorts:** Description with search keywords, title suggestion, thumbnail-worthy first frame note
- **Patient/Customer Resource:** Tags for the resource library

## Output Format

Save the production plan to:
```
industries/<industry>/production-plans/<video-code>-<slug>.md
```

Example: `industries/chiropractic/production-plans/D1-tech-neck.md`

## Transcript Analysis Mode

Analyze an external video transcript to extract reusable patterns.

### Usage
```
/video-director --analyze-transcript
```

Then paste any transcript (from YouTube auto-captions, TikTok, etc.).

### What It Analyzes

1. **Hook** (first 1-3 seconds): What type of hook? How many words? What pattern from `hook-patterns.md` does it match?
2. **Structure**: Which format (A-G) does this video most resemble?
3. **Pacing**: Words per second, number of pauses, sentence length variation
4. **CTA style**: How does it close? What action does it request?
5. **Tone**: Educational, conversational, controversial, emotional?
6. **What makes it effective**: 2-3 specific reasons this video works

### Output

```markdown
## Transcript Analysis

**Source:** [video URL or description]
**Duration estimate:** [based on word count / 2.5 words per second]
**Format match:** [A-G]

### Hook Analysis
- **Hook text:** "[first 1-3 seconds]"
- **Hook pattern:** [type from hook-patterns.md]
- **Word count:** [number]
- **Effectiveness:** [why it works]

### Structure Breakdown
| Segment | Duration | Content | Our Component |
|---------|----------|---------|---------------|

### Pacing
- Words per second: [number]
- Pause count: [number]
- Sentence length: [avg words]

### Steal This
1. **Hook adaptation:** "[rewritten in our brand voice]"
2. **Structure idea:** [how to apply this structure]
3. **CTA adaptation:** "[rewritten CTA]"

### Add to Libraries?
- Hook pattern: [yes/no - if new, suggest adding to hook-patterns.md]
- Content idea: [yes/no - if relevant, suggest adding to idea-bank.md]
```

## Integration with Other Skills

```
/last30days [topic]       → Topic research
/viral-scout [niche]      → Viral pattern discovery
/creator-analysis         → Competitor deep-dives
/content-planner          → Calendar with format assignments
/video-director           → THIS SKILL produces the production plan
remotion-best-practices   → Auto-loaded when generating Remotion data
brand-factory             → Auto-loaded when applying brand voice
```
