import { z } from "zod";
import { zColor } from "@remotion/zod-types";

export const ThemeSchema = z.object({
  // Core colors
  primaryColor: zColor(),
  accentColor: zColor(),
  darkBackground: zColor(),
  lightBackground: zColor(),
  textColor: zColor(),
  headingFont: z.string(),
  bodyFont: z.string(),
  // Visual richness (all optional, backward-compatible)
  primaryGradientEnd: zColor().optional(),
  accentGradientEnd: zColor().optional(),
  glowColor: zColor().optional(),
  surfaceColor: z.string().optional(),
  borderColor: z.string().optional(),
  noiseOpacity: z.number().min(0).max(1).optional(),
  glassBlur: z.number().min(0).max(40).optional(),
  glassOpacity: z.number().min(0).max(1).optional(),
});

export type Theme = z.infer<typeof ThemeSchema>;

/** Resolve optional visual richness fields to concrete values */
export function resolveTheme(theme: Theme) {
  return {
    ...theme,
    primaryGradientEnd: theme.primaryGradientEnd ?? theme.primaryColor,
    accentGradientEnd: theme.accentGradientEnd ?? theme.accentColor,
    glowColor: theme.glowColor ?? theme.primaryColor,
    surfaceColor: theme.surfaceColor ?? "rgba(255, 255, 255, 0.06)",
    borderColor: theme.borderColor ?? "rgba(255, 255, 255, 0.08)",
    noiseOpacity: theme.noiseOpacity ?? 0.03,
    glassBlur: theme.glassBlur ?? 20,
    glassOpacity: theme.glassOpacity ?? 0.08,
  };
}

export type ResolvedTheme = ReturnType<typeof resolveTheme>;

export const defaultTheme: Theme = {
  primaryColor: "#0d9488",
  accentColor: "#faf5ef",
  darkBackground: "#1a1a2e",
  lightBackground: "#faf5ef",
  textColor: "#ffffff",
  headingFont: "Georgia",
  bodyFont: "Nunito Sans",
  primaryGradientEnd: "#065f46",
  accentGradientEnd: "#e7ddd0",
  glowColor: "#0d9488",
  surfaceColor: "rgba(255, 255, 255, 0.06)",
  borderColor: "rgba(255, 255, 255, 0.08)",
  noiseOpacity: 0.03,
  glassBlur: 20,
  glassOpacity: 0.08,
};
