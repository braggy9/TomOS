#!/bin/bash
# Claude Code Session End Hook
# Logs session end to claude-progress.txt

PROGRESS_FILE="${PROJECT_DIR:-$(pwd)}/claude-progress.txt"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
SESSION_ID="${CLAUDE_SESSION_ID:-unknown}"

echo "" >> "$PROGRESS_FILE"
echo "=== SESSION END ===" >> "$PROGRESS_FILE"
echo "Timestamp: $TIMESTAMP" >> "$PROGRESS_FILE"
echo "Session ID: $SESSION_ID" >> "$PROGRESS_FILE"
echo "===================" >> "$PROGRESS_FILE"
