import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { parseContentLibrary } from "../parsers/content-library.js";
import type {
  ComposerAiRequest,
  ComposerAiResponse,
  VibeMotionComponent,
} from "../../shared/types.js";

// ============================================
// Component catalog for the system prompt
// ============================================

const COMPONENT_CATALOG = `
## Available Component Types

Each component has a \`componentType\`, a matching \`compositionId\` (format: "Shot-{Type}"), required/optional props, and a duration range of 2-15 seconds.

### 1. TitleCard
- compositionId: "Shot-TitleCard"
- Purpose: Bold opening title with optional subtitle. Use for video introductions.
- Props: title (string, required), subtitle (string, optional)
- Default duration: 3s

### 2. StatCard
- compositionId: "Shot-StatCard"
- Purpose: Large number or statistic with a label. Use for impactful data points.
- Props: value (string, required - e.g. "60 lbs", "87%", "1 in 250"), label (string, required - describes what the value means)
- Default duration: 4s

### 3. SectionCard
- compositionId: "Shot-SectionCard"
- Purpose: Section label with body text and accent bar. Use for key points or explanations.
- Props: label (string, required - short uppercase label like "KEY POINT"), text (string, required - the explanation)
- Default duration: 4s

### 4. HookText
- compositionId: "Shot-HookText"
- Purpose: Attention-grabbing opening text. Use for hooks that pull viewers in.
- Props: text (string, required - a compelling question or statement)
- Default duration: 3s

### 5. ChecklistOverlay
- compositionId: "Shot-Checklist"
- Purpose: Numbered checklist with checkmarks. Use for signs, symptoms, tips, or steps.
- Props: items (array of {number: number, label: string, description: string}, required, 2-7 items)
- Default duration: 6s

### 6. MythTruthReveal
- compositionId: "Shot-MythTruth"
- Purpose: Dramatic myth or truth stamp reveal. Use for debunking or confirming claims.
- Props: text (string, required - the statement), type ("myth" | "truth", required)
- Default duration: 4s

### 7. StepIndicator
- compositionId: "Shot-StepIndicator"
- Purpose: Numbered step with progress dots. Use for tutorials or processes.
- Props: stepNumber (number, 1-10), totalSteps (number, 1-10), label (string, required), description (string, required)
- Default duration: 5s

### 8. FrequencyCard
- compositionId: "Shot-FrequencyCard"
- Purpose: Exercise frequency and key cue. Use for workout instructions.
- Props: frequency (string, required - e.g. "3 sets of 10, twice daily"), keyCue (string, required - important form tip)
- Default duration: 4s

### 9. CallToAction
- compositionId: "Shot-CTA"
- Purpose: Closing CTA with glow effect. Use as the final component.
- Props: text (string, required - e.g. "Save this and share it with someone who needs it.")
- Default duration: 3s

### 10. ChartCard
- compositionId: "Shot-ChartCard"
- Purpose: Animated bar chart for data visualization. Use to show comparisons, statistics, or trends visually.
- Props: title (string, optional), bars (array of {label: string, value: number, color?: string}, required, 1-8 bars)
- Default duration: 5s
- Note: Values are relative (the tallest bar fills the chart). Colors are optional hex codes.

### 11. QuoteCard
- compositionId: "Shot-QuoteCard"
- Purpose: Testimonial or quote with attribution. Use for patient/client quotes or expert statements.
- Props: quote (string, required), attribution (string, required - who said it), role (string, optional - their title)
- Default duration: 5s
`;

const DEFAULT_THEME = {
  primaryColor: "#0d9488",
  accentColor: "#faf5ef",
  darkBackground: "#1a1a2e",
  lightBackground: "#faf5ef",
  textColor: "#ffffff",
  headingFont: "Georgia",
  bodyFont: "Nunito Sans",
};

function buildSystemPrompt(): string {
  return `You are a motion graphics composer assistant. You help users create and edit animated motion graphic components for short-form social media videos (9:16 vertical, 1080x1920, 30fps).

${COMPONENT_CATALOG}

## Theme
All components must include a "theme" property in their props with these exact values:
${JSON.stringify(DEFAULT_THEME, null, 2)}

## Rules
1. Every component needs: id (use format "{type}-{timestamp}" like "chartcard-1708300000000"), componentType, compositionId, durationInSeconds (2-15), props (must include theme), and label (short descriptive text).
2. When the user says "this" or "the selected component", they mean the component at the selectedIndex.
3. Prefer visual upgrades: if a user asks to "make it more engaging", consider replacing plain text with charts, adding visual elements, or using more dynamic component types.
4. Generate realistic, contextually appropriate content based on the video context (title, script, audience, tags).
5. Keep text concise - titles under 40 chars, labels under 30 chars, body text under 80 chars.
6. Duration should match content complexity: simple text 3s, stats 4s, checklists 5-6s, charts 5s.
7. Do not use emdashes in any text content. Use commas, periods, or restructure instead.

## Response Format
Return a JSON object with:
- "operations": array of operations to apply (add, replace, modify, remove, reorder)
- "message": a brief friendly explanation of what you did (1-2 sentences)

## Operation Types
- { "action": "add", "component": { full VibeMotionComponent object } }
- { "action": "replace", "index": number, "component": { full VibeMotionComponent object } }
- { "action": "modify", "index": number, "props": { partial props to merge }, "durationInSeconds": optional number }
- { "action": "remove", "index": number }
- { "action": "reorder", "order": [new index order] }

Important: When adding or replacing, always provide a COMPLETE component object with all required fields including id, componentType, compositionId, durationInSeconds, props (with theme), and label.

CRITICAL: Your entire response must be a single valid JSON object. No markdown code fences, no explanation text outside the JSON. Just raw JSON.`;
}

function buildUserMessage(req: ComposerAiRequest): string {
  const parts: string[] = [];

  parts.push(`## Video Context
- Code: ${req.videoContext.code}
- Title: ${req.videoContext.title}
- Format: ${req.videoContext.format}
- Audience: ${req.videoContext.audience}
- Tags: ${req.videoContext.tags.join(", ")}
- Script: ${req.videoContext.script.slice(0, 500)}`);

  if (req.components.length > 0) {
    parts.push(`\n## Current Components (${req.components.length} total)`);
    req.components.forEach((c, i) => {
      const selected = i === req.selectedIndex ? " [SELECTED]" : "";
      parts.push(
        `${i}. ${c.componentType} "${c.label}" (${c.durationInSeconds}s)${selected}`,
      );
      parts.push(`   Props: ${JSON.stringify(c.props, null, 0)}`);
    });
  } else {
    parts.push("\n## Current Components\nNone (empty composition)");
  }

  if (req.selectedIndex !== null) {
    parts.push(`\nSelected component index: ${req.selectedIndex}`);
  }

  parts.push(`\n## User Request\n${req.prompt}`);

  return parts.join("\n");
}

// Note: We use plain JSON mode instead of json_schema structured outputs
// because component props are dynamic per component type and structured
// outputs require additionalProperties: false on all objects.

export function createComposerAiRouter(contentLibraryPath: string) {
  const router = Router();

  let client: Anthropic | null = null;
  try {
    client = new Anthropic();
  } catch {
    console.warn(
      "[composer-ai] ANTHROPIC_API_KEY not set. AI features will be unavailable.",
    );
  }

  router.post("/ai", async (req, res) => {
    if (!client) {
      res.status(503).json({
        error:
          "AI features unavailable. Set the ANTHROPIC_API_KEY environment variable.",
      });
      return;
    }

    const body = req.body as ComposerAiRequest;

    if (!body.prompt || typeof body.prompt !== "string") {
      res.status(400).json({ error: "Missing prompt" });
      return;
    }

    // Enrich video context from content library if script is missing
    if (!body.videoContext?.script) {
      const videos = parseContentLibrary(contentLibraryPath);
      const video = videos.find(
        (v) => v.code.toUpperCase() === body.videoContext?.code?.toUpperCase(),
      );
      if (video) {
        body.videoContext = {
          code: video.code,
          title: video.title,
          format: video.formatName,
          script: video.script,
          audience: video.audienceLabel,
          tags: video.tags,
        };
      }
    }

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: buildSystemPrompt(),
        messages: [
          {
            role: "user",
            content: buildUserMessage(body),
          },
        ],
      });

      // Extract the text content from the response
      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        res.status(500).json({ error: "No response from AI" });
        return;
      }

      // Strip markdown code fences if present
      let jsonText = textBlock.text.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }

      const parsed: ComposerAiResponse = JSON.parse(jsonText);

      // Validate and stamp IDs for new components
      for (const op of parsed.operations) {
        if (
          (op.action === "add" || op.action === "replace") &&
          op.component
        ) {
          if (!op.component.id) {
            op.component.id = `${op.component.componentType?.toLowerCase() || "comp"}-${Date.now()}`;
          }
          // Ensure theme is present in props
          if (op.component.props && !op.component.props.theme) {
            op.component.props.theme = DEFAULT_THEME;
          }
          // Ensure durationInSeconds is in props too
          if (op.component.props && op.component.durationInSeconds) {
            op.component.props.durationInSeconds =
              op.component.durationInSeconds;
          }
        }
      }

      res.json(parsed);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI request failed";
      console.error("[composer-ai] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
