import Anthropic from "@anthropic-ai/sdk";
import { Router } from "express";
import { parseContentLibrary } from "../parsers/content-library.js";
import { db } from "../db.js";
import { sql } from "drizzle-orm";
import type {
  ComposerAiRequest,
  ComposerAiResponse,
  ConversationMessage,
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

// ============================================
// Format patterns from formats/*.md Scene Flow tables
// ============================================

const FORMAT_PATTERNS: Record<
  string,
  { name: string; duration: string; energy: string; flow: string }
> = {
  A: {
    name: "Explainer",
    duration: "30-45s",
    energy:
      "Steady, educational. Medium tempo. Each scene breathes before the next enters.",
    flow: "HookText → TitleCard → SectionCard(s) → StatCard (optional) → CallToAction",
  },
  B: {
    name: "Checklist",
    duration: "30-45s",
    energy:
      "Building momentum. Each checklist item enters with consistent rhythm. Tempo increases toward the end.",
    flow: "HookText → TitleCard → ChecklistOverlay → SectionCard → CallToAction",
  },
  C: {
    name: "Demo / Tutorial",
    duration: "30-60s",
    energy:
      "Instructional and methodical. Clear pacing for each step so viewers can follow along.",
    flow: "HookText → TitleCard → StepIndicator(s) → FrequencyCard → CallToAction",
  },
  D: {
    name: "Myth Buster",
    duration: "15-30s",
    energy:
      "Fast, punchy, dramatic. Shortest format. Every animation hits hard and fast. The myth-to-truth reveal is the centerpiece.",
    flow: "MythTruthReveal(myth) → MythTruthReveal(truth) → SectionCard → CallToAction",
  },
  E: {
    name: "Walkthrough",
    duration: "45-60s",
    energy:
      "Calm, reassuring, informative. Longest format. Guide the viewer through a process step by step.",
    flow: "HookText → TitleCard → StepIndicator(s) → SectionCard(s) → CallToAction",
  },
};

// Duration target ranges (in seconds) per format
const FORMAT_DURATION_RANGE: Record<string, [number, number]> = {
  A: [30, 45],
  B: [30, 45],
  C: [30, 60],
  D: [15, 30],
  E: [45, 60],
};

function buildSystemPrompt(format?: string): string {
  const formatPattern = format
    ? FORMAT_PATTERNS[format.toUpperCase()]
    : undefined;
  const durationRange = format
    ? FORMAT_DURATION_RANGE[format.toUpperCase()]
    : undefined;

  const formatSection = formatPattern
    ? `
## Active Video Format: ${formatPattern.name} (Format ${format?.toUpperCase()})
- Target duration: ${formatPattern.duration}
- Energy: ${formatPattern.energy}
- Recommended component flow: ${formatPattern.flow}
Follow this structure when generating or suggesting components. Adapt it to the specific content, but maintain the general flow.`
    : "";

  const durationTarget = durationRange
    ? `Target total composition duration: ${durationRange[0]}-${durationRange[1]} seconds. If total duration exceeds ${durationRange[1]}s, suggest removing or shortening components instead of adding more.`
    : "Target total composition duration: 30-60 seconds for social media.";

  return `You are a motion graphics composer assistant. You help users create and edit animated motion graphic components for short-form social media videos (9:16 vertical, 1080x1920, 30fps).

${COMPONENT_CATALOG}
${formatSection}

## Theme
All components must include a "theme" property in their props with these exact values:
${JSON.stringify(DEFAULT_THEME, null, 2)}

## Rules
1. Every component needs: id (use format "{type}-{timestamp}" like "chartcard-1708300000000"), componentType, compositionId, durationInSeconds (2-15), props (must include theme), and label (short descriptive text).
2. When the user says "this" or "the selected component", they mean the component at the selectedIndex.
3. Generate realistic, contextually appropriate content based on the video context (title, script, audience, tags).
4. Keep text concise: titles under 40 chars, labels under 30 chars, body text under 80 chars.
5. Do not use emdashes in any text content. Use commas, periods, or restructure instead.
6. ${durationTarget}

## Duration Intelligence
Calculate duration based on text length, not just component type:
- Single-text components (HookText, CTA, TitleCard): max(3, ceil(wordCount / 3)) seconds, cap at 8s
- StatCard: 4s (value + label are always short)
- SectionCard: max(4, ceil(wordCount / 3)) seconds
- ChecklistOverlay: 2s per item + 2s for entrance animation
- ChartCard: 5s minimum, add 1s per bar beyond 4
- StepIndicator: 5s per step
- QuoteCard: max(5, ceil(wordCount / 3)) seconds
- MythTruthReveal: 4-5s (the reveal needs time to land)

## Component Sequencing Rules
- HookText should be the first or second component (it opens the video)
- CallToAction should always be the LAST component
- MythTruthReveal with type "truth" should follow MythTruthReveal with type "myth"
- StepIndicators should be in ascending stepNumber order
- Avoid placing two of the same component type back-to-back (e.g., two StatCards in a row looks repetitive)
- After a StatCard or ChartCard (data), follow with a SectionCard (explanation) for context

## Handling Ambiguous Requests
When the user gives a vague instruction, pick the most contextually appropriate action:
- "Make it more engaging": If composition has no chart and topic has data, add a ChartCard. If no quote, add a QuoteCard. If sections are long, shorten durations for faster pacing. If composition is text-heavy, replace a SectionCard with a more visual component.
- "Simplify this": Reduce component count, shorten text, remove least essential components. Prioritize: Hook, 1-2 key content shots, CTA.
- "Make it longer/shorter": Adjust durations first, then add/remove components if needed.
Always explain your reasoning in the "message" field.

## Response Format
Return a JSON object with:
- "operations": array of operations to apply (add, replace, modify, remove, reorder)
- "message": a brief friendly explanation of what you did and why (1-2 sentences)

## Operation Types
- { "action": "add", "component": { full VibeMotionComponent object } }
- { "action": "replace", "index": number, "component": { full VibeMotionComponent object } }
- { "action": "modify", "index": number, "props": { partial props to merge }, "durationInSeconds": optional number }
- { "action": "remove", "index": number }
- { "action": "reorder", "order": [new index order] }

## Examples

User: "Add a stat about childhood back pain"
Response:
{"operations":[{"action":"add","component":{"id":"statcard-1708300000001","componentType":"StatCard","compositionId":"Shot-StatCard","durationInSeconds":4,"label":"Childhood back pain stat","props":{"value":"1 in 3","label":"children experience back pain before age 15","theme":${JSON.stringify(DEFAULT_THEME)},"durationInSeconds":4}}}],"message":"Added a stat card highlighting how common childhood back pain is."}

User: "Change this to a bar chart" (with selectedIndex: 1)
Response:
{"operations":[{"action":"replace","index":1,"component":{"id":"chartcard-1708300000002","componentType":"ChartCard","compositionId":"Shot-ChartCard","durationInSeconds":5,"label":"Pain frequency chart","props":{"title":"Back Pain by Age","bars":[{"label":"Ages 5-8","value":25},{"label":"Ages 9-12","value":45},{"label":"Ages 13-16","value":72}],"theme":${JSON.stringify(DEFAULT_THEME)},"durationInSeconds":5}}}],"message":"Replaced the selected component with an animated bar chart showing back pain frequency by age group."}

User: "Make the title shorter"
Response:
{"operations":[{"action":"modify","index":0,"props":{"title":"5 Signs to Watch"}}],"message":"Shortened the title to be more concise and punchy."}

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
    const totalDuration = req.components.reduce(
      (sum, c) => sum + c.durationInSeconds,
      0,
    );
    const formatKey = req.videoContext.format?.toUpperCase();
    const durationRange = FORMAT_DURATION_RANGE[formatKey];
    const durationStatus = durationRange
      ? totalDuration > durationRange[1]
        ? ` (OVER TARGET: ${durationRange[0]}-${durationRange[1]}s)`
        : totalDuration < durationRange[0]
          ? ` (UNDER TARGET: ${durationRange[0]}-${durationRange[1]}s)`
          : ` (within target: ${durationRange[0]}-${durationRange[1]}s)`
      : "";

    parts.push(
      `\n## Current Components (${req.components.length} total, ${totalDuration}s${durationStatus})`,
    );
    req.components.forEach((c, i) => {
      const selected = i === req.selectedIndex ? " [SELECTED]" : "";
      parts.push(
        `${i}. ${c.componentType} "${c.label}" (${c.durationInSeconds}s)${selected}`,
      );
      // Strip theme from props display to reduce token usage
      const displayProps = { ...c.props };
      delete displayProps.theme;
      delete displayProps.durationInSeconds;
      parts.push(`   Props: ${JSON.stringify(displayProps, null, 0)}`);
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
      // Build messages array with conversation history for multi-turn context
      const messages: Array<{ role: "user" | "assistant"; content: string }> =
        [];

      // Include recent conversation history (cap at last 10 exchanges)
      if (body.conversationHistory && body.conversationHistory.length > 0) {
        const recentHistory = body.conversationHistory.slice(-20); // 10 exchanges = 20 messages
        for (const msg of recentHistory) {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      // Add current user message with full component state context
      messages.push({
        role: "user",
        content: buildUserMessage(body),
      });

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: buildSystemPrompt(body.videoContext?.format),
        messages,
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

  // ============================================
  // Save composition
  // ============================================

  router.put("/save/:videoCode", async (req, res) => {
    try {
      const { videoCode } = req.params;
      const { components } = req.body as { components: VibeMotionComponent[] };

      if (!Array.isArray(components)) {
        res.status(400).json({ error: "components array required" });
        return;
      }

      db.run(
        sql`INSERT INTO composer_compositions (video_code, components_json, updated_at)
            VALUES (${videoCode}, ${JSON.stringify(components)}, datetime('now'))
            ON CONFLICT(video_code)
            DO UPDATE SET components_json = ${JSON.stringify(components)}, updated_at = datetime('now')`,
      );

      res.json({ ok: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Save failed";
      console.error("[composer-save] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // ============================================
  // Load composition
  // ============================================

  router.get("/load/:videoCode", async (req, res) => {
    try {
      const { videoCode } = req.params;

      const rows = db.all<{ components_json: string; updated_at: string }>(
        sql`SELECT components_json, updated_at FROM composer_compositions WHERE video_code = ${videoCode} LIMIT 1`,
      );

      if (rows.length === 0) {
        res.json({ components: null, updatedAt: null });
        return;
      }

      const row = rows[0];
      res.json({
        components: JSON.parse(row.components_json),
        updatedAt: row.updated_at,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Load failed";
      console.error("[composer-load] Error:", message);
      res.status(500).json({ error: message });
    }
  });

  return router;
}
