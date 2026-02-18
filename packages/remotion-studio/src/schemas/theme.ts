import { z } from "zod";
import { zColor } from "@remotion/zod-types";

export const ThemeSchema = z.object({
  primaryColor: zColor(),
  accentColor: zColor(),
  darkBackground: zColor(),
  lightBackground: zColor(),
  textColor: zColor(),
  headingFont: z.string(),
  bodyFont: z.string(),
});

export type Theme = z.infer<typeof ThemeSchema>;

export const defaultTheme: Theme = {
  primaryColor: "#0d9488",
  accentColor: "#faf5ef",
  darkBackground: "#1a1a2e",
  lightBackground: "#faf5ef",
  textColor: "#ffffff",
  headingFont: "Georgia",
  bodyFont: "Nunito Sans",
};
