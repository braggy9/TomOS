# TomOS Postgres Migration — Master Guide

**Complete guide for migrating TomOS from Notion API to PostgreSQL**

---

## 📋 Overview

This migration moves TomOS from using Notion as a database (via API) to PostgreSQL with Prisma ORM. The migration is broken into 4 sessions, each 1-3 hours, designed to be executed with Claude Code.

**Why migrate?**
- **10-100x faster** queries (3s → 50ms)
- **No rate limits** (Notion API: 3 req/s)
- **Complex queries** (joins, full-text search, aggregations)
- **Data integrity** (foreign keys, constraints, transactions)
- **Scalability** (foundation for MatterOS, LegalOS, NexusOS)

**Total time:** 6-10 hours across 4 sessions
**Recommended schedule:** 1 session per day over 4 days

---

## 🗺️ Migration Roadmap

```
Session 1: Database Setup (2-3 hours)
├─ Install Prisma
├─ Define schema
├─ Create migrations
└─ Test connection
    ↓
Session 2: API Migration (2-3 hours)
├─ Set up Prisma Client
├─ Migrate endpoints
├─ Add type safety
└─ Test API
    ↓
Session 3: Data Migration (1-2 hours)
├─ Export from Notion
├─ Import to Postgres
├─ Verify integrity
└─ Parallel testing (24-48h)
    ↓
Session 4: Cutover (1 hour)
├─ Remove Notion
├─ Deploy to production
├─ Monitor
└─ Celebrate 🎉
```

---

## 🎯 Prerequisites

### Before Starting

**Required:**
- TomOS API repo on your machine
- Node.js and npm installed
- Git and GitHub access
- Database provider account: **Vercel Postgres** (recommended)
- Current Notion API credentials
- Claude Code access

### Database Provider: Vercel Postgres

**Free tier:** 256 MB storage, 60 hours compute/month
**Paid:** $20/month (512 MB, unlimited compute)

**Why Vercel Postgres:**
- Already using Vercel for hosting
- Integrated infrastructure
- Simpler setup (one platform)
- Connection pooling built-in

### Set Up Database

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Create database
vercel postgres create tomos-db

# Get connection string
vercel postgres show tomos-db
```

Save both connection strings:
- `DATABASE_URL` (pooled - for queries)
- `POSTGRES_URL_NON_POOLING` (direct - for migrations)

---

## 📚 Session Guides

| Session | File | Duration | Focus |
|---------|------|----------|-------|
| 1 | SESSION-1.md | 2-3 hours | Database setup, schema |
| 2 | SESSION-2.md | 2-3 hours | API endpoints |
| 3 | SESSION-3.md | 1-2 hours | Data migration |
| 4 | SESSION-4.md | 1 hour | Cutover, cleanup |

**Do NOT skip sessions** — each builds on the previous.

---

## 🚀 Quick Start

### Step 1: Prepare
1. Create Vercel Postgres database
2. Save connection strings
3. Clone TomOS API repo
4. Have 2-3 hour block available

### Step 2: Run Session 1

Open `SESSION-1.md` and give Claude Code this prompt:

```
I'm starting the TomOS Postgres migration (Session 1).

I have:
- TomOS API repo at: [path]
- Database: Vercel Postgres
- Connection string: [paste DATABASE_URL]
- Direct URL: [paste POSTGRES_URL_NON_POOLING]

Follow the instructions in SESSION-1.md exactly.
```

### Step 3: Complete Remaining Sessions

Follow SESSION-2.md through SESSION-4.md sequentially.

**CRITICAL:** Wait 24-48 hours between Session 3 and 4 for parallel testing.

---

## ⚠️ Critical Warnings

### Do NOT Skip Backups

Before Session 3 (data migration):
- Export Notion workspace (Settings → Export)
- Save `notion-export.json`
- Keep for at least 30 days

### Do NOT Rush Session 3→4 Transition

Wait 24-48 hours between Session 3 and Session 4 to run both systems in parallel.

### Do NOT Delete Notion Data Immediately

Keep Notion workspace intact for 30 days after migration.

---

## 📊 Expected Results

### Performance Improvements

| Metric | Before (Notion) | After (Postgres) | Improvement |
|--------|-----------------|------------------|-------------|
| Dashboard load | 2-3s | 50-100ms | 20-60x |
| Task search | 1-2s | 20-50ms | 20-100x |
| Create task | 500ms | 50ms | 10x |
| API rate limit | 3 req/s | Unlimited | ∞ |

---

## 🛠️ Essential Commands

```bash
# Prisma
npx prisma migrate dev --name [description]  # Create migration
npx prisma migrate deploy                    # Apply to production
npx prisma generate                          # Generate Prisma Client
npx prisma studio                            # Open database GUI

# Database
psql $DATABASE_URL                           # Connect to database
pg_dump $DATABASE_URL > backup.sql           # Backup database

# Testing
npm run dev                                  # Start dev server
npx ts-node scripts/test-connection.ts       # Test connection
```

---

## 🐛 Troubleshooting

**"Can't connect to database"**
- Check `DATABASE_URL` in `.env`
- Verify database is running
- Try direct connection string (not pooler)

**"Migration failed"**
- Check schema syntax
- Verify database permissions
- Try `npx prisma migrate reset` (DEV ONLY)

**"Prisma Client not found"**
```bash
npx prisma generate
```

---

## 📝 Migration Checklist

### Pre-Migration
- [ ] Database provider chosen: Vercel Postgres
- [ ] Database instance created
- [ ] Connection strings saved
- [ ] Notion workspace backed up

### Session 1
- [ ] Prisma installed
- [ ] Schema defined
- [ ] Migration created
- [ ] Connection tested

### Session 2
- [ ] Prisma Client set up
- [ ] Endpoints migrated
- [ ] API tested

### Session 3
- [ ] Data exported from Notion
- [ ] Data imported to Postgres
- [ ] Migration verified
- [ ] Backups created

### Parallel Testing (24-48h)
- [ ] iOS app tested
- [ ] No issues found
- [ ] Ready for cutover

### Session 4
- [ ] Notion dependencies removed
- [ ] Deployed to production
- [ ] Monitoring in place
- [ ] Migration complete! 🎉

---

## 💡 Tips for Success

1. **One session per day** - Don't rush
2. **Test thoroughly** after each session
3. **Keep Notion as backup** until confident
4. **Use Prisma Studio** to inspect data visually
5. **Monitor logs** closely in first week
6. **Ask Claude Code** for help when stuck

---

**Ready to start? Open SESSION-1.md!** 🚀

*Created: January 2026*
*Version: 1.0*
