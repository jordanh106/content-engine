# Workflow: Full AI Video Generation

How to produce a complete short-form video using Cinema Studio 2.0 with zero filming.

## The Production Model

Record voiceover on your phone (3-5 min), generate every visual in Cinema Studio 2.0, assemble in CapCut, publish. Each video takes 20-30 minutes.

## Step 1: Record Voiceover

- Use the script from your production plan
- Quiet room, natural speaking voice
- One continuous take per script
- Aim for the target duration of your format

## Step 2: Generate Hero Frames

For each shot in your production plan:

1. Set up the camera rig (camera body, lens, focal length, genre)
2. Write the Hero Frame prompt describing the still image
3. Generate and review. Regenerate if needed.
4. Lock the Hero Frame before adding motion.

**Key principle:** Never start with video. Start with a perfect still image. The video engine inherits lighting, composition, character details, and environment from the Hero Frame.

## Step 3: Add Motion

For each locked Hero Frame:
1. Choose camera movement (Slow Push In, Slow Pan Right, Slow Orbit, etc.)
2. Set speed (linear, slow-mo, speed-up, ramp)
3. Generate the video clip

## Step 4: Generate Remotion Graphics (Primary)

For stat cards, title cards, checklist overlays, and other text-based graphics:
1. Use the Remotion compositions in this repo (`packages/remotion-studio/`)
2. Match brand colors from the industry config
3. Keep typography consistent with brand guidelines
4. Use Vibe Motion only as an optional fallback for one-off experiments

## Step 5: Assemble in CapCut

1. Import voiceover audio as primary track
2. Place Cinema Studio clips sequentially, trimming to align with audio
3. Insert Remotion graphics at appropriate points
4. Add transitions (0.2-0.3s cross-dissolve between live shots, hard cuts for graphics)
5. Add background music at 12-15% volume
6. Add auto-captions with brand color keyword highlights
7. Export at 9:16 (1080x1920) for Reels/Shorts

## Production Math

| Metric | Per Video | Per Evening (3-5 videos) |
|--------|-----------|--------------------------|
| Voiceover | 3-5 min | 15-25 min |
| Cinema Studio | 10-15 min | 30-75 min |
| Assembly | 5-10 min | 15-50 min |
| **Total** | **20-30 min** | **1-2.5 hours** |

## See Also

- Prompt writing quick-reference: `workflows/cinema-studio-prompt-template.md`
- Industry-specific camera rigs: `industries/<industry>/cinema-defaults.md`
- Full Cinema Studio reference: `industries/<industry>/production-guides/cinema-studio-guide.md`
