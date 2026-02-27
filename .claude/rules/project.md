# TomOS Project Rules

## Project Identity
- **Name**: TomOS
- **Purpose**: ADHD-friendly task management with intelligent push notifications, legal matter tracking, notes, journaling, and fitness
- **User**: Tom Bragg (Sydney, Australia)

## Architecture Decisions

### Database: PostgreSQL (Neon, Sydney) via Prisma
- PostgreSQL is the ONLY database — Notion is NOT used
- All data stored in Neon Postgres (Sydney region)
- Prisma ORM for all database operations
- Exception: device tokens still in Notion (migration to Postgres pending)

### Client: tomos-web PWAs
- tomos-web monorepo is the primary (only) frontend
- 5 PWAs: Tasks, Notes, Matters, Journal, Fitness
- Swift native apps are fully deprecated — do not reference or build them

### Push Notifications: APNs Only
- Use Apple Push Notification service (APNs) for all push notifications
- NEVER use ntfy - it has been fully deprecated
- All notifications go through `/api/send-push` endpoint

### Two Separate Projects
- **Backend** (this repo): `/Users/tombragg/Desktop/Projects/TomOS/`
- **tomos-web** (frontend): `/Users/tombragg/Desktop/Projects/tomos-web/`
- Do NOT confuse these - they are separate git repos

### Timezone: Sydney
- All date/time operations use `Australia/Sydney` timezone
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

## Deployment

### Vercel
- Region: `syd1` (Sydney)
- Production URL: https://tomos-task-api.vercel.app
- All env vars configured in Vercel dashboard

### Scheduled Jobs
- **Legal deadlines:** Vercel cron, 6:00am Sydney daily
- **Gym suggestion:** GitHub Actions, 6:30am Sydney daily
- Morning overview and EOD summary are disabled

## Constraints

1. Keep it simple - reliability over features
2. Don't over-engineer for hypothetical requirements
3. Sydney timezone for all operations
4. APNs only, no ntfy
5. PostgreSQL only, no Notion (except legacy device tokens)
6. tomos-web PWAs are the frontend, not Swift apps
