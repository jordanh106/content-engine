import { Router } from "express";
import path from "path";
import { parseIdeaBank } from "../parsers/idea-bank.js";
import type { IdeaCategory } from "../../shared/types.js";

export function createIdeasRouter(contentLibraryPath: string) {
  const router = Router();
  const ideaBankPath = path.join(path.dirname(contentLibraryPath), "idea-bank.md");

  // GET /api/ideas - list all ideas with optional category filter
  router.get("/", (_req, res) => {
    const { category } = _req.query;
    let ideas = parseIdeaBank(ideaBankPath);

    if (category && typeof category === "string") {
      ideas = ideas.filter((i) => i.category === (category as IdeaCategory));
    }

    res.json({ ideas, total: ideas.length });
  });

  // GET /api/ideas/summary - category counts
  router.get("/summary", (_req, res) => {
    const ideas = parseIdeaBank(ideaBankPath);
    const counts: Record<string, number> = {};
    for (const idea of ideas) {
      counts[idea.category] = (counts[idea.category] || 0) + 1;
    }
    res.json({ counts, total: ideas.length });
  });

  return router;
}
