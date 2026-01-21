# Anthropic API Key - Access Guide

**Last Updated:** 2026-01-21
**Key Location:** Stored securely in both local and production environments

---

## 🔐 Where the Key is Stored

### 1. **Local Development** (TomOS API Repo)
```
/Users/tombragg/Desktop/Projects/TomOS/.env.local
```
- File is gitignored (never committed to version control)
- Used for local testing and development
- Can be accessed anytime via: `cat .env.local | grep ANTHROPIC_API_KEY`

### 2. **Production Environment** (Vercel)
```
Vercel Project: tomos-task-api
Environment: Production
Variable Name: ANTHROPIC_API_KEY
```
- Encrypted by Vercel
- Accessible via: `vercel env ls`
- Pull to local: `vercel env pull`

---

## 📖 How to Access the Key

### From Command Line (Preferred)
```bash
# Navigate to TomOS API repo
cd /Users/tombragg/Desktop/Projects/TomOS

# Read the key from local environment
grep ANTHROPIC_API_KEY .env.local

# Or export it for use in scripts
export $(grep ANTHROPIC_API_KEY .env.local | xargs)
echo $ANTHROPIC_API_KEY
```

### From Claude Code (Any Chat Session)

When you need the API key in a Claude Code session, say:

> "Read the Anthropic API key from the TomOS project"

Then I will execute:
```bash
cat /Users/tombragg/Desktop/Projects/TomOS/.env.local | grep ANTHROPIC_API_KEY
```

### From Another Project Directory

If you're in a different directory and need the key:
```bash
# Quick one-liner
cat /Users/tombragg/Desktop/Projects/TomOS/.env.local | grep ANTHROPIC_API_KEY

# Or set it as environment variable
export ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY /Users/tombragg/Desktop/Projects/TomOS/.env.local | cut -d '=' -f2)
```

---

## 🔄 How to Update the Key

### 🤖 Fully Automated - No Manual Tracking Needed!

You'll be reminded automatically:
- **Calendar notification** at 90 days (April 21, 2026)
- **Weekly checks** every Monday (starts warning at day 75)
- See **`API-KEY-AUTOMATION.md`** for full automation details

### When It's Time to Rotate

**One command does everything:**

```bash
cd /Users/tombragg/Desktop/Projects/TomOS

# 1. Get new key from console.anthropic.com/settings/keys
# 2. Run this one command:
./update-anthropic-key.sh sk-ant-YOUR-NEW-KEY
```

**This automatically:**
1. ✅ Updates Vercel production
2. ✅ Updates local `.env.local` with new key + today's date
3. ✅ Creates new calendar reminder for +90 days
4. ✅ Deploys to production
5. ✅ Shows verification commands

**Total time:** ~2 minutes

---

## 🧪 Testing the API Key

### Test Scheduled Notifications Endpoint
```bash
# Set the CRON_SECRET first
export CRON_SECRET=$(grep CRON_SECRET .env.local | cut -d '=' -f2)

# Test morning overview (uses Anthropic API)
curl -H "Authorization: Bearer $CRON_SECRET" \
  https://tomos-task-api.vercel.app/api/notifications/morning-overview

# Should return 200 with success message
```

### Test Direct Anthropic API Call
```bash
# Get the key
export ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY /Users/tombragg/Desktop/Projects/TomOS/.env.local | cut -d '=' -f2)

# Test it directly
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

---

## 🚨 Security Best Practices

### ✅ DO
- Keep `.env.local` gitignored (already configured)
- Use the key only in server-side code (never client-side)
- Rotate the key periodically (every 90 days recommended)
- Use environment variables for production (Vercel)
- Reference this guide when needed

### ❌ DON'T
- Commit API keys to git repositories
- Share keys in chat messages (except with Claude Code for configuration)
- Hardcode keys in source code
- Use the same key across multiple unrelated projects
- Leave expired keys in environment variables

---

## 📝 Quick Reference Commands

```bash
# Read key
cat /Users/tombragg/Desktop/Projects/TomOS/.env.local | grep ANTHROPIC_API_KEY

# Update key in Vercel
cd /Users/tombragg/Desktop/Projects/TomOS
./update-anthropic-key.sh <new-key>

# Pull all Vercel env vars to local
vercel env pull .env.vercel

# List all Vercel env vars
vercel env ls

# Test GitHub Actions workflow manually
gh workflow run scheduled-notifications.yml --repo braggy9/TomOS
```

---

## 📚 Related Files

- **API Key Storage:** `/Users/tombragg/Desktop/Projects/TomOS/.env.local`
- **Update Script:** `/Users/tombragg/Desktop/Projects/TomOS/update-anthropic-key.sh`
- **Project Documentation:** `/Users/tombragg/Desktop/Projects/TomOS/CLAUDE.md`
- **GitHub Workflow:** `/Users/tombragg/Desktop/Projects/TomOS/.github/workflows/scheduled-notifications.yml`

---

## 🎯 Common Use Cases

### Use Case 1: New Claude Code Session Needs the Key
```
User: "I need to test the Anthropic API in this project"
Claude: [Reads /Users/tombragg/Desktop/Projects/TomOS/.env.local and provides the key]
```

### Use Case 2: GitHub Actions Failing with Auth Error
```bash
# Check if key is valid
cat /Users/tombragg/Desktop/Projects/TomOS/.env.local | grep ANTHROPIC_API_KEY

# If expired, update it
./update-anthropic-key.sh <new-key-from-console>

# GitHub Actions will use new key on next scheduled run
```

### Use Case 3: Setting Up New Project That Needs Anthropic API
```bash
# Copy key to new project
cd /path/to/new-project
echo "ANTHROPIC_API_KEY=$(grep ANTHROPIC_API_KEY /Users/tombragg/Desktop/Projects/TomOS/.env.local | cut -d '=' -f2)" >> .env.local
```

---

**Key Updated:** 2026-01-21
**Key Status:** ✅ Active in both local and production environments
**Next Rotation:** Recommended by 2026-04-21 (90 days)
