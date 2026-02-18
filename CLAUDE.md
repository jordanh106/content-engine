# Content Engine

Industry-agnostic content creation toolkit. Claude skills, reusable video formats, documented production workflows, and Remotion-powered motion graphics. Chiropractic is the first industry; the architecture supports any industry by swapping config and content packs.

## Architecture

```
skills/           Claude Code skills (symlinked to ~/.claude/skills/)
formats/          5 reusable video format templates (industry-agnostic)
workflows/        Production process documentation (industry-agnostic)
industries/       Pluggable industry content packs
packages/         Code packages (Remotion project)
scripts/          Repo utilities (install, scaffold)
```

## Active Industry

**Chiropractic** (Collective Family Chiropractic)
- Config: `industries/chiropractic/config.json`
- Brand: `industries/chiropractic/brand.md` and `skills/brand-factory/presets/collective-family.md`
- Content: `industries/chiropractic/content-library.md` (57 production-ready videos)

## Skills

| Skill | Invocation | Purpose |
|-------|-----------|---------|
| last30days | `/last30days [topic]` | Research trending topics on Reddit + X + Web from last 30 days |
| remotion-best-practices | Auto-loaded when working with Remotion | Domain knowledge for Remotion video creation |
| brand-factory | Auto-loaded when applying brand | Industry-specific brand colors, typography, voice |
| theme-factory | `/theme-factory` | 11 pre-set styling themes for artifacts |
| content-planner | `/content-planner` | Research output to weekly content calendar |
| video-director | `/video-director` | Calendar entry to full production plan |

### Skill Pipeline
```
/last30days → /content-planner → /video-director → Remotion + Cinema Studio → Assembly
```

## Video Formats

Five reusable templates in `formats/`. Swap the topic, keep the structure:

| Format | Name | Duration | Best For |
|--------|------|----------|----------|
| A | Explainer ("What Is [X]?") | 30-45s | Education, SEO |
| B | Checklist ("Signs Your [X] Needs [Y]") | 30-45s | Shareability, saves |
| C | Demo ("The Exercise/Tutorial") | 30-60s | Actionable value |
| D | Myth Buster ("Myth vs. Truth") | 15-30s | Engagement, comments |
| E | Walkthrough ("What Happens During [X]") | 45-60s | New patient/customer conversion |

## Remotion Project

Location: `packages/remotion-studio/`

Renders motion graphics programmatically (title cards, stat cards, checklist overlays, myth/truth reveals, step indicators, CTAs). Does NOT replace Cinema Studio for cinematic footage. They combine in post-production.

```bash
npm run preview          # Open Remotion preview
npm run render           # Render a composition
npm run typecheck        # TypeScript check
```

Each composition accepts parametrized input via Zod schemas. Brand colors come from the theme system.

### Compositions

| ID | Format | Default Duration |
|----|--------|-----------------|
| Explainer | A | 30s |
| Checklist | B | 35s |
| Demo | C | 40s |
| MythBuster | D | 15s |
| Walkthrough | E | 45s |

All render at **1080x1920 (9:16)** at **30 fps**.

### Key Patterns

- Animations use `useCurrentFrame()` + `spring()` + `interpolate()`. No CSS animations.
- Sequencing uses `<Series>` for sequential scenes.
- Zod must be exactly `3.22.3`.
- Props use `type` declarations, not `interface`.
- Shared components: `TitleCard`, `StatCard`, `ChecklistOverlay`, `MythTruthReveal`, `StepIndicator`, `CallToAction`, `HookText`, `SectionCard`, `FrequencyCard`.

## Key Commands

```bash
npm run install-skills   # Symlink skills to ~/.claude/skills/
npm run uninstall-skills # Remove symlinks
npm run new-industry     # Scaffold a new industry pack
npm run preview          # Remotion preview
npm run render           # Remotion render
npm run typecheck        # TypeScript check
npm run test:skills      # Run last30days Python tests
```

## Adding a New Industry

```bash
bash scripts/new-industry.sh dental
```

Then edit:
1. `industries/dental/config.json` - Audiences, conditions, platforms
2. `industries/dental/brand.md` - Voice, tone, content rules
3. `industries/dental/content-library.md` - Video scripts using formats A-E
4. `skills/brand-factory/presets/dental.md` - Brand colors, typography, design tokens

## Conventions

- No emdashes in any generated content. Use commas, periods, or restructure.
- Patient/customer-facing content: warm, educational, empowering
- Video scripts include delivery cues in brackets: `[Warm, empathetic]`
- Cinema Studio prompts always specify: camera body, lens, focal length, genre
- Exercise instructions always include frequency and difficulty level
- Organize content by audience segment (life stage, demographic, etc.)
