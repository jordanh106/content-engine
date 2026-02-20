/**
 * Default theme used across the dashboard.
 * Single source of truth - previously duplicated in 4 files.
 * Matches the collectiveFamily preset from remotion-studio.
 */
export const DEFAULT_THEME = {
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
} as const;
