# TomOS Postgres Migration — Quick Reference

**One-page cheat sheet for the entire migration**

---

## 🎯 Goal

Migrate TomOS from Notion API → PostgreSQL (via Prisma)

**Why:** 10-100x faster, no rate limits, better data integrity

---

## 📋 The Four Sessions

| # | Name | Time | What You Do |
|---|------|------|-------------|
| 1 | Database Setup | 2-3h | Install Prisma, define schema, test connection |
| 2 | API Migration | 2-3h | Update endpoints to use Prisma instead of Notion |
| 3 | Data Migration | 1-2h | Export from Notion, import to Postgres, verify |
| 4 | Cutover | 1h | Remove Notion, deploy, monitor |

⏱️ **Total:** 6-10 hours | **Spread over:** 4-5 days (24-48h wait between Session 3-4)

---

## ✅ Pre-Flight Checklist

- [ ] Choose database: Vercel Postgres or Supabase
- [ ] Create database instance
- [ ] Get connection string
- [ ] Backup Notion workspace
- [ ] Have Claude Code ready

---

## 🚀 Session 1: Database Setup

**Files:** SESSION-1.md

```bash
# 1. Install Prisma
npm install prisma --save-dev
npm install @prisma/client
npx prisma init

# 2. Add DATABASE_URL to .env

# 3. Define schema in prisma/schema.prisma

# 4. Create migration
npx prisma migrate dev --name init

# 5. Test connection
npx ts-node test-db-connection.ts

# 6. Commit
git add . && git commit -m "feat: add Prisma schema" && git push
```

**Done when:** Schema defined, migration applied, connection works

---

## 🔧 Session 2: API Migration

**Files:** SESSION-2.md

```bash
# 1. Create lib/prisma.ts (Prisma Client singleton)

# 2. Create type definitions (types/task.ts, types/project.ts)

# 3. Update API endpoints:
#    - GET /api/tasks → prisma.task.findMany()
#    - POST /api/tasks → prisma.task.create()
#    - PATCH /api/tasks/[id] → prisma.task.update()
#    - DELETE /api/tasks/[id] → prisma.task.delete()

# 4. Same for projects

# 5. Test endpoints
npm run dev
npx ts-node test-api-endpoints.ts

# 6. Commit
git add . && git commit -m "feat: migrate API to Prisma" && git push
```

**Done when:** API works with Postgres, old Notion code commented out

---

## 📦 Session 3: Data Migration

**Files:** SESSION-3.md

```bash
# 1. Export from Notion
npx ts-node scripts/export-notion-data.ts
# Creates: notion-export.json

# 2. Import to Postgres
npx ts-node scripts/import-postgres-data.ts
# Creates: id-mappings.json

# 3. Verify
npx ts-node scripts/verify-migration.ts

# 4. Backup
pg_dump $DATABASE_URL > tomos-backup.sql

# 5. Parallel testing (24-48 hours)
# - Test iOS app with Postgres API
# - Monitor for issues
# - Keep Notion active as safety net

# 6. Commit
git add . && git commit -m "feat: migrate data to Postgres" && git push
```

**Done when:** Data verified, parallel testing complete, ready for cutover

**⚠️ CRITICAL:** Wait 24-48 hours before Session 4

---

## 🎉 Session 4: Cutover

**Files:** SESSION-4.md

```bash
# 1. Remove Notion
npm uninstall @notionhq/client
# Delete Notion code from .env

# 2. Optimize Prisma
# Add connection pooling if needed

# 3. Deploy to production
vercel env add DATABASE_URL production
npx prisma migrate deploy
vercel --prod

# 4. Test production
curl https://your-app.vercel.app/api/tasks

# 5. Monitor
npx ts-node scripts/monitor-postgres.ts

# 6. Commit
git add . && git commit -m "feat: complete Postgres migration" && git push

# 7. Celebrate! 🎉
```

**Done when:** Postgres is source of truth, Notion removed, production stable

---

## 🛠️ Essential Commands

```bash
# Prisma
npx prisma studio                    # View database GUI
npx prisma migrate dev               # Create & apply migration
npx prisma generate                  # Generate Prisma Client
npx prisma migrate deploy            # Production migration

# Database
psql $DATABASE_URL                   # Connect to DB
pg_dump $DATABASE_URL > backup.sql   # Backup

# Testing
npm run dev                          # Start dev server
npx ts-node [script].ts              # Run test script
```

---

## 🐛 Quick Fixes

| Problem | Solution |
|---------|----------|
| Can't connect | Check `DATABASE_URL` in `.env` |
| Migration fails | Check schema syntax, permissions |
| Client not found | `npx prisma generate` |
| Notion export fails | Check API key, rate limits |
| Data mismatch | Run verification script |

---

## 📊 Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Dashboard load | 2-3s | 50-100ms |
| Task query | 1-2s | 20-50ms |
| Rate limit | 3 req/s | Unlimited |

---

## ⚠️ Critical Rules

1. **NEVER skip sessions** — they build on each other
2. **ALWAYS backup** before Session 3
3. **WAIT 24-48h** between Session 3 and 4
4. **KEEP Notion** for 30 days after migration
5. **TEST thoroughly** after each session

---

## 🎯 Success = 

- [x] All data migrated
- [x] iOS app works
- [x] Dashboard <200ms
- [x] No errors for 7 days
- [x] Ready to build MatterOS

---

## 📚 Full Documentation

- **MASTER.md** — Complete guide
- **SESSION-1.md** — Database setup
- **SESSION-2.md** — API migration
- **SESSION-3.md** — Data migration
- **SESSION-4.md** — Cutover

---

**Ready? Start with Session 1!** 🚀

*Quick Reference v1.0 • January 15, 2026*
