# TomOS: Life — Module Specification

## Overview

Personal planning, productivity, and daily life management. Mirrors the TomOS: Training architecture: **Postgres API endpoints** (source of truth) + **Claude skills** (conversational interface) + **thin PWA** (phone-accessible) + **CC** (power-user CLI).

**Not** a standalone app. An extension of the existing TomOS API backend (`tomos-task-api.vercel.app`) with a new PWA in the `tomos-web` monorepo.

---

## 1. Database Schema (Prisma additions to existing schema.prisma)

All new models go at the bottom of the existing schema file, in a new `LIFE` section.

```prisma
// ============================================
// LIFE — Personal Planning & Productivity
// ============================================
// ─── Goals ──────────────────────────────────────
model Goal {
  id          String   @id @default(uuid())
  title       String
  description String?  @db.Text
  category    String   // health, family, career, financial, creative, social, learning
  timeframe   String   // weekly, monthly, quarterly, yearly
  status      String   @default("active") // active, completed, paused, abandoned
  progress    Int      @default(0) // 0-100 percentage
  targetDate  DateTime?
  completedAt DateTime?

  // Parent goal for hierarchical goals
  parentId    String?
  parent      Goal?    @relation("SubGoals", fields: [parentId], references: [id], onDelete: SetNull)
  children    Goal[]   @relation("SubGoals")

  // Linked habits
  habits      Habit[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("goals")
  @@index([status])
  @@index([category])
  @@index([timeframe])
  @@index([parentId])
}
// ─── Habits ─────────────────────────────────────
model Habit {
  id          String   @id @default(uuid())
  title       String
  description String?
  frequency   String   // daily, weekdays, weekends, mon_wed_fri, tue_thu, custom
  customDays  Int[]    // [1,3,5] for Mon/Wed/Fri if frequency=custom (1=Mon, 7=Sun)
  category    String?  // health, productivity, family, wellbeing
  icon        String?  // Emoji
  status      String   @default("active") // active, paused, archived
  streakCurrent Int    @default(0)
  streakBest    Int    @default(0)

  goalId      String?
  goal        Goal?    @relation(fields: [goalId], references: [id], onDelete: SetNull)
  logs        HabitLog[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("habits")
  @@index([status])
  @@index([goalId])
}

model HabitLog {
  id        String   @id @default(uuid())
  habitId   String
  date      DateTime // Date only (no time), Sydney TZ
  completed Boolean  @default(true)
  notes     String?
  habit     Habit    @relation(fields: [habitId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@unique([habitId, date])
  @@map("habit_logs")
  @@index([habitId])
  @@index([date])
}
// ─── Shopping List ──────────────────────────────
model ShoppingItem {
  id        String   @id @default(uuid())
  name      String
  quantity  String?  // "2", "1kg", "bunch of"
  category  String?  // produce, dairy, meat, pantry, household, other
  checked   Boolean  @default(false)
  listId    String?  // For multiple lists (null = default list)
  sortOrder Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("shopping_items")
  @@index([checked])
  @@index([listId])
  @@index([category])
}

// ─── Weekly Plans ───────────────────────────────
model WeeklyPlan {
  id          String   @id @default(uuid())
  weekStart   DateTime // Monday of the week (Sydney TZ)
  energyLevel Int?     // 1-5
  kidWeek     Boolean? // true = kids week
  priorities  Json?    // [{title, category, status}]
  intentions  Json?    // [{day, focus, notes}]
  reflection  String?  @db.Text
  satisfactionScore Int? // 1-5 end-of-week rating
  status      String   @default("active") // draft, active, completed
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([weekStart])
  @@map("weekly_plans")
  @@index([status])
  @@index([weekStart])
}
```

---
## 2. API Endpoints

All under `/api/life/` in the existing TomOS API repo. Follow existing patterns (JSON responses, `{ success, data }` envelope, pagination via `limit`/`offset`).

### Goals
```
GET    /api/life/goals                  # List (filter: status, category, timeframe)
POST   /api/life/goals                  # Create
GET    /api/life/goals/[id]             # Get with children + linked habits
PATCH  /api/life/goals/[id]             # Update (including progress)
DELETE /api/life/goals/[id]             # Soft archive
```

### Habits
```
GET    /api/life/habits                 # List (filter: status, category)
POST   /api/life/habits                 # Create
GET    /api/life/habits/[id]            # Get with recent logs (last 30 days)
PATCH  /api/life/habits/[id]            # Update
DELETE /api/life/habits/[id]            # Archive

POST   /api/life/habits/[id]/log       # Log completion for a date
GET    /api/life/habits/check-in       # Today's habits with completion status (Sydney TZ)
POST   /api/life/habits/check-in       # Batch log today's habits
```

### Shopping
```
GET    /api/life/shopping               # List (filter: listId, checked)
POST   /api/life/shopping               # Add item(s) — single or array
PATCH  /api/life/shopping/[id]          # Update item
DELETE /api/life/shopping/[id]          # Remove item
POST   /api/life/shopping/check         # Toggle checked { id } or batch { ids: [] }
POST   /api/life/shopping/clear         # Clear checked items (delete all checked=true)
POST   /api/life/shopping/parse         # NLP parse: "milk, 2kg chicken, bunch of bananas" → structured items
```

### Weekly Plans
```
GET    /api/life/plans                  # List (filter: status)
GET    /api/life/plans/current          # Get this week's plan (auto-creates if none)
POST   /api/life/plans                  # Create plan for a specific week
PATCH  /api/life/plans/[id]             # Update (priorities, intentions, reflection)
```

### Dashboard (aggregated read endpoint for skills/PWA)
```
GET    /api/life/today                  # Today snapshot:
                                        #   - today's habits + completion status
                                        #   - active shopping list count
                                        #   - current weekly plan priorities
                                        #   - open tasks (top 5 by priority/due)
                                        #   - journal mood (last entry)
                                        #   - training (today's prescription if any)
```

The `/api/life/today` endpoint is the **key integration point** — it pulls from across TomOS modules to give skills and the PWA a single call for "what's my day look like?"

---

## 3. PWA: `tomos-life`

New app in the `tomos-web` monorepo at `apps/life/`. Deployed to `tomos-life.vercel.app`.
### Pages / Tabs (BottomNav)

| Tab | View | Purpose |
|-----|------|---------|
| **Today** | Daily dashboard | Calendar, top priorities, habits checklist, quick actions |
| **Plan** | Weekly plan | This week's priorities, daily intentions, energy level |
| **Habits** | Habit tracker | List of active habits, streak display, today's check-off |
| **Shop** | Shopping list | Categorised list, check-off at store, quick add |
| **Goals** | Goal overview | Active goals, progress bars, linked habits |

### Design
- Follow existing `@tomos/ui` components and `violet-600` brand colour
- Mobile-first (this is the "at Woolies" app)
- Quick interactions: tap to check habit, tap to check shopping item
- Desktop sidebar with cross-app navigation (AppSwitcher pattern)

### Key UX decisions
- **Today tab** calls `/api/life/today` for a single consolidated view
- **Shop tab** works offline-capable where possible (optimistic updates)
- **Habits** show streak with visual cue (flame emoji after 7+ days)
- No AI in the PWA itself — AI lives in Claude skills. PWA is pure data display/capture.

---

## 4. Shared Package Additions

### `packages/api/src/life.ts`
New API client module following the `fitness.ts` pattern. Exports functions for all `/api/life/*` endpoints.

### `packages/api/src/types.ts`
Add TypeScript interfaces: `Goal`, `Habit`, `HabitLog`, `ShoppingItem`, `WeeklyPlan`, `TodaySnapshot`, etc.
---

## 5. Claude Skills (conversation layer)

These skills call `/api/life/*` endpoints. They are **stateless** — every invocation rebuilds context from the API, not from chat history. This solves the context maxout problem.

### `/planweek` — Weekly Plan Generator (Personal)
**Trigger:** "plan my week", "what should I focus on", "weekly priorities"
**Inputs:** Energy level (1-5), kid week (y/n), any constraints
**Actions:**
1. `GET /api/life/plans/current` — check if plan exists
2. `GET /api/life/today` — current state snapshot
3. Pull Google Calendar events for the week (via GCal MCP)
4. `GET /api/tasks?status=todo&priority=high,urgent` — open tasks
5. Generate prioritised weekly plan
6. `POST /api/life/plans` or `PATCH` — save to Postgres
**Output:** Clean daily schedule with top 3-5 priorities, daily focus areas

### `/today` — Daily Focus
**Trigger:** "what's today", "morning briefing", "what should I focus on today"
**Actions:**
1. `GET /api/life/today` — single call gets everything
2. Optionally pull Google Calendar for time-specific items
3. Present: priorities, calendar, habits to do, shopping list status
**Output:** Concise daily briefing. One screen. No scroll.

### `/review` — End of Week Review
**Trigger:** "how'd my week go", "weekly review", "end of week"
**Actions:**
1. `GET /api/life/plans/current` — this week's plan + priorities
2. `GET /api/life/habits/check-in` + historical data — completion rates3. `GET /api/journal/insights` — mood/energy trends
4. `GET /api/gym/coach/summary?days=7` — training summary
5. Ask Tom 2-3 reflection questions
6. `PATCH /api/life/plans/[id]` — save reflection + satisfaction score
**Output:** Structured reflection. What worked, what didn't, one thing to carry forward.

### `/shoplist` — Shopping List Manager
**Trigger:** "shopping list", "add to list", "what do I need", "going to Woolies"
**Actions:**
1. `GET /api/life/shopping` — current list
2. If adding: `POST /api/life/shopping/parse` — NLP parse natural language
3. If clearing: `POST /api/life/shopping/clear`
**Output:** Categorised shopping list. Or confirmation of adds/removes.

### `/habits` — Habit Check-in
**Trigger:** "habit check", "did I do my habits", "log habits"
**Actions:**
1. `GET /api/life/habits/check-in` — today's habits + status
2. Conversational check-in or batch log
3. `POST /api/life/habits/check-in` — save
**Output:** Today's habits with completion status. Streak info. No guilt on misses.

---

## 6. Google Calendar Integration

Two-way via existing Google Calendar MCP (already configured in Claude Desktop/claude.ai):

**Read:** Pull events for today/this week in `/planweek` and `/today` skills
**Write:** Create focus blocks or reminders from weekly plan (with Tom's permission)
The `/api/life/today` backend endpoint does NOT call GCal directly — that happens at the skill layer via MCP. This keeps the API simple and avoids storing GCal tokens in the backend.

---

## 7. CC (Claude Code) Integration

CC already has access to the TomOS repo. Once the API endpoints exist, CC can:
- Quick-add shopping items: `"add milk and eggs to shopping list"`
- Check habits: `"log habits for today"`
- Plan the week: `"plan my week, energy 3, kid week"`
- All via the same API endpoints the skills and PWA use

The CLAUDE.md in the TomOS repo gets updated with the new `/api/life/*` endpoints documentation (same format as the existing MatterOS and FitnessOS sections).

---

## 8. Build Order

| Phase | What | Where | Effort |
|-------|------|-------|--------|
| **1** | Prisma schema + migration | `TomOS/prisma/schema.prisma` | 30 min |
| **2** | API endpoints (all `/api/life/*`) | `TomOS/app/api/life/` | 2-3 hours |
| **3** | API client (`life.ts` + types) | `tomos-web/packages/api/` | 30 min |
| **4** | PWA scaffold + Today + Shop tabs | `tomos-web/apps/life/` | 2-3 hours |
| **5** | PWA remaining tabs (Plan, Habits, Goals) | `tomos-web/apps/life/` | 2-3 hours |
| **6** | CLAUDE.md update | `TomOS/CLAUDE.md` | 15 min |
| **7** | Skills (as separate skill files) | Skill creator or manual | 1-2 hours |
| **8** | Deploy + test | Vercel | 30 min |

**CC handles phases 1-6. Skills (phase 7) can be created via skill-creator in claude.ai or manually.**
---

## 9. What This Doesn't Include (Deliberately)

- **Time blocking** — Calendar is the interface for that. Skills can create events but we don't need a custom time-blocking UI.
- **Pomodoro/focus timer** — Use existing apps (Forest, etc.). Not worth building.
- **Meal planning** — You've explored Mealie. Not duplicating here. Shopping list covers grocery capture.
- **Budget tracking** — Different domain. Maybe later as a separate module.
- **Notification crons** — Can add a morning push (`/api/cron/life-morning`) later if needed, same pattern as gym-suggestion.

---

## 10. Relation to Existing Modules

| Module | Relation to Life |
|--------|-----------------|
| **Tasks** | `/api/life/today` reads open tasks. Goals can reference tasks but don't duplicate them. |
| **Journal** | `/api/life/today` reads last mood. `/review` reads weekly mood trends. No data duplication. |
| **Fitness** | `/api/life/today` reads today's prescription. `/review` reads training summary. Separate domains. |
| **Notes** | No direct integration. Notes are knowledge, Life is action. |
| **Matters** | No direct integration (work vs personal). |

Life is the **orchestration layer** — it reads from other modules but owns only goals, habits, shopping, and weekly plans.