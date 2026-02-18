---
name: brand-factory
description: Applies industry-specific brand colors, typography, voice, and visual identity to any artifact. Loads brand presets from the presets/ directory. Use when brand colors, style guidelines, visual formatting, or practice design standards apply.
metadata:
  tags: branding, visual identity, brand colors, typography, voice, tone, styling
---

# Brand Factory

## Overview

Industry-agnostic brand application skill. Loads a brand preset and applies its colors, typography, voice, and visual identity to any artifact (slides, docs, videos, HTML, components, etc.).

## How to Use

1. **Check which industry is active.** Look at the root `CLAUDE.md` or ask the user which brand to apply.
2. **Load the brand preset** from `presets/<industry>.md` (relative to this skill directory).
3. **Apply the brand** to the artifact being created or modified.

## Available Presets

Check the `presets/` directory for available brand files. Each preset includes:
- Brand archetype and values
- Color palette with hex codes and usage rules
- Typography (fonts, sizes, weights)
- Design system tokens (component patterns, spacing, shapes)
- Content rules (writing style, tone by context, words to use/avoid)
- Practice/business context (if applicable)

## Creating a New Brand Preset

Copy `presets/_template.md` and fill in the sections for the new industry or business. Save it as `presets/<name>.md`.

## Default Preset

If no industry is specified, check the root `CLAUDE.md` for the active industry configuration. The `collective-family` preset is the original and most complete reference.
