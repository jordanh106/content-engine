# Content Engine

Industry-agnostic content creation toolkit powered by Claude Code skills, reusable video format templates, and Remotion motion graphics.

## What This Is

A single repository that houses everything needed to research, plan, script, and produce short-form educational video content at scale. Built for chiropractic first, but architected to work for any industry.

### The Pipeline

```
Research (/last30days)
    ↓
Plan (/content-planner)
    ↓
Script (/video-director)
    ↓
Produce (Remotion [primary motion graphics] + Cinema Studio [cinematic footage])
    ↓
Distribute (IG Reels, YT Shorts, patient resources)
```

## Motion Graphics Direction

- Primary motion graphics tool: **Remotion** (`packages/remotion-studio/`)
- Vibe Motion: optional fallback for one-off experiments only
- Standard workflow: Remotion graphics + Cinema Studio footage + CapCut assembly

## Quick Start

### 1. Clone and install skills

```bash
git clone https://github.com/jordanh106/content-engine.git
cd content-engine
bash scripts/install-skills.sh
```

### 2. Set up API keys (optional, for /last30days)

```bash
mkdir -p ~/.config/last30days
cat > ~/.config/last30days/.env << 'EOF'
OPENAI_API_KEY=your-key-here
XAI_API_KEY=your-key-here
EOF
```

### 3. Install Remotion dependencies

```bash
npm install
```

### 4. Preview Remotion compositions

```bash
npm run preview
```

## Architecture

```
content-engine/
├── skills/                 Claude Code skills (6 skills)
│   ├── last30days/         Research trending topics
│   ├── remotion-best-practices/  Remotion domain knowledge
│   ├── brand-factory/      Brand application with presets
│   ├── theme-factory/      11 styling themes
│   ├── content-planner/    Research → content calendar
│   └── video-director/     Calendar → production plan
│
├── formats/                5 reusable video templates
│   ├── explainer.md        "What Is [X]?"
│   ├── checklist.md        "Signs Your [X] Needs [Y]"
│   ├── demo.md             "The Exercise/Tutorial"
│   ├── myth-buster.md      "Myth vs. Truth"
│   └── walkthrough.md      "What Happens During [X]"
│
├── workflows/              Production process docs
├── industries/             Pluggable content packs
│   ├── _template/          Blank industry scaffold
│   └── chiropractic/       First industry (57 videos)
│
└── packages/
    └── remotion-studio/    Programmatic motion graphics
```

## Adding a New Industry

```bash
bash scripts/new-industry.sh dental
```

Then customize the config, brand, and content library for your industry.

## Skills

All skills are Claude Code skills that get symlinked to `~/.claude/skills/`. See [skills/INSTALL.md](skills/INSTALL.md) for details.

| Skill | What It Does |
|-------|-------------|
| `/last30days [topic]` | Research Reddit + X + Web for trending topics |
| `/content-planner` | Turn research into a weekly content calendar |
| `/video-director` | Turn a calendar entry into a full production plan |

## Remotion

The `packages/remotion-studio/` project renders motion graphics (title cards, stat cards, checklists, myth/truth reveals) from structured data. Each of the 5 video formats has a matching Remotion composition.

```bash
npm run preview    # Open in browser
npm run render     # Render to .mp4
```

## License

MIT
