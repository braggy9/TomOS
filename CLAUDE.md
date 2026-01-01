# TomOS - Claude Quick Reference

> Read `CLAUDE_CODE_HANDOVER.md` for full project context.

## What is TomOS?

ADHD-friendly task management with intelligent push notifications.
- **Backend**: Next.js 14 on Vercel (this repo)
- **iOS/macOS App**: Separate repo at `/Users/tombragg/Desktop/TomOS/`
- **Push**: APNs only (ntfy deprecated)
- **Timezone**: Sydney (Australia/Sydney)

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE_CODE_HANDOVER.md` | Full project context (read first!) |
| `.claude/rules/*.md` | Domain-specific rules |
| `claude-progress.txt` | Session logs |
| `.env.example` | Environment variables |

## Quick Commands

```bash
# Deploy
vercel --prod

# Test push endpoint
curl -s https://tomos-task-api.vercel.app/api/send-push

# Trigger scheduled notification
gh workflow run scheduled-notifications.yml

# Check workflow status
gh run list --workflow=scheduled-notifications.yml --limit 3
```

## Constraints

1. **APNs only** - Never use ntfy
2. **Sydney timezone** - All date/time ops
3. **Two repos** - Don't modify iOS app from here
4. **Keep simple** - Reliability > features

## Current Status

- ✅ Backend deployed
- ✅ APNs configured
- ✅ GitHub Actions for crons
- ⏳ Awaiting first device registration
