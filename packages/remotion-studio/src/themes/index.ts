import type { Theme } from "../schemas/theme";

export const collectiveFamily: Theme = {
  primaryColor: "#0d9488",
  accentColor: "#faf5ef",
  darkBackground: "#1a1a2e",
  lightBackground: "#faf5ef",
  textColor: "#ffffff",
  headingFont: "Georgia",
  bodyFont: "Nunito Sans",
};

export const presets: Record<string, Theme> = {
  "collective-family": collectiveFamily,
};
