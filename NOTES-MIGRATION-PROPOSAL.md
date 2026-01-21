# Notes Feature - Migration Proposal

**Date:** 2026-01-21
**Status:** Awaiting user input

---

## 📋 Current Situation

### What's Migrated to PostgreSQL ✅
- **Tasks** - Fully migrated, working perfectly
- **Projects** - In PostgreSQL schema
- **Tags** - Full tagging system
- **MatterOS** - Legal matter management with matter-specific notes

### What's Still in Notion ⚠️
- **Device Tokens** - APNs registration (staying in Notion - working fine)
- **General Notes** - Unknown if user has any to migrate

### What's Missing ❌
- **General-purpose note-taking** - No standalone notes feature in TomOS
- Current workaround: Use task descriptions (not ideal for long notes)

---

## 🎯 Proposed Solution

Add a full-featured **Notes** system to PostgreSQL with iOS/macOS integration.

### Database Schema

```prisma
model Note {
  id        String   @id @default(uuid())

  // Content
  title     String
  content   String   @db.Text  // Markdown
  excerpt   String?  // First 200 chars for previews

  // Organization
  tags      String[]
  isPinned  Boolean  @default(false)

  // Optional Relations
  projectId String?
  matterId  String?

  // Metadata
  author    String?  // For future multi-user
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  project   Project? @relation(fields: [projectId], references: [id])
  matter    Matter?  @relation(fields: [matterId], references: [id])

  @@map("notes")
  @@index([isPinned])
  @@index([createdAt])
  @@index([projectId])
  @@index([matterId])
}
```

### Features

#### Core Features (Phase 1)
- ✅ Create/Read/Update/Delete notes
- ✅ Markdown formatting
- ✅ Tag notes (reuse existing tag system)
- ✅ Pin important notes to top
- ✅ Search notes by title and content
- ✅ Filter by tags
- ✅ Sort by date, title, or update time

#### Advanced Features (Phase 2 - Future)
- 📎 Attachments/file uploads
- 🔗 Bidirectional linking (mention other notes)
- 📁 Folders/notebooks
- 🔄 Version history
- 🎨 Syntax highlighting for code blocks
- 🖼️ Image embedding
- ☑️ Todo lists within notes

---

## 🛠️ Implementation Steps

### Phase 1: Backend (1-2 hours)

**1. Database Migration (15 mins)**
```bash
# Add Note model to schema.prisma
# Run: npx prisma migrate dev --name add_notes
# Generate Prisma Client
```

**2. API Endpoints (30 mins)**
```
POST   /api/notes              # Create note
GET    /api/notes              # List notes (with filters)
GET    /api/notes/[id]         # Get single note
PATCH  /api/notes/[id]         # Update note
DELETE /api/notes/[id]         # Delete note
GET    /api/notes/search?q=    # Search notes
```

**3. Search Implementation (15 mins)**
```sql
-- PostgreSQL full-text search
SELECT * FROM notes
WHERE to_tsvector('english', title || ' ' || content)
@@ plainto_tsquery('english', 'search term');
```

### Phase 2: iOS/macOS App (2-3 hours)

**1. Notes Tab**
- Add new tab to ContentView
- Icon: 📝 "note.text"

**2. Notes List View**
- List of all notes
- Pull-to-refresh
- Search bar
- Filter by tag
- Sort options

**3. Note Detail/Edit View**
- Markdown editor
- Tag picker
- Link to projects/matters
- Pin/unpin button

**4. Create Note View**
- Quick capture from anywhere
- Template support

### Phase 3: Migration from Notion (If Needed)

**If user has existing Notion notes:**

1. Export Notion database to CSV/JSON
2. Parse and import to PostgreSQL
3. Preserve:
   - Title, content, tags
   - Created/updated dates
   - Any links to tasks

---

## 📊 API Examples

### Create Note
```bash
POST /api/notes
{
  "title": "Meeting Notes - 2026-01-21",
  "content": "# Discussion Points\n\n- Project timeline\n- Budget approval\n- Next steps",
  "tags": ["meeting", "work"],
  "isPinned": false
}
```

### Link Note to Project
```bash
PATCH /api/notes/uuid
{
  "projectId": "project-uuid"
}
```

### Search Notes
```bash
GET /api/notes/search?q=budget&tags=work,meeting
```

### Get All Pinned Notes
```bash
GET /api/notes?pinned=true
```

---

## 🎨 iOS App UI Mockup

```
┌─────────────────────────────────┐
│ Notes                    [+]    │
├─────────────────────────────────┤
│ [Search notes...]               │
├─────────────────────────────────┤
│ 📌 PINNED                       │
│ • Important Reminder            │
│ • Weekly Goals                  │
├─────────────────────────────────┤
│ 📝 RECENT                       │
│ • Meeting Notes - Jan 21        │
│   "Discussion Points..."        │
│   3 mins ago                    │
│                                 │
│ • Project Ideas                 │
│   "New feature concepts..."     │
│   2 hours ago                   │
│                                 │
│ • Research: Legal Automation    │
│   "LegalOS integration..."      │
│   Yesterday                     │
└─────────────────────────────────┘
```

---

## 🔄 Migration Path from Notion

### Option A: Full Migration
1. Export ALL Notion notes
2. Import to PostgreSQL
3. Decommission Notion for notes
4. Keep only Device Tokens in Notion

### Option B: Partial Migration
1. Export selected important notes
2. Import to PostgreSQL
3. Keep Notion for archive
4. Use TomOS for new notes going forward

### Option C: Fresh Start
1. Start with empty Notes in TomOS
2. Manually migrate key notes as needed
3. Keep Notion as archive

---

## 💰 Benefits

### Why Add Notes to TomOS?

1. **Unified System**
   - Tasks, notes, legal matters all in one place
   - No context switching between apps
   - Cross-linking between notes and tasks

2. **Better Performance**
   - PostgreSQL is faster than Notion API
   - Offline support (once implemented)
   - No rate limits

3. **More Control**
   - Own your data
   - Custom features
   - Privacy (self-hosted DB)

4. **ADHD-Friendly**
   - Quick capture
   - Pin important notes
   - Tag-based organization
   - Link to tasks/projects

---

## ❓ Questions for User

Before starting implementation:

1. **Do you currently use Notion for general note-taking?**
   - If yes: How many notes approximately?
   - What types of notes? (meeting notes, ideas, research, etc.)

2. **What other note-taking apps do you use?**
   - Apple Notes?
   - Bear?
   - Obsidian?
   - None (just want the feature)?

3. **Priority features?**
   - Must have: Markdown? Search? Tags?
   - Nice to have: Attachments? Folders? Linking?

4. **Migration preference?**
   - Import existing notes from Notion?
   - Start fresh?
   - Partial import?

5. **When do you want this?**
   - Now (today)?
   - This week?
   - Later (just planning)?

---

## 🚀 Quick Start Option

**If you want to start TODAY:**

I can implement Phase 1 (backend) in the next hour:
1. Add Notes table to PostgreSQL (15 mins)
2. Create CRUD API endpoints (30 mins)
3. Add search functionality (15 mins)
4. Test with curl commands (10 mins)

Then you can:
- Test via API immediately
- iOS app integration can follow later
- Migration from Notion can be separate task

---

## 📝 Decision Points

Mark your preferences:

```
[ ] Option 1: Full implementation (backend + iOS app) - 3-4 hours
[ ] Option 2: Backend only first, app later - 1 hour
[ ] Option 3: Just planning for now, implement later

Migration:
[ ] Yes, migrate from Notion
[ ] No, start fresh
[ ] Partial (I'll tell you which notes)

Timeline:
[ ] Start now
[ ] This week
[ ] Later
```

---

**Next Steps:**
1. User provides answers to questions above
2. I implement based on preferences
3. Test and verify
4. Document new Notes feature

---

**File:** `/Users/tombragg/Desktop/Projects/TomOS/NOTES-MIGRATION-PROPOSAL.md`
**Status:** Ready for user decision
