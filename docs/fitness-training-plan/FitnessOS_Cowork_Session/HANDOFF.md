# FitnessOS — Claude Code Handoff

**Copy this prompt to Claude Code to implement FitnessOS**

---

## The Prompt

```
I want to implement FitnessOS — a gym and fitness tracking module for my TomOS ecosystem.

## Context

I've already created the full documentation in my command tower:

📁 ~/Desktop/🖥️ TomOS/tomos-command-tower/projects/fitness/
├── CLAUDE.md    — Development guide (patterns, architecture, examples)
├── SPEC.md      — Full technical specification (schema, APIs, algorithms)
├── README.md    — Project overview
└── data/
    ├── Tom_Gym_Program_Tracker.xlsx   — Program tracking spreadsheet
    └── Tom_Gym_Quick_Reference.html   — Mobile workout cards

The main TomOS API lives at:
📁 ~/Desktop/Projects/TomOS/

## What I Need Built

1. **Database Schema** — Add the FitnessOS tables to Prisma:
   - `gym_sessions`, `exercises`, `session_exercises`, `exercise_sets`, `running_sync`
   - See SPEC.md for full schema definitions

2. **API Endpoints** — Add to the existing Next.js API:
   - `/api/gym/sessions` (CRUD)
   - `/api/gym/exercises` (CRUD)
   - `/api/gym/suggest` (smart recommendations)
   - `/api/gym/log` (quick session logging)
   - `/api/gym/sync/strava` (webhook + manual sync)

3. **Exercise Seed Data** — Create a seed script with the exercises from SPEC.md

4. **Progressive Overload Logic** — Implement the weight suggestion algorithm from SPEC.md

## Implementation Order

Please work through this in order:
1. Read CLAUDE.md first (for patterns and conventions)
2. Read SPEC.md (for schema and API details)
3. Add Prisma schema changes
4. Run migration
5. Create seed script and populate exercises
6. Build API endpoints one by one
7. Test each endpoint

## Important Notes

- This integrates with existing TomOS (same Neon Postgres, same Next.js app)
- Follow existing patterns in the TomOS codebase
- Back health (L4/5, S1) considerations are baked into exercise data
- Kid weeks vs non-kid weeks affects session recommendations
- Running load from Strava affects gym weight suggestions

## Verification

After implementation, I should be able to:
- List all exercises: `curl http://localhost:3000/api/gym/exercises`
- Get a session recommendation: `curl http://localhost:3000/api/gym/suggest`
- Log a session via the quick log endpoint

Let's start by reading the documentation files.
```

---

## Quick Start for Claude Code

1. Open Claude Code in terminal
2. Navigate to your TomOS project: `cd ~/Desktop/Projects/TomOS`
3. Paste the prompt above
4. Claude Code will read the docs and start implementing

---

## Expected Deliverables

After Claude Code finishes, you should have:

- [ ] Prisma schema with FitnessOS tables
- [ ] Migration applied to Neon database
- [ ] Exercise seed data populated
- [ ] All API endpoints working
- [ ] Integration with existing TomOS tasks/notes

---

## Troubleshooting

**If Claude Code can't find the docs:**
```bash
# Show Claude Code where the docs are
ls ~/Desktop/🖥️\ TomOS/tomos-command-tower/projects/fitness/
```

**If migration fails:**
```bash
# Reset and retry
npx prisma migrate reset
npx prisma migrate dev --name add_fitnessos
```

**If Strava integration isn't working:**
- You'll need to set up Strava API credentials
- Add `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` to `.env`
- Register webhook at Strava developer portal

---

*Handoff created: February 3, 2026*
