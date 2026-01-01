# TomOS API (Vercel Backend)

## What This Repo Is

Next.js serverless API providing task management, APNs push notifications, and AI-powered features for the TomOS ecosystem.

**Technology:** Next.js 14 App Router, TypeScript, Vercel serverless functions  
**Deployment:** Vercel (Project ID: `prj_8jEVBTn5EAfmPOc5qcOrJ6VYE2Wr`)  
**Production URL:** `https://tomos-task-api.vercel.app`

## Repository Information

**Local Path:** `/Users/tombragg/Desktop/Projects/TomOS/`  
**GitHub:** `github.com/braggy9/TomOS.git` (Public)  
**Related Repo:** [TomOS-Apps](../../TomOS-Apps/) - Swift iOS/macOS clients

## Project Structure

```
TomOS/
├── app/api/
│   ├── register-device/     # APNs device token storage
│   ├── send-push/           # APNs push notification sender
│   ├── task/                # Task creation + auto-push
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
- **Notion Integration:** Publicis Tasks database (NOTION_DATABASE_ID)
- **Multi-Context Support:** Publicis, MixTape, Bison, Personal
- **Automatic Parsing:** Priority, due dates, energy levels, time estimates

### Push Notifications (APNs)
- **HTTP/2 Native:** No deprecated libraries
- **JWT Authentication:** 50-min token caching
- **Device Management:** Notion database for active devices
- **Automatic Triggers:** Task creation → push to all devices
- **Rich Payloads:** Title, body, badge, category, custom data

### Integrations
- **Google Calendar:** Two-way sync, event creation
- **Email Processing:** Inbound emails → tasks
- **Notion Database:** Single source of truth
- **GitHub Actions:** Scheduled morning/EOD summaries

### AI Features
- **Task Suggestions:** AI-powered recommendations
- **Task Breakdown:** Large tasks → subtasks
- **Context Analysis:** Smart priority and energy detection

## Environment Variables

**Required in Vercel:**
```
# Notion
NOTION_API_KEY=secret_xxx
NOTION_DATABASE_ID=xxx  # Publicis Tasks
NOTION_DEVICE_TOKENS_DB_ID=xxx  # Created on first device registration

# APNs
APNS_KEY_ID=Z5X44X9KD7
APNS_TEAM_ID=89NX9R78Y7
APNS_TOPIC=com.tomos.ios
APNS_ENVIRONMENT=development
APNS_AUTH_KEY=-----BEGIN PRIVATE KEY-----\nMIGT...
```

**Optional:**
```
# Google Calendar (if using)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
```

## API Endpoints

### Task Management

**Create Task**
```bash
POST /api/task
{
  "task": "Review quarterly report tomorrow 2pm urgent"
}
```

**Response:**
- Creates task in Notion
- Parses: priority (urgent), due date (tomorrow 2pm), context (inferred)
- Sends push notification to all registered devices

### APNs Device Registration

**Register Device**
```bash
POST /api/register-device
{
  "device_token": "abc123...",
  "platform": "ios"  # or "macos"
}
```

**Response:**
- Upserts device in Notion "TomOS Device Tokens" database
- Returns success/failure
- Device auto-marked as Active

### Push Notifications

**Send Push (Internal)**
```bash
POST /api/send-push
{
  "title": "Task Reminder",
  "body": "Review quarterly report",
  "task_id": "notion-page-id",
  "priority": "urgent"
}
```

**Flow:**
1. Query Notion for active devices
2. Generate JWT token (cached 50min)
3. HTTP/2 POST to `api.sandbox.push.apple.com`
4. Return delivery status

### Scheduled Notifications

**Morning Overview**
```bash
GET /api/notifications/morning-overview
```

**EOD Summary**
```bash
GET /api/notifications/eod-summary
```

Triggered by GitHub Actions cron jobs.

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

### Rollback

Go to Vercel dashboard → Deployments → Promote previous deployment

## Testing Endpoints

```bash
# Health check
curl https://tomos-task-api.vercel.app/api/health

# Register device
curl -X POST https://tomos-task-api.vercel.app/api/register-device \
  -H "Content-Type: application/json" \
  -d '{"device_token":"test-123","platform":"ios"}'

# Create task
curl -X POST https://tomos-task-api.vercel.app/api/task \
  -H "Content-Type: application/json" \
  -d '{"task":"Test task urgent tomorrow"}'

# Send push notification
curl -X POST https://tomos-task-api.vercel.app/api/send-push \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","body":"APNs test"}'
```

## APNs Architecture

### HTTP/2 + JWT Flow

```
1. Query Notion for active device tokens
2. Generate JWT (ES256 algorithm)
   - Header: kid, alg
   - Payload: iss (Team ID), iat (timestamp)
   - Sign with .p8 private key
3. Cache token for 50 minutes
4. For each device:
   - HTTP/2 POST to api.sandbox.push.apple.com
   - Headers: authorization (Bearer JWT), apns-topic
   - Body: JSON payload
5. Return delivery results
```

### Notification Payload

```json
{
  "aps": {
    "alert": {
      "title": "Task Reminder",
      "body": "Review quarterly report"
    },
    "sound": "default",
    "badge": 1,
    "category": "TASK_NOTIFICATION",
    "mutable-content": 1
  },
  "task_id": "notion-page-id",
  "priority": "urgent",
  "type": "task_notification"
}
```

## Database Schema

### Publicis Tasks (Notion)

**Properties:**
- Task (title)
- Context (select): Publicis, MixTape, Bison, Personal
- Priority (select): Urgent, Important, Someday
- Due Date (date)
- Status (select): To Do, In Progress, Done
- Energy (select): High, Medium, Low
- Time Estimate (number)

### TomOS Device Tokens (Notion)

**Properties:**
- Device Token (title)
- Platform (select): ios, macos
- Last Updated (date)
- Active (checkbox)

## Vercel Configuration

**vercel.json:**
```json
{
  "framework": "nextjs",
  "regions": ["syd1"],
  "env": {
    "NOTION_API_KEY": "@notion-api-key"
  }
}
```

**Region:** Sydney (syd1) for low latency

## GitHub Actions

**Workflows:**
- `.github/workflows/scheduled-notifications.yml`
  - Triggers: 7am, 6pm Sydney time
  - Calls morning-overview and eod-summary endpoints
  - Requires CRON_SECRET for auth

## User Context

**User:** Tom Bragg  
**Timezone:** Australia/Sydney (AEDT, UTC+11)  
**Work Contexts:** Publicis (legal), MixTape (running), Bison (consulting), Personal  
**ADHD Workflow:** Needs automatic task structuring, reliable notifications, minimal friction

## Common Tasks

**Add New API Endpoint:**
```bash
mkdir -p app/api/my-endpoint
touch app/api/my-endpoint/route.ts
```

**Update Environment Variables:**
1. Vercel Dashboard → tomos-task-api → Settings → Environment Variables
2. Add/Edit variables
3. Redeploy: `vercel --prod`

**Debug APNs Issues:**
1. Check Vercel logs: `vercel logs --prod --follow`
2. Verify env vars set (APNS_*)
3. Test device registration endpoint
4. Check Notion database for active devices
5. Verify JWT token generation

**Migrate from ntfy to APNs:**
- Old: ntfy.sh with headers
- New: Native APNs via HTTP/2
- Migration complete ✅

## Git Workflow

```bash
# After each working phase
git add .
git commit -m "Phase description"
git push  # Auto-deploys to Vercel

# Check deployment
vercel ls
```

## Related Documentation

See `.claude/context/docs-index.md` for links to:
- APNs setup guide
- API endpoint documentation
- Notion database schemas
- Integration guides

## Quick Reference

**Need frontend changes?** Switch to `/Users/tombragg/Desktop/TomOS-Apps/`  
**Deployment failed?** Check Vercel logs and environment variables  
**APNs not working?** Verify .p8 key, device tokens in Notion, sandbox environment  
**Rate limited?** JWT tokens cached 50min to avoid APNs limits

## Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "jsonwebtoken": "^9.0.2"
  }
}
```

**No node-apn:** Using native HTTP/2 implementation instead
