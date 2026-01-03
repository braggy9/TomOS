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
- The iOS/macOS apps use Apple Push Notification service exclusively
- ntfy was the legacy solution and has been fully removed from codebase
- All notifications go through `/api/send-push` → APNs → native iOS/macOS notifications

## TWO PROJECTS

| Project | Location | Purpose |
|---------|----------|---------|
| **Vercel Backend** | `/Users/tombragg/Desktop/Projects/TomOS/` | Next.js API, Notion integration, APNs sender |
| **iOS/macOS App** | `/Users/tombragg/Desktop/TomOS-Apps/` | Swift/SwiftUI native app |

**Important:** These are separate git repos. Don't confuse them.

## CURRENT STATUS (Updated 2026-01-01)

### Completed
- ✅ Swift iOS/iPadOS/macOS app with menu bar interface
- ✅ APNs endpoints (`/api/register-device`, `/api/send-push`)
- ✅ Apple Developer account configured
- ✅ APNs credentials configured in Vercel
- ✅ GitHub Actions for scheduled notifications (morning overview, EOD summary)
- ✅ ntfy fully removed - all notifications via APNs
- ✅ iOS device registered and receiving push notifications
- ✅ macOS device registered and receiving push notifications
- ✅ macOS app installed in /Applications with auto-start on login
- ✅ NLP task parsing with Claude AI (claude-sonnet-4-5-20250929)
- ✅ 15-minute reminder notifications for tasks with due dates

### Registered Devices
- **iOS:** `f757db2b408a19ec8805ed09a2f2517d945e06b11136c76c02ee989b708349d2`
- **macOS:** `025aeb1d4d823d3300df28fa6b0c6b81581f62df36c10a9fe7d29c1c1a2db4ca`

## KEY API ENDPOINTS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/task` | POST | Create task via Claude AI parsing |
| `/api/task/batch` | POST | Batch import multiple tasks |
| `/api/register-device` | POST | Register iOS/macOS device for push |
| `/api/send-push` | POST | Send APNs notification to all devices |
| `/api/notifications/morning-overview` | GET | 8am daily summary (cron) |
| `/api/notifications/eod-summary` | GET | 6pm daily summary (cron) |

## ENVIRONMENT VARIABLES (Vercel)

**All configured:**
- `NOTION_API_KEY` - Notion integration token
- `NOTION_DATABASE_ID` - 739144099ebc4ba1ba619dd1a5a08d25
- `NOTION_DEVICE_TOKENS_DB_ID` - 2db46505-452d-818f-bd20-d6e9b60b602f
- `NOTION_PARENT_PAGE_ID` - 26f46505452d8001a172c824053753e9
- `ANTHROPIC_API_KEY` - Claude API for task parsing
- `APNS_KEY_ID` - Z5X44X9KD7
- `APNS_TEAM_ID` - 89NX9R78Y7
- `APNS_TOPIC` - com.tomos.app
- `APNS_ENVIRONMENT` - development
- `APNS_AUTH_KEY_BASE64` - Base64-encoded .p8 key
- `CRON_SECRET` - For authenticated cron endpoints

## SCHEDULED NOTIFICATIONS

Handled by GitHub Actions (not Vercel crons - free tier limit):
- **Morning Overview:** 8am Sydney → `/api/notifications/morning-overview`
- **EOD Summary:** 6pm Sydney → `/api/notifications/eod-summary`

Workflow: `.github/workflows/scheduled-notifications.yml`
Secret: `CRON_SECRET` in GitHub repo secrets

## MACOS ENTITLEMENTS FIX

**Important:** macOS uses a different entitlements key than iOS:
- iOS: `aps-environment`
- macOS: `com.apple.developer.aps-environment`

The macOS entitlements file (`TomOS.macOS.entitlements`) must use the full key.

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

### Test push notification to all devices
```bash
curl -s https://tomos-task-api.vercel.app/api/send-push \
  -X POST -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"Push test","badge":1}'
```

### Create a task
```bash
curl -s https://tomos-task-api.vercel.app/api/task \
  -X POST -H "Content-Type: application/json" \
  -d '{"task":"Review contract tomorrow 3pm"}'
```

### Deploy to Vercel
```bash
cd /Users/tombragg/Desktop/Projects/TomOS && vercel --prod
```

### Update macOS app in Applications
```bash
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData -path "*/Debug/TomOS.app" -type d 2>/dev/null | head -1)
rm -rf /Applications/TomOS.app && cp -R "$APP_PATH" /Applications/TomOS.app
```

---

*Last updated: 2026-01-01 by Claude Code*
