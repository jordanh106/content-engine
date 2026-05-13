#!/usr/bin/env python3
"""
audience-pulse.py — pulls demand signal per audience segment.

Sources:
  - Reddit JSON endpoints (no auth needed for public reads)
  - Google "People Also Ask" via SERP scrape
  - (optional) YouTube comment threads via search

Output: industries/chiropractic/audience-demand/demand-{audience}-{YYYY-MM-DD}.md

Usage:
  python audience-pulse.py --audience prenatal
  python audience-pulse.py --audience all
  python audience-pulse.py --audience adult senior

Env:
  ANTHROPIC_API_KEY — required for the Haiku distillation step
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote_plus
import urllib.request
import urllib.error


REPO_ROOT = Path(__file__).resolve().parents[2]
AUDIENCES_PATH = REPO_ROOT / "industries" / "chiropractic" / "audiences.md"
OUT_DIR = REPO_ROOT / "industries" / "chiropractic" / "audience-demand"


def load_env_file(path: Path) -> None:
    """Light-weight .env loader. Only sets keys not already in the process env."""
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


# Auto-load the dashboard .env so we pick up ANTHROPIC_API_KEY without the user
# having to remember to export it. The dashboard already keeps these keys in one place.
load_env_file(REPO_ROOT / "packages" / "dashboard" / ".env")
load_env_file(REPO_ROOT / ".env")  # fallback to repo-root .env if present

# Default source map per audience. Can be overridden by a <!-- pulse-sources --> block
# in audiences.md, but keeping defaults here so the skill works out of the box.
DEFAULT_SUBREDDITS = {
    "prenatal":  ["BabyBumps", "BeyondTheBump", "PregnantOver30"],
    "infant":    ["Mommit", "breastfeeding", "Parenting"],
    "kids":      ["Parenting", "parenting"],
    "athlete":   ["running", "weightroom", "AdvancedRunning"],
    "adult":     ["ChronicPain", "ehlersdanlos", "posture"],
    "senior":    ["AskOldPeople", "AgingParents"],
    "general":   ["AskDocs", "Chiropractic"],
}

DEFAULT_ANCHORS = {
    "prenatal":  ["chiropractic pregnancy", "Webster technique", "pubic symphysis pain pregnancy"],
    "infant":    ["chiropractor newborn", "torticollis baby treatment", "colic chiropractic"],
    "kids":      ["kids tech neck", "scoliosis screening kids", "growing pains kids"],
    "athlete":   ["chiropractor for runners", "low back deadlift", "return to play injury"],
    "adult":     ["tech neck exercises", "morning stiffness causes", "sciatica desk job"],
    "senior":    ["chiropractic seniors safe", "falls prevention exercises", "arthritis pain"],
    "general":   ["best family chiropractor", "first chiropractor visit", "how to choose chiropractor"],
}


USER_AGENT = "ContentEngine-AudiencePulse/1.0 (educational research)"


def fetch_reddit_top_threads(subreddit: str, days: int = 14, limit: int = 25) -> list[dict]:
    """Fetch top threads from a subreddit's public JSON endpoint."""
    url = f"https://www.reddit.com/r/{subreddit}/top.json?t=week&limit={limit}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError) as e:
        print(f"  [skip] /r/{subreddit}: {e}", file=sys.stderr)
        return []

    cutoff = (datetime.utcnow() - timedelta(days=days)).timestamp()
    out = []
    for child in data.get("data", {}).get("children", []):
        post = child.get("data", {})
        created = post.get("created_utc", 0)
        if created < cutoff:
            continue
        out.append({
            "title": post.get("title", "").strip(),
            "selftext": (post.get("selftext", "") or "").strip()[:500],
            "comments": post.get("num_comments", 0),
            "score": post.get("score", 0),
            "url": f"https://reddit.com{post.get('permalink', '')}",
            "subreddit": subreddit,
            "created": datetime.utcfromtimestamp(created).strftime("%Y-%m-%d"),
        })
    return out


def fetch_google_paa(query: str) -> list[str]:
    """Scrape Google's 'People Also Ask' for a query. Best-effort — Google rotates HTML."""
    url = f"https://www.google.com/search?q={quote_plus(query)}&hl=en"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        print(f"  [skip] Google PAA '{query}': {e}", file=sys.stderr)
        return []

    # PAA questions tend to live in spans with data-q attributes or under role="heading"
    # Conservative regex — best-effort.
    paa = set()
    for m in re.finditer(r'data-q="([^"]{8,120}\?)"', html):
        paa.add(m.group(1).strip())
    for m in re.finditer(r'role="heading"[^>]*>([A-Z][^<]{8,120}\?)<', html):
        paa.add(m.group(1).strip())
    return sorted(paa)[:10]


def call_haiku_distill(audience_id: str, audience_label: str, raw_signals: dict) -> str:
    """Call Claude Haiku to distill raw signals into the structured demand format."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("  ANTHROPIC_API_KEY not set — emitting raw signals without distillation", file=sys.stderr)
        return None

    # Build the prompt
    reddit_lines = []
    for t in raw_signals.get("reddit", []):
        reddit_lines.append(f"  - [{t['subreddit']}] {t['title']} — {t['comments']} comments, score {t['score']} — {t['url']}")

    paa_lines = []
    for q in raw_signals.get("paa", []):
        paa_lines.append(f"  - {q}")

    prompt = f"""You are an audience researcher distilling raw demand signals for a chiropractic content creator.

Target audience: {audience_label} ({audience_id})

Raw signals collected this week:

REDDIT THREADS (titles + engagement):
{chr(10).join(reddit_lines) if reddit_lines else "  (none collected)"}

GOOGLE "People Also Ask":
{chr(10).join(paa_lines) if paa_lines else "  (none collected)"}

Your job: produce a markdown report in EXACTLY this structure:

# Demand Signal · {audience_label} ({audience_id}) · {datetime.utcnow().strftime("%Y-%m-%d")}

## Top questions (verbatim from sources)
[Pick the 5-8 most engagement-heavy or recurring questions from the threads + PAA. Quote verbatim. Include the source URL where available. Format: numbered list. Each entry: "QUESTION" — SOURCE · X comments · date · URL]

## Recurring themes (mentioned in 3+ sources)
[Cluster themes. Format: bullet list. "Theme name (count of sources)"]

## Surprising signals
[1-3 bullets on anything counter-intuitive, off-script, or unexpected. If nothing surprising, write a single bullet: "Nothing surprising this week."]

## Suggested idea triggers
[3-5 specific content ideas this audience signal supports. Each one has a format hint and a one-line rationale. Format:
1. **Format type** — "Idea title here" — Source rationale (which threads or PAA queries triggered this)
2. ...
Available format types: Did-you-know carousel | Explainer (Format A) | Checklist (Format B) | Demo (Format C) | Myth Buster (Format D) | Walkthrough (Format E) | Quick Tip (Format F) | Patient Story (Format G)]

## Source map
- Subreddits scanned: [list]
- Search anchors: [list]
- Date range: [start to end]
- Threads sampled: [count]

Output ONLY the markdown. No preamble, no code fence, no explanation."""

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=json.dumps({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 2500,
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
        print(f"  Haiku distillation failed: {e}", file=sys.stderr)
        return None
    return None


def emit_raw_fallback(audience_id: str, audience_label: str, raw_signals: dict) -> str:
    """Fallback when Haiku is unavailable — emit the raw signals as-is in the structured format."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    threads = raw_signals.get("reddit", [])
    paa = raw_signals.get("paa", [])

    lines = [
        f"# Demand Signal · {audience_label} ({audience_id}) · {today}",
        "",
        "## Top questions (verbatim from sources)",
    ]
    if threads:
        for i, t in enumerate(threads[:8], 1):
            lines.append(f"{i}. \"{t['title']}\" — /r/{t['subreddit']} · {t['comments']} comments · {t['created']} · {t['url']}")
    else:
        lines.append("(no reddit signals collected)")
    lines.extend(["", "## Recurring themes (mentioned in 3+ sources)", "(distillation skipped — set ANTHROPIC_API_KEY to enable)", "", "## Surprising signals", "(distillation skipped)", "", "## Suggested idea triggers", "(distillation skipped — review the raw questions above and add manually to idea-bank.md)", "", "## Source map"])
    return "\n".join(lines)


def run_audience(audience_id: str) -> Path | None:
    audience_label_map = {
        "prenatal":  "Pregnancy & Postpartum",
        "infant":    "Babies & Infants",
        "kids":      "Kids & Teens",
        "athlete":   "Active Adults & Athletes",
        "adult":     "Adults & Daily Life",
        "senior":    "Seniors & Aging Well",
        "general":   "Whole Family & General",
    }
    label = audience_label_map.get(audience_id, audience_id)
    print(f"\n→ Pulse: {label} ({audience_id})")

    subs = DEFAULT_SUBREDDITS.get(audience_id, [])
    anchors = DEFAULT_ANCHORS.get(audience_id, [])

    raw = {"reddit": [], "paa": []}
    for sub in subs:
        print(f"  scanning /r/{sub} ...")
        threads = fetch_reddit_top_threads(sub)
        raw["reddit"].extend(threads)
        time.sleep(2)  # be nice to reddit

    for query in anchors:
        print(f"  PAA: {query}")
        paa = fetch_google_paa(query)
        raw["paa"].extend(paa)
        time.sleep(2)  # be nice to google

    # De-dupe PAA
    raw["paa"] = sorted(set(raw["paa"]))

    distilled = call_haiku_distill(audience_id, label, raw)
    body = distilled if distilled else emit_raw_fallback(audience_id, label, raw)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUT_DIR / f"demand-{audience_id}-{datetime.utcnow().strftime('%Y-%m-%d')}.md"
    out_path.write_text(body + "\n", encoding="utf-8")
    print(f"  ✓ wrote {out_path.relative_to(REPO_ROOT)}")
    return out_path


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--audience", nargs="+", required=True,
                   help="Audience id (prenatal/infant/kids/athlete/adult/senior/general) or 'all'")
    args = p.parse_args()

    all_audiences = ["prenatal", "infant", "kids", "athlete", "adult", "senior", "general"]

    targets: list[str] = []
    for a in args.audience:
        if a == "all":
            targets.extend(all_audiences)
        else:
            if a not in all_audiences:
                print(f"unknown audience: {a}", file=sys.stderr)
                return 1
            targets.append(a)

    # De-dupe while preserving order
    seen = set()
    targets = [a for a in targets if not (a in seen or seen.add(a))]

    written: list[Path] = []
    for a in targets:
        path = run_audience(a)
        if path:
            written.append(path)

    print(f"\n✓ Wrote {len(written)} demand file(s) to {OUT_DIR.relative_to(REPO_ROOT)}/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
