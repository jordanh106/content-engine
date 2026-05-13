/**
 * Persona parser for audiences.md.
 *
 * Parses the structured audience persona document and extracts the keyword sets the
 * IdeaRanker uses for audience-fit scoring. The keywords come from three subsections
 * per audience: "what they search for", "what they DM or ask in person", "what they're
 * worried about". These are the most consequential audience signals because they're
 * literal queries / questions in the audience's own voice.
 */
import fs from "fs";

export type Persona = {
  id: string;            // matches config.json audience id
  label: string;         // human-readable
  keywords: Set<string>; // lowercased keyword set for audience-fit scoring
  rawSearchTerms: string[];
  rawWorries: string[];
  rawDmQuestions: string[];
};

const ID_MATCH = /\((?<id>[a-z_]+)\)/;
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would", "should",
  "could", "may", "might", "must", "shall", "to", "of", "in", "on", "at", "by",
  "for", "with", "as", "into", "from", "about", "what", "where", "when", "why",
  "how", "near", "me", "my", "your", "their", "his", "her", "its", "our", "you",
  "we", "they", "i", "this", "that", "these", "those", "it", "its", "im", "ive",
  "youre", "youve", "dont", "wont", "cant", "isnt", "doesnt", "didnt", "wasnt",
  "werent", "havent", "hasnt", "hadnt", "shouldnt", "wouldnt", "couldnt", "etc",
  "very", "also", "just", "only", "really", "even", "still", "way", "ways",
  "thing", "things", "stuff", "lot", "lots", "more", "most", "less", "least",
  "one", "two", "three", "first", "second", "third",
]);

let cache: Persona[] | null = null;
let cacheTimestamp = 0;

export function invalidatePersonaCache(): void {
  cache = null;
  cacheTimestamp = 0;
}

export function parsePersonas(audiencesPath: string): Persona[] {
  if (!fs.existsSync(audiencesPath)) return [];
  const stat = fs.statSync(audiencesPath);
  if (cache && stat.mtimeMs <= cacheTimestamp) return cache;

  const content = fs.readFileSync(audiencesPath, "utf-8");
  const lines = content.split("\n");
  const personas: Persona[] = [];

  let current: {
    id: string;
    label: string;
    rawSearchTerms: string[];
    rawWorries: string[];
    rawDmQuestions: string[];
  } | null = null;
  let subsection: "search" | "worry" | "dm" | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Heading 2 = new audience. We expect the form: "## Label (id) · video codes X-Y"
    const h2 = line.match(/^##\s+(.+?)(?:\s+·\s+video codes.*)?$/);
    if (h2) {
      flush();
      const idMatch = h2[1].match(ID_MATCH);
      if (idMatch?.groups?.id) {
        current = {
          id: idMatch.groups.id,
          label: h2[1].replace(/\s*\([a-z_]+\)\s*/, "").trim(),
          rawSearchTerms: [],
          rawWorries: [],
          rawDmQuestions: [],
        };
      } else {
        current = null;
      }
      subsection = null;
      continue;
    }

    if (!current) continue;

    // Heading 3 = subsection. Use the subsection name to decide what to collect.
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      const heading = h3[1].toLowerCase();
      if (heading.includes("search for")) subsection = "search";
      else if (heading.includes("worried about") || heading.includes("they fear")) subsection = "worry";
      else if (heading.includes("dm or ask") || heading.includes("ask in person")) subsection = "dm";
      else subsection = null;
      continue;
    }

    // Bullet list entry under the current subsection.
    const bullet = line.match(/^-\s+(.+)$/);
    if (bullet && subsection) {
      const raw = bullet[1].trim().replace(/^["'`]|["'`]$/g, "");
      if (subsection === "search") current.rawSearchTerms.push(raw);
      else if (subsection === "worry") current.rawWorries.push(raw);
      else if (subsection === "dm") current.rawDmQuestions.push(raw);
    }
  }
  flush();

  cache = personas;
  cacheTimestamp = stat.mtimeMs;
  return personas;

  function flush(): void {
    if (!current) return;
    const keywords = new Set<string>();
    const allText = [...current.rawSearchTerms, ...current.rawWorries, ...current.rawDmQuestions].join(" ").toLowerCase();
    for (const w of allText.split(/[^a-z0-9]+/)) {
      if (w.length < 3) continue;
      if (STOP_WORDS.has(w)) continue;
      keywords.add(w);
    }
    personas.push({
      id: current.id,
      label: current.label,
      keywords,
      rawSearchTerms: current.rawSearchTerms,
      rawWorries: current.rawWorries,
      rawDmQuestions: current.rawDmQuestions,
    });
    current = null;
  }
}

/**
 * Score an idea's text against each persona's keyword set. Returns sorted matches
 * with normalized scores (0-100). Use the top 1-2 as the audience tags when an idea
 * lacks an explicit assignment.
 */
export function scoreIdeaAgainstPersonas(text: string, personas: Persona[]): Array<{ id: string; label: string; score: number }> {
  const tokens = new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP_WORDS.has(w)));
  const matches: Array<{ id: string; label: string; score: number }> = [];

  for (const p of personas) {
    if (p.keywords.size === 0) continue;
    let overlap = 0;
    for (const t of tokens) if (p.keywords.has(t)) overlap += 1;
    if (overlap === 0) continue;
    // Normalize: cap at 20 hits = 100. Most ideas will land in the 10-50 range.
    const score = Math.min(100, Math.round((overlap / 20) * 100));
    matches.push({ id: p.id, label: p.label, score });
  }
  matches.sort((a, b) => b.score - a.score);
  return matches;
}
