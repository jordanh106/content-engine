# Storytelling Reel Styles

Named style presets for the Storytelling Reel Engine. Each preset locks voice, visual aesthetic, motion direction, audio palette, and pacing so the same engine can produce wildly different reels with one preset swap.

Industry-agnostic: works across chiropractic and any future industry. Loaded by `packages/dashboard/server/parsers/storytelling-styles.ts` and surfaced via `GET /api/storytelling/styles`.

Authoring rules:
- Each preset is a single YAML code block tagged `yaml:storytelling-style`.
- `key` is the URL-safe identifier used in API calls and config files.
- `voice.elevenlabs_voice_id` references a public ElevenLabs voice (or `null` for "use cloned voice from voice picker").
- `visual.model_hero` and `visual.model_draft` must be valid Higgsfield `job_set_type` keys.
- `motion.model_hero` and `motion.model_draft` must be valid Higgsfield video `job_set_type` keys.
- `audio_palette.sfx_beats` are descriptive cues; the orchestrator emits them as timeline markers but v1 leaves SFX layering optional.

---

## Science Mystery (flagship)

The hero style. Tuned for hero-quality 30-60s narrative reels about scientific mysteries, expeditions, and historical anomalies. The default style and worked example for the storytelling reel engine. Optimised for Apollo 13, Roswell, Lake Vostok, Mariana Trench, Voyager Golden Record-style topics.

```yaml:storytelling-style
key: science_mystery
displayName: Science Mystery
tagline: Cinematic exploration of scientific mysteries and historical anomalies.
exampleReels:
  - "Apollo 13 oxygen tank"
  - "The 1947 Roswell debris field"
  - "Lake Vostok and the 14M-year sealed lake"
  - "Mariana Trench Challenger Deep"
  - "Voyager Golden Record"
  - "The Wow! signal"
  - "Ant Mill death spirals"
hookArchetypes:
  - Stakes Setter
  - Open Loop
  - Counter-Intuition
voice:
  elevenlabs_voice_id: pNInz6obpgDQGcFmaJgB
  elevenlabs_voice_name: Adam
  direction: "Warm-curious-authoritative. Hushed at reveals. Pauses on numbers. Slightly slower than conversational."
  stability: 0.5
  similarity_boost: 0.75
  style: 0.35
  pace: 0.95
visual:
  aesthetic: "Photo-real archival. Kodachrome grading. Sun-bleached film. Scientific instrument close-ups. NASA mission control aesthetic. Lens flares from period optics. Subtle film grain. Muted blues and burnt amber palette."
  model_hero: nano_banana_2
  model_draft: text2image_soul_v2
  resolution: 2k
  compositionFormula: "scene · subject · period · lens · grading · grain"
  negativePrompts:
    - "cartoon, anime, illustration, 3d render, glossy, oversaturated, modern stock photo"
motion:
  direction: "Slow zoom-ins. Drift-up reveals. Parallax push past instruments. Lingering 2-3s holds. No quick cuts. Never whip-pans."
  model_hero: veo3_1
  model_draft: kling3_0
  defaultDurationSec: 4
audio_palette:
  music_brief: "Ambient cosmic. Low sustained strings. Sparse piano. Modular synth pulse. Slow build. -18dB under VO."
  sfx_beats:
    - "radio static at reveal beat"
    - "equipment hum bed throughout"
    - "breath before climax"
    - "distant rumble at stakes setter"
pacing:
  shotsFor15s: 3
  shotsFor30s: 6
  shotsFor45s: 9
  shotsFor60s: 11
  averageShotSec: 4.5
```

---

## True Crime

Dramatic, dimly-lit narrative reels for unsolved cases, criminal psychology, and forensic mysteries. Sister to Science Mystery but with darker grading and heavier silences.

```yaml:storytelling-style
key: true_crime
displayName: True Crime
tagline: Hushed, dramatic narrative reels for unsolved cases and criminal mysteries.
exampleReels:
  - "Zodiac Killer ciphers"
  - "Dyatlov Pass incident"
  - "The disappearance of Madeleine McCann"
  - "Black Dahlia"
hookArchetypes:
  - Stakes Setter
  - Open Loop
  - Foreshadow
voice:
  elevenlabs_voice_id: VR6AewLTigWG4xSOukaG
  elevenlabs_voice_name: Arnold
  direction: "Slow, hushed, dramatic. Weighted pauses. Almost whispered at reveals."
  stability: 0.6
  similarity_boost: 0.8
  style: 0.55
  pace: 0.9
visual:
  aesthetic: "Low-key dim lighting. Red practical lamps, deep shadows, muted desaturated palette. Film grain. Photo-real. Wet pavement, neon signs, period police tape."
  model_hero: nano_banana_2
  model_draft: text2image_soul_v2
  resolution: 2k
  compositionFormula: "scene · subject · time-of-day · lens · low-key lighting · grain"
  negativePrompts:
    - "bright, cheerful, cartoon, illustration, oversaturated"
motion:
  direction: "Slow camera dollies in. Lingering static holds. Drift-down reveals. No fast cuts."
  model_hero: veo3_1
  model_draft: kling3_0
  defaultDurationSec: 4
audio_palette:
  music_brief: "Sparse piano. Low drone. Heartbeat pulse. Detuned strings. -20dB under VO."
  sfx_beats:
    - "distant siren at stakes"
    - "rain bed throughout"
    - "heartbeat at climax"
    - "clock ticking on numbers"
pacing:
  shotsFor15s: 3
  shotsFor30s: 6
  shotsFor45s: 9
  shotsFor60s: 11
  averageShotSec: 4.5
```

---

## Historical

Sweeping, prestige-documentary reels for major historical events, lost civilizations, and figures. Think Ken Burns at TikTok pace.

```yaml:storytelling-style
key: historical
displayName: Historical
tagline: Prestige-documentary reels for major events, lost civilizations, and historical figures.
exampleReels:
  - "Pompeii's final hours"
  - "The Library of Alexandria"
  - "Hannibal crosses the Alps"
  - "The Antikythera mechanism"
hookArchetypes:
  - Stakes Setter
  - Counter-Intuition
  - Time-Anchor
voice:
  elevenlabs_voice_id: TxGEqnHWrfWFTfGW9XjX
  elevenlabs_voice_name: Josh
  direction: "Measured, authoritative, reverent. Like a museum audio guide. Confident on dates."
  stability: 0.55
  similarity_boost: 0.75
  style: 0.3
  pace: 0.95
visual:
  aesthetic: "Painterly historical realism. Golden hour lighting. Marble, parchment, candlelight, smoke. Photo-real but with period grading. Tilt-shift miniature effect on wide shots."
  model_hero: nano_banana_2
  model_draft: text2image_soul_v2
  resolution: 2k
  compositionFormula: "era · location · subject · lens · golden-hour grading · grain"
  negativePrompts:
    - "modern, neon, anachronistic, cartoon, oversaturated"
motion:
  direction: "Slow cranes. Wide-to-close reveals. Push past artifacts. Static prestige holds."
  model_hero: veo3_1
  model_draft: kling3_0
  defaultDurationSec: 4
audio_palette:
  music_brief: "Orchestral. Strings and choir. Sparse percussion. Reverent and building. -18dB under VO."
  sfx_beats:
    - "wind bed for outdoor scenes"
    - "fire crackle for indoor scenes"
    - "horns at stakes setter"
    - "footsteps on stone for character beats"
pacing:
  shotsFor15s: 3
  shotsFor30s: 6
  shotsFor45s: 9
  shotsFor60s: 11
  averageShotSec: 4.5
```

---

## Cosmic Horror

Dread-soaked narrative reels for deep-space mysteries, ocean abyss creatures, and Lovecraftian unknowns. Slower pacing, more silence, more dread.

```yaml:storytelling-style
key: cosmic_horror
displayName: Cosmic Horror
tagline: Dread-soaked reels for deep-space mysteries and Lovecraftian unknowns.
exampleReels:
  - "What lives in the deepest ocean trenches"
  - "The Boötes Void"
  - "The Fermi Paradox"
  - "Black hole event horizons"
hookArchetypes:
  - Foreshadow
  - Open Loop
  - Counter-Intuition
voice:
  elevenlabs_voice_id: VR6AewLTigWG4xSOukaG
  elevenlabs_voice_name: Arnold
  direction: "Slow, low-register, ominous. Long pauses. Almost reluctant to continue."
  stability: 0.65
  similarity_boost: 0.8
  style: 0.6
  pace: 0.85
visual:
  aesthetic: "Cold blue-black palette. Bioluminescence. Vast scale. Negative space dominates. Photo-real but unsettling. Film grain. Light eaten by darkness."
  model_hero: nano_banana_2
  model_draft: text2image_soul_v2
  resolution: 2k
  compositionFormula: "void · subject · scale-reference · lens · cold grading · grain"
  negativePrompts:
    - "bright, warm, cheerful, cartoon, oversaturated"
motion:
  direction: "Very slow drifts. Pull-aways revealing scale. Long holds on emptiness. Glacial."
  model_hero: veo3_1
  model_draft: kling3_0
  defaultDurationSec: 5
audio_palette:
  music_brief: "Sub-bass drones. Detuned strings. Distant choir. Almost no melody. -22dB under VO."
  sfx_beats:
    - "low rumble bed throughout"
    - "metallic creak at reveals"
    - "distant whale call for ocean scenes"
    - "silence before climax"
pacing:
  shotsFor15s: 3
  shotsFor30s: 5
  shotsFor45s: 8
  shotsFor60s: 10
  averageShotSec: 5.5
```

---

## Future Sci-Fi

Sleek, hopeful-or-ominous reels for emerging tech, space exploration, and near-future scenarios. Brighter, more synthetic, more saturated.

```yaml:storytelling-style
key: future_scifi
displayName: Future Sci-Fi
tagline: Sleek near-future reels for emerging tech and space exploration.
exampleReels:
  - "What a Dyson Sphere would look like"
  - "Brain-computer interfaces in 2040"
  - "Mars terraforming timelines"
  - "Quantum computing breakthroughs"
hookArchetypes:
  - Counter-Intuition
  - Time-Anchor
  - Stakes Setter
voice:
  elevenlabs_voice_id: yoZ06aMxZJJ28mfd3POQ
  elevenlabs_voice_name: Sam
  direction: "Clear, intelligent, curious. Slightly faster than other styles. Confident on specs."
  stability: 0.45
  similarity_boost: 0.7
  style: 0.4
  pace: 1.0
visual:
  aesthetic: "Clean futurism. Hard light. Holographic UI overlays. Carbon fiber, glass, magnesium. Photo-real CG aesthetic. Cool blues with cyan and orange accents."
  model_hero: nano_banana_2
  model_draft: text2image_soul_v2
  resolution: 2k
  compositionFormula: "scene · technology · scale · lens · clean grading · subtle glow"
  negativePrompts:
    - "rusty, dirty, organic, soft, vintage, grainy"
motion:
  direction: "Smooth tracking shots. Crane reveals. Parallax push past tech. Holographic UI animates in-frame."
  model_hero: veo3_1
  model_draft: kling3_0
  defaultDurationSec: 4
audio_palette:
  music_brief: "Synth pulse. Arpeggios. Modular bass. Optimistic build. -18dB under VO."
  sfx_beats:
    - "synth pad bed throughout"
    - "UI beep at data reveals"
    - "engine whine for spacecraft"
    - "data-stream wash on transitions"
pacing:
  shotsFor15s: 3
  shotsFor30s: 6
  shotsFor45s: 9
  shotsFor60s: 12
  averageShotSec: 4.5
```
