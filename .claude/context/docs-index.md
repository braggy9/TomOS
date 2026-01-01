# TomOS Documentation Index

## Essential Reading (Start Here)

| Document | Location | Purpose |
|----------|----------|---------|
| **CLAUDE_CODE_HANDOVER.md** | `/CLAUDE_CODE_HANDOVER.md` | Project context, architecture, current status |
| **CLAUDE.md** | `/CLAUDE.md` | Quick reference for Claude sessions |

## Technical Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| APNs Setup Guide | `/docs/APNS_SETUP.md` | Complete APNs implementation reference |
| Environment Variables | `/.env.example` | All required env vars with descriptions |

## Configuration Files

| File | Purpose |
|------|---------|
| `vercel.json` | Vercel deployment config (region: syd1) |
| `package.json` | Dependencies and scripts |
| `tsconfig.json` | TypeScript configuration |
| `.github/workflows/scheduled-notifications.yml` | Cron job configuration |

## API Reference

See `/app/api/` directory for all endpoints:
- `/api/task/` - Task management
- `/api/send-push/` - APNs notifications
- `/api/register-device/` - Device registration
- `/api/notifications/` - Scheduled notifications
- `/api/calendar/` - Google Calendar integration
- `/api/focus/` - Focus mode features

## Related Project

The iOS/macOS Swift app is in a separate repo:
- Location: `/Users/tombragg/Desktop/TomOS/`
- Contains: SwiftUI app with menu bar interface
- Handles: Push notification display, device registration

## Progress Tracking

| File | Purpose |
|------|---------|
| `claude-progress.txt` | Session logs and work history |
| `CLAUDE.local.md` | Personal notes (gitignored) |
