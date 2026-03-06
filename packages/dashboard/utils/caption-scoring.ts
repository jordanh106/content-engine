// Caption quality scoring (0-100)
// Evaluates hook strength, CTA presence, readability, hashtag quality, emoji density, length

const PLATFORM_LIMITS: Record<string, { max: number; hookVisible: number }> = {
  instagram_reels: { max: 2200, hookVisible: 125 },
  tiktok: { max: 4000, hookVisible: 100 },
  youtube_shorts: { max: 100, hookVisible: 100 },
  youtube_long: { max: 5000, hookVisible: 200 },
};

const HOOK_PATTERNS = [
  /^(did you know|here'?s (why|how|what)|stop (doing|ignoring)|the (truth|real|#\d)|most people|if you|you'?re|this is why|nobody talks about|what happens when)/i,
  /^\d+ (signs|ways|things|reasons|tips)/i,
  /\?$/, // Ends with question
  /^(myth|fact|truth):/i,
];

const CTA_PATTERNS = [
  /save this/i,
  /follow for/i,
  /tag someone/i,
  /drop a comment/i,
  /share this/i,
  /link in bio/i,
  /book (now|today|a|your)/i,
  /call (us|today|now)/i,
  /comment below/i,
  /let (me|us) know/i,
  /subscribe/i,
  /watch (more|the full)/i,
];

export type ScoreBreakdown = {
  hook: number;
  cta: number;
  readability: number;
  hashtags: number;
  emoji: number;
  length: number;
  total: number;
};

export function scoreCaption(caption: string, platform: string): ScoreBreakdown {
  const lines = caption.split("\n").filter((l) => l.trim());
  const hookLine = lines[0] || "";
  const limits = PLATFORM_LIMITS[platform];

  // Hook strength (0-25)
  let hook = 0;
  const matchesPattern = HOOK_PATTERNS.some((p) => p.test(hookLine));
  if (matchesPattern) hook += 12;
  if (limits && hookLine.length <= limits.hookVisible && hookLine.length > 0) hook += 8;
  else if (hookLine.length > 0) hook += 3;
  // Contains number or question (pattern interrupt)
  if (/\d/.test(hookLine)) hook += 3;
  if (/\?/.test(hookLine)) hook += 2;
  hook = Math.min(hook, 25);

  // CTA presence (0-20)
  let cta = 0;
  const ctaMatches = CTA_PATTERNS.filter((p) => p.test(caption));
  if (ctaMatches.length >= 1) cta += 14;
  if (ctaMatches.length >= 2) cta += 6;
  cta = Math.min(cta, 20);

  // Readability (0-20) - sentence variety and appropriate grade level
  let readability = 0;
  const sentences = caption.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgWords = sentences.reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) / Math.max(sentences.length, 1);
  // Optimal average sentence length is 8-15 words
  if (avgWords >= 5 && avgWords <= 20) readability += 10;
  else if (avgWords >= 3 && avgWords <= 25) readability += 5;
  // Varied sentence lengths
  if (sentences.length >= 2) {
    const lengths = sentences.map((s) => s.trim().split(/\s+/).length);
    const variance = lengths.some((l) => Math.abs(l - avgWords) > 3);
    if (variance) readability += 5;
    else readability += 2;
  }
  // Line breaks for readability
  if (lines.length >= 2) readability += 5;
  readability = Math.min(readability, 20);

  // Hashtag quality (0-15, only for IG/TikTok)
  let hashtags = 0;
  if (platform === "instagram_reels" || platform === "tiktok") {
    const tags = caption.match(/#\w+/g) || [];
    if (tags.length >= 3 && tags.length <= 8) hashtags = 15;
    else if (tags.length >= 1 && tags.length <= 10) hashtags = 8;
    else if (tags.length > 10) hashtags = 3; // Too many
    // No hashtags = 0
  } else {
    // YouTube: hashtags don't matter, give full points
    hashtags = 15;
  }

  // Emoji density (0-10)
  let emoji = 0;
  const emojiCount = (caption.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu) || []).length;
  if (emojiCount >= 1 && emojiCount <= 3) emoji = 10;
  else if (emojiCount >= 4 && emojiCount <= 6) emoji = 6;
  else if (emojiCount > 6) emoji = 2;
  // 0 emojis = 0 points

  // Length appropriateness (0-10)
  let length = 0;
  const charLen = caption.length;
  if (limits) {
    const ratio = charLen / limits.max;
    if (ratio >= 0.15 && ratio <= 0.85) length = 10;
    else if (ratio >= 0.05 && ratio <= 0.95) length = 6;
    else if (ratio > 1) length = 0;
    else length = 3;
  } else {
    length = 5;
  }

  const total = hook + cta + readability + hashtags + emoji + length;

  return { hook, cta, readability, hashtags, emoji, length, total };
}
