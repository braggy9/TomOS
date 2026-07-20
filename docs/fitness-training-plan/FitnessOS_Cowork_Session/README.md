# FitnessOS

**Gym and fitness tracking for the TomOS ecosystem**

---

## What is FitnessOS?

FitnessOS is a strength training companion that works alongside your running. It tracks gym sessions, suggests weights based on fatigue and running load, and integrates with TomOS for unified productivity.

### Key Features

- **Session Logging** — Track exercises, sets, reps, weights, RPE
- **Running Integration** — Syncs from Strava, adjusts recommendations based on training load
- **Progressive Overload** — Intelligent weight suggestions based on history
- **Back Health Aware** — L4/5, S1 considerations built into exercise selection
- **Kid Week Smart** — Adapts to your schedule (1-2 vs 2-3 sessions/week)

---

## Quick Start

### Prerequisites

- TomOS API running locally or deployed
- Strava account (optional, for running sync)
- PostgreSQL database (shared with TomOS)

### Setup

```bash
# 1. Navigate to TomOS API
cd ~/Desktop/Projects/TomOS

# 2. Add FitnessOS schema (after merging changes)
npx prisma migrate dev --name add_fitnessos

# 3. Generate Prisma client
npx prisma generate

# 4. Seed exercise library
npx ts-node scripts/seed-exercises.ts

# 5. Start dev server
npm run dev
```

### Test the API

```bash
# List exercises
curl http://localhost:3000/api/gym/exercises

# Get session recommendation
curl http://localhost:3000/api/gym/suggest

# Log a session
curl -X POST http://localhost:3000/api/gym/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "sessionType": "A",
    "exercises": [
      {
        "exerciseId": "<exercise-uuid>",
        "sets": [
          { "weight": 60, "reps": 8, "rpe": 7 }
        ]
      }
    ]
  }'
```

---

## Sessions

### Session A — Strength + Power
**When:** Tuesday
**Duration:** 45-60 min
**Focus:** Posterior chain, single-leg strength, power

### Session B — Upper + Core
**When:** Friday
**Duration:** 40-50 min
**Focus:** Upper body balance, core stability (light before long run)

### Session C — CrossFit Fun
**When:** Sunday (non-kid weeks only)
**Duration:** 30-45 min
**Focus:** Mixed modality, conditioning, variety

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/gym/sessions` | GET | List sessions |
| `/api/gym/sessions` | POST | Create session |
| `/api/gym/sessions/[id]` | GET/PATCH/DELETE | Single session |
| `/api/gym/exercises` | GET | List exercises |
| `/api/gym/suggest` | GET | Get recommendation |
| `/api/gym/log` | POST | Quick session log |
| `/api/gym/sync/strava` | POST | Strava webhook |

See [SPEC.md](./SPEC.md) for full API documentation.

---

## Integration with TomOS

### Tasks
Sessions can link to TomOS tasks:
```
@Complete-Session-A → Task marked complete when session logged
```

### Notes
Training logs can be created as TomOS notes with smart linking:
```markdown
## Session A - Feb 3

Great session today. @Complete-Session-A

- RDL: 60kg × 8,8,6 (RPE 7)
- Bulgarian Split Squat: 16kg × 10,10,10 (RPE 8)

Running load this week: 340 (moderate)
```

---

## Running Integration

### Strava Sync
Automatically syncs running activities from Strava:
- Distance, duration, pace, heart rate
- Calculates training load score
- Factors into gym recommendations

### Training Load
Weekly running load affects gym suggestions:
- **Low (<300):** Normal progression
- **Moderate (300-500):** Cautious progression
- **High (>500):** Maintain or reduce gym intensity

---

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — Guide for Claude Code
- **[SPEC.md](./SPEC.md)** — Full technical specification
- **Program Files** — Session templates and exercise library

---

## Development

### Adding New Exercises

```typescript
// scripts/seed-exercises.ts
await prisma.exercise.create({
  data: {
    name: "New Exercise",
    category: "strength",
    equipment: ["barbell"],
    primaryMuscles: ["quads"],
    movementPattern: "squat",
    cues: "Key coaching points",
    spineNotes: "L4/5 considerations if any"
  }
})
```

### Testing

```bash
# Open Prisma Studio
npx prisma studio

# Run API tests
npx ts-node scripts/test-fitness-api.ts
```

---

## Related Projects

- **TomOS** — Main productivity API ([/projects/tomos-app](../tomos-app/))
- **MatterOS** — Legal matter management ([/projects/matteros](../matteros/))
- **TomOS-Apps** — iOS/macOS native clients

---

*FitnessOS v1.0 • Part of the TomOS Family*
