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
- Full-format compositions are in `<Folder name="Content-Formats">` in `src/Root.tsx`.
- Per-component shot compositions are in `<Folder name="Shots">` in `src/Root.tsx`.

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
| `ChartCard` | `title?`, `bars` (label/value/color?), `maxValue?`, `theme` | staggered bars via spring (5-frame delay), labels fade with bars, title slide down |
| `QuoteCard` | `quote`, `attribution`, `role?`, `theme` | quotation mark scale 1.5 to 1 (damping: 12), text slide up delayed 8f, attribution slide from right delayed 15f |

### Composition Schemas

**Full-format compositions** (render a complete video format, 15-45s):

| Composition | ID | Duration | Unique Fields |
|-------------|-----|----------|---------------|
| Explainer (A) | `Explainer` | 30s | `title`, `hookText`, `sections` (1-6, each with label/text/durationInSeconds), `stat?` (value/label), `ctaText` |
| Checklist (B) | `Checklist` | 35s | `title`, `hookText`, `items` (2-7, each with number/label/description), `closingText`, `ctaText` |
| Demo (C) | `Demo` | 40s | `title`, `hookText`, `steps` (1-8, each with instruction), `keyCue`, `frequency`, `ctaText` |
| MythBuster (D) | `MythBuster` | 15s | `mythText`, `truthText`, `explanationText`, `ctaText` (NO title or hookText) |
| Walkthrough (E) | `Walkthrough` | 45s | `title`, `hookText`, `steps` (2-8, each with stepNumber/label/description), `reassuranceText`, `ctaText` |

**Shot compositions** (render a single component clip, 2-15s):

| Composition | ID | Props |
|-------------|-----|-------|
| Shot-TitleCard | `Shot-TitleCard` | `title`, `subtitle?`, `durationInSeconds`, `theme` |
| Shot-StatCard | `Shot-StatCard` | `value`, `label`, `durationInSeconds`, `theme` |
| Shot-SectionCard | `Shot-SectionCard` | `label`, `text`, `durationInSeconds`, `theme` |
| Shot-HookText | `Shot-HookText` | `text`, `durationInSeconds`, `theme` |
| Shot-Checklist | `Shot-Checklist` | `items` (1-7, number/label/description), `durationInSeconds`, `theme` |
| Shot-MythTruth | `Shot-MythTruth` | `text`, `type` ("myth"/"truth"), `durationInSeconds`, `theme` |
| Shot-StepIndicator | `Shot-StepIndicator` | `stepNumber`, `totalSteps`, `label`, `description`, `durationInSeconds`, `theme` |
| Shot-FrequencyCard | `Shot-FrequencyCard` | `frequency`, `keyCue`, `durationInSeconds`, `theme` |
| Shot-CTA | `Shot-CTA` | `text`, `durationInSeconds`, `theme` |
| Shot-ChartCard | `Shot-ChartCard` | `title?`, `bars` (1-8, label/value/color?), `maxValue?`, `durationInSeconds`, `theme` |
| Shot-QuoteCard | `Shot-QuoteCard` | `quote`, `attribution`, `role?`, `durationInSeconds`, `theme` |

Shot compositions use `calculateMetadata` to dynamically set duration from `durationInSeconds` prop. Each is wrapped in a `ShotWrapper` that handles entrance (15 frames fade+scale) and exit (15 frames fade out).

### Visual Quality Patterns

All components use these visual techniques for professional output:

- **Radial gradient backgrounds**: `radial-gradient(ellipse at center, ${theme.darkBackground} 0%, #0f0f1e 100%)` instead of flat colors
- **Glow effects**: Large blurred circles (300-500px, 5-8% opacity) behind focal elements using `theme.primaryColor`
- **Accent lines**: 3-4px teal lines that animate in (scale or width interpolation) for visual separation
- **Text shadows**: `0 2px 20px rgba(0,0,0,0.3)` on headings for depth
- **Pulse animations**: `Math.sin(frame * rate) * amplitude` for subtle living effects on glows and borders
- **Screen shake**: `Math.sin(frame * frequency) * decay` for impact moments (MythTruthReveal stamp)
- **Color wash flash**: Brief full-screen color overlay that fades quickly for dramatic reveals

### File Structure

```
packages/remotion-studio/src/
  Root.tsx                    # Composition registration + default props
  schemas/
    theme.ts                  # ThemeSchema (7 fields) + defaultTheme
    shot.ts                   # 11 shot schemas (ShotTitleCardSchema, etc.)
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
    shots/
      ShotTitleCard.tsx       # Single TitleCard clip
      ShotStatCard.tsx        # Single StatCard clip
      ShotSectionCard.tsx     # Single SectionCard clip
      ShotHookText.tsx        # Single HookText clip
      ShotChecklist.tsx       # Checklist items clip (uses Series)
      ShotMythTruth.tsx       # Myth or Truth stamp clip
      ShotStepIndicator.tsx   # Single step clip
      ShotFrequencyCard.tsx   # Frequency/key cue clip
      ShotCallToAction.tsx    # CTA clip
      ShotChartCard.tsx      # Chart/graph clip
      ShotQuoteCard.tsx      # Quote/testimonial clip
  components/
    ShotWrapper.tsx           # Entrance/exit animation wrapper
    TitleCard.tsx
    StatCard.tsx
    ChecklistOverlay.tsx
    MythTruthReveal.tsx
    StepIndicator.tsx
    CallToAction.tsx
    HookText.tsx
    SectionCard.tsx
    FrequencyCard.tsx
    ChartCard.tsx             # Animated bar chart
    QuoteCard.tsx             # Quote/testimonial with attribution
```

### Dashboard Render API

The dashboard at `packages/dashboard/` provides per-component rendering:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/renders/:code` | GET | Get render jobs for a video |
| `/api/renders/:code` | POST | Render full-format composition |
| `/api/renders/:code/shots` | GET | Get parsed Vibe Motion components + shot jobs |
| `/api/renders/:code/shot/:shotId` | POST | Render a single component clip |
| `/api/renders/:code/all-shots` | POST | Render all component clips for a video |
| `/api/renders/:code/composer` | POST | Render user-edited components from the Composer |

The Vibe Motion parser (`server/parsers/vibe-motion.ts`) extracts component references from content library Vibe Motion text and maps them to shot composition props. Supports 11 component types: TitleCard, StatCard, SectionCard, HookText, ChecklistOverlay, MythTruthReveal, StepIndicator, FrequencyCard, CallToAction, ChartCard, QuoteCard.

### Composer

The dashboard includes a full-page Composer view (`components/composer/`) for interactive editing of motion graphics. It embeds `@remotion/player` for live preview and provides:

- **Component registry** (`component-registry.ts`): Maps all 11 component types to their React components, default props, and editable field definitions
- **Live Player preview**: Real-time rendering of selected component at 9:16 / 30fps using `@remotion/player`
- **Prop editor**: Dynamic form generation based on field definitions (text, number, select, array, color)
- **Component list**: Drag-and-drop reorderable list with add/remove capabilities using `@dnd-kit`
- **Render integration**: Renders edited components through the `/api/renders/:code/composer` endpoint
