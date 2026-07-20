# FitnessOS — Technical Specification

**Version:** 1.0
**Status:** Ready for Implementation
**Last Updated:** February 3, 2026

---

## Overview

FitnessOS is a gym and fitness tracking module for the TomOS ecosystem. It complements Tom's running training (Runna speed phase) with intelligent strength programming that adapts to running load, back health considerations, and life schedule (kid weeks vs non-kid weeks).

### Goals

1. **Track gym sessions** — Log exercises, sets, reps, weights, RPE
2. **Integrate with running** — Sync from Strava, factor load into recommendations
3. **Progressive overload** — Intelligent weight suggestions based on history and fatigue
4. **Protect the back** — L4/5, S1 awareness baked into exercise selection
5. **ADHD-friendly** — Quick logging, minimal friction, clear structure

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐      ┌──────────────────┐      ┌──────────────┐
│   Task      │      │   GymSession     │      │   Exercise   │
│  (TomOS)    │◄────▶│                  │      │              │
└─────────────┘      │  - sessionType   │      │  - name      │
                     │  - date          │      │  - category  │
                     │  - duration      │      │  - equipment │
                     │  - overallRPE    │      │  - cues      │
                     │  - weekType      │      │  - spineNotes│
                     └────────┬─────────┘      └──────┬───────┘
                              │                       │
                              ▼                       │
                     ┌──────────────────┐            │
                     │ SessionExercise  │◄───────────┘
                     │                  │
                     │  - order         │
                     └────────┬─────────┘
                              │
                              ▼
                     ┌──────────────────┐
                     │   ExerciseSet    │
                     │                  │
                     │  - weight        │
                     │  - reps          │
                     │  - rpe           │
                     └──────────────────┘

┌──────────────────┐
│   RunningSync    │  (from Strava/Garmin)
│                  │
│  - distance      │
│  - duration      │
│  - trainingLoad  │
└──────────────────┘
```

### Table Definitions

#### `gym_sessions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, DEFAULT uuid() | Unique identifier |
| date | TIMESTAMP | NOT NULL, DEFAULT now() | Session date/time |
| session_type | VARCHAR(50) | NOT NULL | "A", "B", "C", or custom name |
| duration | INT | | Duration in minutes |
| notes | TEXT | | Free-form session notes |
| overall_rpe | INT | CHECK (1-10) | Session-level RPE |
| week_type | VARCHAR(20) | | "kid" or "non-kid" |
| completed_at | TIMESTAMP | | When session was completed |
| task_id | UUID | FK → tasks.id, ON DELETE SET NULL | Link to TomOS task |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | | |

**Indexes:** `date`, `session_type`, `task_id`

#### `exercises`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| name | VARCHAR(100) | UNIQUE, NOT NULL | Exercise name |
| category | VARCHAR(50) | NOT NULL | power, strength, accessory, core, warmup, conditioning |
| equipment | TEXT[] | | Array of equipment needed |
| primary_muscles | TEXT[] | | Target muscle groups |
| movement_pattern | VARCHAR(50) | | hip_hinge, squat, push, pull, carry, rotation |
| cues | TEXT | | Coaching cues |
| spine_notes | TEXT | | L4/5, S1 considerations |
| video_url | VARCHAR(500) | | Link to demo video |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | | |

**Indexes:** `category`, `movement_pattern`

#### `session_exercises`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| session_id | UUID | FK → gym_sessions.id, ON DELETE CASCADE | Parent session |
| exercise_id | UUID | FK → exercises.id | The exercise performed |
| order | INT | NOT NULL | Order within session |
| created_at | TIMESTAMP | DEFAULT now() | |

**Indexes:** `session_id`

#### `exercise_sets`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| session_exercise_id | UUID | FK → session_exercises.id, ON DELETE CASCADE | Parent session_exercise |
| set_number | INT | NOT NULL | 1, 2, 3, etc. |
| weight | DECIMAL(5,2) | | Weight in kg |
| reps | INT | | Number of reps |
| time | INT | | Duration in seconds (for holds) |
| distance | DECIMAL(5,2) | | Distance in meters (for carries) |
| rpe | INT | CHECK (1-10) | Rate of perceived exertion |
| notes | TEXT | | Set-specific notes |
| created_at | TIMESTAMP | DEFAULT now() | |

**Indexes:** `session_exercise_id`

#### `running_sync`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Unique identifier |
| external_id | VARCHAR(100) | UNIQUE, NOT NULL | Strava/Garmin activity ID |
| source | VARCHAR(50) | DEFAULT 'strava' | Data source |
| date | TIMESTAMP | NOT NULL | Activity date |
| type | VARCHAR(50) | | easy, intervals, tempo, hills, long |
| distance | DECIMAL(5,2) | NOT NULL | Distance in km |
| duration | INT | NOT NULL | Duration in minutes |
| avg_pace | DECIMAL(4,2) | | Average pace (min/km) |
| avg_heart_rate | INT | | Average HR |
| elevation_gain | DECIMAL(6,2) | | Elevation in meters |
| training_load | DECIMAL(6,2) | | Calculated load score |
| created_at | TIMESTAMP | DEFAULT now() | |
| updated_at | TIMESTAMP | | |

**Indexes:** `date`, `source`, `external_id`

---

## API Endpoints

### Base URL
```
https://tomos-task-api.vercel.app/api/gym
```

### Sessions

#### List Sessions
```
GET /api/gym/sessions
```

**Query Parameters:**
- `type` — Filter by session type (A, B, C)
- `from` — Start date (ISO 8601)
- `to` — End date (ISO 8601)
- `limit` — Max results (default: 20)
- `offset` — Pagination offset

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "sessionType": "A",
      "date": "2026-02-03T10:00:00Z",
      "duration": 55,
      "overallRPE": 7,
      "weekType": "kid",
      "sessionExercises": [
        {
          "id": "uuid",
          "order": 1,
          "exercise": {
            "id": "uuid",
            "name": "RDL",
            "category": "strength"
          },
          "sets": [
            { "setNumber": 1, "weight": 60, "reps": 8, "rpe": 7 }
          ]
        }
      ]
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Get Single Session
```
GET /api/gym/sessions/[id]
```

#### Create Session
```
POST /api/gym/sessions
```

**Request Body:**
```json
{
  "sessionType": "A",
  "date": "2026-02-03T10:00:00Z",
  "weekType": "kid",
  "notes": "Felt good today",
  "exercises": [
    {
      "exerciseId": "uuid",
      "sets": [
        { "weight": 60, "reps": 8, "rpe": 7 },
        { "weight": 60, "reps": 8, "rpe": 7 },
        { "weight": 60, "reps": 6, "rpe": 8 }
      ]
    }
  ]
}
```

#### Update Session
```
PATCH /api/gym/sessions/[id]
```

#### Delete Session
```
DELETE /api/gym/sessions/[id]
```

---

### Exercises

#### List Exercises
```
GET /api/gym/exercises
```

**Query Parameters:**
- `category` — Filter by category
- `movement` — Filter by movement pattern
- `search` — Text search on name

#### Get Single Exercise
```
GET /api/gym/exercises/[id]
```

#### Create Exercise
```
POST /api/gym/exercises
```

**Request Body:**
```json
{
  "name": "Romanian Deadlift",
  "category": "strength",
  "equipment": ["barbell"],
  "primaryMuscles": ["hamstrings", "glutes"],
  "movementPattern": "hip_hinge",
  "cues": "Hinge at hips, slight knee bend, back neutral",
  "spineNotes": "Excellent for L4/5 - loads posterior chain without spinal flexion"
}
```

---

### Quick Log

Simplified endpoint for fast session logging:

```
POST /api/gym/log
```

**Request Body:**
```json
{
  "sessionType": "A",
  "exercises": [
    { "name": "RDL", "weight": 60, "sets": 3, "reps": 8, "rpe": 7 },
    { "name": "Bulgarian Split Squat", "weight": 16, "sets": 3, "reps": 10, "rpe": 8 }
  ],
  "notes": "Quick session before work"
}
```

Looks up exercises by name, creates session with all sets.

---

### Suggestions

#### Get Session Recommendation
```
GET /api/gym/suggest
```

**Query Parameters:**
- `weekType` — "kid" or "non-kid" (optional, auto-detects if not provided)

**Response:**
```json
{
  "data": {
    "recommendedSession": "A",
    "rationale": "Tuesday is your strength day. Running load moderate (340). Go for it!",
    "weekType": "kid",
    "runningLoadLast7Days": 340,
    "lastSession": {
      "type": "B",
      "date": "2026-01-31",
      "daysAgo": 3
    },
    "suggestedExercises": [
      {
        "name": "RDL",
        "suggestedWeight": 62.5,
        "lastWeight": 60,
        "rationale": "RPE was 7 last time. Try +2.5kg."
      }
    ]
  }
}
```

#### Get Exercise Weight Suggestion
```
GET /api/gym/suggest/exercise/[id]
```

**Response:**
```json
{
  "data": {
    "exerciseId": "uuid",
    "exerciseName": "RDL",
    "suggestedWeight": 62.5,
    "lastWeight": 60,
    "lastRPE": 7,
    "history": [
      { "date": "2026-01-28", "weight": 60, "reps": 8, "rpe": 7 },
      { "date": "2026-01-21", "weight": 57.5, "reps": 8, "rpe": 7 }
    ],
    "runningContext": {
      "loadLast7Days": 340,
      "recommendation": "Normal progression OK"
    },
    "rationale": "Consistent RPE 7. Running load moderate. Progress to 62.5kg."
  }
}
```

---

### Running Sync

#### Strava Webhook
```
POST /api/gym/sync/strava
```

Handles Strava webhook events. Auto-syncs new running activities.

#### Manual Sync
```
POST /api/gym/sync/strava/manual
```

Fetches recent activities from Strava API.

#### Get Running Stats
```
GET /api/gym/running/stats
```

**Response:**
```json
{
  "data": {
    "last7Days": {
      "totalDistance": 42.5,
      "totalDuration": 280,
      "trainingLoad": 340,
      "sessions": 4
    },
    "last30Days": {
      "totalDistance": 180,
      "totalDuration": 1200,
      "trainingLoad": 1450,
      "sessions": 16
    },
    "loadTrend": "increasing"
  }
}
```

---

## Exercise Library (Seed Data)

Initial exercises to seed, based on the gym program:

### Power
| Name | Equipment | Movement | Spine Notes |
|------|-----------|----------|-------------|
| Box Jump | box | plyometric | Step down to reduce impact |
| KB Swing | kettlebell | hip_hinge | Excellent - hip snap, not squat |

### Strength - Lower
| Name | Equipment | Movement | Spine Notes |
|------|-----------|----------|-------------|
| RDL | barbell, dumbbell | hip_hinge | Excellent for L4/5 |
| Trap Bar Deadlift | trap_bar | hip_hinge | Great alternative to conventional |
| Bulgarian Split Squat | dumbbell, bench | squat | Single-leg, less spinal load |
| Hip Thrust | barbell, bench | hip_extension | Excellent glute work |
| Glute Bridge | bodyweight | hip_extension | Core activation |

### Strength - Upper
| Name | Equipment | Movement | Spine Notes |
|------|-----------|----------|-------------|
| DB Bench Press | dumbbell, bench | push | Neutral spine |
| DB Shoulder Press | dumbbell | push | Keep core tight |
| DB Row | dumbbell, bench | pull | Support with bench |
| Lat Pulldown | cable | pull | — |
| Pull-up | bodyweight | pull | — |

### Core
| Name | Equipment | Movement | Spine Notes |
|------|-----------|----------|-------------|
| Dead Bug | bodyweight | anti_extension | Excellent for L4/5 |
| Pallof Press | cable, band | anti_rotation | Core stability |
| Bird Dog | bodyweight | anti_rotation | Great for back |
| Farmers Carry | dumbbell, kettlebell | carry | Functional core |
| Suitcase Carry | dumbbell, kettlebell | carry | Anti-lateral flexion |
| Copenhagen Plank | bodyweight | — | Adductor + core |
| Side Plank | bodyweight | — | — |

### Conditioning (CrossFit-style)
| Name | Equipment | Movement | Spine Notes |
|------|-----------|----------|-------------|
| Wall Ball | medicine_ball | squat | — |
| DB Thruster | dumbbell | compound | Keep core braced |
| Burpee | bodyweight | compound | Control the descent |
| Rowing | erg | cardio | — |
| Goblet Squat | kettlebell, dumbbell | squat | — |

---

## Progressive Overload Algorithm

```
function suggestNextWeight(exerciseHistory, runningLoad, weekType):

  // Get last 3-5 sessions with this exercise
  recentSets = getRecentSets(exerciseHistory, limit=5)

  if empty(recentSets):
    return { weight: 0, rationale: "No history - start light" }

  lastWeight = recentSets[0].weight
  avgRPE = mean(recentSets.map(s => s.rpe))

  // Running load factor
  if runningLoad > 500:
    loadFactor = "high"
  else if runningLoad > 300:
    loadFactor = "moderate"
  else:
    loadFactor = "low"

  // Week type factor
  if weekType == "kid":
    weekFactor = "conservative"
  else:
    weekFactor = "normal"

  // Decision matrix
  if avgRPE < 7 and loadFactor != "high" and weekFactor == "normal":
    return {
      weight: lastWeight + 2.5,
      rationale: "RPE low, running manageable. Progress!"
    }

  if avgRPE > 8 or loadFactor == "high":
    return {
      weight: lastWeight,
      rationale: "High fatigue. Maintain and consolidate."
    }

  if avgRPE > 8.5:
    return {
      weight: lastWeight - 2.5,
      rationale: "RPE very high. Deload slightly."
    }

  return {
    weight: lastWeight,
    rationale: "On track. Maintain current weight."
  }
```

---

## Session Templates

### Session A — Strength + Power (Tuesday)
**Duration:** 45-60 min
**Focus:** Posterior chain, single-leg, power

1. **Warm-up** (10 min)
   - Foam roll, Hip CARs, Glute bridges, Dead bugs, World's greatest stretch

2. **Power** (10 min)
   - Box Jumps OR KB Swings: 3×5-8, 90s rest

3. **Strength** (20-25 min)
   - A1: RDL or Trap Bar DL: 3×6-8, 90s rest
   - A2: Pallof Press: 3×10-12, 60s rest
   - B1: Bulgarian Split Squat: 3×8-10 each, 60s rest
   - B2: DB Row: 3×10-12, 60s rest

4. **Accessory** (10 min)
   - Hip Thrust: 3×12-15
   - Copenhagen or Side Plank: 2×30s each

5. **Optional Finisher** (5-8 min)
   - EMOM 8 or AMRAP 6

### Session B — Upper + Core (Friday)
**Duration:** 40-50 min
**Focus:** Upper body balance, core stability

1. **Warm-up** (8 min)
   - Foam roll (thoracic), Shoulder CARs, Band pull-aparts

2. **Upper Push** (15 min)
   - A1: DB Bench: 3×8-12
   - A2: DB Shoulder Press: 3×8-10

3. **Upper Pull** (15 min)
   - B1: DB Row: 3×10-12
   - B2: Lat Pulldown: 3×8-10

4. **Core + Carries** (10 min)
   - Farmers Carry: 3×40m
   - Hanging Leg Raises: 3×10-12
   - Bird Dogs: 2×10 each

### Session C — CrossFit Fun (Sunday, Non-Kid Weeks)
**Duration:** 30-45 min
**Focus:** Mixed modality, conditioning

1. **Warm-up** (5-8 min)
   - Light row/jog, dynamic stretches

2. **Workout** (20-30 min)
   - Rotate weekly between AMRAP, EMOM, Chipper formats
   - Example AMRAP 15: 10 KB Swings + 10 Wall Balls + 10 Box Step-ups + 200m Row

---

## Integration Points

### TomOS Tasks
- Create task when session is scheduled
- Mark task complete when session logged
- Link session to task via `taskId`

### TomOS Notes
- Auto-create training log notes with smart linking
- Use tags: `fitness`, `gym`, `session-a`, etc.

### Running Plan (Runna)
- Wednesday = quality running day (don't smash legs Tuesday)
- Saturday = long run (Friday gym should be upper-body focused)
- Sync Strava to track actual running load

---

## Future Enhancements

1. **iOS Widget** — Quick log from home screen
2. **Apple Watch** — Session timer, RPE logging
3. **Strava Auto-tag** — Tag runs with gym session proximity
4. **AI Workout Generator** — Generate CrossFit workouts based on preferences
5. **Recovery Tracking** — Sleep, HRV integration
6. **Social** — Share sessions (optional)

---

*Specification v1.0 • February 3, 2026*
