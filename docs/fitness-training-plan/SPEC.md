# FitnessOS Training Plan System — Claude Code Handoff

**Date:** 4 March 2026
**Author:** Claude (TomOS: Training project)
**Target repos:** `tomos-web` (frontend) + `TomOS` (backend)
**Context:** Tom is returning to running after ~6 weeks reduced activity, targeting Gold Coast Marathon (4-5 Jul 2026) and a trail ultra later in the year. Needs a training plan system in Postgres that integrates with existing FitnessOS (gym sessions, Strava sync, recovery check-ins, progressive overload engine).

---

## 1. Why This Exists

FitnessOS currently tracks **what you did** (gym sessions, Strava runs, recovery) but has no concept of **what you should do**. The daily plan engine (`/api/gym/daily-plan`) can recommend a gym session type but can't say "today is a 12km progressive long run at easy pace" or "this is Week 3 of your marathon build, target 32km total."

The Notion TrainingOS (Week Planner, Run Log) was built to fill this gap but has broken data sources and creates a split-brain problem with Postgres. This spec consolidates everything into Postgres.

### What changes:
- New Prisma models: `TrainingBlock`, `TrainingWeek`, `PlannedSession`
- New API endpoints for plan CRUD + "what should I do today" enhanced context
- New exercises seeded for CrossFit/metcon variety
- Updated daily plan engine to incorporate planned sessions
- Kid week / non-kid week flexibility built into the plan structure

### What doesn't change:
- Existing `GymSession`, `Exercise`, `RunningSync`, `RecoveryCheckIn` models — untouched
- Existing suggestion engine, progressive overload, ACWR — all preserved
- Strava sync — still works as-is (tokens were just re-authed 4 Mar 2026)

---

## 2. Schema Changes (Prisma)

Add to `prisma/schema.prisma`:

```prisma
// ============================================
// TRAINING PLAN — Periodised Training Structure
// ============================================

model TrainingBlock {
  id          String   @id @default(uuid())
  name        String   // "Rebuild Phase", "Base Building", "GC Marathon Specific", "Taper"
  phase       String   // rebuild, base, build, specific, taper, race, recovery
  startDate   DateTime
  endDate     DateTime
  targetWeeklyKm  Float?   // Target weekly running volume
  notes       String?  @db.Text
  status      String   @default("planned") // planned, active, completed

  // Relations
  weeks       TrainingWeek[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("training_blocks")
  @@index([status])
  @@index([startDate])
}

model TrainingWeek {
  id          String   @id @default(uuid())
  blockId     String
  weekNumber  Int      // Week number within the block (1, 2, 3...)
  startDate   DateTime // Monday of this week
  targetKm    Float?   // Target total running km
  actualKm    Float?   // Populated from RunningSync after the week
  keyFocus    String?  // "rebuild easy volume", "introduce tempo", "long run to 16km"
  weekType    String?  // "kid", "non-kid", null (set dynamically each week)
  notes       String?  @db.Text
  status      String   @default("planned") // planned, active, completed, deload

  // Relations
  block       TrainingBlock @relation(fields: [blockId], references: [id], onDelete: Cascade)
  sessions    PlannedSession[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("training_weeks")
  @@index([blockId])
  @@index([startDate])
  @@index([status])
}

model PlannedSession {
  id              String   @id @default(uuid())
  weekId          String
  dayOfWeek       Int      // 1=Mon, 2=Tue, ..., 7=Sun
  sessionType     String   // easy, long, tempo, intervals, hills, time_trial, progressive, bft, metcon, rest, ocean, flex
  targetDistanceKm Float?  // null for BFT/metcon/rest
  targetPaceZone  String?  // "easy", "moderate", "tempo", "threshold", "interval", null
  sessionName     String?  // "8km Tempo 2-1-1", "Hill Repeats", "BFT", "AMRAP 15"
  notes           String?  @db.Text
  isOptional      Boolean  @default(false) // true = can skip without guilt
  isKidWeekOnly   Boolean  @default(false) // session structure changes for kid weeks
  isNonKidOnly    Boolean  @default(false) // extra sessions in non-kid weeks

  // Completion linking
  linkedRunId         String?  @unique // → RunningSync.id (matched after Strava sync)
  linkedGymSessionId  String?  @unique // → GymSession.id (for BFT/metcon days)
  status              String   @default("planned") // planned, completed, modified, skipped, minimum_dose

  // Relations
  week            TrainingWeek @relation(fields: [weekId], references: [id], onDelete: Cascade)
  linkedRun       RunningSync? @relation(fields: [linkedRunId], references: [id], onDelete: SetNull)
  linkedGymSession GymSession? @relation(fields: [linkedGymSessionId], references: [id], onDelete: SetNull)

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("planned_sessions")
  @@index([weekId])
  @@index([dayOfWeek])
  @@index([status])
  @@index([sessionType])
}
```

**Also add reverse relations** to existing models:

```prisma
// Add to RunningSync model:
  plannedSession  PlannedSession?

// Add to GymSession model:
  plannedSession  PlannedSession?
```

### Migration

```bash
npx prisma migrate dev --name add-training-plan-system
```

---

## 3. New API Endpoints

### 3.1 Training Blocks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/training/blocks` | List all blocks (optional `?status=active`) |
| POST | `/api/training/blocks` | Create a new training block |
| GET | `/api/training/blocks/[id]` | Get block with weeks and sessions |
| PATCH | `/api/training/blocks/[id]` | Update block (status, dates, notes) |

### 3.2 Training Weeks

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/training/weeks/current` | Get current week (by date) with all planned sessions |
| PATCH | `/api/training/weeks/[id]` | Update week (weekType, notes, actualKm, status) |
| POST | `/api/training/weeks/[id]/reconcile` | Match completed runs/sessions to planned sessions |

### 3.3 Planned Sessions

| Method | Path | Description |
|--------|------|-------------|
| PATCH | `/api/training/sessions/[id]` | Update planned session (status, link to actual) |
| GET | `/api/training/today` | **The key endpoint** — what should I do today? |

### 3.4 Enhanced Daily Plan

Update the existing `/api/gym/daily-plan` to incorporate training plan context:

```typescript
// In daily-plan route, add:
const currentWeek = await prisma.trainingWeek.findFirst({
  where: {
    startDate: { lte: today },
    // endDate is startDate + 7 days
    block: { status: 'active' }
  },
  include: { sessions: true, block: true },
  orderBy: { startDate: 'desc' },
})

const todaysPlannedSession = currentWeek?.sessions.find(
  s => s.dayOfWeek === todayDayOfWeek && s.status === 'planned'
)

// Add to response:
{
  ...existingResponse,
  trainingPlan: {
    block: currentWeek?.block.name,
    phase: currentWeek?.block.phase,
    weekNumber: currentWeek?.weekNumber,
    targetKm: currentWeek?.targetKm,
    todaysSession: todaysPlannedSession ? {
      type: todaysPlannedSession.sessionType,
      name: todaysPlannedSession.sessionName,
      distance: todaysPlannedSession.targetDistanceKm,
      pace: todaysPlannedSession.targetPaceZone,
      notes: todaysPlannedSession.notes,
      isOptional: todaysPlannedSession.isOptional,
    } : null,
    weekProgress: {
      planned: currentWeek?.sessions.length,
      completed: currentWeek?.sessions.filter(s => s.status === 'completed').length,
      targetKm: currentWeek?.targetKm,
      actualKm: currentWeek?.actualKm,
    }
  }
}
```

### 3.5 Auto-Reconciliation

When Strava syncs a new run, try to auto-match it to a planned session:

```typescript
// In the Strava webhook handler (POST /api/gym/sync/strava), after creating RunningSync:
// Find today's unmatched planned session of matching type
const planned = await prisma.plannedSession.findFirst({
  where: {
    status: 'planned',
    linkedRunId: null,
    week: {
      startDate: { lte: activityDate },
      block: { status: 'active' },
    },
    dayOfWeek: activityDate.getDay() === 0 ? 7 : activityDate.getDay(),
  },
})

if (planned) {
  await prisma.plannedSession.update({
    where: { id: planned.id },
    data: {
      linkedRunId: newRunSync.id,
      status: 'completed',
    },
  })
}
```

---

## 4. Kid Week / Non-Kid Week Flexibility

The plan structure supports this natively through `PlannedSession` flags:

- `isNonKidOnly: true` — extra sessions only done in non-kid weeks (e.g., Sunday double, extra metcon)
- `isKidWeekOnly: true` — alternative lighter sessions for kid weeks
- `isOptional: true` — can skip without the system marking it as a failure

### How it works in practice:

**Non-kid week (full load):**
- Mon: BFT
- Tue: Easy run 8km
- Wed: BFT + quality run (double session day)
- Thu: Easy run 7km
- Fri: Rest + ocean
- Sat: Long run 16km
- Sun: Metcon/CrossFit session (isNonKidOnly)

**Kid week (modified):**
- Mon: BFT
- Tue: Easy run 6km
- Wed: Quality run OR BFT (not both)
- Thu: Rest or easy 4km (isOptional)
- Fri: Rest + ocean
- Sat: Long run (same target as non-kid — this is sacred)
- Sun: Rest

The `TrainingWeek.weekType` gets set each week (manually or via a simple toggle in the app). The daily plan endpoint filters sessions accordingly.

---

## 5. Exercise Library — Missing Exercises to Seed

Current DB has 24 exercises. Add these for CrossFit/metcon variety:

```typescript
const newExercises = [
  // ============================================
  // CONDITIONING — CrossFit/Metcon additions
  // ============================================
  {
    name: 'Box Step-Up',
    category: 'conditioning',
    equipment: ['box', 'dumbbell'],
    primaryMuscles: ['quads', 'glutes'],
    movementPattern: 'squat',
    cues: 'Full step up, drive through heel. Control descent. Alternate legs.',
    spineNotes: 'Controlled movement, no spinal compression concerns',
  },
  {
    name: 'DB Snatch',
    category: 'conditioning',
    equipment: ['dumbbell'],
    primaryMuscles: ['shoulders', 'glutes', 'core'],
    movementPattern: 'compound',
    cues: 'Floor to overhead in one movement. Hip snap drives the weight. Alternate arms.',
    spineNotes: 'Maintain neutral spine through hip hinge — avoid rounding',
  },
  {
    name: 'Ball Slam',
    category: 'conditioning',
    equipment: ['medicine_ball'],
    primaryMuscles: ['core', 'lats', 'shoulders'],
    movementPattern: 'compound',
    cues: 'Full extension overhead. Slam with core, not arms. Catch on bounce.',
    spineNotes: 'Good explosive movement — keep core braced on slam',
  },
  {
    name: 'Devil\'s Press',
    category: 'conditioning',
    equipment: ['dumbbell'],
    primaryMuscles: ['full_body'],
    movementPattern: 'compound',
    cues: 'Burpee with DBs to double snatch overhead. Fluid movement.',
    spineNotes: 'Control the burpee portion — avoid collapsing',
  },
  {
    name: 'Man Maker',
    category: 'conditioning',
    equipment: ['dumbbell'],
    primaryMuscles: ['full_body'],
    movementPattern: 'compound',
    cues: 'Push-up, row each arm, clean to squat, press. Keep core braced throughout.',
    spineNotes: 'Complex movement — core must stay braced during row. Reduce weight if back rounds.',
  },
  {
    name: 'Push Press',
    category: 'conditioning',
    equipment: ['barbell', 'dumbbell'],
    primaryMuscles: ['shoulders', 'quads', 'core'],
    movementPattern: 'push',
    cues: 'Quarter dip, drive through legs, press overhead. Lockout with ears through arms.',
    spineNotes: 'Keep core braced — avoid excessive lumbar extension at lockout',
  },
  {
    name: 'Hang Power Clean',
    category: 'conditioning',
    equipment: ['barbell', 'dumbbell', 'kettlebell'],
    primaryMuscles: ['glutes', 'hamstrings', 'traps'],
    movementPattern: 'hip_hinge',
    cues: 'Start at hang position (above knee). Hip snap to catch at shoulders. Elbows high.',
    spineNotes: 'Maintain neutral spine — the power comes from hips, not back',
  },
  {
    name: 'Mountain Climber',
    category: 'conditioning',
    equipment: ['bodyweight'],
    primaryMuscles: ['core', 'hip_flexors', 'shoulders'],
    movementPattern: 'cardio',
    cues: 'Plank position. Drive knees to chest alternating. Keep hips level.',
    spineNotes: 'Core engaged throughout — good for stability',
  },
  {
    name: 'Ski Erg',
    category: 'conditioning',
    equipment: ['erg'],
    primaryMuscles: ['lats', 'core', 'triceps'],
    movementPattern: 'cardio',
    cues: 'Hinge and pull. Arms extend overhead, hinge to drive down. Rhythm > power.',
    spineNotes: 'Hip hinge pattern — keep back neutral',
  },
  {
    name: 'Assault Bike',
    category: 'conditioning',
    equipment: ['erg'],
    primaryMuscles: ['full_body'],
    movementPattern: 'cardio',
    cues: 'Push and pull with arms. Legs drive the resistance. Settle into a pace.',
    spineNotes: null,
  },
  {
    name: 'Battle Rope',
    category: 'conditioning',
    equipment: ['battle_rope'],
    primaryMuscles: ['shoulders', 'core', 'grip'],
    movementPattern: 'compound',
    cues: 'Alternating waves, slams, or circles. Athletic stance. Keep core engaged.',
    spineNotes: null,
  },
  {
    name: 'Thruster (Barbell)',
    category: 'conditioning',
    equipment: ['barbell'],
    primaryMuscles: ['quads', 'glutes', 'shoulders'],
    movementPattern: 'compound',
    cues: 'Front squat to press in one movement. Drive out of the hole. Full lockout.',
    spineNotes: 'Keep core braced throughout — watch for lumbar rounding at bottom of squat',
  },
  {
    name: 'Toes to Bar',
    category: 'conditioning',
    equipment: ['pull_up_bar'],
    primaryMuscles: ['core', 'hip_flexors', 'grip'],
    movementPattern: 'compound',
    cues: 'Kip swing to lift toes to bar. Control the swing. Scale to knee raises.',
    spineNotes: 'Kipping version — monitor for lower back aggravation. Strict is spine-safer.',
  },
  {
    name: 'Rope Climb',
    category: 'conditioning',
    equipment: ['rope'],
    primaryMuscles: ['lats', 'biceps', 'grip', 'core'],
    movementPattern: 'pull',
    cues: 'Wrap feet for J-hook. Pull with arms, stand with legs. Controlled descent.',
    spineNotes: null,
  },
  {
    name: 'Double Under',
    category: 'conditioning',
    equipment: ['jump_rope'],
    primaryMuscles: ['calves', 'shoulders', 'core'],
    movementPattern: 'plyometric',
    cues: 'Wrists do the work. Small bounce. Stay tall. Scale to singles x3.',
    spineNotes: 'Low impact if good form — keep upright',
  },
  {
    name: 'Sandbag Clean',
    category: 'conditioning',
    equipment: ['sandbag'],
    primaryMuscles: ['glutes', 'hamstrings', 'biceps', 'core'],
    movementPattern: 'hip_hinge',
    cues: 'Bear hug the bag. Hip snap to lap, then to shoulder/chest. Stand tall.',
    spineNotes: 'Awkward loading — keep core very tight. Start light.',
  },

  // ============================================
  // HERO WODs / NAMED WORKOUTS — Stored as exercises for logging
  // These are workout FORMATS, not individual exercises.
  // The app can reference these by name in PlannedSession.sessionName
  // ============================================

  // NOTE: Hero WODs and named workouts should NOT be seeded as exercises.
  // Instead, add a WOD_LIBRARY to the suggestion engine (see Section 6).
]
```

### Seed script update

Add these to `scripts/seed-exercises.ts` and re-run:

```bash
npx tsx scripts/seed-exercises.ts
```

---

## 6. WOD Library — Hero WODs & Named Workouts

Add to `lib/fitness/suggestions.ts` — expand `WOD_TEMPLATES` with named/hero workouts:

```typescript
const WOD_TEMPLATES = [
  // --- Existing templates (keep these) ---
  { name: 'AMRAP 15', format: 'amrap', duration: 15, ... },
  { name: 'EMOM 20', format: 'emom', duration: 20, ... },
  { name: '21-15-9', format: 'fortime', duration: null, ... },
  { name: 'Tabata x4', format: 'tabata', duration: 16, ... },
  { name: '5 Rounds', format: 'fortime', duration: null, ... },

  // --- New named workouts ---
  {
    name: 'Cindy',
    format: 'amrap',
    duration: 20,
    description: 'AMRAP 20: 5 Pull-ups, 10 Push-ups, 15 Air Squats',
    slots: 0, // fixed workout, don't randomize exercises
    defaultReps: [5, 10, 15],
    requiresEquipment: ['pull_up_bar'],
    isNamed: true,
    fixedExercises: ['Pull-up', 'Push-up (for WOD)', 'Air Squat'],
  },
  {
    name: 'Helen',
    format: 'fortime',
    duration: null,
    description: '3 Rounds: 400m Run, 21 KB Swings, 12 Pull-ups',
    slots: 0,
    defaultReps: [1, 21, 12],
    requiresEquipment: ['kettlebell', 'pull_up_bar'],
    isNamed: true,
    fixedExercises: ['400m Run', 'KB Swing', 'Pull-up'],
  },
  {
    name: 'Murph',
    format: 'fortime',
    duration: null,
    description: '1 mile Run, 100 Pull-ups, 200 Push-ups, 300 Squats, 1 mile Run. Partition as needed.',
    slots: 0,
    defaultReps: [100, 200, 300],
    requiresEquipment: ['pull_up_bar'],
    isNamed: true,
    isHero: true,
    fixedExercises: ['1 mile Run', 'Pull-up', 'Push-up', 'Air Squat', '1 mile Run'],
    notes: 'Scale: Half Murph (halve everything). With vest if available.',
  },
  {
    name: 'DT',
    format: 'fortime',
    duration: null,
    description: '5 Rounds: 12 Deadlifts, 9 Hang Power Cleans, 6 Push Jerks (70/47.5kg)',
    slots: 0,
    defaultReps: [12, 9, 6],
    requiresEquipment: ['barbell'],
    isNamed: true,
    isHero: true,
  },
  {
    name: 'Fran',
    format: 'fortime',
    duration: null,
    description: '21-15-9: Thrusters (43/30kg), Pull-ups',
    slots: 0,
    defaultReps: [21, 15, 9],
    requiresEquipment: ['barbell', 'pull_up_bar'],
    isNamed: true,
  },
  {
    name: 'Grace',
    format: 'fortime',
    duration: null,
    description: '30 Clean & Jerks for time (60/43kg)',
    slots: 0,
    defaultReps: [30],
    requiresEquipment: ['barbell'],
    isNamed: true,
  },
  {
    name: 'Filthy Fifty',
    format: 'fortime',
    duration: null,
    description: '50 Box Jumps, 50 Jumping Pull-ups, 50 KB Swings, 50 Walking Lunges, 50 Knees-to-Elbows, 50 Push Press, 50 Back Extensions, 50 Wall Balls, 50 Burpees, 50 Double Unders',
    slots: 0,
    defaultReps: [50],
    requiresEquipment: ['box', 'kettlebell', 'barbell', 'medicine_ball', 'jump_rope'],
    isNamed: true,
    notes: 'Scale reps to 30 or 40 for first attempt.',
  },

  // --- Bodyweight-only options (for when no equipment / home) ---
  {
    name: 'Bodyweight Blast',
    format: 'amrap',
    duration: 15,
    description: 'AMRAP 15: 10 Burpees, 20 Mountain Climbers, 30 Air Squats',
    slots: 0,
    defaultReps: [10, 20, 30],
    requiresEquipment: [],
    isNamed: true,
  },
  {
    name: 'Death by Burpees',
    format: 'emom',
    duration: null,
    description: 'EMOM: 1 burpee in minute 1, 2 in minute 2... until you can\'t complete the reps in the minute.',
    slots: 0,
    defaultReps: [0],
    requiresEquipment: [],
    isNamed: true,
  },
]
```

**Type update needed** — add `isNamed`, `isHero`, `fixedExercises`, `notes` to the WOD template type:

```typescript
interface WodTemplate {
  name: string
  format: 'amrap' | 'emom' | 'fortime' | 'tabata'
  duration: number | null
  description: string
  slots: number
  defaultReps: number[]
  requiresEquipment: string[]
  isNamed?: boolean
  isHero?: boolean
  fixedExercises?: string[]
  notes?: string
}
```

---

## 7. ACWR Override for Returning Athletes

Current issue: ACWR is 1.89 because chronic load is low from detraining. System flags "spike detected" when Tom is just doing normal rebuild volume. 

Add to `lib/fitness/running-load.ts`:

```typescript
/**
 * Check if athlete is in a return-to-training phase.
 * If chronic load is very low but an active training block exists
 * with phase='rebuild', suppress ACWR spike warnings.
 */
export async function isReturningAthlete(): Promise<boolean> {
  const activeBlock = await prisma.trainingBlock.findFirst({
    where: { status: 'active', phase: { in: ['rebuild', 'base'] } },
  })
  return !!activeBlock
}

// In getRunningLoadContext(), modify the recommendation logic:
const returning = await isReturningAthlete()

if (returning && acwr > 1.3) {
  recommendation = 'ACWR elevated but you\'re in a rebuild phase — this is expected. Follow the plan.'
} else if (acwr > 1.5) {
  recommendation = 'Spike detected — high injury risk. Consider rest or easy movement only.'
}
// ... rest unchanged
```

---

## 8. Training Plan Data — Tom's GC Marathon Plan

This is the actual plan to seed once the schema is migrated. Covers the full 17-week build to Gold Coast Marathon (4-5 Jul 2026).

### Block Structure

| Block | Phase | Dates | Weeks | Target Weekly Km |
|-------|-------|-------|-------|-----------------|
| Rebuild | rebuild | 3 Mar – 30 Mar | 4 | 20→35 |
| Base Building | base | 31 Mar – 27 Apr | 4 | 35→45 |
| Marathon Build | build | 28 Apr – 1 Jun | 5 | 45→55 |
| Marathon Specific | specific | 2 Jun – 22 Jun | 3 | 50→45 |
| Taper | taper | 23 Jun – 4 Jul | 2 | 35→20 |

### Session Types by Phase

**Rebuild (Weeks 1-4):** All easy runs + long run. No quality sessions. BFT 2-3x/week.

**Base Building (Weeks 5-8):** Introduce 1 quality session/week (progressive run or hills). Long run builds to 20km. BFT 2x/week.

**Marathon Build (Weeks 9-13):** 2 quality sessions/week (tempo + intervals or hills). Long run builds to 28-30km. Reduce BFT to 1-2x/week. Non-kid weeks: add metcon session.

**Marathon Specific (Weeks 14-16):** Marathon-pace long runs. Race-specific sessions. 1x BFT maintenance only. Goal-pace work.

**Taper (Weeks 17-18):** Volume drops 30-40%. Maintain intensity, reduce duration. Light BFT only. Race week: 2 short easy runs + strides.

### Kid Week Modifications (Apply Globally)

When `weekType === 'kid'`:
- Drop the lowest-priority easy run (usually Thursday)
- Keep the quality session (Wednesday) and long run (Saturday) — these are sacred
- BFT can drop from 2x to 1x
- No metcon/CrossFit session
- Sunday is full rest

When `weekType === 'non-kid'`:
- Add Sunday metcon/CrossFit session (Session C style)
- Can double up Wednesday (quality run AM + BFT PM, or vice versa)
- Optional Monday easy run on top of BFT
- More flexibility for longer or extra sessions

### Sample Week Template (Base Building, Non-Kid)

```json
{
  "sessions": [
    { "dayOfWeek": 1, "sessionType": "bft", "sessionName": "BFT", "notes": "Strength focus" },
    { "dayOfWeek": 2, "sessionType": "easy", "targetDistanceKm": 7, "targetPaceZone": "easy", "sessionName": "Easy Run" },
    { "dayOfWeek": 3, "sessionType": "hills", "targetDistanceKm": 8, "targetPaceZone": "moderate", "sessionName": "Hill Repeats" },
    { "dayOfWeek": 4, "sessionType": "easy", "targetDistanceKm": 7, "targetPaceZone": "easy", "sessionName": "Easy Run", "isOptional": true },
    { "dayOfWeek": 5, "sessionType": "rest", "sessionName": "Rest + Ocean" },
    { "dayOfWeek": 6, "sessionType": "long", "targetDistanceKm": 16, "targetPaceZone": "easy", "sessionName": "Long Run" },
    { "dayOfWeek": 7, "sessionType": "metcon", "sessionName": "Metcon / CrossFit", "isNonKidOnly": true }
  ]
}
```

### Sample Week Template (Same Week, Kid Version)

```json
{
  "sessions": [
    { "dayOfWeek": 1, "sessionType": "bft", "sessionName": "BFT" },
    { "dayOfWeek": 2, "sessionType": "easy", "targetDistanceKm": 6, "targetPaceZone": "easy", "sessionName": "Easy Run" },
    { "dayOfWeek": 3, "sessionType": "hills", "targetDistanceKm": 8, "targetPaceZone": "moderate", "sessionName": "Hill Repeats" },
    { "dayOfWeek": 4, "sessionType": "rest", "sessionName": "Rest or easy 4km", "isOptional": true },
    { "dayOfWeek": 5, "sessionType": "rest", "sessionName": "Rest + Ocean" },
    { "dayOfWeek": 6, "sessionType": "long", "targetDistanceKm": 16, "targetPaceZone": "easy", "sessionName": "Long Run" },
    { "dayOfWeek": 7, "sessionType": "rest", "sessionName": "Full Rest" }
  ]
}
```

---

## 9. Minimum Dose Protocol

When a session status is set to `minimum_dose`, it counts differently in progress tracking:

- Still counts toward weekly session count
- Does NOT count toward weekly km target
- Represented in the app as a reduced session (e.g., 3km walk-run instead of 8km easy)
- No negative streak impact

This is critical for ADHD + medication transition. A minimum_dose day is a win, not a failure. The UI should reflect this (green checkmark, not amber/red).

---

## 10. Frontend Changes (apps/fitness/)

### New components needed:

- `TrainingPlanCard.tsx` — shows current block, week, today's planned session on the home screen
- `WeekView.tsx` — 7-day view with planned vs actual sessions
- `WeekTypeToggle.tsx` — already exists, wire to `TrainingWeek.weekType`
- `PlanProgress.tsx` — weekly km target vs actual bar

### Update existing:

- `page.tsx` (home) — add `TrainingPlanCard` above or alongside `SuggestionCard`
- `SuggestionCard.tsx` — incorporate planned session data from enhanced daily plan
- `RunningLoadCard.tsx` — add returning athlete context

### New pages:

- `/plan` — full training plan view (blocks, weeks, calendar-style)
- `/plan/[weekId]` — detailed week view with all sessions

---

## 11. Implementation Order

1. **Prisma schema + migration** (30 min)
2. **Seed new exercises** (15 min)
3. **Training block/week/session API routes** (1-2 hours)
4. **Seed Tom's GC Marathon plan data** (30 min — use the block structure from Section 8)
5. **Update daily plan endpoint** to include training context (30 min)
6. **ACWR returning athlete override** (15 min)
7. **Auto-reconciliation in Strava webhook** (30 min)
8. **Frontend: TrainingPlanCard + WeekView** (1-2 hours)
9. **Frontend: /plan page** (1 hour)
10. **WOD library expansion** (30 min)

Total estimate: ~6-8 hours of Claude Code work, split across sessions.

---

## 12. Strava Status

As of 4 March 2026:
- **Tokens re-authorized** — manual sync pulled 5 activities from last 30 days
- **Known issue:** Tokens expire and the refresh chain can break silently. Consider adding a health check cron (daily, hits `/api/gym/running/stats` and alerts if it returns 0 sessions for 7+ days when an active training block exists)
- **Current data:** 26.2km across 4 sessions in last 30 days, 7.5km / 1 session in last 7 days, load trend increasing, ACWR 1.89 (expected for rebuild)

---

## 13. Open Questions for Tom

- [ ] **Race confirmed?** Gold Coast Marathon 4-5 Jul 2026 — is a ticket secured?
- [ ] **BFT schedule:** What days/times are BFT sessions? Need to lock Mon/Wed/other.
- [ ] **Kid week schedule:** Which weeks in the next 4 months are kid weeks? Can build into the plan.
- [ ] **Trail race timing:** When in 2026 is the trail ultra target? This affects whether we plan a second build cycle after GC or maintain a base between them.
- [ ] **Running routes:** Any preferred routes for different session types? (Maroubra coastal for easy, hills for repeats, etc.)

---

*Generated by Claude — TomOS: Training project, 4 March 2026*