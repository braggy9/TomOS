#!/bin/bash
# TomOS Second Mac Installer
# Usage: curl -fsSL [URL] | bash

set -e

echo "🚀 Installing TomOS on this Mac..."
echo ""

# Create Scripts directory
mkdir -p ~/Scripts

# Create the capture script
cat > ~/Scripts/tomos-capture.sh << 'SCRIPT_EOF'
#!/bin/bash
# TomOS Task Capture Script
# Sends tasks to TomOS API with full Claude AI parsing

if [ -z "$1" ]; then
    # Interactive mode - show dialog
    TASK=$(osascript -e 'text returned of (display dialog "What needs to be done?" default answer "" with title "TomOS - Capture Task" buttons {"Cancel", "Capture"} default button "Capture")' 2>/dev/null)

    if [ $? -ne 0 ]; then
        exit 0  # User cancelled
    fi
else
    # Command-line mode
    TASK="$*"
fi

# Exit if no task
if [ -z "$TASK" ]; then
    exit 0
fi

# Send to TomOS API
RESPONSE=$(curl -s -X POST "https://tomos-task-api.vercel.app/api/task" \
  -H "Content-Type: application/json" \
  -d "{\"task\": \"$TASK\", \"source\": \"$(hostname)\"}")

# Show notification
if echo "$RESPONSE" | grep -q "success"; then
    osascript -e "display notification \"$TASK\" with title \"✅ Task Captured\""
    echo "✅ Task captured: $TASK"
else
    osascript -e "display notification \"Failed to capture task\" with title \"❌ TomOS Error\""
    echo "❌ Error: $RESPONSE"
fi
SCRIPT_EOF

# Make executable
chmod +x ~/Scripts/tomos-capture.sh

# Add alias to shell config
SHELL_CONFIG=""
if [ -f ~/.zshrc ]; then
    SHELL_CONFIG=~/.zshrc
elif [ -f ~/.bashrc ]; then
    SHELL_CONFIG=~/.bashrc
fi

if [ -n "$SHELL_CONFIG" ]; then
    if ! grep -q "alias tomos=" "$SHELL_CONFIG"; then
        echo "" >> "$SHELL_CONFIG"
        echo "# TomOS - Quick task capture" >> "$SHELL_CONFIG"
        echo "alias tomos='~/Scripts/tomos-capture.sh'" >> "$SHELL_CONFIG"
        echo "✅ Added 'tomos' alias to $SHELL_CONFIG"
    fi
fi

echo ""
echo "✅ TomOS installed successfully!"
echo ""
echo "📋 Usage:"
echo "  Interactive:  tomos"
echo "  Quick task:   tomos Buy milk tomorrow at 2pm"
echo "  With script:  ~/Scripts/tomos-capture.sh"
echo ""
echo "🎯 Testing now..."
~/Scripts/tomos-capture.sh "TomOS installed on $(hostname)"
echo ""
echo "✅ Check your Notion - test task should appear!"
echo ""
echo "💡 Tip: Restart terminal or run 'source $SHELL_CONFIG' to use 'tomos' alias"
