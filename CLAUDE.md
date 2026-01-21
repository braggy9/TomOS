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

## Backend Migration (Notion → PostgreSQL)

**Status:** ✅ **COMPLETED** (January 19, 2026)
**Documentation:** `/docs/postgres-migration/`
**Database:** Neon Postgres (Sydney region)

**Migration Results:**
- ✅ 66 tasks migrated successfully
- ✅ 23 tags created (context, energy, time, source)
- ✅ All relations preserved
- ✅ API endpoints migrated with feature flag pattern
- ✅ Production deployed with `USE_POSTGRES=true`

**Performance Improvements:**
- Expected: 20-60x faster than Notion API
- No rate limits (was 3 req/s)
- Native SQL joins and complex queries
- Foundation ready for MatterOS, LegalOS, NexusOS

**Migration Sessions Completed:**
1. ✅ Session 1: Database Setup (schema, migrations, Prisma Client)
2. ✅ Session 2: API Migration (5 Task endpoints)
3. ✅ Session 3: Data Migration (export, import, verify)

**Why:** Current Notion API is slow (2-3s dashboard loads), rate-limited (3 req/s), and can't support advanced queries needed for the full TomOS ecosystem.

---

## MatterOS Integration

**Status:** ✅ **INTEGRATED** (January 19, 2026)
**Documentation:** `/Users/tombragg/Desktop/tomos-command-tower/projects/matteros/`
**Architecture:** Integrated module within TomOS API (shared PostgreSQL database)

### What is MatterOS?

Legal matter management system built as an integrated module within TomOS. Enables lawyers to track matters, documents, events, notes, and link them to TomOS tasks for unified productivity.

### Database Schema

**New Tables (January 19, 2026):**
- `matters` - Core legal matter entity (client, type, status, priority, billing, team)
- `matter_documents` - Document repository (contracts, memos, court filings, research)
- `matter_events` - Activity timeline (status changes, deadlines, meetings)
- `matter_notes` - Research notes and analysis (markdown support)

**Task Integration:**
- Added `matterId` field to `tasks` table
- Foreign key: `tasks.matterId` → `matters.id` (optional, ON DELETE SET NULL)
- Enables linking TomOS tasks to legal matters for unified tracking

### API Endpoints

All endpoints follow REST conventions with JSON responses.

**Matters:**
```
GET    /api/matters                    # List matters (filter by status, priority, client, type)
POST   /api/matters                    # Create new matter
GET    /api/matters/[id]               # Get single matter with related data
PATCH  /api/matters/[id]               # Update matter
DELETE /api/matters/[id]               # Archive matter (soft delete)
```

**Documents:**
```
GET    /api/matters/[id]/documents           # List documents for matter
POST   /api/matters/[id]/documents           # Add document to matter
GET    /api/matters/[id]/documents/[docId]   # Get single document
PATCH  /api/matters/[id]/documents/[docId]   # Update document
DELETE /api/matters/[id]/documents/[docId]   # Delete document
```

**Events (Activity Timeline):**
```
GET    /api/matters/[id]/events        # List events for matter
POST   /api/matters/[id]/events        # Create custom event
```

**Notes:**
```
GET    /api/matters/[id]/notes         # List notes for matter
POST   /api/matters/[id]/notes         # Create note
GET    /api/matters/[id]/notes/[noteId]  # Get single note
PATCH  /api/matters/[id]/notes/[noteId]  # Update note
DELETE /api/matters/[id]/notes/[noteId]  # Delete note
```

### Features

- **Activity Tracking:** Every change updates `matter.lastActivityAt` for sorting
- **Automatic Events:** Status changes, document additions, and note creations auto-create timeline events
- **Soft Deletes:** Matters are archived (not deleted) to preserve history
- **Pagination:** All list endpoints support limit/offset with hasMore flag
- **Type Safety:** Full TypeScript types in `/types/matteros.ts`
- **Fire-and-forget:** Background operations (events, activity updates) don't block primary API responses

### Matter Types

- `contract` - Contract review and negotiation
- `dispute` - Disputes and litigation
- `compliance` - Compliance matters
- `advisory` - Legal advisory services
- `employment` - Employment law
- `ip` - Intellectual property
- `regulatory` - Regulatory matters

### Integration with TomOS Tasks

Link tasks to matters by setting `matterId`:
```typescript
// Create task linked to matter
POST /api/task
{
  "task": "Review employment contract by Friday",
  "matterId": "uuid-of-matter"
}
```

Tasks appear in matter's task list when viewing via:
```
GET /api/matters/[id]  // Includes related tasks
```

### Next Steps

- **Phase 2:** Client management (separate Client table)
- **Phase 3:** Time tracking (TimeEntry table)
- **Phase 4:** iOS/macOS client integration
- **Phase 5:** LegalOS connection (advanced legal automation)

---

## Notes Feature

**Status:** ✅ **INTEGRATED** (January 21, 2026)
**Architecture:** General-purpose note-taking with full TomOS ecosystem integration

### What is the Notes Feature?

General-purpose note-taking system built into TomOS. Unlike MatterNotes (which are specific to legal matters), Notes are standalone with optional linking to Tasks, Matters, and Projects for unified knowledge management.

### Database Schema

**New Table (January 21, 2026):**
- `notes` - General notes with Markdown support

**Fields:**
- Core: title, content (Markdown), auto-generated excerpt
- Organization: tags array, isPinned boolean
- Optional Links: taskId, matterId, projectId (all nullable, ON DELETE SET NULL)
- Timestamps: createdAt, updatedAt

**Indexes:** isPinned, createdAt, taskId, matterId, projectId

### API Endpoints

All endpoints follow REST conventions with JSON responses.

**Notes CRUD:**
```
GET    /api/notes                # List notes (filter by pinned, tags, links)
POST   /api/notes                # Create new note
GET    /api/notes/[id]           # Get single note with relations
PATCH  /api/notes/[id]           # Update note
DELETE /api/notes/[id]           # Delete note
GET    /api/notes/search?q=text  # Full-text search across title/content
```

### Features

- **Markdown Support:** Full markdown formatting in content field
- **Auto Excerpts:** First 200 chars auto-extracted for previews (markdown stripped)
- **Tag Organization:** Reuses existing tag system (string array)
- **Pin Important Notes:** Boolean flag for sticky notes
- **Optional Linking:** Connect notes to tasks, matters, or projects
- **Full-Text Search:** Case-insensitive search across title, content, and excerpt
- **Pagination:** Limit/offset support with hasMore flag

### Example Usage

**Create Note:**
```bash
curl -X POST https://tomos-task-api.vercel.app/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Meeting Notes - 2026-01-21",
    "content": "# Discussion Points\n\n- Project timeline\n- Budget approval",
    "tags": ["meeting", "work"],
    "isPinned": true,
    "projectId": "uuid-of-project"
  }'
```

**List Pinned Notes:**
```bash
curl https://tomos-task-api.vercel.app/api/notes?pinned=true
```

**Search Notes:**
```bash
curl "https://tomos-task-api.vercel.app/api/notes/search?q=budget&tags=work"
```

### Integration with TomOS Ecosystem

Link notes to other entities:
- **Tasks:** Link research notes, implementation details, or decision rationale
- **Matters:** Link general notes (separate from formal MatterNotes for court docs)
- **Projects:** Link brainstorming, meeting notes, or project documentation

All relations are optional and use soft deletes (SetNull) to preserve notes when linked entities are removed.

### Next Steps

- **Phase 2:** iOS/macOS client integration (NotesListView, NoteDetailView)
- **Phase 3:** Rich text editor with syntax highlighting
- **Phase 4:** Note attachments and file uploads
- **Phase 5:** Bidirectional linking between notes

---

## Current Status (Updated 2026-01-21)

### Completed
- iOS push notifications working (device registered)
- macOS push notifications working (device registered)
- **General Notes feature** - Full CRUD API with search and ecosystem integration
- ntfy fully deprecated and removed - all notifications via APNs
- NLP task capture with smart date parsing (Sydney timezone)
- 15-minute reminder notifications via APNs
- Batch task import with AI parsing
- GitHub Actions for scheduled notifications (fixed 2026-01-05)
- Google Calendar sync (optional)
- Automatic device deactivation on APNs 410 errors
- **GET /api/all-tasks** - Task list endpoint for iOS app
- **M365 Calendar** - 30-day window filter to prevent 413 errors

### Recent Fixes (2026-01-05)
- **VERCEL_URL Fix:** Scheduled notifications (morning-overview, eod-summary) now use
  hardcoded production URL instead of `VERCEL_URL` environment variable. This fixes
  issues where internal API calls were hitting deployment-specific URLs that returned
  HTML error pages instead of JSON.
- **Device Deactivation:** send-push endpoint now automatically marks devices as inactive
  when APNs returns 410 (device unregistered) errors.

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
│   ├── matters/             # MatterOS - Legal matter management ⚡ NEW
│   │   └── [id]/
│   │       ├── documents/   # Matter documents
│   │       ├── events/      # Matter activity timeline
│   │       └── notes/       # Matter notes and research
│   ├── calendar/            # Google Calendar sync
│   ├── email/               # Email-to-task processing
│   ├── focus/               # Focus mode state
│   ├── notifications/       # Morning/EOD summaries
│   ├── suggestions/         # AI task suggestions
│   ├── health/              # Health check
│   └── cron/                # Scheduled jobs
├── prisma/
│   ├── schema.prisma        # Database schema (Tasks + MatterOS)
│   └── migrations/          # Migration history
├── types/
│   └── matteros.ts          # MatterOS TypeScript types ⚡ NEW
├── docs/
│   ├── APNS_SETUP.md        # APNs implementation guide
│   └── postgres-migration/  # PostgreSQL migration docs
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

### Fetch All Tasks

**Get All Tasks** (for iOS My Tasks tab)
```bash
GET /api/all-tasks
```

Returns all tasks sorted by priority and due date, limited to 100 tasks.

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
