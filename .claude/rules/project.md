# TomOS Project Rules

## Project Identity
- **Name**: TomOS
- **Purpose**: ADHD-friendly task management with intelligent push notifications
- **User**: Tom Bragg (Sydney, Australia)

## Architecture Decisions

### Push Notifications: APNs Only
- Use Apple Push Notification service (APNs) for all push notifications
- NEVER use ntfy - it has been fully deprecated
- All notifications go through `/api/send-push` endpoint

### Two Separate Projects
- **Backend** (this repo): `/Users/tombragg/Desktop/Projects/TomOS/`
- **iOS/macOS App**: `/Users/tombragg/Desktop/TomOS/`
- Do NOT confuse these - they are separate git repos

### Timezone: Sydney
- All date/time operations use `Australia/Sydney` timezone
- Scheduled notifications: 8am and 6pm Sydney time
- Claude AI receives current Sydney time for relative date parsing

## Code Standards

### API Routes
- Use Next.js 14 App Router (`app/api/*/route.ts`)
- Validate input with Zod schemas
- Handle errors gracefully - don't block primary operations on secondary failures
- Background operations (calendar sync, push) should not block task creation

### TypeScript
- Strict mode enabled
- Use proper types, avoid `any` where possible
- Zod for runtime validation

### Notion Integration
- Database ID: `739144099ebc4ba1ba619dd1a5a08d25` (main tasks)
- Device tokens stored in separate auto-created database

## Deployment

### Vercel
- Region: `syd1` (Sydney)
- Production URL: https://tomos-task-api.vercel.app
- All env vars configured in Vercel dashboard

### GitHub Actions
- Handles scheduled notifications (not Vercel crons - free tier limit)
- Uses `CRON_SECRET` for authentication
- Workflow: `.github/workflows/scheduled-notifications.yml`

## Constraints

1. Keep it simple - reliability over features
2. Don't over-engineer for hypothetical requirements
3. Sydney timezone for all operations
4. APNs only, no ntfy
5. Read CLAUDE_CODE_HANDOVER.md at session start
