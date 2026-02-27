# TomOS - Claude Code Context

> **CLAUDE: READ THIS FILE FIRST AT THE START OF EVERY SESSION**
> This document contains essential project context, architecture decisions, and current status.

## PROJECT OVERVIEW

**TomOS** is an ADHD-friendly task management system with intelligent push notifications, legal matter tracking, notes, journaling, and fitness features.

**User:** Tom Bragg (Sydney, Australia - AEDT timezone)

**Core Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  tomos-web PWAs │────▶│  Vercel Backend  │────▶│   PostgreSQL    │
│  (Next.js 15)   │◀────│   (Next.js 14)   │◀────│  (Neon, Sydney) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │      APNs       │
                        │  (Apple Push)   │
                        └─────────────────┘
```

**Key Decisions:**
- **PostgreSQL (Neon, Sydney) is the ONLY database** — Notion has been completely replaced
- **tomos-web PWAs are the primary client** — Swift native apps are fully deprecated
- **Native APNs for push notifications** — ntfy was removed long ago

## TWO PROJECTS

| Project | Location | Purpose |
|---------|----------|---------|
| **Vercel Backend** | `/Users/tombragg/Desktop/Projects/TomOS/` | Next.js API, PostgreSQL via Prisma, APNs sender |
| **tomos-web** | `/Users/tombragg/Desktop/Projects/tomos-web/` | Next.js 15 PWA monorepo (Tasks, Notes, Matters, Journal, Fitness) |

**Important:** These are separate git repos. Don't confuse them.

## CURRENT STATUS (Updated 2026-02-27)

### Architecture
- **Database:** PostgreSQL (Neon, Sydney region) via Prisma ORM — migrated from Notion January 2026
- **Frontend:** tomos-web PWAs (5 apps in pnpm monorepo with Turborepo)
- **Backend:** Next.js 14 on Vercel (serverless functions)
- **Push:** APNs for all notifications
- **Swift apps:** Fully deprecated — no longer maintained or distributed

### Web Apps (tomos-web)
- **Tasks:** https://tomos-tasks.vercel.app
- **Notes:** https://tomos-notes.vercel.app
- **Matters:** https://tomos-matters.vercel.app
- **Journal:** https://tomos-journal.vercel.app
- **Fitness:** https://tomos-fitness.vercel.app

### Completed
- PostgreSQL migration complete (66 tasks, 23 tags, all relations preserved)
- MatterOS legal matter management (CRUD, documents, events, notes)
- General Notes with smart linking, templates, full-text search
- Journal with AI companion, mood/energy tracking, insights
- FitnessOS with gym logging, Strava sync, progressive overload
- APNs push notifications to iOS and macOS devices
- NLP task capture with Claude AI (smart date parsing, Sydney timezone)
- 15-minute reminder notifications for tasks with due dates
- Legal deadline notifications via Vercel cron
- Subtasks (one level deep, parentId self-relation)
- Markdown rendering across Notes and Journal

### Pending
- Device token migration from Notion to Postgres `device_tokens` table (APNs still works via Notion for now)
- Notion environment variables will be removed from Vercel once device token migration completes

### Registered Devices
- **iOS:** `f757db2b408a19ec8805ed09a2f2517d945e06b11136c76c02ee989b708349d2`
- **macOS:** `025aeb1d4d823d3300df28fa6b0c6b81581f62df36c10a9fe7d29c1c1a2db4ca`

## KEY API ENDPOINTS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/task` | POST | Create task via Claude AI parsing |
| `/api/task/batch` | POST | Batch import multiple tasks |
| `/api/tasks` | GET | List/filter tasks |
| `/api/matters` | GET/POST | Legal matter management |
| `/api/matters/[id]` | GET/PATCH/DELETE | Single matter with related data |
| `/api/notes` | GET/POST | General notes CRUD |
| `/api/notes/search` | GET | Full-text search with GIN index |
| `/api/notes/templates` | GET/POST | Note templates |
| `/api/journal/entries` | GET/POST | Journal entries with mood/energy |
| `/api/journal/chat` | GET/POST | AI companion conversations |
| `/api/journal/insights` | GET | Mood patterns, theme trends |
| `/api/gym/*` | Various | FitnessOS (sessions, exercises, Strava) |
| `/api/register-device` | POST | Register iOS/macOS device for push |
| `/api/send-push` | POST | Send APNs notification to all devices |
| `/api/cron/legal-deadlines` | GET | Legal deadline notifications (Vercel cron) |
| `/api/cron/gym-suggestion` | GET | Daily gym suggestion (GitHub Actions) |
| `/api/health` | GET | Health check |

## ENVIRONMENT VARIABLES (Vercel)

**Core (all configured):**
- `DATABASE_URL` — Neon Postgres connection string (pooled)
- `DIRECT_URL` — Neon Postgres direct connection (for migrations)
- `ANTHROPIC_API_KEY` — Claude API for task parsing, journal AI, theme extraction
- `APNS_KEY_ID` — Z5X44X9KD7
- `APNS_TEAM_ID` — 89NX9R78Y7
- `APNS_TOPIC` — com.tomos.app
- `APNS_ENVIRONMENT` — development
- `APNS_AUTH_KEY_BASE64` — Base64-encoded .p8 key
- `CRON_SECRET` — For authenticated cron endpoints

**Legacy (pending removal after device token migration):**
- `NOTION_API_KEY` — Used only for device token lookups in `/api/send-push`
- `NOTION_DEVICE_TOKENS_DB_ID` — Device tokens database (migrating to Postgres)

## SCHEDULED NOTIFICATIONS

| Schedule | Endpoint | Trigger | Purpose |
|----------|----------|---------|---------|
| 6:00am Sydney daily | `/api/cron/legal-deadlines` | Vercel cron | Legal deadline alerts |
| 6:30am Sydney daily | `/api/cron/gym-suggestion` | GitHub Actions | Daily workout suggestion |
| ~~8:00am Sydney~~ | ~~`/api/notifications/morning-overview`~~ | ~~Disabled~~ | ~~Morning task summary~~ |
| ~~6:00pm Sydney~~ | ~~`/api/notifications/eod-summary`~~ | ~~Disabled~~ | ~~EOD task summary~~ |

## END GOAL

User workflow:
1. Create/manage tasks via tomos-web PWA (https://tomos-tasks.vercel.app)
2. Task parsed by Claude AI and saved to PostgreSQL
3. Push notification sent via APNs to registered devices
4. Manage legal matters, notes, journal, and fitness via dedicated PWAs
5. Morning notifications for legal deadlines and workout suggestions
6. All data in PostgreSQL — single source of truth, fast queries, no rate limits

## CONSTRAINTS FOR CLAUDE

1. **Always read this file first** in new sessions
2. **PostgreSQL via Prisma** for all data operations — Notion is NOT used for data (only legacy device tokens)
3. **APNs replaces ntfy** — never add ntfy back
4. **Sydney timezone** — all date/time operations use Australia/Sydney
5. **Keep it simple** — don't over-engineer, focus on reliability
6. **tomos-web is the frontend** — do not reference or build Swift/iOS code in this repo
7. **Background operations** must not block primary API responses

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

---

*Last updated: 2026-02-27 by Claude Code*
