# TomOS API (Vercel Backend)

## What This Repo Is

Next.js serverless API providing task management, APNs push notifications, and AI-powered features for the TomOS ecosystem.

**Technology:** Next.js 14 App Router, TypeScript, Vercel serverless functions
**Deployment:** Vercel (Project ID: `prj_8jEVBTn5EAfmPOc5qcOrJ6VYE2Wr`)
**Production URL:** `https://tomos-task-api.vercel.app`

## Repository Information

**Local Path:** `/Users/tombragg/Desktop/Projects/TomOS/`
**GitHub:** `github.com/braggy9/TomOS.git` (Public)
**Related Repo:** [TomOS-Apps](/Users/tombragg/Desktop/TomOS-Apps/) - Swift iOS/macOS clients

## Current Status (Updated 2026-01-01)

### Completed
- iOS push notifications working (device registered)
- macOS push notifications working (device registered)
- ntfy fully deprecated and removed - all notifications via APNs
- NLP task capture with smart date parsing (Sydney timezone)
- 15-minute reminder notifications via APNs
- Batch task import with AI parsing
- GitHub Actions for scheduled notifications
- Google Calendar sync (optional)

### Registered Devices
- **iOS:** `f757db2b408a19ec...`
- **macOS:** `025aeb1d4d823d33...`

## Project Structure

```
TomOS/
├── app/api/
│   ├── register-device/     # APNs device token storage
│   ├── send-push/           # APNs push notification sender
│   ├── task/                # Single task creation + auto-push
│   │   └── batch/           # Batch task import
│   ├── tasks/               # Task management
│   ├── calendar/            # Google Calendar sync
│   ├── email/               # Email-to-task processing
│   ├── focus/               # Focus mode state
│   ├── notifications/       # Morning/EOD summaries
│   ├── suggestions/         # AI task suggestions
│   ├── health/              # Health check
│   └── cron/                # Scheduled jobs
├── docs/
│   └── APNS_SETUP.md        # APNs implementation guide
├── .github/workflows/       # GitHub Actions (cron jobs)
├── package.json
├── vercel.json
└── .env.local               # Secrets (gitignored)
```

## Key Features

### Core Task Management
- **Natural Language Processing:** "Review contract tomorrow 3pm" → structured task
- **Notion Integration:** Tasks database (NOTION_DATABASE_ID: `739144099ebc4ba1ba619dd1a5a08d25`)
- **Multi-Context Support:** Work, Client Projects, Strategy, Admin, Legal Review
- **Automatic Parsing:** Priority, due dates, energy levels, time estimates
- **Batch Import:** Multiple tasks from brain dump text

### Push Notifications (APNs)
- **HTTP/2 Native:** No deprecated libraries
- **JWT Authentication:** 50-min token caching
- **Device Management:** Notion database for active devices
- **Automatic Triggers:** Task creation → push to all devices
- **15-minute Reminders:** Scheduled via node-cron for tasks with due dates
- **Rich Payloads:** Title, body, badge, category, custom data

### Integrations
- **Google Calendar:** Two-way sync, event creation
- **Email Processing:** Inbound emails → tasks
- **Notion Database:** Single source of truth
- **GitHub Actions:** Scheduled morning/EOD summaries

### AI Features (Claude claude-sonnet-4-5-20250929)
- **Task Parsing:** Natural language → structured task data
- **Smart Date Extraction:** "tomorrow", "next Friday", "in 2 hours"
- **Context Detection:** Auto-categorize by content
- **Priority Inference:** Detect urgency from language

## Environment Variables

**Required in Vercel:**
```
# Notion
NOTION_API_KEY=secret_xxx
NOTION_DATABASE_ID=739144099ebc4ba1ba619dd1a5a08d25
NOTION_DEVICE_TOKENS_DB_ID=2db46505-452d-818f-bd20-d6e9b60b602f
NOTION_PARENT_PAGE_ID=26f46505452d8001a172c824053753e9

# APNs
APNS_KEY_ID=Z5X44X9KD7
APNS_TEAM_ID=89NX9R78Y7
APNS_TOPIC=com.tomos.app
APNS_ENVIRONMENT=development
APNS_AUTH_KEY_BASE64=<base64-encoded .p8 key>

# AI
ANTHROPIC_API_KEY=sk-ant-xxx

# Scheduled Jobs
CRON_SECRET=xxx
```

**Optional:**
```
# Google Calendar (if using)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_CALENDAR_REFRESH_TOKEN=xxx
```

## API Endpoints

### Task Management

**Create Single Task**
```bash
POST /api/task
{
  "task": "Review quarterly report tomorrow 2pm urgent",
  "source": "Alfred"  # optional, defaults to "Alfred"
}
```

**Batch Import Tasks**
```bash
POST /api/task/batch
{
  "tasks": "dentist tomorrow, review contract #urgent @john, prep slides for friday",
  "source": "Batch Import"
}
```

### APNs Device Registration

**Register Device**
```bash
POST /api/register-device
{
  "device_token": "abc123...",
  "platform": "ios",  # or "macos"
  "bundle_id": "com.tomos.app",
  "app_version": "1.0"
}
```

### Push Notifications

**Send Push**
```bash
POST /api/send-push
{
  "title": "Task Reminder",
  "body": "Review quarterly report",
  "task_id": "notion-page-id",
  "priority": "urgent",
  "badge": 1
}
```

### Scheduled Notifications

**Morning Overview** (8am Sydney via GitHub Actions)
```bash
GET /api/notifications/morning-overview
Authorization: Bearer <CRON_SECRET>
```

**EOD Summary** (6pm Sydney via GitHub Actions)
```bash
GET /api/notifications/eod-summary
Authorization: Bearer <CRON_SECRET>
```

## Deployment

### Deploy to Production

```bash
cd /Users/tombragg/Desktop/Projects/TomOS

# Check changes
git status

# Commit
git add .
git commit -m "Description"
git push

# Deploy (or auto-deploys on push)
vercel --prod
```

### Check Deployment Status

```bash
vercel logs --prod
vercel inspect <deployment-url>
```

## Testing Endpoints

```bash
# Health check
curl https://tomos-task-api.vercel.app/api/health

# Send test push to all devices
curl -X POST https://tomos-task-api.vercel.app/api/send-push \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"APNs test","badge":1}'

# Create task
curl -X POST https://tomos-task-api.vercel.app/api/task \
  -H "Content-Type: application/json" \
  -d '{"task":"Test task urgent tomorrow"}'
```

## Database Schema

### Tasks (Notion)

**Properties:**
- Task (title)
- Context (multi_select): Work, Client Projects, Strategy, Admin, Legal Review
- Priority (select): Urgent, Important, Someday
- Due Date (date)
- Status (select): Inbox, To Do, In Progress, Done
- Energy (select): High, Medium, Low
- Time (select): Quick, Short, Long
- Source (select): Alfred, Batch Import, Email, etc.
- Captured (date)

### TomOS Device Tokens (Notion)

**Properties:**
- Device Token (title)
- Platform (select): ios, macos, ipados
- Bundle ID (rich_text)
- App Version (rich_text)
- Last Updated (date)
- Active (checkbox)

## User Context

**User:** Tom Bragg
**Timezone:** Australia/Sydney (AEDT, UTC+11)
**Work Contexts:** Work, Client Projects, Strategy, Admin, Legal Review
**ADHD Workflow:** Needs automatic task structuring, reliable notifications, minimal friction

## Quick Reference

**Need frontend changes?** Switch to `/Users/tombragg/Desktop/TomOS-Apps/`
**Deployment failed?** Check Vercel logs and environment variables
**APNs not working?** Verify .p8 key, device tokens in Notion, APNS_TOPIC=com.tomos.app
**Rate limited?** JWT tokens cached 50min to avoid APNs limits

---

*Last updated: 2026-01-01*
