# TomOS: Life Module — Claude Code Build Instructions

## Context

I'm adding a personal planning and productivity module to TomOS called "Life". This follows the same architecture as FitnessOS: Postgres schema → API endpoints → shared API client → thin PWA → Claude skills as the conversational layer.

The full spec is at: `/Users/tombragg/Desktop/Projects/TomOS/docs/LIFE-MODULE-SPEC.md`

**Read that spec first before doing anything.**

## What to Build (in order)

### Phase 1: Schema + Migration

Working in: `/Users/tombragg/Desktop/Projects/TomOS/`

Add these models to the END of `prisma/schema.prisma` (after the Journal section), in a new `// ============================================ // LIFE` section:

**5 new models:**
- `Goal` — id, title, description, category (health/family/career/financial/creative/social/learning), timeframe (weekly/monthly/quarterly/yearly), status, progress (0-100), targetDate, parentId self-relation for sub-goals, relation to Habit[]
- `Habit` — id, title, description, frequency (daily/weekdays/weekends/mon_wed_fri/tue_thu/custom), customDays Int[], category, icon, status, streakCurrent, streakBest, goalId FK, relation to HabitLog[]
- `HabitLog` — id, habitId, date, completed Boolean, notes. @@unique([habitId, date])
- `ShoppingItem` — id, name, quantity String?, category (produce/dairy/meat/pantry/household/other), checked Boolean, listId String?, sortOrder Int
- `WeeklyPlan` — id, weekStart DateTime (@@unique), energyLevel Int?, kidWeek Boolean?, priorities Json?, intentions Json?, reflection Text?, satisfactionScore Int?, status

Follow existing conventions: `@@map("snake_case")`, uuid PKs, proper indexes on status/date/FK fields, Sydney timezone awareness for date fields.

Then run `npx prisma migrate dev --name add-life-module` and `npx prisma generate`.
### Phase 2: API Endpoints

Create `/app/api/life/` directory structure:

```
app/api/life/
├── goals/
│   ├── route.ts           # GET (list) + POST (create)
│   └── [id]/
│       └── route.ts       # GET + PATCH + DELETE
├── habits/
│   ├── route.ts           # GET (list) + POST (create)
│   ├── check-in/
│   │   └── route.ts       # GET (today's status) + POST (batch log)
│   └── [id]/
│       ├── route.ts       # GET + PATCH + DELETE
│       └── log/
│           └── route.ts   # POST (log single day)
├── shopping/
│   ├── route.ts           # GET (list) + POST (add)
│   ├── check/
│   │   └── route.ts       # POST (toggle checked)
│   ├── clear/
│   │   └── route.ts       # POST (clear checked items)
│   ├── parse/
│   │   └── route.ts       # POST (NLP parse text → items, uses Claude Haiku)
│   └── [id]/
│       └── route.ts       # PATCH + DELETE
├── plans/
│   ├── route.ts           # GET (list) + POST (create)
│   ├── current/
│   │   └── route.ts       # GET (this week, auto-create if none)
│   └── [id]/
│       └── route.ts       # GET + PATCH
└── today/
    └── route.ts           # GET (aggregated dashboard snapshot)
```
**Pattern to follow:** Look at `/app/api/gym/sessions/route.ts` and `/app/api/gym/recovery/route.ts` for the response envelope pattern (`{ success: true, data: ... }`), error handling, and Prisma usage. Use `lib/sydney-time.ts` for any date logic.

**Key implementation notes:**
- `GET /api/life/habits/check-in` — uses `getSydneyToday()` from `lib/sydney-time.ts` to determine today, returns all active habits with whether they have a log for today
- `POST /api/life/shopping/parse` — accepts `{ text: "milk, 2kg chicken, bunch of bananas" }`, uses Claude Haiku to extract structured items `[{ name, quantity, category }]`, then creates them. Same pattern as task NLP parsing.
- `GET /api/life/plans/current` — calculates Monday of current week (Sydney TZ), finds or creates a WeeklyPlan for that weekStart
- `GET /api/life/today` — aggregates data from multiple tables in parallel:
  - Active habits + today's completion (from habits + habit_logs)
  - Unchecked shopping items count (from shopping_items)
  - Current week's priorities (from weekly_plans)
  - Top 5 open tasks by priority/due (from tasks)
  - Last journal mood/energy (from journal_entries ORDER BY entryDate DESC LIMIT 1)
  - Today's coach prescription if any (from coach_prescriptions)

**After completing Phases 1-2:** Commit and deploy the backend before moving on.
```bash
git add . && git commit -m "feat: add Life module — schema + API endpoints" && git push
```
Vercel will auto-deploy. Verify the endpoints respond before building the PWA.

---

> **⚠️ REPO SWITCH: Phases 1-2 are in the TomOS backend repo. Phases 3-5 are in a DIFFERENT repo — the tomos-web monorepo. You must stop here, commit/push the backend work, then open a new CC session in the tomos-web repo:**
> ```bash
> cd /Users/tombragg/Desktop/Projects/tomos-web && claude
> ```
> **Paste the remainder of this spec (Phase 3 onwards) into that new session.**

---
### Phase 3: Shared API Client

Working in: `/Users/tombragg/Desktop/Projects/tomos-web/`

Create `packages/api/src/life.ts` following the exact pattern of `packages/api/src/fitness.ts`:
- Import `get, post, patch, del` from `./client`
- Import types from `./types`
- Export async functions for each endpoint

Add TypeScript interfaces to `packages/api/src/types.ts`:
```typescript
// Life module types
export interface Goal { ... }
export interface Habit { ... }
export interface HabitLog { ... }
export interface ShoppingItem { ... }
export interface WeeklyPlan { ... }
export interface TodaySnapshot { ... }
export interface HabitCheckIn { habit: Habit; completedToday: boolean; streak: number; }
```

Re-export from `packages/api/src/index.ts`.

### Phase 4: PWA Scaffold

Create `apps/life/` in the tomos-web monorepo. Use `apps/fitness/` as the template — copy and adapt:

- `package.json` — name: `@tomos/life`, port: 3007
- `next.config.mjs` — transpilePackages: ['@tomos/api', '@tomos/ui']
- `tailwind.config.ts` — same as fitness
- `app/layout.tsx` — TomOS Life title, violet brand
- `app/page.tsx` — redirect to /today
**5 pages:**
- `app/today/page.tsx` — calls `useLifeToday()` hook, shows calendar summary, priorities, habits checklist, shopping count
- `app/plan/page.tsx` — weekly plan view, priorities editor, daily intentions
- `app/habits/page.tsx` — habit list with streaks, tap-to-complete, add new
- `app/shop/page.tsx` — shopping list with categories, check-off, quick add input, clear checked
- `app/goals/page.tsx` — goal cards with progress bars, linked habits

**Components:**
- `components/BottomNav.tsx` — 5 tabs (Today, Plan, Habits, Shop, Goals) + desktop sidebar with cross-app AppSwitcher
- `components/AppSwitcher.tsx` — copy from fitness, add life app link
- `components/HabitRow.tsx` — habit name + streak + tap to toggle
- `components/ShoppingItemRow.tsx` — item name + quantity + tap to check
- `components/PriorityCard.tsx` — priority title + category badge + status

**Hooks (in `hooks/`):**
- `useLifeToday.ts` — calls `/api/life/today`
- `useGoals.ts` — CRUD for goals
- `useHabits.ts` — CRUD + check-in for habits
- `useShopping.ts` — CRUD + check + clear + parse for shopping
- `usePlans.ts` — weekly plan CRUD + current

### Phase 5: Update CLAUDE.md

Add a `## Life Module` section to `/Users/tombragg/Desktop/Projects/TomOS/CLAUDE.md` documenting all new endpoints, same format as the MatterOS and FitnessOS sections.

### Phase 6: Deploy

1. Backend: commit + push TomOS repo, Vercel auto-deploys
2. PWA: update `vercel.json` in tomos-web for life app, `vercel link --project tomos-life --yes && vercel --prod --yes`
## Important Constraints

- Use `lib/sydney-time.ts` for ALL date logic (getSydneyToday, getSydneyDayBounds)
- Follow existing response envelope: `{ success: boolean, data: T }` with proper error responses
- No authentication (personal tools, existing pattern)
- Use Prisma's `$transaction` for batch operations
- Fire-and-forget for non-critical background ops (streak calculation, etc.)
- Mobile-first PWA design, violet-600 brand colour
- TanStack Query v5 for data fetching in PWA
- Tailwind CSS v4 with `@theme` blocks

## Don't

- Don't create a separate Vercel project for the API — everything goes in the existing TomOS backend
- Don't add Google Calendar integration to the backend — that stays in the Claude skill layer via MCP
- Don't build AI features into the PWA — AI lives in Claude skills
- Don't create notification crons yet — can add later
- Don't touch existing tables — Life module only reads from tasks/journal/coach_prescriptions, doesn't modify them