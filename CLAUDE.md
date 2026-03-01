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

**Status:** ✅ **PHASE 1 COMPLETE** (January 21, 2026)
**Architecture:** Professional note-taking with smart linking, templates, and full-text search

### What is the Notes Feature?

Professional note-taking system built into TomOS with advanced features for legal ADHD workflows. Unlike MatterNotes (which are specific to legal matters), Notes are standalone with smart linking to Tasks, Matters, Projects, and other Notes for unified knowledge management.

### Database Schema

**Table:** `notes` - Enhanced professional note-taking

**Fields:**
- **Core:** title, content (Markdown), auto-generated excerpt
- **Organization:** tags array, isPinned boolean
- **Properties:** priority (low/medium/high/urgent), status (draft/active/archived)
- **Legal Features:** reviewDate (for periodic review), confidential boolean flag
- **Smart Linking:** links JSON (resolved references to tasks/matters/projects/notes)
- **Relations:** taskId, matterId, projectId (all optional, ON DELETE SET NULL)
- **Timestamps:** createdAt, updatedAt

**Indexes:** isPinned, priority, status, reviewDate, confidential, full-text search (GIN)

### Phase 1 Features (✅ Complete)

#### 1. **Note Templates** (8 Professional Templates)

Pre-filled structures for common legal workflows organized by category:

**Legal Templates:**
- Legal Research (legislation, case law, analysis)
- Case Notes (facts, issues, decisions, next steps)
- Client Brief (matter details, key points, timeline)
- Contract Review (parties, terms, issues, recommendations)
- Matter Strategy (objectives, risks, action plan)

**Work/Personal Templates:**
- Meeting Notes (attendees, agenda, decisions, actions)
- Daily Log (daily reflection and tasks)
- Quick Capture (rapid note-taking)

**API Endpoints:**
```
GET  /api/notes/templates           # List all templates by category
POST /api/notes/templates?id={id}   # Create note from template
```

**Example:**
```bash
# List all templates
curl https://tomos-task-api.vercel.app/api/notes/templates

# Create from template
curl -X POST "https://tomos-task-api.vercel.app/api/notes/templates?id=legal-research" \
  -H "Content-Type: application/json" \
  -d '{"title": "Employment Law Research"}'
```

#### 2. **Smart Linking** (Auto-Detection & Resolution)

Automatically parse and resolve entity mentions in note content:

**Syntax:**
- `@task-name` or `@"task with spaces"` → Links to tasks
- `#matter-123` or `#PUB-2026-001` → Links to matters
- `&project-name` or `&"project name"` → Links to projects
- `[[note-title]]` → Wiki-style links to other notes

**Features:**
- Automatic parsing on create/update
- Batch database resolution
- Stored in `links` JSON field for fast retrieval
- Case-insensitive title matching

**Implementation:** `/lib/smartLinking.ts`

**Example:**
```bash
curl -X POST https://tomos-task-api.vercel.app/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Research Summary",
    "content": "Analysis for #PUB-2026-001 linked to @Review task. See [[Case Notes]] for precedent."
  }'

# Response includes resolved links:
{
  "links": {
    "tasks": [{"id": "...", "title": "Review"}],
    "matters": [{"id": "...", "title": "...", "matterNumber": "PUB-2026-001"}],
    "notes": [{"id": "...", "title": "Case Notes"}]
  }
}
```

#### 3. **Backlinks** (Reverse Reference Tracking)

Find all notes that link to a specific note:

**API Endpoint:**
```
GET /api/notes/[id]/backlinks
```

**Features:**
- Searches both links JSON and content
- Returns context snippets (100 chars before/after mention)
- Ordered by most recent update

**Example:**
```bash
curl https://tomos-task-api.vercel.app/api/notes/{noteId}/backlinks

# Response:
{
  "data": {
    "noteId": "...",
    "backlinks": [
      {
        "id": "...",
        "title": "Research Summary",
        "linkContext": "...See [[Case Notes]] for precedent...",
        "updatedAt": "2026-01-21T..."
      }
    ],
    "count": 1
  }
}
```

#### 4. **PostgreSQL Full-Text Search** (with Relevance Ranking)

High-performance search using PostgreSQL's native full-text capabilities:

**Features:**
- GIN index on combined title + content
- `to_tsvector` + `plainto_tsquery` for natural language search
- `ts_rank` for relevance scoring
- Tag filtering support
- 10-100x faster than basic LIKE queries

**API Endpoint:**
```
GET /api/notes/search?q={query}&tags={tag1,tag2}&limit={n}&offset={n}
```

**Example:**
```bash
# Search with ranking
curl "https://tomos-task-api.vercel.app/api/notes/search?q=employment contract"

# Search with tag filter
curl "https://tomos-task-api.vercel.app/api/notes/search?q=legal&tags=research,contracts"
```

#### 5. **Note Properties** (Priority, Status, Review)

Enhanced metadata for professional workflows:

**Properties:**
- `priority`: low, medium, high, urgent (default: medium)
- `status`: draft, active, archived (default: active)
- `reviewDate`: DateTime for periodic review (legal research tracking)
- `confidential`: Boolean flag for sensitive attorney-client content

**Example:**
```bash
curl -X POST https://tomos-task-api.vercel.app/api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Privileged Analysis",
    "content": "Attorney-client privileged research",
    "priority": "urgent",
    "confidential": true,
    "reviewDate": "2026-03-21"
  }'
```

#### 6. **Note Actions** (Quick Workflows)

Server-side operations for efficient note management:

**API Endpoint:**
```
POST /api/notes/[id]/actions
```

**Actions:**

**`duplicate`** - Copy note
```bash
curl -X POST https://tomos-task-api.vercel.app/api/notes/{id}/actions \
  -H "Content-Type: application/json" \
  -d '{"action": "duplicate"}'

# Creates copy with:
# - Title: "{original} (Copy)"
# - Status: draft
# - isPinned: false
# - Relations cleared
```

**`archive`** - Archive note
```bash
curl -X POST https://tomos-task-api.vercel.app/api/notes/{id}/actions \
  -H "Content-Type: application/json" \
  -d '{"action": "archive"}'

# Sets:
# - status: "archived"
# - isPinned: false
```

**`unarchive`** - Restore note
```bash
curl -X POST https://tomos-task-api.vercel.app/api/notes/{id}/actions \
  -H "Content-Type: application/json" \
  -d '{"action": "unarchive"}'
```

**`convert-to-task`** - Create task from note
```bash
curl -X POST https://tomos-task-api.vercel.app/api/notes/{id}/actions \
  -H "Content-Type: application/json" \
  -d '{"action": "convert-to-task"}'

# Creates task with:
# - title: note.title
# - description: note.content
# - priority: mapped from note.priority
# - Linked to note via taskId
# - Archives original note
```

**`set-review-date`** - Schedule review
```bash
curl -X POST https://tomos-task-api.vercel.app/api/notes/{id}/actions \
  -H "Content-Type: application/json" \
  -d '{"action": "set-review-date", "days": 60}'

# Sets reviewDate to 60 days from now
```

### API Endpoints (Complete List)

**Notes CRUD:**
```
GET    /api/notes                          # List notes (filter by pinned, tags, links, status, priority)
POST   /api/notes                          # Create note (auto-processes smart links)
GET    /api/notes/[id]                     # Get single note with relations
PATCH  /api/notes/[id]                     # Update note (reprocesses smart links if content changed)
DELETE /api/notes/[id]                     # Delete note
```

**Templates:**
```
GET    /api/notes/templates                # List templates by category
POST   /api/notes/templates?id={templateId}  # Create note from template
```

**Search & Discovery:**
```
GET    /api/notes/search?q={query}&tags={tags}&limit={n}&offset={n}  # Full-text search
GET    /api/notes/[id]/backlinks           # Find notes linking to this note
```

**Actions:**
```
POST   /api/notes/[id]/actions             # Perform action (duplicate, archive, convert-to-task, etc.)
```

### Integration with TomOS Ecosystem

**Smart linking enables:**
- Notes referencing tasks: `@task-name`
- Notes referencing matters: `#matter-number`
- Notes referencing projects: `&project-name`
- Notes referencing other notes: `[[note-title]]`

**Use cases:**
- **Tasks:** Implementation notes, decision rationale, research backing
- **Matters:** General notes (separate from formal MatterNotes for court filings)
- **Projects:** Brainstorming, meeting notes, project documentation
- **Notes:** Wiki-style knowledge graph with bidirectional linking

All relations use soft deletes (SetNull) to preserve notes when linked entities are removed.

### Next Steps (Notes)

**Phase 2: Client Integration**
- iOS/macOS NotesListView with search and filters
- NoteDetailView with Markdown rendering

**Phase 3: AI Features**
- AI-powered note summarization
- Automatic tagging suggestions

---

## Journal / Companion Feature

**Status:** ✅ **COMPLETE** (February 24, 2026)
**Architecture:** Reflective journaling with AI companion, mood tracking, and insights
**Web App:** https://tomos-journal.vercel.app
**Prompt System:** `lib/journalPrompt.ts` — Three-layer architecture (base + dynamic context + session state)

### What is the Journal Feature?

A personal journaling system with an AI companion that provides thoughtful reflections and insights. Adapted from the standalone "Journal Buddy" app's prompt design but rebuilt as part of the TomOS ecosystem. The companion is curious (not solution-finding), uses dry humor, keeps responses concise, and avoids therapy-speak.

### Database Schema

**4 New Tables (February 23, 2026):**

- `journal_entries` — Core journal entries
  - Fields: title, content, excerpt, mood (great/good/okay/low/rough), energy (high/medium/low), themes (String[]), reflection (AI-generated), wordCount, entryDate
  - Indexes: entryDate, mood, full-text search GIN index on title+content

- `journal_conversations` — Chat conversations with companion
  - Fields: title, mode (free_form/guided/reflection), entryId (optional link to entry)
  - Relation: belongs to JournalEntry (optional)

- `journal_messages` — Individual chat messages
  - Fields: role (user/assistant/system), content
  - Relation: belongs to JournalConversation

- `journal_summaries` — Weekly/monthly AI-generated summaries
  - Fields: type (weekly/monthly), periodStart, periodEnd, content, themes, moodPattern, insights

### API Endpoints

**Entries:**
```
GET    /api/journal/entries              # List entries (filter by mood, date range, pagination)
POST   /api/journal/entries              # Create entry (auto-extracts themes via Claude Haiku)
GET    /api/journal/entries/[id]         # Get entry with conversations
PATCH  /api/journal/entries/[id]         # Update entry
DELETE /api/journal/entries/[id]         # Delete entry
POST   /api/journal/entries/[id]/reflect # Generate AI reflection (Claude Sonnet)
```

**Chat:**
```
GET    /api/journal/chat                 # List conversations or get specific conversation
POST   /api/journal/chat                 # Send message (creates conversation if new)
```

**Insights & Search:**
```
GET    /api/journal/insights             # Stats, mood distribution, top themes, mood timeline
GET    /api/journal/search?q=...&mood=...  # Full-text search with GIN index
```

**Summaries:**
```
GET    /api/journal/summary              # List existing summaries
POST   /api/journal/summary              # Generate weekly/monthly summary (Claude Sonnet)
```

### AI Integration

- **Theme Extraction:** Fire-and-forget on entry creation using Claude Haiku (fast, cheap)
- **Reflections:** Claude Sonnet with recent entries context and weekly themes
- **Chat:** Full three-layer prompt system (base personality + dynamic journal context + session state)
- **Summaries:** Claude Sonnet with period's entries for pattern analysis

### Prompt System (`lib/journalPrompt.ts`)

Three-layer architecture adapted from Journal Buddy:
1. **Base Prompt** — Personality, tone, behavioral guidelines (curious, concise, dry humor, one thread)
2. **Dynamic Context** — Built from recent entries, current mood patterns, active themes
3. **Session State** — Conversation history, current entry context

Exports: `JOURNAL_BASE_PROMPT`, `REFLECTION_PROMPT`, `WEEKLY_SUMMARY_PROMPT`, `buildDynamicContext()`

---

## Current Status (Updated 2026-02-27)

### Completed
- iOS/macOS push notifications working (both devices registered)
- **General Notes feature** — Full CRUD API with search and ecosystem integration
- **Journal / Companion feature** — Entries, AI reflections, chat, insights, search, summaries
- **FitnessOS** — Gym sessions, progressive overload, Strava sync, recovery check-ins
- **TomOS Web Apps** — 5 Next.js PWAs in monorepo at `/Users/tombragg/Desktop/Projects/tomos-web/`
  - Tasks: https://tomos-tasks.vercel.app
  - Notes: https://tomos-notes.vercel.app
  - Matters: https://tomos-matters.vercel.app
  - Journal: https://tomos-journal.vercel.app
  - Fitness: https://tomos-fitness.vercel.app
- Swift/Xcode apps deprecated — PWAs are the canonical frontend
- ntfy fully deprecated — all notifications via APNs
- NLP task capture with smart date parsing (Sydney timezone)
- 15-minute reminder notifications via APNs
- Batch task import with AI parsing
- Google Calendar sync (optional)
- Automatic device deactivation on APNs 410 errors
- **Gym suggestion cron** — Scheduled via GitHub Actions at 6:30am Sydney
- **Legal deadlines cron** — Scheduled via Vercel at 6am Sydney
- **Phase 2 (2026-02-26):** Subtasks (parentId self-relation), smart linking expanded, work MBP docs

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
│   ├── matters/             # MatterOS - Legal matter management
│   │   └── [id]/
│   │       ├── documents/   # Matter documents
│   │       ├── events/      # Matter activity timeline
│   │       └── notes/       # Matter notes and research
│   ├── notes/               # General Notes feature
│   │   ├── search/          # Full-text search
│   │   ├── templates/       # Note templates
│   │   └── [id]/
│   │       ├── actions/     # Note actions (archive, duplicate, etc.)
│   │       └── backlinks/   # Reverse reference tracking
│   ├── journal/             # Journal / Companion feature ⚡ NEW
│   │   ├── entries/         # CRUD for journal entries
│   │   │   └── [id]/
│   │   │       └── reflect/ # AI reflection generation
│   │   ├── chat/            # Companion chat conversations
│   │   ├── insights/        # Stats, mood patterns, theme trends
│   │   ├── search/          # Full-text search with GIN index
│   │   └── summary/         # Weekly/monthly AI summaries
│   ├── calendar/            # Google Calendar sync
│   ├── email/               # Email-to-task processing
│   ├── focus/               # Focus mode state
│   ├── notifications/       # Morning/EOD summaries
│   ├── suggestions/         # AI task suggestions
│   ├── health/              # Health check
│   └── cron/                # Scheduled jobs
├── lib/
│   └── journalPrompt.ts     # Three-layer prompt system for companion ⚡ NEW
├── prisma/
│   ├── schema.prisma        # Database schema (Tasks + MatterOS + Notes + Journal)
│   └── migrations/          # Migration history
├── types/
│   └── matteros.ts          # MatterOS TypeScript types
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


## Cron Jobs

| Job | Trigger | Schedule | Purpose |
|-----|---------|----------|---------|
| `gym-suggestion` | GitHub Actions (`scheduled-notifications.yml`) | 6:30am Sydney (19:30 UTC) | Morning push with session type + suggested weights |
| `legal-deadlines` | Vercel Cron (`vercel.json`) | 6am Sydney (19:00 UTC prev day) | Scans active matters for overdue/upcoming deadlines, legal-tagged tasks, stale matters (90d) |

Both endpoints also accept manual `POST` triggers for testing.

---

*Last updated: 2026-02-27*

## Email Inbound Route

**Endpoint:** `POST /api/email/inbound`
**Integration:** Resend inbound webhook

Routing logic (checked in order):
1. Subject starts with `[MATTER]` or `MATTER:` → creates new matter via Prisma (type: advisory, status: active, client extracted from body)
2. Subject contains `#PUB-XXXX` pattern → adds note to existing matter + bumps `lastActivityAt`
3. Fallback → NLP task creation via `/api/task` (existing behaviour, Claude-parsed)

Returns: `{ success, route: "new_matter"|"matter_note"|"task", ... }`

To wire up: configure Resend inbound forwarding webhook → `https://tomos-task-api.vercel.app/api/email/inbound`

## Deployment

**IMPORTANT: iCloud Drive "Optimize Mac Storage" evicts project files, breaking git and Vercel CLI.**

Workaround — clone to `/tmp` and deploy from there:
```bash
cd /tmp && git clone git@github.com:braggy9/TomOS.git tomos-fresh
# Copy changed files in, then:
cd /tmp/tomos-fresh && git add . && git commit -m "..." && git push
# Link to existing project (NOT new one) before deploying:
vercel link --project tomos-task-api --yes && vercel --prod --yes
```

Permanent fix: right-click `~/Desktop/Projects` in Finder → **Keep Downloaded**

SSH key: `~/.ssh/id_ed25519` — load with `ssh-add ~/.ssh/id_ed25519` if git push fails.

*Last updated: 2026-03-02*
