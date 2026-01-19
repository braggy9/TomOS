# PostgreSQL Setup Instructions

**Date:** January 16, 2026
**Status:** Ready to create database

---

## ✅ Automated Steps Completed

- [x] Vercel CLI verified (logged in as tombragg9-3517)
- [x] Project identified: tomos-task-api
- [x] Vercel dashboard opened in browser
- [x] Setup script created: `setup-postgres.sh`

---

## 🎯 Next Steps (5 minutes)

### Step 1: Create Database in Vercel Dashboard

**The browser should now be open to:** https://vercel.com/tombragg9-3517/tomos-task-api/stores

**In the dashboard:**

1. Click **"Create Database"** button
2. Select **"Postgres"**
3. Configure:
   - **Name:** `tomos-db`
   - **Region:** Select closest to Australia (Sydney if available)
   - **Plan:** Hobby (free) is fine for now
4. Click **"Create"**

⏱️ Database creation takes about 30-60 seconds

---

### Step 2: Copy Connection Strings

Once created, you'll see the database page with connection details.

**You need TWO connection strings:**

#### 1. POSTGRES_URL (Pooled)
```
postgres://default:...@...-pooler.postgres.vercel-storage.com:5432/verceldb
```
- Used for normal queries
- Includes connection pooling
- Copy the full string

#### 2. POSTGRES_URL_NON_POOLING (Direct)
```
postgres://default:...@....postgres.vercel-storage.com:5432/verceldb
```
- Used for migrations
- Direct connection
- Copy the full string

**💡 Tip:** Click the eye icon to reveal the full strings, then use the copy button

---

### Step 3: Add to .env.local

**Option A: Automated (Recommended)**

Run this command and paste the connection strings when prompted:

```bash
cd /Users/tombragg/Desktop/Projects/TomOS
./setup-postgres.sh
```

**Option B: Manual**

Edit `.env.local` and add these lines:

```bash
# PostgreSQL Database Configuration
DATABASE_URL="paste-your-POSTGRES_URL-here"
DIRECT_URL="paste-your-POSTGRES_URL_NON_POOLING-here"

# Keep your existing Notion key for now
NOTION_API_KEY="your-existing-key"
```

---

### Step 4: Verify Connection

Test that everything works:

```bash
cd /Users/tombragg/Desktop/Projects/TomOS

# Create test script
cat > test-connection.ts << 'EOF'
import { Pool } from '@vercel/postgres';

async function testConnection() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✓ Database connection successful!');
    console.log('✓ Server time:', result.rows[0].now);
    client.release();
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
EOF

# Install dependencies
npm install @vercel/postgres

# Run test
npx tsx test-connection.ts
```

**Expected output:**
```
✓ Database connection successful!
✓ Server time: 2026-01-16T...
```

---

## ✨ Once Complete

**You'll have:**
- ✅ Vercel Postgres database created
- ✅ Connection strings saved in `.env.local`
- ✅ Database connection verified
- ✅ Ready for Phase 1: Database Setup

**Next action:**
Use the Claude Code prompt from `CLAUDE-CODE-PROMPTS.md` for Session 1:

```
I'm starting TomOS PostgreSQL migration - Session 1: Database Setup

Context files to read:
- /Users/tombragg/Desktop/Projects/TomOS/docs/postgres-migration/FULL-CONVERSATION.md
- /Users/tombragg/Desktop/Projects/TomOS/docs/postgres-migration/SESSION-1.md
- /Users/tombragg/Desktop/Projects/TomOS/CLAUDE.md

My setup:
- Database: Vercel Postgres (already created)
- DATABASE_URL: [I have this in .env.local]
- DIRECT_URL: [I have this in .env.local]
- TomOS API repo: /Users/tombragg/Desktop/Projects/TomOS/
- Current timezone: Australia/Sydney

Task:
Follow SESSION-1.md exactly to:
1. Install Prisma and dependencies
2. Create prisma/schema.prisma with Task, Project, Tag models
3. Configure database connection
4. Create initial migration
5. Test connection
6. Commit changes

Please start with Phase 1: Install Prisma and Dependencies.
```

---

## 🚨 Troubleshooting

**"Can't find database"**
- Refresh the dashboard
- Check you're in the right project (tomos-task-api)

**"Connection failed"**
- Verify you copied the FULL connection string (including password)
- Check no extra spaces or quotes in .env.local
- Make sure you used DATABASE_URL and DIRECT_URL as the variable names

**"@vercel/postgres not found"**
- Run: `npm install @vercel/postgres`

---

**Time to complete:** 5 minutes
**Difficulty:** Easy (just copy-paste)
**Next session:** Phase 1 with Claude Code

