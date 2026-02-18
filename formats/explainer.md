# Format A: "What Is [X]?" (The Explainer)

**Duration:** 30-45 seconds
**Best for:** Education, awareness, SEO discovery
**Platform sweet spot:** YouTube Shorts (educational hooks perform best)

## Structure

| Segment | Time | Purpose |
|---------|------|---------|
| Hook | 0-3s | Question or surprising statement that stops the scroll |
| What's happening | 3-15s | Simple explanation with visual support |
| Why it matters | 15-25s | The consequence of ignoring it, or the connection most people miss |
| What you can do | 25-35s | Brief actionable step or "here's how we help" |
| CTA | 35-45s | Follow for more, share with someone who needs this |

## Cinema Studio Rig (Default)

- Camera: ARRI Alexa (warm, professional)
- Lens: Cooke (character-driven bokeh)
- Focal Length: 35mm
- Genre: Intimate
- Shots: 3-4 shots, 2-3 seconds each

## Vibe Motion Graphics

- Title card with topic name (brand primary color on dark background, serif font)
- One stat card if relevant ("affects 1 in 4 [people]" style)

## Voiceover Template

```
[Hook question or statement]

Here's what's actually happening. [Simple explanation using everyday language, not jargon]

And here's why that matters. [Consequence or connection]

[What they can do about it / how your service helps]

If this sounds like you [or your child / or someone you know], share this with someone who needs to hear it.
```

## Remotion Composition: `Explainer`

Input schema fields:
- `title` (string) - Topic name for title card
- `hookText` (string) - Text overlay for first 3 seconds
- `sections` (array) - Label + text + duration for each segment
- `stat` (optional) - Value + label for stat card
- `ctaText` (string) - Call to action text
- `theme` (object) - Brand colors and fonts

## Platform Notes

- **Instagram Reels:** Add trending audio if it fits. First frame needs text overlay.
- **YouTube Shorts:** Description should include condition keywords and common search questions.
