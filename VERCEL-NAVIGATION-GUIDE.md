# Vercel Dashboard Navigation Guide

**Issue:** The direct URL to storage didn't work (404 error)

## ✅ Alternative Navigation Paths

### Option 1: From Main Dashboard (Easiest)

1. **Dashboard should now be open:** https://vercel.com/dashboard
2. Find your project: **tomos-task-api**
3. Click on the project
4. In the top navigation, click **"Storage"** tab
5. Click **"Create Database"**
6. Select **"Postgres"**

### Option 2: Direct Project URL

Try this URL structure:
```
https://vercel.com/team_GGiGJSubcmaJR5lrf6f8bTHP/tomos-task-api
```

Then navigate to Storage → Create Database

### Option 3: Search for Project

1. Go to: https://vercel.com/dashboard
2. Use search bar (top) to find: `tomos-task-api`
3. Click on the project
4. Navigate to Storage tab

---

## 🎯 Once You Find the Storage Page

**Create Postgres Database:**

1. Click **"Create Database"** or **"Add Database"**
2. Select **"Postgres"**
3. Configure:
   - **Database Name:** `tomos-db`
   - **Region:** `syd1` (Sydney) or closest to Australia
   - **Plan:** Hobby (free tier is fine)
4. Click **"Create"**

**Wait 30-60 seconds** for provisioning to complete

---

## 📋 After Database Created

You'll see a page with connection details. **Copy these two strings:**

### 1. POSTGRES_URL (with pooling)
```
postgres://default:...@...-pooler.postgres.vercel-storage.com:5432/verceldb
```
Click the eye icon to reveal, then copy button

### 2. POSTGRES_URL_NON_POOLING (direct)
```
postgres://default:...@....postgres.vercel-storage.com:5432/verceldb
```
Click the eye icon to reveal, then copy button

---

## 🔧 Then Run Setup Script

Once you have both connection strings:

```bash
cd /Users/tombragg/Desktop/Projects/TomOS
./setup-postgres.sh
```

Paste the strings when prompted, and the script will:
- Update `.env.local` automatically
- Install required packages
- Test the database connection
- Confirm everything works

---

## 🆘 Still Can't Find It?

Alternative methods:

### Method A: Use Vercel CLI to get correct URL
```bash
vercel project ls
vercel open
```

### Method B: Manual Search
1. Go to https://vercel.com
2. Sign in (you're logged in as tom.bragg9@gmail.com)
3. Look for "tomos-task-api" in your projects list
4. Click it, then find "Storage" or "Databases"

### Method C: Create from Storage Page
1. Go to https://vercel.com/dashboard/stores
2. Click "Create Database"
3. During creation, link it to your `tomos-task-api` project

---

**Project Details:**
- **Project ID:** prj_8jEVBTn5EAfmPOc5qcOrJ6VYE2Wr
- **Org/Team ID:** team_GGiGJSubcmaJR5lrf6f8bTHP
- **Project Name:** tomos-task-api

---

**Time needed:** 5 minutes once you find the right page
**What you're creating:** Postgres database named `tomos-db`
**What you need to copy:** Two connection strings

