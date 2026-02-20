import type { ParsedVideo } from "../../shared/types.js";
import { DEFAULT_THEME } from "../../shared/theme-defaults.js";

// ============================================
// Types
// ============================================

export type VibeMotionComponent = {
  id: string;
  componentType: string;
  compositionId: string;
  durationInSeconds: number;
  props: Record<string, unknown>;
  label: string;
};


// Component name to composition ID mapping
const COMP_MAP: Record<string, string> = {
  TitleCard: "Shot-TitleCard",
  StatCard: "Shot-StatCard",
  SectionCard: "Shot-SectionCard",
  HookText: "Shot-HookText",
  ChecklistOverlay: "Shot-Checklist",
  MythTruthReveal: "Shot-MythTruth",
  StepIndicator: "Shot-StepIndicator",
  FrequencyCard: "Shot-FrequencyCard",
  CallToAction: "Shot-CTA",
  ChartCard: "Shot-ChartCard",
  QuoteCard: "Shot-QuoteCard",
};

const COMPONENT_NAMES = Object.keys(COMP_MAP);

// Regex to split on component references like "TitleCard:" or "StatCard:"
const COMPONENT_SPLIT_RE = new RegExp(
  `(${COMPONENT_NAMES.join("|")}):`,
  "g",
);

// ============================================
// Text extraction helpers
// ============================================

function extractQuoted(text: string): string[] {
  const matches: string[] = [];
  const re = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    matches.push(m[1]);
  }
  return matches;
}

function extractHoldDuration(text: string): number | null {
  const m = text.match(/Hold\s+(\d+)s/i);
  return m ? parseInt(m[1], 10) : null;
}

function extractItems(text: string): string[] {
  // Match parenthesized lists like ("item1", "item2", "item3")
  const listMatch = text.match(/\(([^)]+)\)/);
  if (listMatch) {
    const items = extractQuoted(listMatch[1]);
    if (items.length > 0) return items;
  }
  // Fall back to all quoted strings
  return extractQuoted(text);
}

function extractSteps(text: string): { label: string; description: string }[] {
  // Match parenthesized list for step labels
  const listMatch = text.match(/\(([^)]+)\)/);
  if (listMatch) {
    const labels = extractQuoted(listMatch[1]);
    if (labels.length > 0) {
      return labels.map((label) => ({
        label,
        description: label,
      }));
    }
  }
  return [];
}

// ============================================
// Component parsers
// ============================================

function parseTitleCard(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent {
  const quoted = extractQuoted(text);
  const title = quoted[0] || video.title;
  const subtitle = quoted[1] || undefined;
  const duration = extractHoldDuration(text) || 3;

  return {
    id: `titlecard-${index}`,
    componentType: "TitleCard",
    compositionId: "Shot-TitleCard",
    durationInSeconds: duration,
    props: {
      title,
      subtitle,
      durationInSeconds: duration,
      theme: DEFAULT_THEME,
    },
    label: title.length > 40 ? `${title.slice(0, 37)}...` : title,
  };
}

function parseStatCard(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent {
  const quoted = extractQuoted(text);
  const value = quoted[0] || "Key Stat";
  const label = quoted[1] || video.title;
  const duration = extractHoldDuration(text) || 3;

  return {
    id: `statcard-${index}`,
    componentType: "StatCard",
    compositionId: "Shot-StatCard",
    durationInSeconds: duration,
    props: {
      value,
      label,
      durationInSeconds: duration,
      theme: DEFAULT_THEME,
    },
    label: value.length > 40 ? `${value.slice(0, 37)}...` : value,
  };
}

function parseSectionCard(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent {
  const quoted = extractQuoted(text);
  const label = quoted[0] || "Key Point";
  const bodyText = quoted[1] || video.title;
  const duration = extractHoldDuration(text) || 3;

  return {
    id: `sectioncard-${index}`,
    componentType: "SectionCard",
    compositionId: "Shot-SectionCard",
    durationInSeconds: duration,
    props: {
      label,
      text: bodyText,
      durationInSeconds: duration,
      theme: DEFAULT_THEME,
    },
    label: label.length > 40 ? `${label.slice(0, 37)}...` : label,
  };
}

function parseHookText(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent {
  const quoted = extractQuoted(text);
  const hookText = quoted[0] || video.title;
  const duration = extractHoldDuration(text) || 3;

  return {
    id: `hooktext-${index}`,
    componentType: "HookText",
    compositionId: "Shot-HookText",
    durationInSeconds: duration,
    props: {
      text: hookText,
      durationInSeconds: duration,
      theme: DEFAULT_THEME,
    },
    label: hookText.length > 40 ? `${hookText.slice(0, 37)}...` : hookText,
  };
}

function parseChecklist(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent {
  const items = extractItems(text);
  const duration = extractHoldDuration(text) || Math.max(4, items.length * 2);

  const checklistItems = items.map((item, i) => ({
    number: i + 1,
    label: item,
    description: item,
  }));

  // Ensure we have at least 1 item
  if (checklistItems.length === 0) {
    checklistItems.push({ number: 1, label: "Key point", description: "Key point" });
  }

  // Cap at 7 items (schema max)
  const capped = checklistItems.slice(0, 7);

  return {
    id: `checklist-${index}`,
    componentType: "ChecklistOverlay",
    compositionId: "Shot-Checklist",
    durationInSeconds: duration,
    props: {
      items: capped,
      durationInSeconds: duration,
      theme: DEFAULT_THEME,
    },
    label: `${capped.length} items`,
  };
}

function parseMythTruth(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent[] {
  const components: VibeMotionComponent[] = [];

  // Extract myth text
  const mythMatch = text.match(
    /[""]([^""]+)[""]\s*slides?\s*in/i,
  );
  const mythQuoted = extractQuoted(text);

  // Check for MYTH section
  const hasMythSection = /MYTH/i.test(text);
  const hasTruthSection = /TRUTH/i.test(text);

  if (hasMythSection) {
    // Split on "TRUTH" to get myth vs truth parts
    const parts = text.split(/[""]?TRUTH[""]?/i);
    const mythPart = parts[0] || "";
    const truthPart = parts[1] || "";

    const mythTexts = extractQuoted(mythPart);
    const truthTexts = extractQuoted(truthPart);

    // Get the text content (skip "MYTH" if it's in quotes)
    const mythText =
      mythTexts.find((t) => t !== "MYTH" && t.length > 3) || mythQuoted[0] || "Common myth";
    const truthText =
      truthTexts.find((t) => t !== "TRUTH" && t.length > 3) ||
      mythQuoted.find((t, i) => i > 0 && t !== "TRUTH" && t.length > 3) ||
      "The truth";

    components.push({
      id: `myth-${index}`,
      componentType: "MythTruthReveal",
      compositionId: "Shot-MythTruth",
      durationInSeconds: 3,
      props: {
        text: mythText,
        type: "myth",
        durationInSeconds: 3,
        theme: DEFAULT_THEME,
      },
      label: `Myth: ${mythText.length > 30 ? `${mythText.slice(0, 27)}...` : mythText}`,
    });

    components.push({
      id: `truth-${index}`,
      componentType: "MythTruthReveal",
      compositionId: "Shot-MythTruth",
      durationInSeconds: 3,
      props: {
        text: truthText,
        type: "truth",
        durationInSeconds: 3,
        theme: DEFAULT_THEME,
      },
      label: `Truth: ${truthText.length > 30 ? `${truthText.slice(0, 27)}...` : truthText}`,
    });
  } else {
    // Single myth or truth
    const mythText = mythQuoted[0] || "Statement";
    const type = hasTruthSection ? "truth" : "myth";
    components.push({
      id: `mythtruth-${index}`,
      componentType: "MythTruthReveal",
      compositionId: "Shot-MythTruth",
      durationInSeconds: 3,
      props: {
        text: mythText,
        type,
        durationInSeconds: 3,
        theme: DEFAULT_THEME,
      },
      label: `${type === "myth" ? "Myth" : "Truth"}: ${mythText.length > 30 ? `${mythText.slice(0, 27)}...` : mythText}`,
    });
  }

  return components;
}

function parseStepIndicator(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent[] {
  const steps = extractSteps(text);
  const holdDuration = extractHoldDuration(text) || 4;

  if (steps.length === 0) {
    return [
      {
        id: `step-${index}-1`,
        componentType: "StepIndicator",
        compositionId: "Shot-StepIndicator",
        durationInSeconds: holdDuration,
        props: {
          stepNumber: 1,
          totalSteps: 1,
          label: "Step 1",
          description: video.title,
          durationInSeconds: holdDuration,
          theme: DEFAULT_THEME,
        },
        label: "Step 1",
      },
    ];
  }

  return steps.map((step, i) => ({
    id: `step-${index}-${i + 1}`,
    componentType: "StepIndicator",
    compositionId: "Shot-StepIndicator",
    durationInSeconds: holdDuration,
    props: {
      stepNumber: i + 1,
      totalSteps: steps.length,
      label: step.label,
      description: step.description,
      durationInSeconds: holdDuration,
      theme: DEFAULT_THEME,
    },
    label: `Step ${i + 1}: ${step.label.length > 25 ? `${step.label.slice(0, 22)}...` : step.label}`,
  }));
}

function parseFrequencyCard(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent {
  const quoted = extractQuoted(text);
  const frequency = quoted[0] || "Daily";
  const keyCue = quoted[1] || "Key recommendation";
  const duration = extractHoldDuration(text) || 3;

  return {
    id: `frequency-${index}`,
    componentType: "FrequencyCard",
    compositionId: "Shot-FrequencyCard",
    durationInSeconds: duration,
    props: {
      frequency,
      keyCue,
      durationInSeconds: duration,
      theme: DEFAULT_THEME,
    },
    label: frequency.length > 40 ? `${frequency.slice(0, 37)}...` : frequency,
  };
}

function parseCallToAction(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent {
  const quoted = extractQuoted(text);
  const ctaText = quoted[0] || `Save this and share it`;
  const duration = extractHoldDuration(text) || 3;

  return {
    id: `cta-${index}`,
    componentType: "CallToAction",
    compositionId: "Shot-CTA",
    durationInSeconds: duration,
    props: {
      text: ctaText,
      durationInSeconds: duration,
      theme: DEFAULT_THEME,
    },
    label: ctaText.length > 40 ? `${ctaText.slice(0, 37)}...` : ctaText,
  };
}

function parseChartCard(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent {
  const quoted = extractQuoted(text);
  const title = quoted[0] || video.title;
  const duration = extractHoldDuration(text) || 5;

  // Try to extract bar data from quoted strings after the title
  const barLabels = quoted.slice(1);
  const bars =
    barLabels.length > 0
      ? barLabels.map((label, i) => ({ label, value: (i + 1) * 20, color: undefined }))
      : [
          { label: "Before", value: 30, color: undefined },
          { label: "After", value: 75, color: undefined },
        ];

  return {
    id: `chart-${index}`,
    componentType: "ChartCard",
    compositionId: "Shot-ChartCard",
    durationInSeconds: duration,
    props: {
      title,
      bars,
      durationInSeconds: duration,
      theme: DEFAULT_THEME,
    },
    label: title.length > 40 ? `${title.slice(0, 37)}...` : title,
  };
}

function parseQuoteCard(
  text: string,
  video: ParsedVideo,
  index: number,
): VibeMotionComponent {
  const quoted = extractQuoted(text);
  const quote = quoted[0] || "Patient testimonial";
  const attribution = quoted[1] || "Patient";
  const role = quoted[2] || undefined;
  const duration = extractHoldDuration(text) || 5;

  return {
    id: `quote-${index}`,
    componentType: "QuoteCard",
    compositionId: "Shot-QuoteCard",
    durationInSeconds: duration,
    props: {
      quote,
      attribution,
      role,
      durationInSeconds: duration,
      theme: DEFAULT_THEME,
    },
    label: quote.length > 40 ? `${quote.slice(0, 37)}...` : quote,
  };
}

// ============================================
// Main parser
// ============================================

export function parseVibeMotion(
  vibeMotionText: string,
  video: ParsedVideo,
): VibeMotionComponent[] {
  if (!vibeMotionText || vibeMotionText.trim().length === 0) {
    return buildDefaultComponents(video);
  }

  const components: VibeMotionComponent[] = [];

  // Split the text into segments by component name
  // Strategy: find all component references and their following text
  const segments: { type: string; text: string }[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(`(${COMPONENT_NAMES.join("|")}):`, "g");

  while ((match = re.exec(vibeMotionText)) !== null) {
    if (segments.length > 0) {
      // Close the previous segment's text
      segments[segments.length - 1].text = vibeMotionText.slice(
        lastIndex,
        match.index,
      );
    }
    segments.push({ type: match[1], text: "" });
    lastIndex = match.index + match[0].length;
  }

  // Close the last segment
  if (segments.length > 0) {
    segments[segments.length - 1].text = vibeMotionText.slice(lastIndex);
  }

  if (segments.length === 0) {
    return buildDefaultComponents(video);
  }

  // Parse each segment
  let componentIndex = 0;
  for (const seg of segments) {
    componentIndex++;

    switch (seg.type) {
      case "TitleCard":
        components.push(parseTitleCard(seg.text, video, componentIndex));
        break;
      case "StatCard":
        components.push(parseStatCard(seg.text, video, componentIndex));
        break;
      case "SectionCard":
        components.push(parseSectionCard(seg.text, video, componentIndex));
        break;
      case "HookText":
        components.push(parseHookText(seg.text, video, componentIndex));
        break;
      case "ChecklistOverlay":
        components.push(parseChecklist(seg.text, video, componentIndex));
        break;
      case "MythTruthReveal":
        components.push(...parseMythTruth(seg.text, video, componentIndex));
        break;
      case "StepIndicator":
        components.push(...parseStepIndicator(seg.text, video, componentIndex));
        break;
      case "FrequencyCard":
        components.push(parseFrequencyCard(seg.text, video, componentIndex));
        break;
      case "CallToAction":
        components.push(parseCallToAction(seg.text, video, componentIndex));
        break;
      case "ChartCard":
        components.push(parseChartCard(seg.text, video, componentIndex));
        break;
      case "QuoteCard":
        components.push(parseQuoteCard(seg.text, video, componentIndex));
        break;
    }
  }

  return components;
}

// ============================================
// Default components by format
// ============================================

function buildDefaultComponents(video: ParsedVideo): VibeMotionComponent[] {
  const components: VibeMotionComponent[] = [];
  const scriptLines = video.script
    .split("\n")
    .map((l) => l.replace(/\[[^\]]+\]/g, "").trim())
    .filter((l) => l.length > 0);

  // Always add a title card
  components.push({
    id: "titlecard-default",
    componentType: "TitleCard",
    compositionId: "Shot-TitleCard",
    durationInSeconds: 3,
    props: {
      title: video.title,
      durationInSeconds: 3,
      theme: DEFAULT_THEME,
    },
    label: video.title.length > 40 ? `${video.title.slice(0, 37)}...` : video.title,
  });

  // Format-specific defaults
  switch (video.format) {
    case "A": // Explainer
      if (scriptLines[1]) {
        components.push({
          id: "section-default",
          componentType: "SectionCard",
          compositionId: "Shot-SectionCard",
          durationInSeconds: 3,
          props: {
            label: "Key Point",
            text: scriptLines[1].slice(0, 60),
            durationInSeconds: 3,
            theme: DEFAULT_THEME,
          },
          label: scriptLines[1].slice(0, 40),
        });
      }
      break;

    case "B": // Checklist
      if (scriptLines.length > 1) {
        const items = scriptLines.slice(1, 5).map((line, i) => ({
          number: i + 1,
          label: line.slice(0, 40),
          description: line.slice(0, 40),
        }));
        components.push({
          id: "checklist-default",
          componentType: "ChecklistOverlay",
          compositionId: "Shot-Checklist",
          durationInSeconds: Math.max(4, items.length * 2),
          props: {
            items,
            durationInSeconds: Math.max(4, items.length * 2),
            theme: DEFAULT_THEME,
          },
          label: `${items.length} items`,
        });
      }
      break;

    case "D": // Myth Buster
      components.push({
        id: "myth-default",
        componentType: "MythTruthReveal",
        compositionId: "Shot-MythTruth",
        durationInSeconds: 3,
        props: {
          text: scriptLines[0]?.slice(0, 50) || "Common myth",
          type: "myth",
          durationInSeconds: 3,
          theme: DEFAULT_THEME,
        },
        label: "Myth",
      });
      components.push({
        id: "truth-default",
        componentType: "MythTruthReveal",
        compositionId: "Shot-MythTruth",
        durationInSeconds: 3,
        props: {
          text: scriptLines[1]?.slice(0, 50) || "The truth",
          type: "truth",
          durationInSeconds: 3,
          theme: DEFAULT_THEME,
        },
        label: "Truth",
      });
      break;

    case "C": // Demo
    case "E": // Walkthrough
      if (video.shots.length > 0) {
        const totalSteps = Math.min(video.shots.length, 4);
        video.shots.slice(0, totalSteps).forEach((shot, i) => {
          components.push({
            id: `step-default-${i + 1}`,
            componentType: "StepIndicator",
            compositionId: "Shot-StepIndicator",
            durationInSeconds: 4,
            props: {
              stepNumber: i + 1,
              totalSteps,
              label: `Step ${i + 1}`,
              description: shot.prompt.slice(0, 50),
              durationInSeconds: 4,
              theme: DEFAULT_THEME,
            },
            label: `Step ${i + 1}`,
          });
        });
      }
      break;
  }

  // Always add a CTA
  components.push({
    id: "cta-default",
    componentType: "CallToAction",
    compositionId: "Shot-CTA",
    durationInSeconds: 3,
    props: {
      text: `Save this and share it with someone in ${video.audienceLabel}.`,
      durationInSeconds: 3,
      theme: DEFAULT_THEME,
    },
    label: "Call to Action",
  });

  return components;
}
