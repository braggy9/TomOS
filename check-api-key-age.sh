#!/bin/bash
# Check Anthropic API Key Age and Warn if Expiring Soon
# Run this periodically or add to cron

ENV_FILE="/Users/tombragg/Desktop/Projects/TomOS/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: .env.local not found"
  exit 1
fi

# Extract the key creation date from comment
KEY_DATE=$(grep "# Key Created:" "$ENV_FILE" | sed 's/# Key Created: //')

if [ -z "$KEY_DATE" ]; then
  echo "⚠️  Warning: No key creation date found in .env.local"
  echo "   Add this line after ANTHROPIC_API_KEY:"
  echo "   # Key Created: 2026-01-21"
  exit 0
fi

# Calculate days since key creation
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  KEY_TIMESTAMP=$(date -j -f "%Y-%m-%d" "$KEY_DATE" +%s 2>/dev/null)
else
  # Linux
  KEY_TIMESTAMP=$(date -d "$KEY_DATE" +%s 2>/dev/null)
fi

if [ -z "$KEY_TIMESTAMP" ]; then
  echo "⚠️  Warning: Invalid date format in .env.local"
  exit 0
fi

CURRENT_TIMESTAMP=$(date +%s)
DAYS_OLD=$(( ($CURRENT_TIMESTAMP - $KEY_TIMESTAMP) / 86400 ))

echo "📅 Anthropic API Key Status"
echo "   Created: $KEY_DATE"
echo "   Age: $DAYS_OLD days"
echo ""

if [ $DAYS_OLD -ge 90 ]; then
  echo "🚨 ACTION REQUIRED: API key is $DAYS_OLD days old!"
  echo "   Recommended: Rotate every 90 days"
  echo ""
  echo "   1. Generate new key: https://console.anthropic.com/settings/keys"
  echo "   2. Run: ./update-anthropic-key.sh sk-ant-YOUR-NEW-KEY"
  exit 1
elif [ $DAYS_OLD -ge 75 ]; then
  echo "⚠️  Warning: API key will expire soon ($(( 90 - $DAYS_OLD )) days remaining)"
  echo "   Consider rotating at: https://console.anthropic.com/settings/keys"
  exit 0
else
  echo "✅ API key is healthy ($(( 90 - $DAYS_OLD )) days until recommended rotation)"
  exit 0
fi
