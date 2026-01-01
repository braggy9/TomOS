#!/bin/bash
# Claude Code Pre-Compact Hook
# Logs before context compaction to claude-progress.txt

PROGRESS_FILE="${PROJECT_DIR:-$(pwd)}/claude-progress.txt"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
COMPACT_TYPE="${1:-unknown}"

echo "" >> "$PROGRESS_FILE"
echo "=== PRE-COMPACT ===" >> "$PROGRESS_FILE"
echo "Timestamp: $TIMESTAMP" >> "$PROGRESS_FILE"
echo "Compact Type: $COMPACT_TYPE" >> "$PROGRESS_FILE"
echo "===================" >> "$PROGRESS_FILE"
