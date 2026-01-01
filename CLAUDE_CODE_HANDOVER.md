# TomOS - Claude Code Context

> **CLAUDE: READ THIS FILE FIRST AT THE START OF EVERY SESSION**
> This document contains essential project context, architecture decisions, and current status.

## PROJECT OVERVIEW

**TomOS** is an ADHD-friendly task management system with intelligent push notifications.

**User:** Tom Bragg (Sydney, Australia - AEDT timezone)

**Core Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  iOS/macOS App  │────▶│  Vercel Backend │────▶│     Notion      │
│  (Swift/SwiftUI)│◀────│   (Next.js 14)  │◀────│   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       ▼
        │               ┌─────────────────┐
        └──────────────▶│      APNs       │
           Push via     │ (Apple Push)    │
                        └─────────────────┘
```

**Key Decision: Native APNs, NOT ntfy**
- The iOS/macOS apps were built specifically to use Apple Push Notification service
- ntfy was the legacy solution and has been fully replaced
- All notifications now go through `/api/send-push` → APNs → native iOS/macOS notifications

## TWO PROJECTS

| Project | Location | Purpose |
|---------|----------|---------|
| **Vercel Backend** | `/Users/tombragg/Desktop/Projects/TomOS/` | Next.js API, Notion integration, APNs sender |
| **iOS/macOS App** | `/Users/tombragg/Desktop/TomOS/` | Swift/SwiftUI native app |

**Important:** These are separate git repos. Don't confuse them.

## CURRENT STATUS (Updated 2026-01-01)

### Completed
- ✅ Swift iOS/iPadOS/macOS app with menu bar interface
- ✅ APNs endpoints (`/api/register-device`, `/api/send-push`)
- ✅ Apple Developer account approved
- ✅ APNs credentials configured in Vercel
- ✅ GitHub Actions for scheduled notifications (morning overview, EOD summary)
- ✅ ntfy fully removed - all notifications via APNs
- ✅ Deployed to production at https://tomos-task-api.vercel.app

### Pending
- ⏳ Run iOS/macOS app to register first device
- ⏳ Add `NOTION_DEVICE_TOKENS_DB_ID` to Vercel after first device registers
- ⏳ End-to-end test with real push notification

## KEY API ENDPOINTS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/task` | POST | Create task via Claude AI parsing |
| `/api/register-device` | POST | Register iOS/macOS device for push |
| `/api/send-push` | POST | Send APNs notification to all devices |
| `/api/notifications/morning-overview` | GET | 8am daily summary (cron) |
| `/api/notifications/eod-summary` | GET | 6pm daily summary (cron) |

## ENVIRONMENT VARIABLES (Vercel)

**All configured:**
- `NOTION_API_KEY` - Notion integration token
- `ANTHROPIC_API_KEY` - Claude API for task parsing
- `APNS_KEY_ID` - Z5X44X9KD7
- `APNS_TEAM_ID` - 89NX9R78Y7
- `APNS_TOPIC` - com.tomos.app
- `APNS_ENVIRONMENT` - development
- `APNS_AUTH_KEY` - Full .p8 key contents
- `CRON_SECRET` - For authenticated cron endpoints

**Needs to be added after first device registration:**
- `NOTION_DEVICE_TOKENS_DB_ID` - Auto-created when first device registers

## SCHEDULED NOTIFICATIONS

Handled by GitHub Actions (not Vercel crons - free tier limit):
- **Morning Overview:** 8am Sydney (22:00 UTC) → `/api/notifications/morning-overview`
- **EOD Summary:** 6pm Sydney (08:00 UTC) → `/api/notifications/eod-summary`

Workflow: `.github/workflows/scheduled-notifications.yml`
Secret: `CRON_SECRET` in GitHub repo secrets

## END GOAL

User workflow:
1. Create task via Siri/iOS app or Alfred
2. Task parsed by Claude AI and saved to Notion
3. Push notification sent via APNs to all registered devices
4. Notification appears natively on iPhone/iPad/Mac
5. User can tap notification actions (Complete/Snooze)

## CONSTRAINTS FOR CLAUDE

1. **Always read this file first** in new sessions
2. **Don't modify Swift/Xcode files** unless specifically asked (different project)
3. **APNs replaces ntfy** - never add ntfy back
4. **Sydney timezone** - all date/time operations use Australia/Sydney
5. **Keep it simple** - don't over-engineer, focus on reliability

## COMMON TASKS

### Test APNs endpoint
```bash
curl -s https://tomos-task-api.vercel.app/api/send-push
```

### Trigger scheduled notification manually
```bash
cd /Users/tombragg/Desktop/Projects/TomOS && gh workflow run scheduled-notifications.yml
```

### Deploy to Vercel
```bash
cd /Users/tombragg/Desktop/Projects/TomOS && vercel --prod
```

### Check workflow status
```bash
cd /Users/tombragg/Desktop/Projects/TomOS && gh run list --workflow=scheduled-notifications.yml --limit 3
```

---

*Last updated: 2026-01-01 by Claude Code*
