#!/bin/bash
# Setup weekly automated API key age check

PLIST_NAME="com.tomos.api-key-checker"
PLIST_FILE="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"

# Create LaunchAgent plist
cat > "$PLIST_FILE" << PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>$PLIST_NAME</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>/Users/tombragg/Desktop/Projects/TomOS/check-api-key-age.sh</string>
    </array>
    
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>1</integer>
        <key>Hour</key>
        <integer>9</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    
    <key>StandardOutPath</key>
    <string>/tmp/tomos-api-key-check.log</string>
    
    <key>StandardErrorPath</key>
    <string>/tmp/tomos-api-key-check-error.log</string>
</dict>
</plist>
PLISTEOF

# Load the LaunchAgent
launchctl unload "$PLIST_FILE" 2>/dev/null
launchctl load "$PLIST_FILE"

echo "✅ Weekly API key age check configured"
echo "   Runs every Monday at 9:00 AM"
echo "   Check logs: tail /tmp/tomos-api-key-check.log"
echo ""
echo "   To disable: launchctl unload $PLIST_FILE"
echo "   To enable: launchctl load $PLIST_FILE"
