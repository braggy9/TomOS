# Anthropic API Key - Automated Rotation System

**Created:** 2026-01-21
**Status:** ✅ Fully Automated

---

## 🤖 Automated Reminders (Set & Forget)

You now have **three layers of automated reminders** to ensure you never forget to rotate the API key:

### 1. macOS Calendar Reminder ✅
- **When:** April 21, 2026 at 9:00 AM (90 days from creation)
- **What:** Notification with step-by-step rotation instructions
- **Where:** Apple Reminders app (syncs across all devices)
- **Auto-updates:** Yes - automatically recreated each time you rotate the key

### 2. Weekly Age Check ✅
- **When:** Every Monday at 9:00 AM
- **What:** Checks key age and warns if approaching 90 days
- **How:** macOS LaunchAgent (runs automatically)
- **Logs:** `/tmp/tomos-api-key-check.log`

**Warning levels:**
- ✅ Days 0-74: "API key is healthy"
- ⚠️ Days 75-89: "Warning: API key will expire soon"
- 🚨 Day 90+: "ACTION REQUIRED: API key is old!"

### 3. Manual Check Anytime
```bash
cd /Users/tombragg/Desktop/Projects/TomOS
./check-api-key-age.sh
```

---

## 🔄 One-Command Rotation

When it's time to rotate (or anytime you want):

```bash
# 1. Get new key from console.anthropic.com/settings/keys
# 2. Run this:
./update-anthropic-key.sh sk-ant-YOUR-NEW-KEY
```

**This automatically:**
1. ✅ Updates Vercel production environment
2. ✅ Updates local `.env.local` with new key and today's date
3. ✅ Updates calendar reminder to 90 days from today
4. ✅ Deploys to production
5. ✅ Shows verification commands

---

## 📊 How It Works

### File Structure
```
/Users/tombragg/Desktop/Projects/TomOS/
├── .env.local                      # Stores key + creation date
├── update-anthropic-key.sh         # One-command rotation
├── check-api-key-age.sh            # Age checker
├── add-calendar-reminder.sh        # Calendar reminder creator
├── setup-weekly-key-check.sh       # Weekly check installer
└── ~/Library/LaunchAgents/         # Weekly automation
    └── com.tomos.api-key-checker.plist
```

### Key Metadata
The `.env.local` file now includes:
```bash
# Anthropic API Key
# Key Created: 2026-01-21
# Next Rotation: 2026-04-21 (90 days)
ANTHROPIC_API_KEY=sk-ant-...
```

This metadata is:
- Used by `check-api-key-age.sh` to calculate age
- Auto-updated by `update-anthropic-key.sh` when rotating
- Never committed to git (gitignored)

---

## 🛠️ Management Commands

### Check Key Status
```bash
./check-api-key-age.sh

# Output:
# 📅 Anthropic API Key Status
#    Created: 2026-01-21
#    Age: 0 days
#
# ✅ API key is healthy (90 days until recommended rotation)
```

### View Weekly Check Logs
```bash
tail -f /tmp/tomos-api-key-check.log
```

### Disable Weekly Checks (if needed)
```bash
launchctl unload ~/Library/LaunchAgents/com.tomos.api-key-checker.plist
```

### Re-enable Weekly Checks
```bash
launchctl load ~/Library/LaunchAgents/com.tomos.api-key-checker.plist
```

### Manually Trigger Weekly Check
```bash
launchctl start com.tomos.api-key-checker
```

---

## 📅 Timeline Example

Let's say today is **January 21, 2026**:

| Date | Days | Event |
|------|------|-------|
| Jan 21, 2026 | 0 | ✅ Key created |
| Jan 27, 2026 | 6 | Weekly check: "Key is healthy (84 days remaining)" |
| Feb 3, 2026 | 13 | Weekly check: "Key is healthy (77 days remaining)" |
| ... | ... | ... |
| Apr 7, 2026 | 76 | ⚠️ Weekly check: "Warning: 14 days remaining" |
| Apr 14, 2026 | 83 | ⚠️ Weekly check: "Warning: 7 days remaining" |
| Apr 21, 2026 | 90 | 🚨 Calendar reminder: "Rotate API key today!" |
| Apr 21, 2026 | 90 | 🚨 Weekly check: "ACTION REQUIRED!" |

---

## 🔐 Security Benefits

### Why Rotate Every 90 Days?

1. **Limits Exposure Window**
   - If a key is compromised, it's only valid for max 90 days
   - Reduces blast radius of any security incident

2. **Industry Best Practice**
   - Most security frameworks recommend 60-90 day rotation
   - Anthropic doesn't enforce expiration, but rotation is recommended

3. **Compliance Ready**
   - Many compliance frameworks (SOC2, ISO 27001) require regular rotation
   - Automated system provides audit trail

4. **Zero Effort**
   - Fully automated reminders
   - One-command rotation
   - No manual tracking needed

---

## 🎯 What Happens on Rotation Day

### Scenario: It's April 21, 2026

**Morning (9:00 AM):**
1. 📱 Reminders app notification appears
2. 💻 Weekly check runs and logs warning
3. ✅ You see the notification

**You do this:**
```bash
# Open browser to get new key
open https://console.anthropic.com/settings/keys

# After creating new key, run:
cd /Users/tombragg/Desktop/Projects/TomOS
./update-anthropic-key.sh sk-ant-api03-NEW-KEY-HERE
```

**Script automatically:**
1. Updates Vercel ✅
2. Updates `.env.local` with today's date ✅
3. Creates new calendar reminder for July 20, 2026 ✅
4. Deploys to production ✅
5. Shows success message ✅

**Total time:** ~2 minutes

---

## 📱 Reminders App Preview

Your calendar reminder includes:

**Title:** 🔑 Rotate Anthropic API Key (TomOS)

**Description:**
```
Time to rotate your Anthropic API key for security!

Steps:
1. Open: https://console.anthropic.com/settings/keys
2. Create new API key
3. In Terminal:
   cd /Users/tombragg/Desktop/Projects/TomOS
   ./update-anthropic-key.sh sk-ant-YOUR-NEW-KEY

The key is 90 days old and should be rotated.
```

**Due:** April 21, 2026 at 9:00 AM
**Reminder:** April 21, 2026 at 9:00 AM

---

## 🧪 Testing the Automation

### Test the Age Checker
```bash
./check-api-key-age.sh

# Should show:
# ✅ API key is healthy (90 days until recommended rotation)
```

### Test Weekly Check Manually
```bash
launchctl start com.tomos.api-key-checker

# Check logs
cat /tmp/tomos-api-key-check.log
```

### Verify Calendar Reminder
```bash
# Open Reminders app
open -a Reminders

# Look for: "🔑 Rotate Anthropic API Key (TomOS)"
# Due: April 21, 2026
```

### Test Full Rotation (Dry Run)
```bash
# Don't actually run this unless you want to rotate now!
# ./update-anthropic-key.sh sk-ant-FAKE-KEY-FOR-TESTING

# But you can read the script to see what it does:
cat update-anthropic-key.sh
```

---

## 🔧 Troubleshooting

### Weekly Check Not Running?

**Check if LaunchAgent is loaded:**
```bash
launchctl list | grep tomos
# Should show: com.tomos.api-key-checker
```

**Reload if needed:**
```bash
launchctl unload ~/Library/LaunchAgents/com.tomos.api-key-checker.plist
launchctl load ~/Library/LaunchAgents/com.tomos.api-key-checker.plist
```

**Check logs:**
```bash
cat /tmp/tomos-api-key-check.log
cat /tmp/tomos-api-key-check-error.log
```

### Calendar Reminder Missing?

**Recreate it:**
```bash
./add-calendar-reminder.sh
```

**Check Reminders app permissions:**
- System Settings → Privacy & Security → Automation
- Make sure Terminal has Reminders access

### Key Age Shows Wrong Date?

**Check .env.local:**
```bash
grep "Key Created" .env.local

# Should show:
# # Key Created: 2026-01-21
```

**Update manually if needed:**
```bash
# Edit .env.local and change the date
nano .env.local
```

---

## 📚 Quick Reference

| Task | Command |
|------|---------|
| Check key age | `./check-api-key-age.sh` |
| Rotate key | `./update-anthropic-key.sh sk-ant-NEW-KEY` |
| View weekly logs | `tail /tmp/tomos-api-key-check.log` |
| Disable weekly check | `launchctl unload ~/Library/LaunchAgents/com.tomos.api-key-checker.plist` |
| Enable weekly check | `launchctl load ~/Library/LaunchAgents/com.tomos.api-key-checker.plist` |
| Recreate reminder | `./add-calendar-reminder.sh` |
| Test health | `curl https://tomos-task-api.vercel.app/api/health` |

---

## ✨ Summary

You now have a **fully automated system** that:

✅ Reminds you at 90 days (Calendar + Weekly checks)
✅ Warns you as expiration approaches (Weekly checks at day 75+)
✅ Makes rotation a one-command operation
✅ Updates all environments automatically
✅ Creates the next reminder automatically
✅ Requires zero manual tracking

**Set it and forget it!** 🎉

---

**Created:** 2026-01-21
**Next Rotation:** 2026-04-21
**Status:** ✅ Active and automated
