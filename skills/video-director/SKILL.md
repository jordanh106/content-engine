---
name: video-director
description: Turn a content plan entry into a complete video production plan. Generates voiceover script, Cinema Studio shot prompts, Remotion data, and CapCut assembly instructions.
argument-hint: "[topic] as [format]" or "[video code from library]"
context: fork
agent: Explore
allowed-tools: Bash, Read, Write, AskUserQuestion
---

# Video Director: Script to Production Plan

Transform a topic and format assignment into a complete, production-ready video plan.

## When to Use

- After `/content-planner` assigns a topic and format
- When you want to create a new video not yet in the content library
- When you want to expand a content library entry into a full production plan (like the 3 example videos in the chiropractic library)
- When adapting an existing video concept to a different industry

## What It Does

Produces a complete production plan containing:
1. **Voiceover script** with delivery cues, ready to record
2. **Cinema Studio shot list** with Hero Frame prompts and camera movements
3. **Remotion data JSON** matching the composition's Zod schema (for motion graphics)
4. **Vibe Motion graphic prompts** (if Cinema Studio workflow)
5. **CapCut assembly instructions** (shot order, transitions, music notes)
6. **Platform-specific notes** (captions, hashtags, description keywords)

## How to Use

### From a Content Planner Entry
```
/video-director "What Is Tech Neck?" as explainer
```

### From an Existing Library Code
```
/video-director D1
```
This expands the D1 entry from the content library into a full production plan (like the 3 example videos).

### For a New Topic
```
/video-director "Why Deep Squats Are Good for You" as demo for chiropractic
```

### For a Different Industry
```
/video-director "What Is a Root Canal?" as walkthrough for dental
```

## Step-by-Step Process

### Step 1: Load Context

Read these files (paths relative to content-engine repo root):
- `formats/<format>.md` - The assigned format template
- `industries/<industry>/brand.md` - Voice, tone, humor rules
- `industries/<industry>/cinema-defaults.md` - Default camera rigs
- `industries/<industry>/config.json` - Audience segments and conditions

If a library code was given (e.g., "D1"), also read:
- `industries/<industry>/content-library.md` - Find the existing entry

### Step 2: Research the Topic

If the topic requires medical, technical, or factual accuracy:
1. Check if the content library already has a script for this topic
2. If not, use your training knowledge to ensure accuracy
3. Note any claims that should include supporting data

### Step 3: Write the Voiceover Script

Follow the format template's voiceover structure. Apply the brand voice from brand.md.

**Script rules:**
- Include delivery cues in brackets: `[Warm, empathetic]`, `[Pause 2 seconds]`, `[Deadpan]`
- Match the target duration for the format (word count ~ duration x 2.5)
- Use "you/your" language, not clinical third-person
- No emdashes. Use commas, periods, or restructure.
- End with a clear CTA that matches the format's style

### Step 4: Build the Shot List

For each segment of the script:

| Shot | Duration | Hero Frame Prompt | Camera Movement | Audio Alignment |
|------|----------|-------------------|-----------------|-----------------|
| 1 | Xs | [Detailed prompt] | [Movement] | "Plays during [script line]" |

**Hero Frame Prompt Guidelines:**
- Be specific about: subject, action, environment, lighting, mood, clothing
- Include brand colors where appropriate (e.g., "teal (#0d9488) glow")
- Specify camera angle and composition
- Use the industry's cinema defaults for camera body, lens, and genre

### Step 5: Generate Remotion Data

Output a JSON object matching the format's Remotion composition schema:

```json
{
  "title": "Video Title",
  "hookText": "Hook overlay text",
  "sections": [...],
  "stat": { "value": "82%", "label": "success rate" },
  "ctaText": "Share this with someone who needs it",
  "theme": {
    "primaryColor": "#0d9488",
    "accentColor": "#faf5ef",
    "headingFont": "Georgia",
    "bodyFont": "Nunito Sans",
    "darkBackground": "#1a1a2e"
  }
}
```

### Step 6: Write Assembly Instructions

Specify:
- Shot sequence and transitions
- Background music mood and volume
- Caption highlight keywords
- Export format (9:16, 1080x1920)

### Step 7: Add Platform Notes

- **Instagram Reels:** Suggested hashtags, caption text, audio notes
- **YouTube Shorts:** Description with search keywords, title suggestion
- **Patient/Customer Resource:** Tags for the resource library

## Output Format

Save the production plan to:
```
industries/<industry>/production-plans/<video-code>-<slug>.md
```

Example: `industries/chiropractic/production-plans/D1-tech-neck.md`

## Integration with Other Skills

```
/last30days [topic]     → Research
/content-planner        → Calendar with format assignments
/video-director         → THIS SKILL produces the production plan
remotion-best-practices → Auto-loaded when generating Remotion data
brand-factory           → Auto-loaded when applying brand voice
```
