# Format E: "What Happens During [X]" (The Walkthrough)

**Duration:** 45-60 seconds
**Best for:** Anxiety reduction, new customer/patient conversion
**Platform sweet spot:** YouTube Shorts (people search for "what to expect")

## Structure

| Segment | Time | Purpose |
|---------|------|---------|
| Hook | 0-5s | "Here's exactly what happens when [you/your child] gets [service]" |
| Step 1 | 5-15s | What happens first (consultation, assessment) |
| Step 2 | 15-30s | The service itself (with reassuring language) |
| Step 3 | 30-45s | What to expect after |
| Reassurance + CTA | 45-60s | "It's [gentle/safe/effective] and [audience]-specific" |

## Cinema Studio Rig (Default)

- Camera: ARRI Alexa (warm, professional)
- Lens: Cooke (warm bokeh)
- Focal Length: 35mm
- Genre: Intimate
- Shots: 4-6 shots walking through each step visually

## Vibe Motion Graphics

- Step number overlays ("Step 1: Assessment")
- Gentle, reassuring typography (no harsh colors)
- Closing card: "Questions? We're here to help"

## Voiceover Template

```
A lot of [audience] want to know: what actually happens during [service]? Here's the honest answer.

First, [step one in warm, simple language].

Then, [step two, emphasizing gentleness and safety].

After that, [what to expect, including normal responses].

That's it. It's [gentle/safe/effective], and it's designed specifically for [audience / condition].

If you've been thinking about it, this is your sign.
```

## Remotion Composition: `Walkthrough`

Input schema fields:
- `title` (string) - Service/procedure name
- `hookText` (string) - "Here's exactly what happens..."
- `steps` (array) - Step number + label + description
- `reassuranceText` (string) - Closing reassurance line
- `ctaText` (string) - Call to action
- `theme` (object) - Brand colors and fonts

## Platform Notes

- **YouTube Shorts:** "What to expect" is a high-intent search query. Optimize descriptions with the service name + "what to expect" + "first visit."
- **Instagram Reels:** Share this in DMs to potential new customers/patients considering their first appointment.
