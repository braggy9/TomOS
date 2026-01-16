# Session 3: Data Migration from Notion to Postgres

**Duration:** 1-2 hours (+ 24-48h parallel testing)  
**Goal:** Export data from Notion, import to Postgres, verify integrity  
**Prerequisites:** Sessions 1 & 2 complete, **Notion workspace backed up**

---

## ⚠️ CRITICAL WARNING

**BEFORE STARTING:**
1. **Back up your Notion workspace** (Settings → Export → Everything)
2. **Save `notion-export.json`** to safe location
3. **Do NOT delete Notion data** until after Session 4
4. **Wait 24-48 hours** between this session and Session 4

**This session exports your data from Notion and imports it into Postgres. The old Notion database stays intact as a backup until Session 4.**

---

## 📋 Overview

In this session, you'll:
1. Export all data from Notion (Tasks, Projects, Tags)
2. Transform Notion format → Postgres format
3. Import data into Postgres
4. Map old Notion IDs → new Postgres UUIDs
5. Verify data integrity
6. Create backup
7. Run parallel testing (24-48 hours)
8. Commit changes

**Claude Code Prompt:**
```
I'm starting Session 3 of the TomOS Postgres migration.

Sessions 1 & 2 complete:
✓ Database schema created
✓ API endpoints migrated

CRITICAL: I have backed up my Notion workspace.

Follow SESSION-3.md exactly. Start with Phase 1.
```

---

## Phase 1: Export Data from Notion (30 minutes)

### Step 1.1: Create Export Script

Create `scripts/export-notion-data.ts`:

```typescript
import { Client } from '@notionhq/client'
import * as fs from 'fs'

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
})

const TASKS_DB_ID = process.env.NOTION_TASKS_DB_ID!
const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID!
const TAGS_DB_ID = process.env.NOTION_TAGS_DB_ID!

interface NotionExport {
  projects: any[]
  tasks: any[]
  tags: any[]
  exportedAt: string
}

async function exportNotionData() {
  console.log('📤 Exporting data from Notion...\n')

  try {
    const exportData: NotionExport = {
      projects: [],
      tasks: [],
      tags: [],
      exportedAt: new Date().toISOString(),
    }

    // Export Projects
    console.log('Exporting projects...')
    let hasMore = true
    let startCursor: string | undefined = undefined

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: PROJECTS_DB_ID,
        start_cursor: startCursor,
      })

      exportData.projects.push(...response.results)
      hasMore = response.has_more
      startCursor = response.next_cursor || undefined

      console.log(`  Fetched ${response.results.length} projects...`)
    }

    // Export Tags
    console.log('\nExporting tags...')
    hasMore = true
    startCursor = undefined

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: TAGS_DB_ID,
        start_cursor: startCursor,
      })

      exportData.tags.push(...response.results)
      hasMore = response.has_more
      startCursor = response.next_cursor || undefined

      console.log(`  Fetched ${response.results.length} tags...`)
    }

    // Export Tasks
    console.log('\nExporting tasks...')
    hasMore = true
    startCursor = undefined

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: TASKS_DB_ID,
        start_cursor: startCursor,
      })

      exportData.tasks.push(...response.results)
      hasMore = response.has_more
      startCursor = response.next_cursor || undefined

      console.log(`  Fetched ${response.results.length} tasks...`)
    }

    // Save to file
    const filename = 'notion-export.json'
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2))

    console.log('\n✅ Export complete!')
    console.log(`  Projects: ${exportData.projects.length}`)
    console.log(`  Tasks: ${exportData.tasks.length}`)
    console.log(`  Tags: ${exportData.tags.length}`)
    console.log(`  Saved to: ${filename}`)
  } catch (error) {
    console.error('❌ Export failed:', error)
    process.exit(1)
  }
}

exportNotionData()
```

### Step 1.2: Run Export

```bash
npx ts-node scripts/export-notion-data.ts
```

**Expected output:**
```
📤 Exporting data from Notion...

Exporting projects...
  Fetched 10 projects...

Exporting tags...
  Fetched 25 tags...

Exporting tasks...
  Fetched 150 tasks...

✅ Export complete!
  Projects: 10
  Tasks: 150
  Tags: 25
  Saved to: notion-export.json
```

**Checkpoint:** ✅ `notion-export.json` created with all data

---

## Phase 2: Import Data to Postgres (45 minutes)

### Step 2.1: Create Import Script

Create `scripts/import-postgres-data.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

interface NotionExport {
  projects: any[]
  tasks: any[]
  tags: any[]
}

interface IDMapping {
  projects: Record<string, string> // notionId → postgresId
  tasks: Record<string, string>
  tags: Record<string, string>
}

// Helper: Extract text from Notion rich text
function extractText(richText: any[]): string {
  if (!richText || richText.length === 0) return ''
  return richText.map((rt: any) => rt.plain_text).join('')
}

// Helper: Extract select value
function extractSelect(select: any): string {
  return select?.name || ''
}

// Helper: Extract multi-select values
function extractMultiSelect(multiSelect: any[]): string[] {
  if (!multiSelect) return []
  return multiSelect.map((ms: any) => ms.name)
}

// Helper: Extract relation IDs
function extractRelations(relations: any[]): string[] {
  if (!relations) return []
  return relations.map((rel: any) => rel.id)
}

// Helper: Extract date
function extractDate(date: any): Date | null {
  if (!date || !date.start) return null
  return new Date(date.start)
}

async function importToPostgres() {
  console.log('📥 Importing data to Postgres...\n')

  try {
    // Load export
    const exportData: NotionExport = JSON.parse(
      fs.readFileSync('notion-export.json', 'utf-8')
    )

    const idMapping: IDMapping = {
      projects: {},
      tasks: {},
      tags: {},
    }

    // Step 1: Import Projects
    console.log('Importing projects...')
    for (const notionProject of exportData.projects) {
      const props = notionProject.properties

      const project = await prisma.project.create({
        data: {
          title: extractText(props.Title?.title || props.Name?.title),
          description: extractText(props.Description?.rich_text),
          color: props.Color?.select?.color || null,
          icon: extractText(props.Icon?.rich_text) || null,
          status: extractSelect(props.Status) || 'active',
          createdAt: new Date(notionProject.created_time),
        }
      })

      idMapping.projects[notionProject.id] = project.id
      console.log(`  ✓ ${project.title}`)
    }

    // Step 2: Import Tags
    console.log('\nImporting tags...')
    for (const notionTag of exportData.tags) {
      const props = notionTag.properties

      const tag = await prisma.tag.create({
        data: {
          name: extractText(props.Name?.title),
          color: props.Color?.select?.color || null,
          createdAt: new Date(notionTag.created_time),
        }
      })

      idMapping.tags[notionTag.id] = tag.id
      console.log(`  ✓ ${tag.name}`)
    }

    // Step 3: Import Tasks
    console.log('\nImporting tasks...')
    for (const notionTask of exportData.tasks) {
      const props = notionTask.properties

      // Map project ID
      const notionProjectIds = extractRelations(props.Project?.relation)
      const postgresProjectId = notionProjectIds[0]
        ? idMapping.projects[notionProjectIds[0]]
        : null

      const task = await prisma.task.create({
        data: {
          title: extractText(props.Title?.title || props.Name?.title),
          description: extractText(props.Description?.rich_text),
          status: extractSelect(props.Status) || 'todo',
          priority: extractSelect(props.Priority) || 'medium',
          dueDate: extractDate(props['Due Date']?.date),
          completedAt: extractDate(props['Completed At']?.date),
          projectId: postgresProjectId,
          createdAt: new Date(notionTask.created_time),
        }
      })

      idMapping.tasks[notionTask.id] = task.id

      // Map tags
      const notionTagNames = extractMultiSelect(props.Tags?.multi_select)
      for (const tagName of notionTagNames) {
        // Find tag by name (since we created them)
        const tag = await prisma.tag.findFirst({
          where: { name: tagName }
        })

        if (tag) {
          await prisma.taskTag.create({
            data: {
              taskId: task.id,
              tagId: tag.id,
            }
          })
        }
      }

      console.log(`  ✓ ${task.title}`)
    }

    // Save ID mappings
    fs.writeFileSync(
      'id-mappings.json',
      JSON.stringify(idMapping, null, 2)
    )

    console.log('\n✅ Import complete!')
    console.log(`  Projects: ${exportData.projects.length}`)
    console.log(`  Tasks: ${exportData.tasks.length}`)
    console.log(`  Tags: ${exportData.tags.length}`)
    console.log(`  ID mappings saved to: id-mappings.json`)
  } catch (error) {
    console.error('❌ Import failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

importToPostgres()
```

### Step 2.2: Run Import

```bash
npx ts-node scripts/import-postgres-data.ts
```

**Expected output:**
```
📥 Importing data to Postgres...

Importing projects...
  ✓ Work
  ✓ Personal
  ...

Importing tags...
  ✓ urgent
  ✓ backend
  ...

Importing tasks...
  ✓ Fix bug in API
  ✓ Review PR
  ...

✅ Import complete!
  Projects: 10
  Tasks: 150
  Tags: 25
  ID mappings saved to: id-mappings.json
```

**Checkpoint:** ✅ Data imported to Postgres, `id-mappings.json` created

---

## Phase 3: Verify Data Integrity (15 minutes)

### Step 3.1: Create Verification Script

Create `scripts/verify-migration.ts`:

```typescript
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

interface NotionExport {
  projects: any[]
  tasks: any[]
  tags: any[]
}

async function verifyMigration() {
  console.log('🔍 Verifying migration...\n')

  try {
    const exportData: NotionExport = JSON.parse(
      fs.readFileSync('notion-export.json', 'utf-8')
    )

    // Count records
    const projectCount = await prisma.project.count()
    const taskCount = await prisma.task.count()
    const tagCount = await prisma.tag.count()

    console.log('Record counts:')
    console.log(`  Notion Projects: ${exportData.projects.length}`)
    console.log(`  Postgres Projects: ${projectCount}`)
    console.log(`  Match: ${exportData.projects.length === projectCount ? '✓' : '✗'}`)

    console.log(`\n  Notion Tasks: ${exportData.tasks.length}`)
    console.log(`  Postgres Tasks: ${taskCount}`)
    console.log(`  Match: ${exportData.tasks.length === taskCount ? '✓' : '✗'}`)

    console.log(`\n  Notion Tags: ${exportData.tags.length}`)
    console.log(`  Postgres Tags: ${tagCount}`)
    console.log(`  Match: ${exportData.tags.length === tagCount ? '✓' : '✗'}`)

    // Check relations
    console.log('\nChecking relations:')
    const tasksWithProject = await prisma.task.count({
      where: {
        projectId: { not: null }
      }
    })
    console.log(`  Tasks with project: ${tasksWithProject}`)

    const tasksWithTags = await prisma.taskTag.count()
    console.log(`  Task-tag links: ${tasksWithTags}`)

    // Sample data check
    console.log('\nSample data:')
    const sampleTask = await prisma.task.findFirst({
      include: {
        project: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    })

    if (sampleTask) {
      console.log(`  Task: ${sampleTask.title}`)
      console.log(`  Project: ${sampleTask.project?.title || 'None'}`)
      console.log(`  Tags: ${sampleTask.tags.map(tt => tt.tag.name).join(', ') || 'None'}`)
    }

    const allMatch =
      exportData.projects.length === projectCount &&
      exportData.tasks.length === taskCount &&
      exportData.tags.length === tagCount

    if (allMatch) {
      console.log('\n✅ MIGRATION VERIFIED - All counts match!')
    } else {
      console.log('\n⚠️ WARNING: Count mismatch detected!')
      console.log('Review the data and consider re-importing.')
    }
  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyMigration()
```

### Step 3.2: Run Verification

```bash
npx ts-node scripts/verify-migration.ts
```

**Expected output:**
```
🔍 Verifying migration...

Record counts:
  Notion Projects: 10
  Postgres Projects: 10
  Match: ✓

  Notion Tasks: 150
  Postgres Tasks: 150
  Match: ✓

  Notion Tags: 25
  Postgres Tags: 25
  Match: ✓

Checking relations:
  Tasks with project: 120
  Task-tag links: 275

Sample data:
  Task: Fix bug in API
  Project: Work
  Tags: urgent, backend

✅ MIGRATION VERIFIED - All counts match!
```

**If counts don't match:**
1. Check `import-postgres-data.ts` for errors
2. Review Notion property names (Title vs Name)
3. Consider re-importing: `npx prisma migrate reset` (DEV ONLY)

**Checkpoint:** ✅ Data verified, counts match

---

## Phase 4: Create Backup (5 minutes)

```bash
# Backup Postgres
pg_dump $DATABASE_URL > tomos-backup-$(date +%Y%m%d).sql

# Backup Notion export (copy to safe location)
cp notion-export.json ~/Documents/Backups/notion-export-$(date +%Y%m%d).json
cp id-mappings.json ~/Documents/Backups/id-mappings-$(date +%Y%m%d).json
```

**Checkpoint:** ✅ Backups created

---

## Phase 5: Commit Changes (5 minutes)

```bash
git add scripts/export-notion-data.ts
git add scripts/import-postgres-data.ts
git add scripts/verify-migration.ts
git commit -m "feat: add data migration scripts"
git push
```

**DO NOT COMMIT:**
- `notion-export.json` (contains sensitive data)
- `id-mappings.json` (large, not needed in repo)
- Backup files

**Checkpoint:** ✅ Changes committed

---

## Phase 6: Parallel Testing (24-48 hours)

**This is the SAFETY NET before fully committing to Postgres.**

### What to Test

**iOS App:**
1. Dashboard loads correctly
2. Tasks display with projects and tags
3. Create new task
4. Update task status
5. Delete task
6. Filter tasks by project
7. Search tasks

**Performance:**
1. Dashboard load time (<200ms?)
2. Task creation (<100ms?)
3. Search response time

**Data Integrity:**
1. All tasks present
2. Projects linked correctly
3. Tags linked correctly
4. Due dates correct
5. Completed tasks marked correctly

### How to Test

**Option A: Point iOS app at Postgres API**
Update your iOS app's API URL to use the new Postgres endpoints.

**Option B: Run both in parallel**
Keep Notion API running, add a flag to switch between them.

### If Issues Found

1. **DO NOT proceed to Session 4**
2. Document the issue
3. Fix the problem (may require re-import)
4. Re-verify data
5. Test again

### When Ready for Session 4

- [ ] Tested for 24-48 hours
- [ ] No issues found
- [ ] Performance meets expectations
- [ ] Confident in data integrity

**ONLY THEN proceed to Session 4.**

---

## ✅ Session 3 Complete!

### What You Accomplished

- ✅ Exported all data from Notion
- ✅ Imported data to Postgres
- ✅ Mapped old IDs to new UUIDs
- ✅ Verified data integrity (counts match)
- ✅ Created backups
- ✅ Started parallel testing

### What You Now Have

- **Postgres:** Full copy of TomOS data with proper relations
- **Notion:** Original data still intact (safety net)
- **Backups:** `notion-export.json`, `tomos-backup.sql`, `id-mappings.json`
- **API:** Works with both Notion (commented out) and Postgres

### Critical Next Steps

**DO NOT skip to Session 4!**

1. **Test thoroughly** for 24-48 hours
2. **Monitor for issues** in iOS app
3. **Verify data** regularly during testing
4. **Keep Notion active** as backup

**Only proceed to Session 4 when:**
- No issues found for 24-48 hours
- Performance meets expectations
- 100% confident in data integrity

---

## 🐛 Troubleshooting

**"Import failed halfway through"**
```bash
# Reset database (DEV ONLY)
npx prisma migrate reset

# Re-import
npx ts-node scripts/import-postgres-data.ts
```

**"Count mismatch after import"**
- Check Notion property names match script expectations
- Verify no duplicate records
- Check for errors in import script output

**"Tags not linking to tasks"**
- Tags are matched by name, ensure names are exact
- Check for case sensitivity issues
- Verify tags were created before task-tag links

**"iOS app shows old data"**
- Clear app cache
- Check API URL is pointing to new endpoints
- Verify endpoints return Postgres data

---

## 📚 Files Created

- `notion-export.json` — Notion data backup
- `id-mappings.json` — Old ID → New ID map
- `tomos-backup.sql` — Postgres backup
- `scripts/export-notion-data.ts` — Export script
- `scripts/import-postgres-data.ts` — Import script
- `scripts/verify-migration.ts` — Verification script

---

**After 24-48 hours of successful testing, proceed to Session 4!** 🎉

*Session 3 Guide v1.0 • January 15, 2026*
