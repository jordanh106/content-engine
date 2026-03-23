# Carousel Content Strategy

Rules and ranked patterns for generating carousel slide text. The n8n Code node reads this file when building slide content. The autoresearch loop optimizes these rules based on real engagement metrics (composite score: save_rate*0.4 + share_rate*0.3 + engagement*0.2 + ctr*0.1).

---

## Hook Patterns for Carousels (Ranked by Performance)

Carousel hooks differ from video hooks. They must work as static text without audio/visual support. Ranked by predicted save rate:

1. **Listicle Promise** - "X things your [professional] wants you to know about [topic]"
   - Best for: Instagram square, LinkedIn
   - Why it works: Sets clear expectation of value density, high save rate because viewers bookmark lists
2. **Myth Opener** - "Stop believing this about [topic]"
   - Best for: Instagram portrait, TikTok
   - Why it works: Pattern interrupt in a scroll feed, drives comment debate
3. **Stat Anchor** - "[Startling number]% of [group] get this wrong"
   - Best for: LinkedIn, Instagram square
   - Why it works: Numbers stop the scroll, credibility-first framing
4. **Regret Frame** - "I wish I knew this about [topic] sooner"
   - Best for: Instagram portrait
   - Why it works: Vulnerability drives shares, "show this to someone who needs it"
5. **Quick Win** - "Fix your [problem] in [short time]"
   - Best for: TikTok, Instagram square
   - Why it works: Actionable promise, high save rate for "try later" intent
6. **Contrarian Challenge** - "[Common advice] is making your [condition] worse"
   - Best for: TikTok, Instagram
   - Why it works: Triggers protective instinct, high comment and share rates

---

## Slide Copy Rules

### Length Targets by Platform

| Platform | Cover Hook | Content Slide Title | Content Slide Body | CTA Text |
|----------|-----------|--------------------|--------------------|----------|
| Instagram (square) | 8-12 words | 4-7 words | 15-25 words | 5-8 words |
| Instagram (portrait) | 10-15 words | 5-8 words | 20-35 words | 5-8 words |
| LinkedIn | 10-15 words | 5-10 words | 25-40 words | 8-12 words |
| TikTok | 6-10 words | 3-6 words | 12-20 words | 4-6 words |
| YouTube Thumbnail | 4-8 words (headline only) | N/A | N/A | N/A |

### Slide Count by Platform

| Platform | Recommended Slides | Min | Max |
|----------|-------------------|-----|-----|
| Instagram (square) | 7 | 5 | 10 |
| Instagram (portrait) | 7 | 5 | 10 |
| LinkedIn | 6 | 4 | 8 |
| TikTok | 5 | 3 | 7 |
| YouTube Thumbnail | 1 | 1 | 1 |

### Formatting Rules

- No emojis on cover slides. Clean, bold, authoritative.
- Content slides: max 1 emoji per slide, placed before the point title. Use sparingly.
- CTA slides: zero emojis. Professional and direct.
- Never use ALL CAPS for full sentences. ALL CAPS acceptable only for single emphasis words (e.g., "STOP stretching your lower back").
- Sentence fragments preferred over full sentences on content slides. Punchier = higher engagement.

---

## CTA Wording (Ranked by Conversion)

1. **Save-first CTA** - "Save this for your next [relevant moment]"
   - Drives saves directly, highest composite score impact
2. **Share-trigger CTA** - "Share with someone who needs to hear this"
   - Drives shares, second highest composite score impact
3. **Follow CTA** - "Follow for more [topic] tips"
   - Lower immediate engagement but builds audience
4. **Action CTA** - "Book your first visit" / "Try this today"
   - Direct conversion, platform-dependent effectiveness
5. **Comment CTA** - "Which one surprised you? Comment below"
   - Drives comments, good for algorithmic boost but lower composite score weight

### CTA Selection Rules

- Instagram: Alternate between save-first (60%) and share-trigger (30%), action CTA (10%)
- LinkedIn: Share-trigger (50%), save-first (30%), follow (20%)
- TikTok: Share-trigger (40%), follow (30%), comment (30%)
- YouTube Thumbnail: No CTA (single image)

---

## Content Structure by Topic Type

### Educational Topics (Format A, C)
Structure: Hook > Problem context > 3-5 actionable points > CTA
- Lead with the problem the audience feels
- Each point should be independently valuable (someone screenshotting one slide should still get value)
- End content slides with the most surprising or counterintuitive point

### Myth-Busting Topics (Format D)
Structure: Hook > Myth statement > Truth reveal > 2-3 supporting facts > CTA
- Cover slide states the myth boldly
- Second slide reveals the truth with a single powerful sentence
- Supporting slides provide evidence, not just claims
- Shorter carousels (4-6 slides) perform better for myth content

### Story/Testimonial Topics (Format G)
Structure: Hook > Before state > Turning point > After state > Lesson > CTA
- Use second person when possible ("You might recognize this...")
- Specific details increase credibility ("6 months of daily headaches" not "chronic headaches")
- End with universal takeaway, not just the individual story

### Quick Tips (Format F)
Structure: Hook > Tip 1 > Tip 2 > Tip 3 > CTA
- Maximum 3-4 tips per carousel
- Each tip must be immediately actionable without equipment or appointments
- Use "Do this, not that" framing when possible

---

## Audience-Specific Adjustments

### Young Adults (18-35)
- Shorter copy, punchier language
- Reference desk work, phone posture, gym injuries
- More contrarian/myth-busting hooks
- TikTok-first content structure

### Parents (30-50)
- Slightly longer explanations acceptable
- Reference kids, carrying, sleep disruption
- More story/testimonial hooks
- Instagram-first content structure

### Active/Athletes
- Technical language acceptable
- Reference performance, recovery, mobility
- More quick-tip and educational hooks
- Focus on "did you know" patterns

### Seniors (55+)
- Clearer, larger-feeling text (templates handle sizing)
- Reference mobility, independence, daily activities
- More statistic and educational hooks
- LinkedIn and Instagram square preferred

---

## Visual-Content Alignment Rules

- If the hook mentions a number, the content slides MUST deliver that exact number of points
- If the hook is a question, the first content slide MUST begin answering it (no preamble slides)
- If the hook is contrarian, at least one content slide MUST cite evidence (stat, study, mechanism)
- The CTA must connect to the hook theme. Don't end an educational carousel with a hard sales CTA.
- Subtitle on cover slide should preview the value: "5 things most people miss" not "Read on to learn more"
