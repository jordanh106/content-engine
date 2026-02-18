# Installing Skills

Skills in this repo are designed to be symlinked into `~/.claude/skills/` so Claude Code can discover them automatically.

## Quick Install

From the repo root:

```bash
bash scripts/install-skills.sh
```

This will:
1. Scan `skills/` for directories containing a `SKILL.md`
2. Create symlinks in `~/.claude/skills/` pointing back to this repo
3. Back up any existing skill directories that would be overwritten

## Uninstall

```bash
bash scripts/uninstall-skills.sh
```

This removes only symlinks that point to this repo. It will not delete any skill directories that existed before installation, and will restore backups if they exist.

## Skills Included

| Skill | Description |
|-------|-------------|
| `last30days` | Research trending topics on Reddit, X, and Web from the last 30 days |
| `remotion-best-practices` | Domain knowledge for Remotion video creation in React |
| `brand-factory` | Industry-agnostic brand application with pluggable presets |
| `theme-factory` | 11 pre-set styling themes for artifacts |
| `content-planner` | Research-to-calendar workflow orchestration |
| `video-director` | Calendar entry to full video production plan |

## Dependencies

### last30days
- Python 3.11+
- API keys in `~/.config/last30days/.env`:
  - `OPENAI_API_KEY` (for Reddit research)
  - `XAI_API_KEY` (for X/Twitter research)
  - Both optional; falls back to WebSearch-only mode

### remotion-best-practices
- No dependencies (reference documentation only)
- For rendering: Node.js 18+ and the Remotion project in `packages/remotion-studio/`

### All other skills
- No dependencies (Claude Code skills with markdown instructions only)
