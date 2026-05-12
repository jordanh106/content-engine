/**
 * Local carousel renderer.
 *
 * Renders carousel-template HTML files to PNG using Playwright + Chromium.
 * Models the existing pattern in routes/metrics.ts (Instagram screenshot capture).
 *
 * Templates live in `packages/dashboard/server/carousel-templates/`. The base layer
 * is the unprefixed cover.html / content.html / cta.html files. Design variants
 * live in subfolders: editorial/, bold/, minimal/. Variants override individual
 * templates; missing templates fall back to the base layer.
 */
import fs from "fs";
import path from "path";

const TEMPLATES_ROOT = path.join(import.meta.dirname, "..", "carousel-templates");

export type CarouselVariant = "editorial" | "bold" | "minimal";
export type CarouselAspect = "1:1" | "4:5" | "9:16";

type TemplateName = "cover" | "content" | "cta";

export type SlideSpec =
  | { templateName: "cover"; variables: { HOOK_LINE: string; SUBTITLE: string; TOTAL_SLIDES: string } }
  | { templateName: "content"; variables: { POINT_NUMBER: string; POINT_TITLE: string; POINT_BODY: string; SLIDE_INDEX: string; TOTAL_SLIDES: string } }
  | { templateName: "cta"; variables: { CTA_HEADLINE: string; CTA_SUBHEAD: string; CTA_BUTTON_TEXT: string; SLIDE_INDEX: string; TOTAL_SLIDES: string } };

export type RenderedSlide = {
  slideIndex: number;          // 1-based
  filePath: string;            // absolute path to the PNG
  templateName: TemplateName;
};

type ConfigJson = {
  brand: Record<string, string>;
  typography: Record<string, string | number>;
  cover: Record<string, number>;
  content: Record<string, number>;
  cta: Record<string, number>;
  variants?: Record<string, Partial<{
    brand: Record<string, string>;
    cover: Record<string, number>;
    content: Record<string, number>;
    cta: Record<string, number>;
  }>>;
};

const ASPECT_DIMENSIONS: Record<CarouselAspect, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
};

function loadConfig(): ConfigJson {
  const raw = fs.readFileSync(path.join(TEMPLATES_ROOT, "config.json"), "utf-8");
  return JSON.parse(raw) as ConfigJson;
}

function resolveTemplatePath(variant: CarouselVariant, templateName: TemplateName): string {
  const variantPath = path.join(TEMPLATES_ROOT, variant, `${templateName}.html`);
  if (fs.existsSync(variantPath)) return variantPath;
  return path.join(TEMPLATES_ROOT, `${templateName}.html`);
}

function applyVariables(html: string, vars: Record<string, string | number>): string {
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined ? "" : String(v);
  });
}

function commonVariables(config: ConfigJson, variant: CarouselVariant, aspect: CarouselAspect): Record<string, string | number> {
  const dims = ASPECT_DIMENSIONS[aspect];
  const variantOverride = config.variants?.[variant] ?? {};
  const brand = { ...config.brand, ...(variantOverride.brand ?? {}) };
  const cover = { ...config.cover, ...(variantOverride.cover ?? {}) };
  const content = { ...config.content, ...(variantOverride.content ?? {}) };
  const cta = { ...config.cta, ...(variantOverride.cta ?? {}) };

  const widthMin = Math.min(dims.width, dims.height);
  const paddingCover = Math.round((widthMin * cover.paddingPercent) / 100);
  const paddingContent = Math.round((widthMin * content.paddingPercent) / 100);

  return {
    WIDTH: dims.width,
    HEIGHT: dims.height,
    // Brand
    PRIMARY: brand.primary,
    PRIMARY_LIGHT: brand.primaryLight,
    BACKGROUND: brand.background,
    BG_DARK: brand.backgroundDark,
    ACCENT: brand.accent,
    TEXT: brand.text,
    TEXT_LIGHT: brand.textLight,
    MUTED: brand.muted,
    // Cover-specific
    HEADLINE_SIZE: cover.headlineFontSize,
    SUBHEAD_SIZE: cover.subheadFontSize,
    GRADIENT_ANGLE: cover.gradientAngle,
    ACCENT_BAR_HEIGHT: cover.accentBarHeight,
    PADDING: paddingCover,
    // Content-specific (overrides PADDING when content template is used)
    NUMBER_SIZE: content.numberFontSize,
    TITLE_SIZE: content.titleFontSize,
    BODY_SIZE: content.bodyFontSize,
    NUMBER_OPACITY: content.numberOpacity,
    // CTA-specific
    BUTTON_SIZE: cta.buttonFontSize,
    BUTTON_PH: cta.buttonPaddingH,
    BUTTON_PV: cta.buttonPaddingV,
    BUTTON_RADIUS: cta.buttonBorderRadius,
  };
}

/**
 * Renders a complete carousel: array of slide specs → array of PNG file paths.
 * Browser is launched once and reused across slides for speed.
 */
export async function renderCarousel(input: {
  slides: SlideSpec[];
  variant: CarouselVariant;
  aspect: CarouselAspect;
  outDir: string;
  /** Optional filename prefix; defaults to "slide_" */
  prefix?: string;
}): Promise<RenderedSlide[]> {
  const { slides, variant, aspect, outDir } = input;
  const prefix = input.prefix ?? "slide_";
  fs.mkdirSync(outDir, { recursive: true });

  const config = loadConfig();
  const dims = ASPECT_DIMENSIONS[aspect];
  const baseVars = commonVariables(config, variant, aspect);

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: dims, deviceScaleFactor: 1 });
  const results: RenderedSlide[] = [];

  try {
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const templatePath = resolveTemplatePath(variant, slide.templateName);
      const html = fs.readFileSync(templatePath, "utf-8");

      // Content-specific PADDING override (the content template uses a tighter padding)
      const slideVars: Record<string, string | number> = { ...baseVars, ...slide.variables };
      if (slide.templateName === "content") {
        const widthMin = Math.min(dims.width, dims.height);
        slideVars.PADDING = Math.round((widthMin * config.content.paddingPercent) / 100);
      }

      const rendered = applyVariables(html, slideVars);
      const page = await context.newPage();
      try {
        // data URL is the fastest path (no disk write needed). base64 encoding handles unicode safely.
        const dataUrl = `data:text/html;base64,${Buffer.from(rendered, "utf-8").toString("base64")}`;
        await page.goto(dataUrl, { waitUntil: "networkidle", timeout: 15_000 });
        // Wait a beat for web-fonts to settle (Google Fonts @import).
        await page.waitForTimeout(400);

        const slideIndex = i + 1;
        const outPath = path.join(outDir, `${prefix}${slideIndex}.png`);
        await page.screenshot({ path: outPath, type: "png", omitBackground: false, fullPage: false });
        results.push({ slideIndex, filePath: outPath, templateName: slide.templateName });
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  return results;
}

/**
 * Convenience: render a single slide. Exists mostly for ad-hoc / debug use.
 */
export async function renderSlide(input: {
  slide: SlideSpec;
  variant: CarouselVariant;
  aspect: CarouselAspect;
  outDir: string;
  filename: string;
}): Promise<RenderedSlide> {
  const out = await renderCarousel({
    slides: [input.slide],
    variant: input.variant,
    aspect: input.aspect,
    outDir: input.outDir,
    prefix: input.filename.replace(/\.png$/, "") + "_",
  });
  return out[0];
}
