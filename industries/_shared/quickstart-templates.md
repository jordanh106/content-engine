# Quick-Start Templates

Curated starting points for the Content Engine. Each template creates a Project of a specific kind with a starter brief, a list of assets to generate, and rough credit/time estimates.

Authoring rules:
- Each template is a single YAML block tagged ` ```yaml:quickstart-template `.
- `group` is either `brand` (Collective Family Chiropractic essentials) or `showcase` (general-purpose, holiday, adjacent).
- `projectKind` is the resulting `kind` on the created Project.
- `briefTemplate` is markdown — used as the initial brief content of the new project.
- `icon` is a lucide-react name (capital case).

---

## Group A — Your brand

```yaml:quickstart-template
key: chiropractic_explainer
projectKind: chiropractic_explainer
group: brand
displayName: Educational explainer
icon: BookOpen
blurb: 30-45s explainer about a condition (back pain, posture, pregnancy, kids). Hook + 3 teaching beats + CTA. Format A.
estimatedCreditsLow: 25
estimatedCreditsHigh: 50
estimatedMinutes: 8
briefTemplate: |
  ## Topic
  e.g. "Why your morning back pain is actually a hip flexor problem"

  ## Audience
  Adults 30-55 with chronic low-back pain, posture issues, sedentary work.

  ## Hook
  Pattern-interrupt with a specific counter-intuitive claim or statistic.

  ## Teaching beats (3 things they'll learn)
  1.
  2.
  3.

  ## CTA
  Save this for tomorrow morning · Book a visit · Share with someone who needs it.
generates:
  - { kind: image, model: nano_banana_2, count: 4, label: shot, aspect: "9:16" }
  - { kind: video, model: kling, durationSec: 5, label: hero_motion, aspect: "9:16" }
```

```yaml:quickstart-template
key: patient_story
projectKind: patient_story
group: brand
displayName: Patient story
icon: Heart
blurb: 15-30s testimonial-style reel. Real story of relief / transformation. Format G.
estimatedCreditsLow: 15
estimatedCreditsHigh: 35
estimatedMinutes: 6
briefTemplate: |
  ## Patient (anonymous or by initial)

  ## Their problem before
  e.g. "Couldn't pick up her toddler without sharp lower-back pain"

  ## What changed
  Concrete moment of relief, weeks-to-result, lifestyle shift.

  ## Visual style
  Warm, candid, golden-hour. Family at home. NO stock photo energy.

  ## Closing line
  Specific, human, not salesy. 1-2 sentences max.
generates:
  - { kind: image, model: nano_banana_2, count: 3, label: scene, aspect: "9:16" }
  - { kind: video, model: seedance, durationSec: 5, label: hero_motion, aspect: "9:16" }
```

```yaml:quickstart-template
key: office_tour
projectKind: office_tour
group: brand
displayName: Office tour
icon: Compass
blurb: 45-60s walkthrough of the practice. Hybrid real-footage + AI environment polish. Format E.
estimatedCreditsLow: 30
estimatedCreditsHigh: 60
estimatedMinutes: 10
briefTemplate: |
  ## Walkthrough beats
  1. Entrance / waiting area
  2. Adjustment room (the moment of magic)
  3. Education / consultation space
  4. Family-friendly amenities (kids zone, prenatal options)

  ## Vibe
  Warm. Bright. Inviting. NOT clinical.

  ## Voiceover hook
  "Most chiropractic offices feel like a dentist. This one feels like..."
generates:
  - { kind: image, model: nano_banana_2, count: 4, label: room, aspect: "9:16" }
  - { kind: video, model: seedance, durationSec: 5, label: walkthrough, aspect: "9:16" }
```

```yaml:quickstart-template
key: did_you_know
projectKind: did_you_know
group: brand
displayName: Did you know carousel
icon: LayoutGrid
blurb: 5-7 slide carousel. Hook slide + 3-5 fact slides + CTA slide. Format F adapted to IG.
estimatedCreditsLow: 12
estimatedCreditsHigh: 25
estimatedMinutes: 5
briefTemplate: |
  ## Topic
  e.g. "Things you probably do every day that quietly wreck your spine"

  ## Slide hooks (5-7 lines)
  1. Hook slide (one bold sentence)
  2.
  3.
  4.
  5.
  6.
  7. CTA slide ("Save this so you remember tomorrow morning")
generates:
  - { kind: carousel, slides: 7, label: carousel }
```

```yaml:quickstart-template
key: storytelling_reel
projectKind: storytelling_reel
group: brand
displayName: Storytelling reel
icon: Film
blurb: Narrative one-sentence-per-shot reel. Science Mystery, True Crime, Historical, Cosmic Horror, Future Sci-Fi.
estimatedCreditsLow: 12
estimatedCreditsHigh: 55
estimatedMinutes: 10
briefTemplate: |
  ## Style
  Pick from: Science Mystery (flagship), True Crime, Historical, Cosmic Horror, Future Sci-Fi.

  ## Topic
  e.g. "The 1970 Apollo 13 oxygen tank explosion"

  ## Length (seconds)
  30 or 45

  ## Tier
  Draft (~12 cr, fast) or Hero (~55 cr, final)
generates:
  - { kind: video, model: kling, durationSec: 30, label: reel, aspect: "9:16" }
```

---

## Group B — Higgsfield showcase

```yaml:quickstart-template
key: brand_launch
projectKind: brand_launch
group: showcase
displayName: Brand launch
icon: Rocket
blurb: Three hero stills, motion piece, 9:16 social cutdown, single-file landing page HTML — all from one brief.
estimatedCreditsLow: 60
estimatedCreditsHigh: 100
estimatedMinutes: 12
briefTemplate: |
  ## Brand
  [Brand name]

  ## Mood
  3-5 sentence vibe description. Editorial, not AI-aesthetic.

  ## Hero subject
  What's in the hero shot. Specific. e.g. "Hand-stitched leather notebook on a writing desk at dawn."

  ## Audience
  Who's seeing this. Two sentences.

  ## Tagline candidates (3)
  1.
  2.
  3.

  ## Style references
  Drop 2-3 reference images in the refs panel.
generates:
  - { kind: image, model: nano_banana_2, count: 3, label: hero_v, aspect: "16:9", resolution: "2k" }
  - { kind: video, model: seedance, durationSec: 10, label: motion_piece, aspect: "16:9" }
  - { kind: video, model: kling, durationSec: 6, label: social_cutdown, aspect: "9:16" }
  - { kind: html, label: landing_page }
```

```yaml:quickstart-template
key: viral_replication
projectKind: viral_replication
group: showcase
displayName: Viral replication
icon: Repeat2
blurb: Paste any viral video URL. Claude deconstructs the pattern, rebuilds it for your brand.
estimatedCreditsLow: 40
estimatedCreditsHigh: 80
estimatedMinutes: 12
briefTemplate: |
  ## Reference video URL
  Drop the viral video URL here.

  ## What about it works
  3 reasons (hook, pacing, structure, audio, etc.)

  ## Your brand / product
  Brief context on what's replacing the original subject.

  ## Target output
  9:16 reel, 6-15 seconds.
generates:
  - { kind: video, model: kling, durationSec: 10, label: rebuilt_reel, aspect: "9:16" }
```

```yaml:quickstart-template
key: avatar_ugc
projectKind: avatar_ugc
group: showcase
displayName: Avatar UGC ad
icon: Mic
blurb: Pick a Higgsfield Marketing Studio avatar + your product. Get UGC-style ad reel.
estimatedCreditsLow: 25
estimatedCreditsHigh: 55
estimatedMinutes: 8
briefTemplate: |
  ## Avatar
  Which Marketing Studio avatar to use (Clara, Maya, etc.)

  ## Product
  Brand + what it does + 1-line value prop.

  ## Hook
  First 3 seconds. What grabs attention?

  ## CTA
  Specific action. URL or DM trigger.
generates:
  - { kind: video, model: seedance, durationSec: 15, label: ugc_ad, aspect: "9:16" }
```

```yaml:quickstart-template
key: ad_variants
projectKind: ad_variants
group: showcase
displayName: Ad variants pack
icon: GitBranch
blurb: One product brief → 12 still + motion variants across aspect ratios (1:1, 4:5, 9:16, 16:9).
estimatedCreditsLow: 80
estimatedCreditsHigh: 160
estimatedMinutes: 18
briefTemplate: |
  ## Product
  Name + 1-line description.

  ## Variant axes (we'll fan out across these)
  - Aspect ratios: 1:1, 4:5, 9:16, 16:9
  - Settings: studio, lifestyle, outdoors, in-use
  - Mood: bright, cinematic, soft, bold

  ## Don't include
  Words / icons / faces / brands that conflict.
generates:
  - { kind: image, model: nano_banana_2, count: 8, label: still_variant, aspect: "1:1" }
  - { kind: video, model: kling, durationSec: 4, label: motion_variant, aspect: "9:16" }
```

```yaml:quickstart-template
key: product_360
projectKind: product_360
group: showcase
displayName: Product 360
icon: Repeat2
blurb: 8-frame turntable of a product / service station. Loopable for IG / web product page.
estimatedCreditsLow: 20
estimatedCreditsHigh: 40
estimatedMinutes: 6
briefTemplate: |
  ## Subject
  Product or service station to rotate.

  ## Background
  Solid color (specify hex) or scene description.

  ## Lighting
  Soft / dramatic / clinical / editorial.
generates:
  - { kind: image, model: nano_banana_2, count: 8, label: turntable_frame, aspect: "1:1" }
```

```yaml:quickstart-template
key: press_kit
projectKind: press_kit
group: showcase
displayName: Press kit + hero
icon: Image
blurb: Hero stills at every aspect ratio (1:1, 4:5, 16:9, 9:16) for press, web, social drops.
estimatedCreditsLow: 30
estimatedCreditsHigh: 55
estimatedMinutes: 8
briefTemplate: |
  ## Subject
  Who or what is the hero of this press kit.

  ## Mood
  Editorial. Magazine cover energy. NOT corporate headshot.

  ## Wardrobe / props
  Specifics that tell the story.
generates:
  - { kind: image, model: nano_banana_2, count: 4, label: press_aspect, aspect: "1:1" }
```

```yaml:quickstart-template
key: holiday_variant
projectKind: holiday_variant
group: showcase
displayName: Holiday variant
icon: Gift
blurb: Re-shoot existing brand assets with a seasonal theme (Halloween, holidays, Valentine's, summer, etc.).
estimatedCreditsLow: 20
estimatedCreditsHigh: 50
estimatedMinutes: 8
briefTemplate: |
  ## Holiday / season
  e.g. "Christmas warm-and-cozy", "Halloween moody-Gothic", "summer beach"

  ## Original brand asset
  Reference the asset(s) being themed. Drop them in refs.

  ## Holiday treatment
  Specific elements (wreath, pumpkin, snow, etc.) — but tasteful, no cliché.
generates:
  - { kind: image, model: nano_banana_2, count: 3, label: holiday_variant, aspect: "1:1" }
  - { kind: video, model: kling, durationSec: 4, label: motion_variant, aspect: "9:16" }
```
