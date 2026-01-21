#!/bin/bash
# Update Anthropic API Key in Vercel
# Usage: ./update-anthropic-key.sh <new-api-key>

if [ -z "$1" ]; then
  echo "❌ Error: No API key provided"
  echo "Usage: ./update-anthropic-key.sh sk-ant-xxxxx"
  exit 1
fi

NEW_KEY="$1"
TODAY=$(date +%Y-%m-%d)
ROTATION_DATE=$(date -v+90d +%Y-%m-%d 2>/dev/null || date -d "+90 days" +%Y-%m-%d)

echo "🔄 Updating ANTHROPIC_API_KEY..."
echo ""

# Update Vercel production
echo "1️⃣  Updating Vercel production environment..."
vercel env rm ANTHROPIC_API_KEY production --yes 2>/dev/null || true
echo "$NEW_KEY" | vercel env add ANTHROPIC_API_KEY production

# Update local .env.local
echo "2️⃣  Updating local .env.local..."
cat > .env.local << EOF
# TomOS API Environment Variables (Local Development)
# This file is gitignored - never commit to version control

# Anthropic API Key
# Key Created: $TODAY
# Next Rotation: $ROTATION_DATE (90 days)
ANTHROPIC_API_KEY=$NEW_KEY

# Note: This key is also stored in Vercel production environment
# To update in Vercel: ./update-anthropic-key.sh <new-key>
# To check age: ./check-api-key-age.sh
EOF

# Update calendar reminder
echo "3️⃣  Updating calendar reminder..."
osascript << APPLESCRIPT 2>/dev/null
tell application "Reminders"
    set oldReminders to reminders whose name contains "Rotate Anthropic API Key"
    repeat with oldReminder in oldReminders
        delete oldReminder
    end repeat

    tell list "Reminders"
        set reminderDate to current date
        set reminderDate to reminderDate + (90 * days)
        set hours of reminderDate to 9
        set minutes of reminderDate to 0

        make new reminder with properties {name:"🔑 Rotate Anthropic API Key (TomOS)", body:"Time to rotate (created $TODAY, now 90 days old)

Steps:
1. https://console.anthropic.com/settings/keys
2. cd /Users/tombragg/Desktop/Projects/TomOS
3. ./update-anthropic-key.sh sk-ant-NEW-KEY", due date:reminderDate, remind me date:reminderDate}
    end tell
end tell
APPLESCRIPT

echo "✅ Local environment updated!"
echo ""
echo "🚀 Triggering Vercel deployment..."
vercel --prod

echo ""
echo "✅ Done! All environments updated:"
echo "   ✓ Vercel production"
echo "   ✓ Local .env.local (created $TODAY)"
echo "   ✓ Calendar reminder (due $ROTATION_DATE)"
echo ""
echo "   Test: curl https://tomos-task-api.vercel.app/api/health"
echo "   Check age: ./check-api-key-age.sh"
