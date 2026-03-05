import fs from "fs";
import { Router } from "express";
import path from "path";
import { parseWatchlist, invalidateWatchlistCache } from "../parsers/watchlist.js";
import { parseCreatorInsights } from "../parsers/creator-insights.js";
import type { WatchlistCreator } from "../../shared/types.js";

const KNOWN_SECTIONS = [
  "Local Competitors",
  "Chiro Content Leaders",
  "Prenatal & Pediatric Chiro",
  "Health & Wellness Crossover",
];

function appendCreatorToFile(
  filePath: string,
  creator: WatchlistCreator,
  section?: string,
): boolean {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  let insertIndex = -1;

  if (section) {
    let inSection = false;
    for (let i = 0; i < lines.length; i++) {
      const headerMatch = lines[i].match(/^##\s+(.+)/);
      if (headerMatch) {
        if (headerMatch[1].trim().toLowerCase() === section.toLowerCase()) {
          inSection = true;
          continue;
        } else if (inSection) {
          // Hit next section, walk back past empty lines
          insertIndex = i - 1;
          while (insertIndex > 0 && lines[insertIndex].trim() === "") insertIndex--;
          insertIndex++;
          break;
        }
      }
      if (inSection && lines[i].startsWith("|") && lines[i].includes("@")) {
        insertIndex = i + 1;
      }
    }
    // Last section in file
    if (inSection && insertIndex === -1) {
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith("|") && lines[i].includes("@")) {
          insertIndex = i + 1;
          break;
        }
      }
    }
  }

  // Fallback: last table row with @ in entire file
  if (insertIndex === -1) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lines[i].startsWith("|") && lines[i].includes("@")) {
        insertIndex = i + 1;
        break;
      }
    }
  }

  if (insertIndex === -1) return false;

  const row = `| ${creator.handle} | ${creator.platform} | ${creator.followers || ""} | ${creator.whyTracking || ""} | ${creator.contentStyle || ""} | ${creator.frequency || ""} | ${creator.lastAnalyzed || "-"} |`;
  lines.splice(insertIndex, 0, row);
  fs.writeFileSync(filePath, lines.join("\n"));
  return true;
}

function updateCreatorInFile(
  filePath: string,
  handle: string,
  updates: Partial<WatchlistCreator>,
): boolean {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const normalizedHandle = handle.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("|") || lines[i].includes("---")) continue;

    const cells = lines[i]
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cells.length >= 2 && cells[0].toLowerCase() === normalizedHandle) {
      const updated = [
        updates.handle ?? cells[0],
        updates.platform ?? cells[1] ?? "",
        updates.followers ?? cells[2] ?? "",
        updates.whyTracking ?? cells[3] ?? "",
        updates.contentStyle ?? cells[4] ?? "",
        updates.frequency ?? cells[5] ?? "",
        updates.lastAnalyzed ?? cells[6] ?? "",
      ];
      lines[i] = `| ${updated.join(" | ")} |`;
      fs.writeFileSync(filePath, lines.join("\n"));
      return true;
    }
  }

  return false;
}

function deleteCreatorFromFile(filePath: string, handle: string): boolean {
  if (!fs.existsSync(filePath)) return false;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const normalizedHandle = handle.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("|") || lines[i].includes("---")) continue;

    const cells = lines[i]
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (cells.length >= 2 && cells[0].toLowerCase() === normalizedHandle) {
      lines.splice(i, 1);
      fs.writeFileSync(filePath, lines.join("\n"));
      return true;
    }
  }

  return false;
}

export { updateCreatorInFile };

export function createWatchlistRouter(contentLibraryPath: string) {
  const router = Router();
  const industryDir = path.dirname(contentLibraryPath);
  const watchlistPath = path.join(industryDir, "watchlist.md");
  const creatorInsightsDir = path.join(industryDir, "creator-insights");

  // GET /api/watchlist - list all tracked creators with insight availability
  router.get("/", (_req, res) => {
    const creators = parseWatchlist(watchlistPath);
    const insights = parseCreatorInsights(creatorInsightsDir);

    const enriched = creators.map((c) => ({
      ...c,
      hasInsight: insights.has(c.handle.replace("@", "").toLowerCase()),
    }));

    res.json({ creators: enriched, total: enriched.length, sections: KNOWN_SECTIONS });
  });

  // GET /api/watchlist/:handle/insights - Get creator analysis if available
  router.get("/:handle/insights", (req, res) => {
    const handle = req.params.handle.replace("@", "").toLowerCase();
    const insights = parseCreatorInsights(creatorInsightsDir);
    const insight = insights.get(handle);

    if (insight) {
      res.json({ available: true, handle, insight });
    } else {
      res.json({ available: false, handle, insight: null });
    }
  });

  // POST /api/watchlist - add a creator
  router.post("/", (req, res) => {
    const body = req.body as WatchlistCreator & { section?: string };
    if (!body.handle || !body.platform) {
      res.status(400).json({ error: "handle and platform are required" });
      return;
    }

    const handle = body.handle.startsWith("@") ? body.handle : `@${body.handle}`;
    const creator: WatchlistCreator = {
      handle,
      platform: body.platform,
      followers: body.followers || "",
      whyTracking: body.whyTracking || "",
      contentStyle: body.contentStyle || "",
      frequency: body.frequency || "",
      lastAnalyzed: body.lastAnalyzed || "-",
    };

    const success = appendCreatorToFile(watchlistPath, creator, body.section);
    if (!success) {
      res.status(500).json({ error: "Failed to add creator to watchlist" });
      return;
    }
    invalidateWatchlistCache();
    res.status(201).json({ added: true, handle });
  });

  // PUT /api/watchlist/:handle - update a creator
  router.put("/:handle", (req, res) => {
    const handle = req.params.handle.startsWith("@")
      ? req.params.handle
      : `@${req.params.handle}`;
    const updates = req.body as Partial<WatchlistCreator>;

    const success = updateCreatorInFile(watchlistPath, handle, updates);
    if (!success) {
      res.status(404).json({ error: "Creator not found" });
      return;
    }
    invalidateWatchlistCache();
    res.json({ updated: true, handle });
  });

  // DELETE /api/watchlist/:handle - remove a creator
  router.delete("/:handle", (req, res) => {
    const handle = req.params.handle.startsWith("@")
      ? req.params.handle
      : `@${req.params.handle}`;

    const success = deleteCreatorFromFile(watchlistPath, handle);
    if (!success) {
      res.status(404).json({ error: "Creator not found" });
      return;
    }
    invalidateWatchlistCache();
    res.json({ deleted: true, handle });
  });

  return router;
}
