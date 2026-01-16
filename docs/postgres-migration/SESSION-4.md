# Session 4: Cutover & Cleanup

**Duration:** 1 hour  
**Goal:** Remove Notion, deploy to production, celebrate!  
**Prerequisites:** Session 3 complete, **24-48h parallel testing with no issues**

---

## ⚠️ CRITICAL CHECKPOINT

**DO NOT START THIS SESSION UNLESS:**
- [ ] Session 3 completed successfully
- [ ] **Parallel testing** ran for 24-48 hours
- [ ] **No issues** found during testing
- [ ] iOS app works perfectly with Postgres
- [ ] Performance meets expectations
- [ ] You have **backups** of everything

**This session is IRREVERSIBLE. Once you remove Notion, you're fully on Postgres.**

**If you're unsure, WAIT. Better to delay than rush.**

---

## 📋 Overview

In this final session, you'll:
1. Remove Notion dependencies
2. Clean up commented code
3. Optimize Prisma configuration
4. Deploy to production
5. Verify production deployment
6. Set up monitoring
7. Update documentation
8. Celebrate! 🎉

**Claude Code Prompt:**
```
I'm starting Session 4 of the TomOS Postgres migration - the final cutover.

Session 3 complete:
✓ Data migrated to Postgres
✓ 24-48h parallel testing successful
✓ No issues found
✓ Ready for cutover

Follow SESSION-4.md exactly. Start with Phase 1.
```

---

## Phase 1: Remove Notion Dependencies (15 minutes)

### Step 1.1: Uninstall Notion Client

```bash
npm uninstall @notionhq/client
```

### Step 1.2: Remove Notion Environment Variables

Edit `.env` and remove:
```env
# Remove these lines:
NOTION_API_KEY=secret_xxx
NOTION_TASKS_DB_ID=xxx
NOTION_PROJECTS_DB_ID=xxx
NOTION_TAGS_DB_ID=xxx
```

### Step 1.3: Delete Commented Notion Code

**Find all files with commented Notion code:**
```bash
grep -r "// import.*@notionhq" pages/api/
```

**Delete these sections:**
- Notion imports
- Notion client initialization
- Old Notion query code
- Any commented-out Notion logic

**Example:**
```typescript
// DELETE THIS:
// import { Client } from '@notionhq/client'
// const notion = new Client({ auth: process.env.NOTION_API_KEY })
// const response = await notion.databases.query(...)
```

### Step 1.4: Verify No Notion References

```bash
# Should return nothing:
grep -r "@notionhq" pages/
grep -r "NOTION_" .env*
```

**Checkpoint:** ✅ Notion completely removed

---

## Phase 2: Optimize Prisma Configuration (10 minutes)

### Step 2.1: Update Prisma Client Configuration

Edit `lib/prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['error', 'warn'] 
      : ['error'],
    // Connection pool settings
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect()
})
```

### Step 2.2: Add Connection Pooling (Vercel Postgres)

If using Vercel Postgres, pooling is automatic via `DATABASE_URL` with `?pgbouncer=true`.

**Verify in `.env`:**
```env
DATABASE_URL="postgres://...?pgbouncer=true"
```

### Step 2.3: Add Indexes for Performance (if not already in schema)

Review `prisma/schema.prisma` and ensure indexes exist:

```prisma
model Task {
  // ...
  @@index([status])
  @@index([priority])
  @@index([projectId])
  @@index([dueDate])
}
```

**Checkpoint:** ✅ Prisma optimized

---

## Phase 3: Deploy to Production (15 minutes)

### Step 3.1: Add Production Environment Variables

**Vercel:**
```bash
vercel env add DATABASE_URL production
vercel env add POSTGRES_URL_NON_POOLING production
```

Paste your production connection strings when prompted.

### Step 3.2: Run Production Migration

```bash
npx prisma migrate deploy
```

This applies all migrations to your production database.

### Step 3.3: Deploy to Vercel

```bash
# Deploy
vercel --prod

# Or push to main branch (if auto-deploy enabled)
git push origin main
```

**Wait for deployment to complete...**

### Step 3.4: Verify Production Deployment

```bash
# Test production API
curl https://your-app.vercel.app/api/tasks

# Should return JSON with tasks
```

**Expected:**
```json
[
  {
    "id": "...",
    "title": "...",
    "status": "todo",
    ...
  }
]
```

**If API returns error:**
1. Check Vercel logs: `vercel logs`
2. Verify environment variables set correctly
3. Check database connection from Vercel
4. Verify migration applied: `npx prisma migrate status`

**Checkpoint:** ✅ Deployed to production, API working

---

## Phase 4: Update iOS App (if needed) (10 minutes)

### Step 4.1: Update API Base URL

If you were using a development URL, update to production:

```swift
// Before (dev)
let apiBaseURL = "http://localhost:3000/api"

// After (prod)
let apiBaseURL = "https://your-app.vercel.app/api"
```

### Step 4.2: Test iOS App Against Production

1. Build and run iOS app
2. Verify all features work
3. Check performance (should be <200ms)

**Checkpoint:** ✅ iOS app works with production Postgres

---

## Phase 5: Set Up Monitoring (15 minutes)

### Step 5.1: Create Monitoring Script

Create `scripts/monitor-postgres.ts`:

```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkHealth() {
  console.log('🏥 TomOS Health Check\n')

  try {
    // Database connection
    console.log('Database:')
    const startTime = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const latency = Date.now() - startTime
    console.log(`  ✓ Connected (${latency}ms)`)

    // Record counts
    const taskCount = await prisma.task.count()
    const projectCount = await prisma.project.count()
    const tagCount = await prisma.tag.count()

    console.log('\nRecords:')
    console.log(`  Tasks: ${taskCount}`)
    console.log(`  Projects: ${projectCount}`)
    console.log(`  Tags: ${tagCount}`)

    // Recent activity
    const recentTasks = await prisma.task.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        title: true,
        createdAt: true,
      }
    })

    console.log('\nRecent tasks:')
    recentTasks.forEach(task => {
      console.log(`  - ${task.title} (${task.createdAt.toLocaleString()})`)
    })

    // Performance test
    console.log('\nPerformance:')
    const perfStart = Date.now()
    await prisma.task.findMany({
      include: {
        project: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    })
    const perfLatency = Date.now() - perfStart
    console.log(`  Dashboard query: ${perfLatency}ms`)

    if (perfLatency > 500) {
      console.log('  ⚠️ Performance slower than expected')
    } else if (perfLatency > 200) {
      console.log('  ⚡ Good performance')
    } else {
      console.log('  🚀 Excellent performance')
    }

    console.log('\n✅ All systems operational\n')
  } catch (error) {
    console.error('❌ Health check failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

checkHealth()
```

### Step 5.2: Run Health Check

```bash
npx ts-node scripts/monitor-postgres.ts
```

**Expected output:**
```
🏥 TomOS Health Check

Database:
  ✓ Connected (25ms)

Records:
  Tasks: 150
  Projects: 10
  Tags: 25

Recent tasks:
  - Review PR (1/15/2026, 2:30 PM)
  - Fix bug (1/15/2026, 1:15 PM)
  ...

Performance:
  Dashboard query: 75ms
  🚀 Excellent performance

✅ All systems operational
```

### Step 5.3: Schedule Regular Health Checks

**Option A: Cron job**
```bash
# Add to crontab (every hour)
0 * * * * cd /path/to/tomos && npx ts-node scripts/monitor-postgres.ts >> logs/health.log 2>&1
```

**Option B: Vercel Cron**
Create `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/health",
    "schedule": "0 * * * *"
  }]
}
```

Create `pages/api/health.ts`:
```typescript
import { prisma } from '@/lib/prisma'

export default async function handler(req, res) {
  try {
    await prisma.$queryRaw`SELECT 1`
    const taskCount = await prisma.task.count()
    
    res.status(200).json({
      status: 'healthy',
      taskCount,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    })
  }
}
```

**Checkpoint:** ✅ Monitoring set up

---

## Phase 6: Update Documentation (5 minutes)

### Step 6.1: Update README

Add to your repo's `README.md`:

```markdown
## Database

TomOS uses **PostgreSQL** with Prisma ORM.

### Schema
- **Tasks** — Core productivity items
- **Projects** — Task groupings
- **Tags** — Task categorization
- **TaskTags** — Many-to-many relation

### Migrations
```bash
# Create migration
npx prisma migrate dev --name description

# Apply to production
npx prisma migrate deploy
```

### Database GUI
```bash
npx prisma studio
```

### Backup
```bash
pg_dump $DATABASE_URL > backup.sql
```

### Health Check
```bash
npx ts-node scripts/monitor-postgres.ts
```
```

**Checkpoint:** ✅ Documentation updated

---

## Phase 7: Commit Changes (5 minutes)

```bash
git add .
git commit -m "feat: complete Postgres migration - remove Notion, optimize, deploy"
git push
```

**Checkpoint:** ✅ Final changes committed

---

## Phase 8: Clean Up (Optional) (5 minutes)

### Keep for 30 Days

**Essential files to keep:**
- `notion-export.json` (backup)
- `id-mappings.json` (reference)
- `tomos-backup.sql` (Postgres backup)

**Move to archive:**
```bash
mkdir ~/Documents/Backups/tomos-migration-$(date +%Y%m%d)
mv notion-export.json ~/Documents/Backups/tomos-migration-$(date +%Y%m%d)/
mv id-mappings.json ~/Documents/Backups/tomos-migration-$(date +%Y%m%d)/
cp tomos-backup-*.sql ~/Documents/Backups/tomos-migration-$(date +%Y%m%d)/
```

### After 30 Days (if all is well)

**Can delete:**
- Migration backup files
- Notion export
- ID mappings

**Keep forever:**
- Migration scripts (in repo)
- Schema history (`prisma/migrations/`)

---

## ✅ Session 4 Complete! 🎉

### What You Accomplished

- ✅ Removed Notion completely
- ✅ Optimized Prisma configuration
- ✅ Deployed to production
- ✅ Verified production works
- ✅ Set up monitoring
- ✅ Updated documentation
- ✅ **MIGRATION COMPLETE!**

### The Results

**Before (Notion API):**
- Dashboard load: 2-3 seconds
- Task creation: 500ms
- Rate limit: 3 requests/second
- Data integrity: Basic
- Scalability: Limited

**After (Postgres + Prisma):**
- Dashboard load: 50-100ms (20-60x faster!) 🚀
- Task creation: 50ms (10x faster!)
- Rate limit: Unlimited
- Data integrity: Foreign keys, constraints, transactions
- Scalability: Ready for MatterOS, LegalOS, NexusOS

### What You Now Have

**Infrastructure:**
- PostgreSQL database with proper schema
- Prisma ORM for type-safe queries
- Production-ready API
- Monitoring in place

**Confidence:**
- 24-48h parallel testing completed
- No issues found
- Production verified
- Ready to build next features

---

## 🎯 What's Next?

### Week 1: Monitor Closely

- [ ] Check health daily
- [ ] Monitor error logs
- [ ] Watch performance metrics
- [ ] Verify data integrity

### Week 2-4: Optimize Further

- [ ] Identify slow queries (if any)
- [ ] Add indexes for hot paths
- [ ] Consider caching strategy
- [ ] Fine-tune connection pool

### Month 2+: Build on This Foundation

**Now you can:**
- **MatterOS** — Legal matter management (same Postgres DB)
- **LegalOS** — Legal research tools (same Postgres DB)
- **NexusOS** — Cross-system integration (queries across all systems)
- **Advanced features** — Full-text search, real-time updates, analytics

**The Postgres foundation enables:**
- Complex joins across TomOS, MatterOS, LegalOS
- Shared tags across systems
- Unified search
- Cross-system reporting
- Real-time collaboration

---

## 🎊 Congratulations!

You've successfully migrated TomOS from Notion to PostgreSQL!

**This was a significant undertaking:**
- 4 sessions over 4-5 days
- 6-10 hours of focused work
- Database schema design
- API migration
- Data migration
- Production deployment

**You now have:**
- ⚡ Lightning-fast performance (20-60x improvement)
- 🔒 Proper data integrity
- 🚀 Unlimited scalability
- 🎯 Foundation for NexusOS

**Most importantly:**
- You **learned** Prisma, PostgreSQL, migrations
- You **planned** carefully with backups and parallel testing
- You **executed** methodically across 4 sessions
- You **succeeded** without losing any data

---

## 📚 Knowledge Gained

**You now know how to:**
- Design PostgreSQL schemas with Prisma
- Create and apply migrations
- Migrate data from one system to another
- Verify data integrity
- Deploy to production safely
- Monitor database health
- Optimize query performance

**These skills transfer to:**
- Any PostgreSQL project
- Any Prisma project
- Any data migration
- Any production deployment

---

## 🙏 Thank You

Thank you for trusting this migration guide. You executed it perfectly by:
- Following each session methodically
- Waiting 24-48h for parallel testing
- Keeping backups at every step
- Verifying data at each phase

**You did it!** 🎉

---

## 🐛 Troubleshooting (Post-Migration)

**"Slow queries in production"**
```bash
# Enable query logging
# In lib/prisma.ts, add:
log: ['query']

# Identify slow queries, add indexes
npx prisma migrate dev --name add_performance_indexes
```

**"Database connection errors"**
```bash
# Check connection pool
# Increase if needed (Vercel Postgres dashboard)
```

**"Data mismatch found"**
```bash
# Check id-mappings.json
# Verify relations are correct
npx ts-node scripts/verify-migration.ts
```

---

## 📖 Resources

**Prisma:**
- [Prisma Docs](https://www.prisma.io/docs)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

**PostgreSQL:**
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)

**Vercel:**
- [Vercel Postgres Docs](https://vercel.com/docs/storage/vercel-postgres)
- [Vercel Functions](https://vercel.com/docs/functions)

---

**Your migration is complete. Time to celebrate! 🍾**

*Session 4 Guide v1.0 • January 15, 2026*
