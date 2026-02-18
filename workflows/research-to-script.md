# Workflow: Research to Script

How to go from a topic idea to a production-ready video script.

## Step 1: Research with /last30days

Before creating any content, research what's trending in your industry.

```
/last30days [your topic] [--quick | --deep]
```

**What to look for:**
- What questions are people asking about this topic?
- What hooks and formats are performing well?
- What myths or misconceptions exist (Format D opportunities)?
- What gaps exist (topics no one is covering well)?
- What emotional triggers are driving engagement?

## Step 2: Choose a Format

Match the topic to one of the 5 format templates:

| If the topic is... | Use Format |
|---------------------|-----------|
| An explanation of a condition/concept | A (Explainer) |
| Warning signs or symptoms | B (Checklist) |
| A practical exercise or technique | C (Demo) |
| A common misconception | D (Myth Buster) |
| A service or procedure walkthrough | E (Walkthrough) |

## Step 3: Write the Script

1. Load the format template from `formats/<format>.md`
2. Load the industry brand voice from `industries/<industry>/brand.md`
3. Fill in the voiceover template with your topic-specific content
4. Add delivery cues in brackets: `[Warm, empathetic]`, `[Pause for effect]`
5. Keep the script within the format's target duration (word count ~ duration x 2.5 words/second)

## Step 4: Build the Shot List

For each segment of the script:
1. Write a Cinema Studio Hero Frame prompt (or describe the Remotion graphic)
2. Assign a camera movement from the industry's cinema defaults
3. Note the audio alignment (which script line plays over this shot)

## Step 5: Record Voiceover

- Quiet room, no echo (closet or car works)
- Phone voice memo app
- Speak naturally, not "announcer voice"
- One continuous take is fine; trim dead air in post
- Read time should match target duration (+/- 5 seconds)

## Tools in the Chain

```
/last30days → Topic research
/content-planner → Calendar placement (optional)
/video-director → Full production plan (optional)
Manual → Voiceover recording
```
