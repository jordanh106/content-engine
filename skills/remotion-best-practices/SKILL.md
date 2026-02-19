---
name: remotion-best-practices
description: Best practices for Remotion - Video creation in React
metadata:
  tags: remotion, video, react, animation, composition
---

## When to use

Use this skills whenever you are dealing with Remotion code to obtain the domain-specific knowledge.

## Captions

When dealing with captions or subtitles, load the [./rules/subtitles.md](./rules/subtitles.md) file for more information.

## How to use

Read individual rule files for detailed explanations and code examples:

- [rules/3d.md](rules/3d.md) - 3D content in Remotion using Three.js and React Three Fiber
- [rules/animations.md](rules/animations.md) - Fundamental animation skills for Remotion
- [rules/assets.md](rules/assets.md) - Importing images, videos, audio, and fonts into Remotion
- [rules/audio.md](rules/audio.md) - Using audio and sound in Remotion - importing, trimming, volume, speed, pitch
- [rules/calculate-metadata.md](rules/calculate-metadata.md) - Dynamically set composition duration, dimensions, and props
- [rules/can-decode.md](rules/can-decode.md) - Check if a video can be decoded by the browser using Mediabunny
- [rules/charts.md](rules/charts.md) - Chart and data visualization patterns for Remotion
- [rules/compositions.md](rules/compositions.md) - Defining compositions, stills, folders, default props and dynamic metadata
- [rules/extract-frames.md](rules/extract-frames.md) - Extract frames from videos at specific timestamps using Mediabunny
- [rules/fonts.md](rules/fonts.md) - Loading Google Fonts and local fonts in Remotion
- [rules/get-audio-duration.md](rules/get-audio-duration.md) - Getting the duration of an audio file in seconds with Mediabunny
- [rules/get-video-dimensions.md](rules/get-video-dimensions.md) - Getting the width and height of a video file with Mediabunny
- [rules/get-video-duration.md](rules/get-video-duration.md) - Getting the duration of a video file in seconds with Mediabunny
- [rules/gifs.md](rules/gifs.md) - Displaying GIFs synchronized with Remotion's timeline
- [rules/images.md](rules/images.md) - Embedding images in Remotion using the Img component
- [rules/light-leaks.md](rules/light-leaks.md) - Light leak overlay effects using @remotion/light-leaks
- [rules/lottie.md](rules/lottie.md) - Embedding Lottie animations in Remotion
- [rules/measuring-dom-nodes.md](rules/measuring-dom-nodes.md) - Measuring DOM element dimensions in Remotion
- [rules/measuring-text.md](rules/measuring-text.md) - Measuring text dimensions, fitting text to containers, and checking overflow
- [rules/sequencing.md](rules/sequencing.md) - Sequencing patterns for Remotion - delay, trim, limit duration of items
- [rules/tailwind.md](rules/tailwind.md) - Using TailwindCSS in Remotion
- [rules/text-animations.md](rules/text-animations.md) - Typography and text animation patterns for Remotion
- [rules/timing.md](rules/timing.md) - Interpolation curves in Remotion - linear, easing, spring animations
- [rules/transitions.md](rules/transitions.md) - Scene transition patterns for Remotion
- [rules/transparent-videos.md](rules/transparent-videos.md) - Rendering out a video with transparency
- [rules/trimming.md](rules/trimming.md) - Trimming patterns for Remotion - cut the beginning or end of animations
- [rules/videos.md](rules/videos.md) - Embedding videos in Remotion - trimming, volume, speed, looping, pitch
- [rules/parameters.md](rules/parameters.md) - Make a video parametrizable by adding a Zod schema
- [rules/maps.md](rules/maps.md) - Add a map using Mapbox and animate it
- [rules/motion-blur.md](rules/motion-blur.md) - Motion blur and trail effects using @remotion/motion-blur
- [rules/noise.md](rules/noise.md) - Procedural noise generation for visual effects using @remotion/noise
- [rules/paths.md](rules/paths.md) - SVG path manipulation, morphing, and stroke drawing using @remotion/paths
- [rules/rive.md](rules/rive.md) - Embedding Rive animations using @remotion/rive
- [rules/shapes.md](rules/shapes.md) - SVG shape components using @remotion/shapes

---

## Project Reference

This section documents the actual Remotion project at `packages/remotion-studio/` so Claude knows the codebase when generating JSON or editing code.

### Render Settings

- **Resolution:** 1080x1920 (9:16 vertical)
- **FPS:** 30
- **Remotion version:** 4.0.242
- **Zod version:** 3.22.3 (exact)

### Key Conventions

- Animations use `useCurrentFrame()` + `spring()` + `interpolate()` only. No CSS animations or transitions.
- Sequencing uses `<Series>` for sequential scenes.
- Props use `type` declarations, not `interface`.
- All compositions are registered in `src/Root.tsx` inside a `<Folder name="Content-Formats">`.

### Theme System

All compositions share a `ThemeSchema` with 7 fields:

| Field | Type | Default (Collective Family) |
|-------|------|-----------------------------|
| `primaryColor` | color | `"#0d9488"` |
| `accentColor` | color | `"#faf5ef"` |
| `darkBackground` | color | `"#1a1a2e"` |
| `lightBackground` | color | `"#faf5ef"` |
| `textColor` | color | `"#ffffff"` |
| `headingFont` | string | `"Georgia"` |
| `bodyFont` | string | `"Nunito Sans"` |

### Shared Components

All components live in `src/components/` and accept a `theme: Theme` prop.

| Component | Props | Animation |
|-----------|-------|-----------|
| `TitleCard` | `title`, `subtitle?`, `theme` | spring slide down (damping: 200), subtitle delayed 8 frames |
| `StatCard` | `value`, `label`, `theme` | scale 0.5 to 1 (damping: 12, stiffness: 200), label fade delayed 10 frames |
| `ChecklistOverlay` | `number`, `label`, `description`, `theme` | slide from left -80px (damping: 200), checkmark scale pop (damping: 15, delay: 12) |
| `MythTruthReveal` | `type` ("myth" or "truth"), `text`, `theme` | stamp scale 3 to 1 + rotation (damping: 8, stiffness: 200), text slide delayed 6 frames |
| `StepIndicator` | `stepNumber`, `totalSteps`, `label`, `description`, `theme` | slide up 50px (damping: 200), description delayed 8 frames |
| `CallToAction` | `text`, `theme` | scale 0.8 to 1 (damping: 12, stiffness: 180), glow delayed 10 frames |
| `HookText` | `text`, `theme` | scale 1.2 to 1 + slide 20px (damping: 15, stiffness: 200) |
| `SectionCard` | `label`, `text`, `theme` | two-stage fade: label then text (damping: 200, text delayed 6 frames) |
| `FrequencyCard` | `frequency`, `keyCue`, `theme` | key cue slide 40px (damping: 200), badge scale pop (damping: 12, delay: 8) |

### Composition Schemas

| Composition | ID | Duration | Unique Fields |
|-------------|-----|----------|---------------|
| Explainer (A) | `Explainer` | 30s | `title`, `hookText`, `sections` (1-6, each with label/text/durationInSeconds), `stat?` (value/label), `ctaText` |
| Checklist (B) | `Checklist` | 35s | `title`, `hookText`, `items` (2-7, each with number/label/description), `closingText`, `ctaText` |
| Demo (C) | `Demo` | 40s | `title`, `hookText`, `steps` (1-8, each with instruction), `keyCue`, `frequency`, `ctaText` |
| MythBuster (D) | `MythBuster` | 15s | `mythText`, `truthText`, `explanationText`, `ctaText` (NO title or hookText) |
| Walkthrough (E) | `Walkthrough` | 45s | `title`, `hookText`, `steps` (2-8, each with stepNumber/label/description), `reassuranceText`, `ctaText` |

### File Structure

```
packages/remotion-studio/src/
  Root.tsx                    # Composition registration + default props
  schemas/
    theme.ts                  # ThemeSchema (7 fields) + defaultTheme
    explainer.ts              # ExplainerSchema
    checklist.ts              # ChecklistSchema
    demo.ts                   # DemoSchema
    myth-buster.ts            # MythBusterSchema
    walkthrough.ts            # WalkthroughSchema
  compositions/
    Explainer.tsx             # Format A composition
    Checklist.tsx             # Format B composition
    Demo.tsx                  # Format C composition
    MythBuster.tsx            # Format D composition
    Walkthrough.tsx           # Format E composition
  components/
    TitleCard.tsx
    StatCard.tsx
    ChecklistOverlay.tsx
    MythTruthReveal.tsx
    StepIndicator.tsx
    CallToAction.tsx
    HookText.tsx
    SectionCard.tsx
    FrequencyCard.tsx
```
