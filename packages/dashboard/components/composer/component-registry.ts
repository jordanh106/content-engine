import React from "react";
import { DEFAULT_THEME } from "../../shared/theme-defaults.js";

// ============================================
// Field definitions for the prop editor
// ============================================

export type FieldType = "text" | "textarea" | "number" | "select" | "color" | "array";

export type FieldDefinition = {
  name: string;
  label: string;
  type: FieldType;
  options?: string[];        // for "select" type
  arrayFields?: FieldDefinition[]; // for "array" type (defines fields per item)
  min?: number;
  max?: number;
  optional?: boolean;
};

// ============================================
// Registry entry
// ============================================

export type ComponentRegistryEntry = {
  type: string;
  label: string;
  description: string;
  compositionId: string;
  component: React.LazyExoticComponent<React.ComponentType<any>>;
  defaultProps: Record<string, unknown>;
  fields: FieldDefinition[];
};


// ============================================
// Lazy component imports from remotion-studio
// ============================================

const TitleCard = React.lazy(() =>
  import("@remotion-studio/components/TitleCard").then((m) => ({ default: m.TitleCard })),
);
const StatCard = React.lazy(() =>
  import("@remotion-studio/components/StatCard").then((m) => ({ default: m.StatCard })),
);
const SectionCard = React.lazy(() =>
  import("@remotion-studio/components/SectionCard").then((m) => ({ default: m.SectionCard })),
);
const HookText = React.lazy(() =>
  import("@remotion-studio/components/HookText").then((m) => ({ default: m.HookText })),
);
const ChecklistOverlay = React.lazy(() =>
  import("@remotion-studio/components/ChecklistOverlay").then((m) => ({
    default: m.ChecklistOverlay,
  })),
);
const MythTruthReveal = React.lazy(() =>
  import("@remotion-studio/components/MythTruthReveal").then((m) => ({
    default: m.MythTruthReveal,
  })),
);
const StepIndicator = React.lazy(() =>
  import("@remotion-studio/components/StepIndicator").then((m) => ({
    default: m.StepIndicator,
  })),
);
const FrequencyCard = React.lazy(() =>
  import("@remotion-studio/components/FrequencyCard").then((m) => ({
    default: m.FrequencyCard,
  })),
);
const CallToAction = React.lazy(() =>
  import("@remotion-studio/components/CallToAction").then((m) => ({
    default: m.CallToAction,
  })),
);
const ChartCard = React.lazy(() =>
  import("@remotion-studio/components/ChartCard").then((m) => ({ default: m.ChartCard })),
);
const QuoteCard = React.lazy(() =>
  import("@remotion-studio/components/QuoteCard").then((m) => ({ default: m.QuoteCard })),
);
const KineticText = React.lazy(() =>
  import("@remotion-studio/components/KineticText").then((m) => ({ default: m.KineticText })),
);

// ============================================
// Registry
// ============================================

export const COMPONENT_REGISTRY: Record<string, ComponentRegistryEntry> = {
  TitleCard: {
    type: "TitleCard",
    label: "Title Card",
    description: "Bold title with optional subtitle",
    compositionId: "Shot-TitleCard",
    component: TitleCard,
    defaultProps: {
      title: "Your Title Here",
      subtitle: "",
      durationInSeconds: 3,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "title", label: "Title", type: "text" },
      { name: "subtitle", label: "Subtitle", type: "text", optional: true },
    ],
  },

  StatCard: {
    type: "StatCard",
    label: "Stat Card",
    description: "Large number or value with label",
    compositionId: "Shot-StatCard",
    component: StatCard,
    defaultProps: {
      value: "60 lbs",
      label: "of extra pressure on your spine",
      durationInSeconds: 4,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "value", label: "Value", type: "text" },
      { name: "label", label: "Label", type: "text" },
    ],
  },

  SectionCard: {
    type: "SectionCard",
    label: "Section Card",
    description: "Label and body text with accent bar",
    compositionId: "Shot-SectionCard",
    component: SectionCard,
    defaultProps: {
      label: "KEY POINT",
      text: "Your explanation or insight goes here",
      durationInSeconds: 4,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "label", label: "Section Label", type: "text" },
      { name: "text", label: "Body Text", type: "textarea" },
    ],
  },

  HookText: {
    type: "HookText",
    label: "Hook Text",
    description: "Attention-grabbing opening text",
    compositionId: "Shot-HookText",
    component: HookText,
    defaultProps: {
      text: "That neck pain you feel after scrolling? It has a name.",
      durationInSeconds: 3,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "text", label: "Hook Text", type: "textarea" },
    ],
  },

  ChecklistOverlay: {
    type: "ChecklistOverlay",
    label: "Checklist",
    description: "Numbered checklist items with checkmarks",
    compositionId: "Shot-Checklist",
    component: ChecklistOverlay,
    defaultProps: {
      items: [
        { number: 1, label: "First item", description: "Description here" },
        { number: 2, label: "Second item", description: "Description here" },
        { number: 3, label: "Third item", description: "Description here" },
      ],
      durationInSeconds: 6,
      theme: DEFAULT_THEME,
    },
    fields: [
      {
        name: "items",
        label: "Checklist Items",
        type: "array",
        arrayFields: [
          { name: "number", label: "#", type: "number", min: 1, max: 7 },
          { name: "label", label: "Label", type: "text" },
          { name: "description", label: "Description", type: "text" },
        ],
      },
    ],
  },

  MythTruthReveal: {
    type: "MythTruthReveal",
    label: "Myth/Truth",
    description: "Dramatic myth or truth stamp reveal",
    compositionId: "Shot-MythTruth",
    component: MythTruthReveal,
    defaultProps: {
      text: "Cracking your knuckles causes arthritis.",
      type: "myth",
      durationInSeconds: 4,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "text", label: "Statement", type: "textarea" },
      { name: "type", label: "Type", type: "select", options: ["myth", "truth"] },
    ],
  },

  StepIndicator: {
    type: "StepIndicator",
    label: "Step Indicator",
    description: "Numbered step with progress dots",
    compositionId: "Shot-StepIndicator",
    component: StepIndicator,
    defaultProps: {
      stepNumber: 1,
      totalSteps: 3,
      label: "Step Label",
      description: "Step description goes here.",
      durationInSeconds: 5,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "stepNumber", label: "Step #", type: "number", min: 1, max: 10 },
      { name: "totalSteps", label: "Total Steps", type: "number", min: 1, max: 10 },
      { name: "label", label: "Label", type: "text" },
      { name: "description", label: "Description", type: "textarea" },
    ],
  },

  FrequencyCard: {
    type: "FrequencyCard",
    label: "Frequency Card",
    description: "Frequency and key cue display",
    compositionId: "Shot-FrequencyCard",
    component: FrequencyCard,
    defaultProps: {
      frequency: "3 sets of 10, twice daily",
      keyCue: "Keep your eyes level throughout the movement.",
      durationInSeconds: 4,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "frequency", label: "Frequency", type: "text" },
      { name: "keyCue", label: "Key Cue", type: "textarea" },
    ],
  },

  CallToAction: {
    type: "CallToAction",
    label: "Call to Action",
    description: "Closing CTA with glow effect",
    compositionId: "Shot-CTA",
    component: CallToAction,
    defaultProps: {
      text: "Save this and share it with someone who needs it.",
      durationInSeconds: 3,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "text", label: "CTA Text", type: "textarea" },
    ],
  },

  ChartCard: {
    type: "ChartCard",
    label: "Chart",
    description: "Animated bar chart for data visualization",
    compositionId: "Shot-ChartCard",
    component: ChartCard,
    defaultProps: {
      title: "Chart Title",
      bars: [
        { label: "A", value: 40 },
        { label: "B", value: 70 },
        { label: "C", value: 55 },
      ],
      durationInSeconds: 5,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "title", label: "Chart Title", type: "text", optional: true },
      {
        name: "bars",
        label: "Bars",
        type: "array",
        arrayFields: [
          { name: "label", label: "Label", type: "text" },
          { name: "value", label: "Value", type: "number", min: 0, max: 1000 },
        ],
      },
    ],
  },

  QuoteCard: {
    type: "QuoteCard",
    label: "Quote",
    description: "Testimonial or quote with attribution",
    compositionId: "Shot-QuoteCard",
    component: QuoteCard,
    defaultProps: {
      quote: "This changed everything for me.",
      attribution: "Patient Name",
      role: "",
      durationInSeconds: 5,
      theme: DEFAULT_THEME,
    },
    fields: [
      { name: "quote", label: "Quote", type: "textarea" },
      { name: "attribution", label: "Attribution", type: "text" },
      { name: "role", label: "Role/Title", type: "text", optional: true },
    ],
  },
  KineticText: {
    type: "KineticText",
    label: "Kinetic Text",
    description: "Word-by-word animated text reveal with staggered springs",
    compositionId: "Shot-KineticText",
    component: KineticText,
    defaultProps: {
      words: [
        { text: "Your", delay: 0 },
        { text: "spine", delay: 5, scale: 1.3, color: "#0d9488" },
        { text: "controls", delay: 10 },
        { text: "everything.", delay: 15, scale: 1.2 },
      ],
      durationInSeconds: 4,
      theme: DEFAULT_THEME,
    },
    fields: [
      {
        name: "words",
        label: "Words",
        type: "array",
        arrayFields: [
          { name: "text", label: "Word", type: "text" },
          { name: "delay", label: "Delay (frames)", type: "number", min: 0, max: 90 },
          { name: "scale", label: "Scale", type: "number", min: 0.5, max: 3, optional: true },
          { name: "color", label: "Color", type: "color", optional: true },
        ],
      },
    ],
  },
};

export const COMPONENT_TYPES = Object.keys(COMPONENT_REGISTRY);
