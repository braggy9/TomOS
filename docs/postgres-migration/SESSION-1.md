# Session 1: Database Setup & Schema Design

**Duration:** 2-3 hours  
**Goal:** Set up Prisma, define schema, create migrations, test connection  
**Prerequisites:** Database provider set up (Vercel Postgres or Supabase), connection string ready

---

## 📋 Overview

In this session, you'll:
1. Install Prisma ORM
2. Configure database connection
3. Define TomOS schema (Tasks, Projects, Tags)
4. Create first migration
5. Test database connection
6. Commit changes

**Claude Code Prompt:**
```
I'm starting Session 1 of the TomOS Postgres migration.

I have:
- Database provider: [Vercel Postgres / Supabase]
- Database connection string: [paste here]
- Direct connection string (for migrations): [paste here if different]

Follow SESSION-1.md exactly. Start with Phase 1.
```

---

## Phase 1: Install Prisma (10 minutes)

### Step 1.1: Install Prisma Dependencies

```bash
npm install prisma --save-dev
npm install @prisma/client
```

### Step 1.2: Initialize Prisma

```bash
npx prisma init
```

This creates:
- `prisma/` directory
- `prisma/schema.prisma` file
- `.env` file (if it doesn't exist)

### Step 1.3: Verify Installation

```bash
npx prisma --version
```

Should output Prisma version (e.g., `5.x.x`)

**Checkpoint:** ✅ Prisma installed, `prisma/schema.prisma` exists

---

## Phase 2: Configure Database Connection (5 minutes)

### Step 2.1: Add Connection String to `.env`

Open `.env` and update:

```env
# Vercel Postgres
DATABASE_URL="postgres://[user]:[password]@[host]/[database]?sslmode=require&pgbouncer=true"
POSTGRES_URL_NON_POOLING="postgres://[user]:[password]@[host]/[database]?sslmode=require"

# OR Supabase
DATABASE_URL="postgresql://[user]:[password]@[host]:[port]/[database]"
```

**IMPORTANT:** 
- Use `DATABASE_URL` (pooled) for queries
- Use `POSTGRES_URL_NON_POOLING` (direct) for migrations

### Step 2.2: Update `prisma/schema.prisma` Generator

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("POSTGRES_URL_NON_POOLING") // For migrations
}
```

**Checkpoint:** ✅ Connection strings in `.env`, schema configured

---

## Phase 3: Define Schema (60 minutes)

### Step 3.1: Design Decisions

**Tables to create:**
1. **Task** — Core entity (title, status, priority, dates, etc.)
2. **Project** — Groups tasks
3. **Tag** — Categorizes tasks
4. **TaskTag** — Many-to-many relation (Task ↔ Tag)

**Relations:**
- Task → Project (many-to-one)
- Task ↔ Tag (many-to-many via TaskTag)

### Step 3.2: Define Schema

Replace contents of `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("POSTGRES_URL_NON_POOLING")
}

// ============================================
// PROJECTS
// ============================================
model Project {
  id          String   @id @default(uuid())
  title       String
  description String?
  color       String?  // Hex color
  icon        String?  // Emoji or icon name
  status      String   @default("active") // active, archived, completed
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  tasks Task[]

  @@map("projects")
}

// ============================================
// TASKS
// ============================================
model Task {
  id          String    @id @default(uuid())
  title       String
  description String?
  status      String    @default("todo") // todo, in_progress, done, blocked
  priority    String    @default("medium") // low, medium, high, urgent
  dueDate     DateTime?
  completedAt DateTime?
  projectId   String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Relations
  project Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  tags    TaskTag[]

  @@map("tasks")
  @@index([status])
  @@index([priority])
  @@index([projectId])
  @@index([dueDate])
}

// ============================================
// TAGS
// ============================================
model Tag {
  id        String   @id @default(uuid())
  name      String   @unique
  color     String?  // Hex color
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  tasks TaskTag[]

  @@map("tags")
}

// ============================================
// TASK-TAG JUNCTION (Many-to-Many)
// ============================================
model TaskTag {
  taskId String
  tagId  String

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  tag  Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([taskId, tagId])
  @@map("task_tags")
}
```

### Step 3.3: Review Schema Features

**UUIDs as Primary Keys:**
- Future-proof (no collisions across systems)
- Needed for NexusOS multi-system integration

**Indexes:**
- Fast queries on `status`, `priority`, `projectId`, `dueDate`
- Critical for dashboard performance

**Cascading Deletes:**
- Delete Task → Delete TaskTag entries
- Delete Project → Set Task.projectId to NULL (preserve tasks)

**Timestamps:**
- `createdAt` — Set once on creation
- `updatedAt` — Auto-updated on every change

**Checkpoint:** ✅ Schema defined in `prisma/schema.prisma`

---

## Phase 4: Create Migration (15 minutes)

### Step 4.1: Generate Migration

```bash
npx prisma migrate dev --name init
```

This will:
1. Validate your schema
2. Generate SQL migration file
3. Apply migration to database
4. Generate Prisma Client

**Output:**
```
✔ Generated Prisma Client (5.x.x) to ./node_modules/@prisma/client
✔ Your database is now in sync with your schema.
```

### Step 4.2: Review Migration SQL

Open `prisma/migrations/[timestamp]_init/migration.sql`

Should see:
```sql
CREATE TABLE "projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    ...
);

CREATE TABLE "tasks" (
    ...
);

CREATE TABLE "tags" (
    ...
);

CREATE TABLE "task_tags" (
    ...
);

CREATE INDEX ...
```

### Step 4.3: Verify Database

```bash
npx prisma studio
```

This opens a GUI at `http://localhost:5555` where you can see:
- Empty `projects` table ✓
- Empty `tasks` table ✓
- Empty `tags` table ✓
- Empty `task_tags` table ✓

**Checkpoint:** ✅ Migration created and applied, tables exist in database

---

## Phase 5: Test Connection (20 minutes)

### Step 5.1: Create Test Script

Create `scripts/test-db-connection.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})

async function testConnection() {
  try {
    console.log('🔌 Testing Postgres connection...\n')

    // Test 1: Raw query
    console.log('Test 1: Raw query')
    const result = await prisma.$queryRaw`SELECT NOW()`
    console.log('✓ Connected to Postgres')
    console.log('  Server time:', result)

    // Test 2: Create project
    console.log('\nTest 2: Create project')
    const project = await prisma.project.create({
      data: {
        title: 'Test Project',
        description: 'Testing Postgres connection',
        color: '#3b82f6',
        icon: '🧪',
      },
    })
    console.log('✓ Created project:', project.id)

    // Test 3: Create task
    console.log('\nTest 3: Create task')
    const task = await prisma.task.create({
      data: {
        title: 'Test Task',
        description: 'Testing task creation',
        status: 'todo',
        priority: 'high',
        projectId: project.id,
      },
    })
    console.log('✓ Created task:', task.id)

    // Test 4: Query with relation
    console.log('\nTest 4: Query with relation')
    const taskWithProject = await prisma.task.findUnique({
      where: { id: task.id },
      include: { project: true },
    })
    console.log('✓ Loaded task with project:', taskWithProject?.project?.title)

    // Test 5: Create tag and link to task
    console.log('\nTest 5: Create tag and link')
    const tag = await prisma.tag.create({
      data: { name: 'test', color: '#10b981' },
    })
    await prisma.taskTag.create({
      data: {
        taskId: task.id,
        tagId: tag.id,
      },
    })
    console.log('✓ Created tag and linked to task')

    // Test 6: Complex query
    console.log('\nTest 6: Complex query with all relations')
    const tasks = await prisma.task.findMany({
      include: {
        project: true,
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })
    console.log('✓ Loaded', tasks.length, 'tasks with relations')

    // Cleanup
    console.log('\nCleaning up test data...')
    await prisma.taskTag.deleteMany()
    await prisma.task.deleteMany()
    await prisma.tag.deleteMany()
    await prisma.project.deleteMany()
    console.log('✓ Cleanup complete')

    console.log('\n✅ ALL TESTS PASSED\n')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
```

### Step 5.2: Run Test

```bash
npx ts-node scripts/test-db-connection.ts
```

**Expected output:**
```
🔌 Testing Postgres connection...

Test 1: Raw query
✓ Connected to Postgres
  Server time: ...

Test 2: Create project
✓ Created project: abc-123-...

Test 3: Create task
✓ Created task: def-456-...

Test 4: Query with relation
✓ Loaded task with project: Test Project

Test 5: Create tag and link
✓ Created tag and linked to task

Test 6: Complex query with all relations
✓ Loaded 1 tasks with relations

Cleaning up test data...
✓ Cleanup complete

✅ ALL TESTS PASSED
```

**If tests fail:**
- Check `DATABASE_URL` in `.env`
- Check database is running
- Check firewall/IP whitelist
- Try direct URL: `POSTGRES_URL_NON_POOLING`

**Checkpoint:** ✅ All tests pass, connection verified

---

## Phase 6: Commit Changes (10 minutes)

### Step 6.1: Add `.env` to `.gitignore`

Ensure `.gitignore` contains:
```
.env
.env.local
```

### Step 6.2: Commit

```bash
git add prisma/
git add scripts/test-db-connection.ts
git add package.json
git add package-lock.json
git commit -m "feat: add Prisma schema and test database connection"
git push
```

**Checkpoint:** ✅ Changes committed and pushed

---

## ✅ Session 1 Complete!

### What You Accomplished

- ✅ Installed Prisma ORM
- ✅ Configured database connection
- ✅ Defined TomOS schema (Tasks, Projects, Tags)
- ✅ Created and applied first migration
- ✅ Tested database connection with all relation types
- ✅ Committed changes to Git

### What You Now Have

- **Database:** Empty but structured with proper tables
- **Schema:** `prisma/schema.prisma` defining your data model
- **Migration:** `prisma/migrations/[timestamp]_init/` with SQL
- **Test script:** Verified connection and CRUD operations

### Performance Baseline

**Current (Notion API):**
- Dashboard load: 2-3 seconds
- Task creation: 500ms
- Rate limit: 3 requests/second

**After Session 4 (Postgres):**
- Dashboard load: 50-100ms (20-60x faster)
- Task creation: 50ms (10x faster)
- Rate limit: Unlimited

---

## 🎯 Next Steps

**Before Session 2:**
1. Review the schema in Prisma Studio (`npx prisma studio`)
2. Familiarize yourself with Prisma Client API
3. Read SESSION-2.md overview
4. Plan 2-3 hour block for Session 2

**Session 2 Preview:**
- Create Prisma Client singleton
- Migrate API endpoints from Notion to Prisma
- Add TypeScript types
- Test all endpoints

---

## 🐛 Troubleshooting

**"Can't reach database server"**
```bash
# Test connection string
psql "$DATABASE_URL"

# If fails, check:
# 1. Database is running
# 2. IP whitelist includes your IP
# 3. SSL mode is correct
```

**"P3009: migrate found failed migration"**
```bash
# Reset database (DEV ONLY)
npx prisma migrate reset

# Then re-run
npx prisma migrate dev --name init
```

**"Prisma Client not found"**
```bash
npx prisma generate
```

---

## 📚 Resources

- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Client API](https://www.prisma.io/docs/reference/api-reference/prisma-client-reference)

---

**Ready for Session 2?** Open SESSION-2.md! 🚀

*Session 1 Guide v1.0 • January 15, 2026*
