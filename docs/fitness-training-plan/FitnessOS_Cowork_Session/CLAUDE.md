# Working with Claude Code on FitnessOS

**Guide for Claude Code when building FitnessOS**

---

## 🎯 Project Context

You are helping Tom Bragg build **FitnessOS**, a gym and fitness tracking system that complements his running training. This project shares a PostgreSQL database with **TomOS** (his personal productivity system) and integrates with his existing task/project management.

**Important context:**
- Tom is a runner in a speed training phase (Runna plan)
- He had L4/5, S1 back surgery in 2012 (no current limitations, but movement is medicine)
- He enjoys CrossFit-style training and variety
- Kid weeks (1-2 gym sessions) vs non-kid weeks (2-3 sessions)
- Gym: Maroubra Seals (has steam room, IR sauna, ice baths)
- He has ADHD and values clear structure, minimal friction

---

## 📚 Essential Files to Read First

**Before writing any code, READ these files:**

1. **SPEC.md** — Complete technical specification
   - Database schema
   - API endpoints
   - Strava integration
   - Progressive overload logic

2. **README.md** — Project overview and setup
   - Quick start
   - CLI commands
   - Development workflow

3. **TomOS Prisma Schema** — `prisma/schema.prisma`
   - Understand existing models (Task, Project, Note, Matter)
   - FitnessOS will extend this schema

4. **The Gym Program Files** — Reference for exercise library seed data
   - Located in TomOS outputs or this repo's `/data/` folder
   - Contains sessions, exercises, sets/reps, coaching cues

---

## 🗄️ Database Architecture

### Shared Database Strategy

**TomOS and FitnessOS share the same PostgreSQL database.**

**Why:**
- Link gym sessions to TomOS tasks (e.g., "Complete Session A")
- Query running load alongside gym recommendations
- Single source of truth for Tom's productivity
- Foundation for unified health/productivity insights

**Naming conventions:**
- TomOS tables: `tasks`, `projects`, `notes`, `tags`
- MatterOS tables: `matters`, `matter_documents`, `matter_events`
- FitnessOS tables: `gym_sessions`, `exercises`, `session_exercises`, `sets`, `running_sync`

### Adding FitnessOS Tables

**When adding FitnessOS schema to Prisma:**

```prisma
// Add to existing prisma/schema.prisma (don't create new file)

// ============================================
// FITNESSOS
// ============================================

model GymSession {
  id              String   @id @default(uuid())
  date            DateTime @default(now())
  sessionType     String   // "A", "B", "C", or custom
  duration        Int?     // minutes
  notes           String?
  overallRPE      Int?     // 1-10
  weekType        String?  // "kid" or "non-kid"
  completedAt     DateTime?

  // Relations
  taskId          String?  // Link to TomOS task
  task            Task?    @relation(fields: [taskId], references: [id], onDelete: SetNull)
  sessionExercises SessionExercise[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("gym_sessions")
  @@index([date])
  @@index([sessionType])
}

model Exercise {
  id              String   @id @default(uuid())
  name            String   @unique
  category        String   // "power", "strength", "accessory", "core", "warmup", "conditioning"
  equipment       String[] // ["barbell", "dumbbell", "kettlebell", "bodyweight"]
  primaryMuscles  String[] // ["glutes", "hamstrings", "quads"]
  movementPattern String?  // "hip_hinge", "squat", "push", "pull", "carry"
  cues            String?  // Coaching cues
  spineNotes      String?  // L4/5, S1 considerations
  videoUrl        String?

  sessionExercises SessionExercise[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("exercises")
  @@index([category])
}

model SessionExercise {
  id              String   @id @default(uuid())
  order           Int      // Order within session

  // Relations
  sessionId       String
  session         GymSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  exerciseId      String
  exercise        Exercise @relation(fields: [exerciseId], references: [id])

  sets            ExerciseSet[]

  createdAt       DateTime @default(now())

  @@map("session_exercises")
  @@index([sessionId])
}

model ExerciseSet {
  id              String   @id @default(uuid())
  setNumber       Int
  weight          Float?   // kg
  reps            Int?
  time            Int?     // seconds (for holds/carries)
  distance        Float?   // meters (for carries)
  rpe             Int?     // 1-10
  notes           String?

  // Relations
  sessionExerciseId String
  sessionExercise   SessionExercise @relation(fields: [sessionExerciseId], references: [id], onDelete: Cascade)

  createdAt       DateTime @default(now())

  @@map("exercise_sets")
  @@index([sessionExerciseId])
}

model RunningSync {
  id              String   @id @default(uuid())
  externalId      String   @unique // Strava activity ID
  source          String   @default("strava") // "strava", "garmin", "manual"
  date            DateTime
  type            String   // "easy", "intervals", "tempo", "hills", "long"
  distance        Float    // km
  duration        Int      // minutes
  avgPace         Float?   // min/km
  avgHeartRate    Int?
  elevationGain   Float?   // meters
  trainingLoad    Float?   // Calculated load score

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("running_sync")
  @@index([date])
  @@index([source])
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_fitnessos_schema
```

---

## 🏗️ Project Structure

```
tomos-api/
├── prisma/
│   ├── schema.prisma         # SHARED schema (TomOS + MatterOS + FitnessOS)
│   └── migrations/
├── app/api/                   # Next.js App Router
│   ├── tasks/                 # TomOS endpoints
│   ├── matters/               # MatterOS endpoints
│   ├── gym/                   # NEW: FitnessOS endpoints
│   │   ├── sessions/
│   │   │   ├── route.ts       # GET/POST sessions
│   │   │   └── [id]/
│   │   │       └── route.ts   # GET/PATCH/DELETE session
│   │   ├── exercises/
│   │   │   └── route.ts       # GET/POST exercises
│   │   ├── log/
│   │   │   └── route.ts       # Quick session logging
│   │   ├── suggest/
│   │   │   └── route.ts       # AI recommendations
│   │   └── sync/
│   │       └── strava/
│   │           └── route.ts   # Strava webhook
├── lib/
│   ├── prisma.ts              # SHARED Prisma client
│   ├── fitness/
│   │   ├── progressive-overload.ts  # Weight progression logic
│   │   ├── running-load.ts          # Calculate training load
│   │   └── suggestions.ts           # AI-powered recommendations
├── types/
│   ├── fitness.ts             # NEW: FitnessOS types
└── scripts/
    ├── seed-exercises.ts      # Seed exercise library
    └── test-fitness-api.ts    # FitnessOS tests
```

---

## 🎨 API Design Patterns

### Follow TomOS Conventions

**FitnessOS APIs should match TomOS/MatterOS patterns:**

```typescript
// app/api/gym/sessions/route.ts
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sessionType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: any = {}
    if (sessionType) where.sessionType = sessionType

    const sessions = await prisma.gymSession.findMany({
      where,
      include: {
        sessionExercises: {
          include: {
            exercise: true,
            sets: true,
          },
          orderBy: { order: 'asc' }
        }
      },
      orderBy: { date: 'desc' },
      take: limit,
    })

    return NextResponse.json({ data: sessions })
  } catch (error) {
    console.error('Error fetching gym sessions:', error)
    return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { sessionType, date, notes, exercises } = body

    const session = await prisma.gymSession.create({
      data: {
        sessionType,
        date: date ? new Date(date) : new Date(),
        notes,
        sessionExercises: exercises ? {
          create: exercises.map((ex: any, index: number) => ({
            order: index,
            exerciseId: ex.exerciseId,
            sets: {
              create: ex.sets?.map((set: any, setIndex: number) => ({
                setNumber: setIndex + 1,
                weight: set.weight,
                reps: set.reps,
                rpe: set.rpe,
              }))
            }
          }))
        } : undefined
      },
      include: {
        sessionExercises: {
          include: { exercise: true, sets: true }
        }
      }
    })

    return NextResponse.json({ data: session }, { status: 201 })
  } catch (error) {
    console.error('Error creating gym session:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
```

### Standard Response Formats

**Success:**
```json
{
  "data": {
    "id": "abc-123",
    "sessionType": "A",
    "date": "2026-02-03T10:00:00Z",
    "overallRPE": 7,
    "sessionExercises": [...]
  }
}
```

**Error:**
```json
{
  "error": "Session not found"
}
```

---

## 🔗 TomOS Integration

### Linking Sessions to Tasks

**Create a task for the gym session:**

```typescript
// When creating a gym session, optionally create a linked task
const task = await prisma.task.create({
  data: {
    task: `Complete Gym Session ${sessionType}`,
    source: 'FitnessOS',
    priority: 'medium',
    dueDate: sessionDate,
  }
})

const session = await prisma.gymSession.create({
  data: {
    sessionType,
    taskId: task.id,
    // ...
  }
})
```

### Using Notes for Training Logs

**Link to TomOS Notes:**
```typescript
// Create a note with smart linking
const note = await prisma.note.create({
  data: {
    title: `Training Log - ${format(date, 'yyyy-MM-dd')}`,
    content: `## Session ${sessionType}\n\n@Complete-Gym-Session-A\n\n${sessionNotes}`,
    tags: ['fitness', 'gym', sessionType.toLowerCase()],
  }
})
```

---

## 🏃 Strava Integration

### Webhook Setup

```typescript
// app/api/gym/sync/strava/route.ts

// Strava sends POST on new activity
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Verify webhook (Strava challenge)
  if (body['hub.challenge']) {
    return NextResponse.json({ 'hub.challenge': body['hub.challenge'] })
  }

  // Process activity
  if (body.object_type === 'activity' && body.aspect_type === 'create') {
    const activityId = body.object_id

    // Fetch full activity from Strava API
    const activity = await fetchStravaActivity(activityId)

    // Map to RunningSync
    if (activity.type === 'Run') {
      await prisma.runningSync.upsert({
        where: { externalId: String(activityId) },
        create: {
          externalId: String(activityId),
          source: 'strava',
          date: new Date(activity.start_date),
          type: classifyRunType(activity),
          distance: activity.distance / 1000, // m to km
          duration: Math.round(activity.moving_time / 60), // s to min
          avgPace: calculatePace(activity),
          avgHeartRate: activity.average_heartrate,
          elevationGain: activity.total_elevation_gain,
          trainingLoad: calculateTrainingLoad(activity),
        },
        update: {
          // Update if re-synced
        }
      })
    }
  }

  return NextResponse.json({ received: true })
}
```

### Training Load Calculation

```typescript
// lib/fitness/running-load.ts

export function calculateTrainingLoad(activity: StravaActivity): number {
  // Simple TRIMP-like calculation
  const duration = activity.moving_time / 60 // minutes
  const distance = activity.distance / 1000 // km
  const avgHR = activity.average_heartrate || 140
  const elevationGain = activity.total_elevation_gain || 0

  // Base load from distance and duration
  let load = (distance * 10) + (duration * 0.5)

  // Intensity modifier from HR
  const hrModifier = avgHR > 160 ? 1.5 : avgHR > 145 ? 1.2 : 1.0
  load *= hrModifier

  // Elevation modifier
  load += elevationGain * 0.1

  return Math.round(load)
}

export function getWeeklyRunningLoad(days: number = 7): Promise<number> {
  const since = new Date()
  since.setDate(since.getDate() - days)

  return prisma.runningSync.aggregate({
    where: { date: { gte: since } },
    _sum: { trainingLoad: true }
  }).then(result => result._sum.trainingLoad || 0)
}
```

---

## 📈 Progressive Overload Logic

### Suggest Next Session Weights

```typescript
// lib/fitness/progressive-overload.ts

export async function suggestWeight(
  exerciseId: string,
  targetReps: number
): Promise<{ weight: number; rationale: string }> {
  // Get last 3 sessions with this exercise
  const history = await prisma.sessionExercise.findMany({
    where: { exerciseId },
    include: {
      sets: true,
      session: true
    },
    orderBy: { session: { date: 'desc' } },
    take: 3,
  })

  if (history.length === 0) {
    return {
      weight: 0,
      rationale: 'No history - start light and focus on form'
    }
  }

  // Analyze RPE trend
  const recentSets = history.flatMap(h => h.sets)
  const avgRPE = recentSets.reduce((sum, s) => sum + (s.rpe || 7), 0) / recentSets.length
  const lastWeight = recentSets[0]?.weight || 0

  // Get weekly running load
  const runningLoad = await getWeeklyRunningLoad()

  // Decision logic
  let suggestion = lastWeight
  let rationale = ''

  if (avgRPE < 7 && runningLoad < 400) {
    // Easy last time, low running load - increase
    suggestion = lastWeight + 2.5
    rationale = `RPE was low (${avgRPE.toFixed(1)}), running load manageable. Try +2.5kg.`
  } else if (avgRPE > 8 || runningLoad > 500) {
    // Hard last time or heavy running week - maintain or decrease
    suggestion = lastWeight
    rationale = runningLoad > 500
      ? `Heavy running week (load: ${runningLoad}). Maintain weight, focus on quality.`
      : `RPE was high (${avgRPE.toFixed(1)}). Consolidate before progressing.`
  } else {
    rationale = `Maintain ${lastWeight}kg. RPE: ${avgRPE.toFixed(1)}, Running load: ${runningLoad}.`
  }

  return { weight: suggestion, rationale }
}
```

---

## 🖥️ CLI Tool (Optional Enhancement)

**Quick logging from terminal:**

```bash
# Log a session
gym log

# Get today's suggestion
gym suggest

# Weekly status
gym status

# Sync from Strava
gym sync
```

**Implementation:** Use Commander.js or similar, calling the API endpoints.

---

## 🎯 MVP Implementation Order

### Phase 1: Foundation (Week 1)
1. Add FitnessOS schema to Prisma
2. Create Exercise CRUD API
3. Seed exercise library from gym program
4. Create GymSession CRUD API

### Phase 2: Logging (Week 2)
5. Create session logging endpoint
6. Add set/rep tracking
7. Link to TomOS tasks
8. Test with Prisma Studio

### Phase 3: Running Integration (Week 3)
9. Set up Strava webhook
10. Implement RunningSync model
11. Calculate training load
12. Test sync flow

### Phase 4: Intelligence (Week 4)
13. Progressive overload suggestions
14. Session recommendations based on running load
15. Weekly status/summary endpoint

### Phase 5: Polish (Week 5)
16. CLI tool (optional)
17. iOS widget (future)
18. Comprehensive tests

---

## ⚠️ Common Pitfalls

### 1. Don't Create Separate Database
Use the shared TomOS database. No separate `FITNESS_DATABASE_URL`.

### 2. Don't Break TomOS
All existing endpoints must keep working. Test thoroughly.

### 3. Respect the Back
Include `spineNotes` field on exercises. Flag movements that need attention.

### 4. Running Load Awareness
Always consider weekly running load when making suggestions. Speed phase = prioritize running.

### 5. Kid Week Awareness
Session suggestions should account for available time. Kid weeks = fewer, shorter sessions.

---

## 🧪 Testing Checklist

**Before considering a feature "done":**

- [ ] Schema migrated successfully
- [ ] API endpoints return correct data
- [ ] Error cases handled (404, 500, etc.)
- [ ] TypeScript types defined
- [ ] Integration with TomOS tasks tested
- [ ] Running load affects suggestions
- [ ] Exercise library seeded
- [ ] Manual testing in Prisma Studio

---

## 📖 Helpful Commands

```bash
# Database
npx prisma studio                        # Open DB GUI
npx prisma migrate dev                   # Create migration
npx prisma generate                      # Generate Prisma Client

# Seeding
npx ts-node scripts/seed-exercises.ts    # Seed exercise library

# Testing
npm run dev                              # Start dev server
curl http://localhost:3000/api/gym/sessions
npx ts-node scripts/test-fitness-api.ts
```

---

**You now have everything you need to build FitnessOS. Start with the schema and exercise library, then iterate!**

*Claude Code Guide v1.0 • February 3, 2026*
