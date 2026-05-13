#!/usr/bin/env python3
"""
refresh-voice.py — distill the Living Brand Voice from the last 4 weeks of
published scripts + top-performing captions.

Output: industries/chiropractic/brand-voice/voice-{YYYY-MM-DD}.md

Reads:
- industries/chiropractic/brand.md (constitution — must not be contradicted)
- packages/dashboard/data/dashboard.db (script_versions, video_status, performance_metrics)
- industries/chiropractic/content-library.md (script bodies for the same window)
- Previous voice-*.md (diff anchor)

Env:
- ANTHROPIC_API_KEY (auto-loaded from packages/dashboard/.env if not in shell env)

Usage:
  python3 refresh-voice.py
"""
import json
import os
import sqlite3
import sys
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
INDUSTRY = "chiropractic"
INDUSTRY_DIR = REPO_ROOT / "industries" / INDUSTRY
BRAND_MD = INDUSTRY_DIR / "brand.md"
VOICE_DIR = INDUSTRY_DIR / "brand-voice"
CONTENT_LIB = INDUSTRY_DIR / "content-library.md"
DB_PATH = REPO_ROOT / "packages" / "dashboard" / "data" / "dashboard.db"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


load_env_file(REPO_ROOT / "packages" / "dashboard" / ".env")
load_env_file(REPO_ROOT / ".env")


def read_constitution() -> str:
    if not BRAND_MD.exists():
        return ""
    return BRAND_MD.read_text(encoding="utf-8")


def read_previous_voice() -> tuple[str, str]:
    """Return (newest_voice_filename, content) or ('', '') if none."""
    if not VOICE_DIR.exists():
        return "", ""
    dated = sorted([f for f in VOICE_DIR.iterdir()
                    if f.is_file() and f.name.startswith("voice-")
                    and f.suffix == ".md"
                    and f.stem[6:].replace("-", "").isdigit()])
    if dated:
        newest = dated[-1]
    else:
        # Fall back to INITIAL or any voice-*.md
        any_voice = sorted([f for f in VOICE_DIR.iterdir()
                            if f.is_file() and f.name.startswith("voice-") and f.suffix == ".md"])
        if not any_voice:
            return "", ""
        newest = any_voice[-1]
    return newest.name, newest.read_text(encoding="utf-8")


def read_top_performers() -> list[dict]:
    """Return rows from performance_metrics, top decile by saves+shares*2+likes*0.2."""
    if not DB_PATH.exists():
        print("  [warn] dashboard.db not found — performance feedback will be empty", file=sys.stderr)
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cutoff = (datetime.utcnow() - timedelta(days=28)).strftime("%Y-%m-%d")
    try:
        rows = cur.execute(
            """
            SELECT
              video_code,
              SUM(saves) AS saves,
              SUM(shares) AS shares,
              SUM(likes) AS likes,
              SUM(views) AS views,
              MAX(hook_pattern_used) AS hook_pattern,
              MAX(format_id) AS format_id
            FROM performance_metrics
            WHERE recorded_at >= ?
            GROUP BY video_code
            ORDER BY (COALESCE(SUM(saves),0) + COALESCE(SUM(shares),0) * 2 + COALESCE(SUM(likes),0) * 0.2) DESC
            LIMIT 8
            """,
            (cutoff,),
        ).fetchall()
        return [dict(r) for r in rows]
    except sqlite3.OperationalError as e:
        print(f"  [warn] performance_metrics query failed: {e}", file=sys.stderr)
        return []
    finally:
        conn.close()


def read_recent_scripts(video_codes: list[str]) -> dict[str, str]:
    """Pull the latest script_versions text for each video code."""
    if not DB_PATH.exists() or not video_codes:
        return {}
    out: dict[str, str] = {}
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    try:
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='script_versions'")
        if not cur.fetchone():
            return out
        for code in video_codes:
            row = cur.execute(
                "SELECT script FROM script_versions WHERE video_code = ? ORDER BY version DESC LIMIT 1",
                (code,),
            ).fetchone()
            if row and row["script"]:
                out[code] = row["script"][:1500]
    finally:
        conn.close()
    return out


def call_haiku_distill(constitution: str, prev_voice: str, performers: list[dict], scripts: dict[str, str]) -> str | None:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("  [error] ANTHROPIC_API_KEY not set — cannot distill voice", file=sys.stderr)
        return None

    today = datetime.utcnow().strftime("%Y-%m-%d")

    performer_lines = []
    for p in performers:
        code = p.get("video_code", "")
        script = scripts.get(code, "")
        performer_lines.append(
            f"\n--- {code} (saves={p.get('saves',0)} shares={p.get('shares',0)} likes={p.get('likes',0)} format={p.get('format_id') or '?'} hook={p.get('hook_pattern') or '?'}) ---\n"
            f"{script[:1000] if script else '(script not in db)'}"
        )

    prompt = f"""You are distilling and updating a brand voice profile for a content creator. Today is {today}.

CONSTITUTION (the brand voice must NEVER contradict this):
{constitution[:3000]}

PREVIOUS VOICE PROFILE (from the most recent voice-*.md — use this as the diff anchor):
{prev_voice[:2500] if prev_voice else "(no prior voice profile — this is the first refresh)"}

PUBLISHED WORK THAT PERFORMED IN TOP DECILE (last 4 weeks):
{"".join(performer_lines) if performer_lines else "(no performance data in the last 4 weeks — base updates on the constitution + prior voice only)"}

Produce an updated voice profile in EXACTLY this markdown structure. No preamble, no code fence, just the markdown:

# Brand Voice — {today}

## Style block (the prompt-ready 5-bullet guide)
[5 bullets, evolved from the prior voice based on what's performing. Stay aligned to the constitution. Avoid emdashes. Each bullet starts with "- ".]

## Signature phrases (recurring in top performers)
[Up to 6 bullets. Quote exact phrases or sentence patterns from the performers' scripts that recur. Format: "- \\"phrase here\\" — appears N times". If no clear recurrence, write "*(no clear signature phrases detected this week)*"]

## Tone descriptors (3-5 adjectives, ranked)
[Numbered list 1-5. Most dominant first. Use a single adjective per line, no descriptions.]

## What changed from last week
[Bullet list. Examples: "Added: ...", "Dropped: ...", "Shifted: ...". If this is the first refresh, write "*(initial refresh — no diff to surface)*"]

## Constitution alignment check
[Brief check — does this voice still align with brand.md? Any tension? Format as bullets: "- Aligns with [rule]: ✓" or "- Tension: [description]"]"""

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1800,
            "messages": [{"role": "user", "content": prompt}],
        }).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            for block in data.get("content", []):
                if block.get("type") == "text":
                    return block.get("text", "").strip()
    except Exception as e:
        print(f"  [error] Haiku distillation failed: {e}", file=sys.stderr)
        return None
    return None


def main() -> int:
    print(f"→ Refreshing Brand Voice for {INDUSTRY}")

    constitution = read_constitution()
    if not constitution:
        print(f"  [error] {BRAND_MD} not found — cannot refresh without a constitution", file=sys.stderr)
        return 1

    prev_name, prev_content = read_previous_voice()
    if prev_name:
        print(f"  Prior voice: {prev_name}")
    else:
        print("  Prior voice: (none — first refresh)")

    performers = read_top_performers()
    print(f"  Top-decile performers (last 4 weeks): {len(performers)}")

    scripts = read_recent_scripts([p.get("video_code", "") for p in performers])
    print(f"  Scripts loaded for performers: {len(scripts)}")

    distilled = call_haiku_distill(constitution, prev_content, performers, scripts)
    if not distilled:
        print("  [error] Haiku returned nothing — voice not updated", file=sys.stderr)
        return 2

    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    today = datetime.utcnow().strftime("%Y-%m-%d")
    out_path = VOICE_DIR / f"voice-{today}.md"
    out_path.write_text(distilled + "\n", encoding="utf-8")
    print(f"  ✓ Wrote {out_path.relative_to(REPO_ROOT)}")
    print("  The dashboard's getCurrentBrandVoice() will pick this up on next call.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
