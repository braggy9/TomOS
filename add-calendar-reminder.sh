#!/bin/bash
# Add macOS Calendar reminder for API key rotation

osascript << 'APPLESCRIPT'
tell application "Reminders"
    tell list "Reminders"
        set reminderDate to current date
        set year of reminderDate to 2026
        set month of reminderDate to 4
        set day of reminderDate to 21
        set hours of reminderDate to 9
        set minutes of reminderDate to 0
        set seconds of reminderDate to 0
        
        make new reminder with properties {name:"🔑 Rotate Anthropic API Key (TomOS)", body:"Time to rotate your Anthropic API key for security!

Steps:
1. Open: https://console.anthropic.com/settings/keys
2. Create new API key
3. In Terminal:
   cd /Users/tombragg/Desktop/Projects/TomOS
   ./update-anthropic-key.sh sk-ant-YOUR-NEW-KEY

The key is 90 days old and should be rotated.", due date:reminderDate, remind me date:reminderDate}
    end tell
end tell
APPLESCRIPT

if [ $? -eq 0 ]; then
    echo "✅ Calendar reminder created for April 21, 2026 at 9:00 AM"
    echo "   Open Reminders app to view it"
else
    echo "❌ Failed to create reminder (check Reminders app permissions)"
fi
