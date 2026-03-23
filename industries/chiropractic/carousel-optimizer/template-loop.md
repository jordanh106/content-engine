# Autoresearch: Carousel Template Optimization Loop

Run with: `/autoresearch` then provide these parameters inline.

## Configuration

```
Goal: Maximize carousel engagement score (save_rate*0.4 + share_rate*0.3 + engagement*0.2 + ctr*0.1)
Scope: packages/dashboard/server/carousel-templates/**
Metric: composite engagement score
Direction: higher is better
Verify: curl -s http://localhost:3001/api/carousels/metrics/score | jq '.compositeScore'
Guard: npx tsc --noEmit --project packages/dashboard/tsconfig.json
Iterations: 20
```

## What the Loop Modifies Per Iteration

The editable assets are the 4 HTML template files and 1 config.json:

- `packages/dashboard/server/carousel-templates/config.json` - Font sizes, spacing, opacity, border radius
- `packages/dashboard/server/carousel-templates/cover.html` - Cover/hook slide layout and styling
- `packages/dashboard/server/carousel-templates/content.html` - Content slide layout and styling
- `packages/dashboard/server/carousel-templates/cta.html` - CTA slide layout and styling
- `packages/dashboard/server/carousel-templates/thumbnail.html` - YouTube thumbnail layout and styling

### Optimization Dimensions

Each iteration should modify ONE of these dimensions:

1. **Font size ratios** - headline vs body text sizing (config.json values)
2. **Color contrast** - background darkness, text brightness, accent placement
3. **Spacing/padding** - whitespace proportions, element margins
4. **Text positioning** - centered vs left-aligned, max-width constraints
5. **Background gradient** - angle, color stops, opacity
6. **CTA button styling** - size, shape, color, position
7. **Accent bar** - height, position, color treatment
8. **Brand mark** - size, opacity, position
9. **Number display** - size, opacity, font weight on content slides
10. **Slide number indicator** - visibility, format, position

### Constraints

- Templates must remain valid HTML that renders correctly as images
- All `{{PLACEHOLDER}}` variables must be preserved (the n8n Code node substitutes these)
- Brand colors from config.json must stay consistent with Collective Family brand (teal-600 primary, slate neutrals)
- Font imports (Google Fonts) must remain functional
- Body dimensions are set by the platform ({{WIDTH}}x{{HEIGHT}}) and must not change

## How to Run

```bash
# Check current score baseline
curl -s http://localhost:3001/api/carousels/metrics/score | jq '.'

# Run the loop
/autoresearch
# When prompted, paste the configuration block above
```

## Verification After Each Iteration

1. Templates parse as valid HTML
2. TypeScript still compiles: `npx tsc --noEmit --project packages/dashboard/tsconfig.json`
3. The `/api/carousels/templates` endpoint returns valid JSON
4. Composite score maintained or improved: `curl -s http://localhost:3001/api/carousels/metrics/score | jq '.compositeScore'`

## Git as Memory

Each kept change is committed. Each discarded change is reverted. The experiment log at `/api/carousels/experiments` tracks which template versions produced which scores. Over time, the git log of `carousel-templates/` becomes a record of what design changes improved engagement.
