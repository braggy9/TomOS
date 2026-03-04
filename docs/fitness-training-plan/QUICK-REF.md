# Training Plan System — Quick Reference

**Full spec:** `docs/fitness-training-plan/SPEC.md`
**Date:** 4 March 2026

## Implementation Checklist

1. [ ] Prisma schema — add `TrainingBlock`, `TrainingWeek`, `PlannedSession` (see SPEC §2)
2. [ ] Run migration: `npx prisma migrate dev --name add-training-plan-system`
3. [ ] Seed 16 new conditioning exercises (see SPEC §5)
4. [ ] API routes: `/api/training/blocks`, `/api/training/weeks/current`, `/api/training/today` (see SPEC §3)
5. [ ] Seed Tom's GC Marathon plan blocks (see SPEC §8)
6. [ ] Update `/api/gym/daily-plan` to include training plan context (see SPEC §3.4)
7. [ ] ACWR returning athlete override in `lib/fitness/running-load.ts` (see SPEC §7)
8. [ ] Auto-reconcile Strava syncs to planned sessions (see SPEC §3.5)
9. [ ] Expand WOD_TEMPLATES in `lib/fitness/suggestions.ts` with hero WODs (see SPEC §6)
10. [ ] Frontend: `TrainingPlanCard`, `WeekView` components (see SPEC §10)

## Key Files to Touch

- `prisma/schema.prisma` — new models + reverse relations
- `scripts/seed-exercises.ts` — add conditioning exercises
- `lib/fitness/running-load.ts` — ACWR override
- `lib/fitness/suggestions.ts` — WOD library expansion
- `types/fitness.ts` — new types for training plan
- New: `app/api/training/` — all new routes
- New: `scripts/seed-training-plan.ts` — seed the actual plan data

## Don't Break

- Existing `GymSession`, `RunningSync`, `RecoveryCheckIn` models — untouched
- Strava sync flow — just add auto-reconciliation after sync
- Progressive overload engine — unchanged
- Existing daily plan response shape — extend, don't replace