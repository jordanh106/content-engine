# Poppy AI Parity + Surpass Plan

Research date: 2026-06-10. Sources: getpoppy.ai, feedback.getpoppy.ai/changelog, skillscouter.com review, AppSumo listing, G2.

## Part 1 — What Poppy AI actually is (June 2026 state)

**Founder + growth story.** Built by Rafeh Qazi (Clever Programmer). Bootstrapped, no free trial, 30-day money-back. Grew through creator-first GTM: Qazi's existing audience plus testimonial-led marketing ("5.7M impressions on LinkedIn," "$75k deal closed"). Positioned as "the first and only multiplayer AI" — Figma-style boards where teams and AI work together.

**Pricing.** ~$27–33/mo annual, ~$90/mo monthly, VIP ~$799/yr, Lifetime $997. Credit system (1,000–2,000+/mo).

**The core magic moment.** Paste a YouTube/TikTok/IG link onto an infinite whiteboard → thumbnail and metadata populate instantly → video is auto-transcribed → you chat with the AI about that source (or several at once). The board holds persistent context (brand docs, frameworks, past scripts) so nothing gets re-prompted.

**Full media support:** YouTube/TikTok/IG Reels/Shorts/MP4, voice notes/podcasts/MP3, PDFs/Word/PPT, images, websites, Loom, tweets. 200k-token cap per connection.

**Models:** ChatGPT, Claude, Gemini, Grok, GPT Image, Nanobanana — switchable mid-conversation.

**Changelog (newest first) — their shipping velocity:**
| Date | Feature |
|------|---------|
| May 7, 2026 | **@-References** — type @ in chat, select connected sources directly |
| Mar 26, 2026 | Document preview (PDFs visualized on boards) |
| Mar 22, 2026 | **Outlier content detection** — rolling-average scoring across IG/TikTok/YT |
| Mar 15, 2026 | Team collaboration chat inside boards |
| Feb 7, 2026 | **Channel research** — paste a full creator channel, analyze title frameworks |
| Jan 25, 2026 | Nanobanana Pro thumbnail/image generation |
| Dec 2025 | Dark mode |
| Nov 2025 | Loom support; Twitter/X post analysis |

**Known weaknesses (user complaints):** steep monthly price, credit caps for heavy users, board-setup learning curve, mind maps buggy, visual layer adds friction for prompt-fluent users, no production pipeline (it's a thinking tool — output is text you copy elsewhere).

## Part 2 — Honest gap analysis vs Content Engine

### Where Poppy beats us today

| Poppy capability | Our current state | Gap severity |
|---|---|---|
| Paste any link → thumbnail + metadata auto-populate anywhere | Only in Discover Feed (`discover.ts:189` add-url); IG thumbnails flaky (login-wall placeholders); Canvas paste creates a bare "source" node with no fetch | **HIGH** — this is the magic moment |
| Auto-transcription on ingest | Whisper only fires on manual deep-breakdown (`creator-videos.ts:1166`) | **HIGH** |
| Persistent AI chat wired to sources (@-references) | None. All AI is fire-and-forget POST endpoints | **HIGH** — the other half of the magic |
| PDFs / docs on board | Zero PDF support anywhere | MEDIUM |
| Voice notes (record + transcribe) | Zero audio capability | MEDIUM |
| Websites as sources (fetched + extracted) | URL stored as dead text on a source node | MEDIUM |
| Multi-model switching | Claude only — but `OPENAI_API_KEY` + `GEMINI_API_KEY` already sit in `.env` unused by chat | LOW effort, real value |
| Multiple named boards, DB-persisted | One canvas, localStorage only (`ce-canvas-state-v1`) | MEDIUM |
| Real-time multiplayer | Polling only | **SKIP** — see below |

### Where we already match or beat Poppy

| Capability | Ours | Poppy |
|---|---|---|
| Outlier detection | `outlierScoreX100` shipped in Discover Feed months before their Mar 2026 ship | Mar 2026 |
| Image/thumbnail generation | Higgsfield nano_banana_2 + gpt_image wired with per-role model selection | Jan 2026 (Nanobanana) |
| Channel research | `/creator-analysis` skill with 16 creator profiles on disk | Feb 2026 |
| **Production pipeline** | Carousel renderer, storytelling reels, caption studio, Remotion, ffmpeg export | **None — they stop at text** |
| **Goal-locked idea ranking** | 6-axis composite with goalAlignment | None |
| **Automation** | Weekly Studio n8n chain, audience-pulse cron, Telegram alerts | None (integrations are passive) |
| **Brand voice system** | Living voice doc, auto-refreshed weekly, applied in every prompt | Static board context |
| Cost | API cost only (~cents/use) | $33–90/mo + credit caps |

### The strategic read

Poppy is a **thinking tool**; ours is a **production engine**. Their moat is the frictionless capture-and-chat loop; our moat is everything that happens after an idea exists. The play is NOT to clone Poppy — it's to steal the capture-and-chat loop and bolt it onto our production spine. A creator using Poppy still has to leave it to make anything. A creator using ours never leaves.

**Deliberately skipped: multiplayer real-time sync.** Poppy's headline feature is built for teams. We have a 2-person team (Jordan + Ashley) on one machine + phone. Liveblocks/Yjs integration is weeks of work for near-zero value here. Polling stays. Revisit only if the team grows.

## Part 3 — Implementation plan (4 phases)

### Phase 1 — Universal media ingestion ("paste anything, it just works")

The single highest-leverage build. One service, used everywhere.

**New: `server/lib/media-ingest.ts`**
- `ingestUrl(url)` → classifies (YouTube / TikTok / IG / tweet / Loom / generic website) → fetches oEmbed metadata + thumbnail (reuse + extend `thumbnail-resolver.ts`) → returns a normalized `MediaAsset`
- `ingestFile(file)` → PDF (text extraction via `pdf-parse`), audio (Whisper), image (stored + optionally vision-described), MP4 (frame extraction + Whisper, reusing the deep-breakdown pipeline at `creator-videos.ts:1098–1185`)
- Generic website: fetch → readability extraction → store text content

**New: `media_assets` SQLite table** — `id, kind (video|audio|pdf|image|website|tweet), source_url, title, author, thumbnail_path, transcript, text_content, metadata_json, token_count, created_at`. This is the universal source store every surface reads.

**New: background transcript queue** — on video ingest, fire a non-blocking job: try native captions first (yt-dlp, free — same pattern as the `/watch` skill), Whisper fallback. Status field on the asset (`pending → ready → failed`). Poppy transcribes everything on ingest; so do we, but captions-first keeps cost near zero.

**Fix: Instagram thumbnails** — route through Xpoz CDN URLs at ingest time (the bulk-thumbnails pattern already noted in `thumbnail-resolver.ts:72`) instead of the broken oEmbed path.

### Phase 2 — Board chat with @-references (the other half of the magic)

**New: `BoardChat` panel on CanvasView** — collapsible right-side chat. Type `@` → autocomplete of every node/asset on the current board. Selected references inject that asset's transcript/text/metadata into context (200k-token budget, matching Poppy's per-connection cap; truncate oldest-first with a visible indicator).

**New: `server/routes/board-chat.ts`** — streaming chat endpoint (SSE). Context assembly: brand voice (existing `getCurrentBrandVoice()`) + goal-lock + selected asset contents + chat history. Chat history persisted per board in a `board_messages` table.

**Multi-model router** — model picker in the chat header: Claude (default), GPT (OPENAI_API_KEY), Gemini (GEMINI_API_KEY). All three keys already exist in `.env`; this is a thin adapter layer, not new infrastructure.

**Our unfair advantage, wired in from day one:** a "→ Develop" button on any chat response that pushes it into the Inspiration Inbox (audience-tagged via the existing persona matcher) or straight into a Project brief. Poppy's chat output is a dead end you copy-paste out of; ours feeds the pipeline.

### Phase 3 — Boards (multiple, persistent, media-first)

- **`boards` table** — replace the single localStorage canvas with named boards in SQLite (`id, name, nodes_json, edges_json, updated_at`). Keep localStorage as a write-through cache for snappiness.
- **Media nodes** — new ReactFlow node type rendering a `media_asset`: thumbnail, title, transcript-status badge, token count. Paste a URL onto the canvas → media node appears with live thumbnail (Phase 1 service). Drag a PDF/MP3/image onto the canvas → uploaded + ingested + node appears.
- **Board switcher** in the Canvas header + board templates seeded from the existing Quick-Start templates.
- Existing node types (creator, video, idea, script, b-roll) stay — they're the production-graph layer Poppy doesn't have.

### Phase 4 — Surpass features (what Poppy can't follow)

1. **Chat → production handoff** (started in Phase 2): board chat can invoke the carousel orchestrator / storytelling reel / caption studio directly. "Make this a carousel" inside chat ships a real rendered artifact.
2. **Channel research in-dashboard** — paste a channel URL → runs the `/creator-analysis` flow server-side → results land as a creator node + insight nodes on the board. (Their Feb 2026 feature, but ours writes into the IdeaRanker's signal pool.)
3. **Outlier surfacing on boards** — drop a creator node → their outlier videos (existing `outlierScoreX100`) fan out as video nodes, rolling-average scored like Poppy's Mar 2026 ship.
4. **Goal-aware chat** — every board chat silently carries goal-lock.md. Ask "what should I make this week?" and the answer is filtered through the Q3 prenatal goal. Poppy has no concept of a business goal.

## Part 4 — Execution order + estimates

| Phase | Scope | Est. sessions | Depends on |
|---|---|---|---|
| 1. Universal ingestion | media-ingest lib + media_assets table + transcript queue + IG thumbnail fix | 2–3 | none |
| 2. Board chat + @-refs + multi-model | chat panel + SSE route + model router + Develop handoff | 2–3 | Phase 1 |
| 3. Persistent boards + media nodes | boards table + media node type + paste/drag-drop UX | 2 | Phase 1 |
| 4. Surpass features | chat→production, channel research, outlier fan-out | 2 | Phases 1–3 |

**Costs:** captions-first transcription keeps per-video cost ≈ $0 (Whisper fallback ~$0.006/min). Chat at Claude Haiku/Sonnet rates. No new subscriptions. Compare: Poppy at $33–90/mo with credit caps.

**Verification per phase:** Phase 1 — paste 5 URL types + drop PDF/MP3/image, all populate thumbnails + transcripts. Phase 2 — @-reference two videos, ask comparative question, get grounded answer; Develop button creates tagged inbox item. Phase 3 — two boards persist across restart, media nodes survive reload. Phase 4 — "make this a carousel" in chat produces rendered slides in project outputs.

## Decisions log

- **Skip multiplayer** (2-person team, near-zero ROI) — revisit if team grows
- **Skip Notion/Slack/Gmail integrations** (n8n + Telegram already cover notify/automate)
- **Skip mind maps** (theirs is buggy; our node graph already does this better)
- **Captions-first transcription** (cost control vs Poppy's all-Whisper approach)
- **200k token context cap** matched deliberately so "chat with 10 hours of video" parity claims hold
