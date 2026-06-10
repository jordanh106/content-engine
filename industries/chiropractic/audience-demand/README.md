# Audience demand digests

Weekly demand-signal digests, one file per audience segment. Produced by:

```
/audience-pulse all                                  # ad-hoc, all 7 audiences
/audience-pulse prenatal                             # one audience
python skills/audience-pulse/audience-pulse.py --audience all   # direct script
```

Or by the **Audience Demand Weekly Digest** n8n workflow (Tuesdays 6am Eastern), which commits and pushes these files automatically.

## File naming

`demand-{audience_id}-{YYYY-MM-DD}.md` — one per audience per run.

Recent files (last 30 days) are read by:
- `packages/dashboard/server/lib/idea-ranker.ts` — pulls the "Suggested idea triggers" section into the ranked queue
- `packages/dashboard/components/DashboardHome.tsx` — the "Tonight's Top Ideas" surface surfaces audience-demand-sourced ideas with their source attribution

## Per-file structure

See `skills/audience-pulse/SKILL.md` for the full schema. The "Suggested idea triggers" section is the load-bearing one — the ranker parses it for ideas. Format:

```markdown
## Suggested idea triggers

1. **Did-you-know carousel** — "Why your pelvis loosens in the 3rd trimester" — 12 /r/BeyondTheBump threads asking the same question this month
2. **Patient story (Format G)** — "Webster technique breech reversal at 36 weeks" — 5 threads, no creators in our space covering it
```

The format-type prefix is parsed by the ranker to drive the Develop CTA's project kind.

## Maintenance

- Files older than 30 days are ignored by the ranker (still kept on disk for historical reference)
- Audience-pulse output is non-destructive — runs append a new dated file, never overwrite
- Source map at the bottom of each file documents what was scanned, so the same query is repeatable
