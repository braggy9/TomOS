import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

/**
 * Seed Tom's Gold Coast Marathon training plan.
 * 5 blocks, 18 weeks, 3 Mar – 4 Jul 2026.
 * Per SPEC §8.
 */

interface PlannedSessionInput {
  dayOfWeek: number // 1=Mon ... 7=Sun
  sessionType: string
  targetDistanceKm?: number
  targetPaceZone?: string
  sessionName?: string
  notes?: string
  isOptional?: boolean
  isKidWeekOnly?: boolean
  isNonKidOnly?: boolean
}

interface WeekInput {
  weekNumber: number
  startDate: string // YYYY-MM-DD (Monday)
  targetKm: number
  keyFocus: string
  sessions: PlannedSessionInput[]
}

interface BlockInput {
  name: string
  phase: string
  startDate: string
  endDate: string
  targetWeeklyKm: number
  notes?: string
  status: string
  weeks: WeekInput[]
}

// ── Helper: generate a standard week template by phase ──
function rebuildWeek(weekNum: number, startDate: string, targetKm: number, longRunKm: number): WeekInput {
  const easyKm = Math.round((targetKm - longRunKm) / 3 * 10) / 10
  return {
    weekNumber: weekNum,
    startDate,
    targetKm,
    keyFocus: `Rebuild easy volume, long run to ${longRunKm}km`,
    sessions: [
      { dayOfWeek: 1, sessionType: 'bft', sessionName: 'BFT', notes: 'Strength focus — Session A or B' },
      { dayOfWeek: 2, sessionType: 'easy', targetDistanceKm: easyKm, targetPaceZone: 'easy', sessionName: 'Easy Run' },
      { dayOfWeek: 3, sessionType: 'easy', targetDistanceKm: easyKm, targetPaceZone: 'easy', sessionName: 'Easy Run' },
      { dayOfWeek: 4, sessionType: 'easy', targetDistanceKm: easyKm, targetPaceZone: 'easy', sessionName: 'Easy Run', isOptional: true },
      { dayOfWeek: 5, sessionType: 'rest', sessionName: 'Rest + Ocean' },
      { dayOfWeek: 6, sessionType: 'long', targetDistanceKm: longRunKm, targetPaceZone: 'easy', sessionName: 'Long Run' },
      { dayOfWeek: 7, sessionType: 'rest', sessionName: 'Full Rest' },
    ],
  }
}

function baseWeek(weekNum: number, startDate: string, targetKm: number, longRunKm: number, qualitySession: PlannedSessionInput): WeekInput {
  const remainingKm = targetKm - longRunKm - (qualitySession.targetDistanceKm || 0)
  const easyKm = Math.round(remainingKm / 2 * 10) / 10
  return {
    weekNumber: weekNum,
    startDate,
    targetKm,
    keyFocus: `Base building — ${qualitySession.sessionName}`,
    sessions: [
      { dayOfWeek: 1, sessionType: 'bft', sessionName: 'BFT', notes: 'Strength focus' },
      { dayOfWeek: 2, sessionType: 'easy', targetDistanceKm: easyKm, targetPaceZone: 'easy', sessionName: 'Easy Run' },
      { dayOfWeek: 3, ...qualitySession },
      { dayOfWeek: 4, sessionType: 'easy', targetDistanceKm: easyKm, targetPaceZone: 'easy', sessionName: 'Easy Run', isOptional: true },
      { dayOfWeek: 5, sessionType: 'rest', sessionName: 'Rest + Ocean' },
      { dayOfWeek: 6, sessionType: 'long', targetDistanceKm: longRunKm, targetPaceZone: 'easy', sessionName: 'Long Run' },
      { dayOfWeek: 7, sessionType: 'metcon', sessionName: 'Metcon / CrossFit', isNonKidOnly: true },
    ],
  }
}

function buildWeek(weekNum: number, startDate: string, targetKm: number, longRunKm: number, quality1: PlannedSessionInput, quality2: PlannedSessionInput): WeekInput {
  const remainingKm = targetKm - longRunKm - (quality1.targetDistanceKm || 0) - (quality2.targetDistanceKm || 0)
  const easyKm = Math.max(5, Math.round(remainingKm * 10) / 10)
  return {
    weekNumber: weekNum,
    startDate,
    targetKm,
    keyFocus: `Marathon build — ${quality1.sessionName} + ${quality2.sessionName}`,
    sessions: [
      { dayOfWeek: 1, sessionType: 'bft', sessionName: 'BFT', notes: 'Maintenance strength', isOptional: true },
      { dayOfWeek: 2, ...quality1 },
      { dayOfWeek: 3, sessionType: 'easy', targetDistanceKm: easyKm, targetPaceZone: 'easy', sessionName: 'Easy Run' },
      { dayOfWeek: 4, ...quality2 },
      { dayOfWeek: 5, sessionType: 'rest', sessionName: 'Rest + Ocean' },
      { dayOfWeek: 6, sessionType: 'long', targetDistanceKm: longRunKm, targetPaceZone: 'easy', sessionName: 'Long Run' },
      { dayOfWeek: 7, sessionType: 'metcon', sessionName: 'Metcon / CrossFit', isNonKidOnly: true },
    ],
  }
}

// ── The Plan ──────────────────────────────────

const blocks: BlockInput[] = [
  // ── BLOCK 1: Rebuild (Weeks 1-4) ──
  {
    name: 'Rebuild Phase',
    phase: 'rebuild',
    startDate: '2026-03-02', // Mon 2 Mar (week starts Mon, plan starts this week)
    endDate: '2026-03-29',
    targetWeeklyKm: 28, // average target
    notes: 'Return to running after ~6 weeks reduced activity. All easy runs + long run. No quality sessions. BFT 2-3x/week.',
    status: 'active', // Current block
    weeks: [
      rebuildWeek(1, '2026-03-02', 20, 8),
      rebuildWeek(2, '2026-03-09', 25, 10),
      rebuildWeek(3, '2026-03-16', 30, 12),
      rebuildWeek(4, '2026-03-23', 35, 14),
    ],
  },

  // ── BLOCK 2: Base Building (Weeks 5-8) ──
  {
    name: 'Base Building',
    phase: 'base',
    startDate: '2026-03-30',
    endDate: '2026-04-26',
    targetWeeklyKm: 40,
    notes: 'Introduce 1 quality session/week. Long run builds to 20km. BFT 2x/week.',
    status: 'planned',
    weeks: [
      baseWeek(5, '2026-03-30', 35, 16, {
        sessionType: 'progressive', targetDistanceKm: 8, targetPaceZone: 'moderate',
        sessionName: 'Progressive Run', notes: 'Start easy, finish at moderate pace. Last 2km at tempo feel.',
      }),
      baseWeek(6, '2026-04-06', 38, 17, {
        sessionType: 'hills', targetDistanceKm: 8, targetPaceZone: 'moderate',
        sessionName: 'Hill Repeats', notes: '6x90s hill efforts with jog recovery. Maroubra hills.',
      }),
      baseWeek(7, '2026-04-13', 42, 18, {
        sessionType: 'progressive', targetDistanceKm: 9, targetPaceZone: 'moderate',
        sessionName: 'Progressive Run', notes: 'Negative split — second half faster than first.',
      }),
      baseWeek(8, '2026-04-20', 45, 20, {
        sessionType: 'hills', targetDistanceKm: 9, targetPaceZone: 'moderate',
        sessionName: 'Hill Repeats', notes: '8x90s hill efforts. Building strength for GC flat course.',
      }),
    ],
  },

  // ── BLOCK 3: Marathon Build (Weeks 9-13) ──
  {
    name: 'Marathon Build',
    phase: 'build',
    startDate: '2026-04-27',
    endDate: '2026-05-31',
    targetWeeklyKm: 50,
    notes: '2 quality sessions/week (tempo + intervals/hills). Long run builds to 28-30km. BFT 1-2x/week. Non-kid weeks: metcon session.',
    status: 'planned',
    weeks: [
      buildWeek(9, '2026-04-27', 45, 22,
        { sessionType: 'tempo', targetDistanceKm: 10, targetPaceZone: 'tempo', sessionName: '10km Tempo', notes: '3km warm-up, 4km at tempo, 3km cool-down' },
        { sessionType: 'intervals', targetDistanceKm: 8, targetPaceZone: 'interval', sessionName: 'Intervals', notes: '6x800m at 5K pace, 400m jog recovery' },
      ),
      buildWeek(10, '2026-05-04', 48, 24,
        { sessionType: 'tempo', targetDistanceKm: 11, targetPaceZone: 'tempo', sessionName: '11km Tempo', notes: '2km warm-up, 7km at tempo, 2km cool-down' },
        { sessionType: 'hills', targetDistanceKm: 9, targetPaceZone: 'moderate', sessionName: 'Hill Repeats', notes: '10x90s hill efforts' },
      ),
      buildWeek(11, '2026-05-11', 52, 26,
        { sessionType: 'tempo', targetDistanceKm: 12, targetPaceZone: 'tempo', sessionName: '12km Tempo 2-1-1', notes: '2km tempo, 1km easy, 1km tempo — repeat pattern' },
        { sessionType: 'intervals', targetDistanceKm: 9, targetPaceZone: 'interval', sessionName: 'Intervals', notes: '5x1km at 10K pace, 500m jog recovery' },
      ),
      buildWeek(12, '2026-05-18', 55, 28,
        { sessionType: 'tempo', targetDistanceKm: 13, targetPaceZone: 'tempo', sessionName: '13km Tempo', notes: 'Goal marathon pace for middle 8km' },
        { sessionType: 'intervals', targetDistanceKm: 10, targetPaceZone: 'interval', sessionName: 'Intervals', notes: '4x1.5km at half-marathon pace, 500m jog' },
      ),
      // Deload week
      {
        weekNumber: 13,
        startDate: '2026-05-25',
        targetKm: 40,
        keyFocus: 'Deload — recover before specific phase',
        sessions: [
          { dayOfWeek: 1, sessionType: 'bft', sessionName: 'Light BFT', notes: 'Easy session, mobility focus' },
          { dayOfWeek: 2, sessionType: 'easy', targetDistanceKm: 7, targetPaceZone: 'easy', sessionName: 'Easy Run' },
          { dayOfWeek: 3, sessionType: 'easy', targetDistanceKm: 8, targetPaceZone: 'easy', sessionName: 'Easy Run with Strides', notes: '6x100m strides at end' },
          { dayOfWeek: 4, sessionType: 'rest', sessionName: 'Rest' },
          { dayOfWeek: 5, sessionType: 'rest', sessionName: 'Rest + Ocean' },
          { dayOfWeek: 6, sessionType: 'long', targetDistanceKm: 20, targetPaceZone: 'easy', sessionName: 'Easy Long Run' },
          { dayOfWeek: 7, sessionType: 'rest', sessionName: 'Full Rest' },
        ],
      },
    ],
  },

  // ── BLOCK 4: Marathon Specific (Weeks 14-16) ──
  {
    name: 'Marathon Specific',
    phase: 'specific',
    startDate: '2026-06-01',
    endDate: '2026-06-21',
    targetWeeklyKm: 48,
    notes: 'Marathon-pace long runs. Race-specific sessions. 1x BFT maintenance only. Goal-pace work.',
    status: 'planned',
    weeks: [
      {
        weekNumber: 14,
        startDate: '2026-06-01',
        targetKm: 50,
        keyFocus: 'Marathon-pace work — race simulation',
        sessions: [
          { dayOfWeek: 1, sessionType: 'bft', sessionName: 'BFT Maintenance', notes: 'Light — maintain, don\'t build', isOptional: true },
          { dayOfWeek: 2, sessionType: 'tempo', targetDistanceKm: 12, targetPaceZone: 'tempo', sessionName: 'Marathon Pace Run', notes: '12km at goal marathon pace' },
          { dayOfWeek: 3, sessionType: 'easy', targetDistanceKm: 7, targetPaceZone: 'easy', sessionName: 'Easy Run' },
          { dayOfWeek: 4, sessionType: 'intervals', targetDistanceKm: 8, targetPaceZone: 'threshold', sessionName: 'Threshold Intervals', notes: '3x2km at half-marathon pace, 800m jog' },
          { dayOfWeek: 5, sessionType: 'rest', sessionName: 'Rest + Ocean' },
          { dayOfWeek: 6, sessionType: 'long', targetDistanceKm: 30, targetPaceZone: 'easy', sessionName: 'Long Run with MP Finish', notes: 'Last 10km at marathon pace' },
          { dayOfWeek: 7, sessionType: 'rest', sessionName: 'Full Rest' },
        ],
      },
      {
        weekNumber: 15,
        startDate: '2026-06-08',
        targetKm: 48,
        keyFocus: 'Race simulation and confidence building',
        sessions: [
          { dayOfWeek: 1, sessionType: 'easy', targetDistanceKm: 6, targetPaceZone: 'easy', sessionName: 'Easy Run + Strides' },
          { dayOfWeek: 2, sessionType: 'tempo', targetDistanceKm: 14, targetPaceZone: 'tempo', sessionName: 'Half Marathon Simulation', notes: 'Run at goal marathon pace — race rehearsal' },
          { dayOfWeek: 3, sessionType: 'rest', sessionName: 'Rest' },
          { dayOfWeek: 4, sessionType: 'easy', targetDistanceKm: 8, targetPaceZone: 'easy', sessionName: 'Easy Run' },
          { dayOfWeek: 5, sessionType: 'rest', sessionName: 'Rest + Ocean' },
          { dayOfWeek: 6, sessionType: 'long', targetDistanceKm: 26, targetPaceZone: 'easy', sessionName: 'Long Run', notes: 'Easy effort — last big long run' },
          { dayOfWeek: 7, sessionType: 'rest', sessionName: 'Full Rest' },
        ],
      },
      {
        weekNumber: 16,
        startDate: '2026-06-15',
        targetKm: 45,
        keyFocus: 'Last hard week before taper',
        sessions: [
          { dayOfWeek: 1, sessionType: 'easy', targetDistanceKm: 6, targetPaceZone: 'easy', sessionName: 'Easy Run' },
          { dayOfWeek: 2, sessionType: 'tempo', targetDistanceKm: 10, targetPaceZone: 'tempo', sessionName: 'Tempo Run', notes: 'Comfortable hard — don\'t overdo it' },
          { dayOfWeek: 3, sessionType: 'easy', targetDistanceKm: 7, targetPaceZone: 'easy', sessionName: 'Easy Run' },
          { dayOfWeek: 4, sessionType: 'intervals', targetDistanceKm: 7, targetPaceZone: 'interval', sessionName: 'Short Intervals', notes: '8x400m at 5K pace. Legs stay sharp.' },
          { dayOfWeek: 5, sessionType: 'rest', sessionName: 'Rest + Ocean' },
          { dayOfWeek: 6, sessionType: 'long', targetDistanceKm: 18, targetPaceZone: 'easy', sessionName: 'Moderate Long Run', notes: 'Volume tapering starts' },
          { dayOfWeek: 7, sessionType: 'rest', sessionName: 'Full Rest' },
        ],
      },
    ],
  },

  // ── BLOCK 5: Taper (Weeks 17-18) ──
  {
    name: 'Taper',
    phase: 'taper',
    startDate: '2026-06-22',
    endDate: '2026-07-05',
    targetWeeklyKm: 28,
    notes: 'Volume drops 30-40%. Maintain intensity, reduce duration. Light BFT only. Race week: 2 short easy runs + strides.',
    status: 'planned',
    weeks: [
      {
        weekNumber: 17,
        startDate: '2026-06-22',
        targetKm: 35,
        keyFocus: 'Taper week 1 — volume down, intensity maintained',
        sessions: [
          { dayOfWeek: 1, sessionType: 'easy', targetDistanceKm: 6, targetPaceZone: 'easy', sessionName: 'Easy Run + Strides' },
          { dayOfWeek: 2, sessionType: 'tempo', targetDistanceKm: 8, targetPaceZone: 'tempo', sessionName: 'Short Tempo', notes: '5km at marathon pace — stay sharp, don\'t overdo' },
          { dayOfWeek: 3, sessionType: 'rest', sessionName: 'Rest' },
          { dayOfWeek: 4, sessionType: 'easy', targetDistanceKm: 6, targetPaceZone: 'easy', sessionName: 'Easy Run' },
          { dayOfWeek: 5, sessionType: 'rest', sessionName: 'Rest + Ocean' },
          { dayOfWeek: 6, sessionType: 'long', targetDistanceKm: 12, targetPaceZone: 'easy', sessionName: 'Easy Long Run', notes: 'Last "long" run — keep it easy' },
          { dayOfWeek: 7, sessionType: 'rest', sessionName: 'Full Rest' },
        ],
      },
      {
        weekNumber: 18,
        startDate: '2026-06-29',
        targetKm: 20,
        keyFocus: 'Race week — trust the training',
        sessions: [
          { dayOfWeek: 1, sessionType: 'easy', targetDistanceKm: 5, targetPaceZone: 'easy', sessionName: 'Easy Shakeout + Strides', notes: '4x100m strides to keep legs turning over' },
          { dayOfWeek: 2, sessionType: 'easy', targetDistanceKm: 4, targetPaceZone: 'easy', sessionName: 'Short Easy Run', notes: 'Last run before race. 20 mins max.' },
          { dayOfWeek: 3, sessionType: 'rest', sessionName: 'Rest' },
          { dayOfWeek: 4, sessionType: 'rest', sessionName: 'Rest — travel day if needed' },
          { dayOfWeek: 5, sessionType: 'easy', targetDistanceKm: 3, targetPaceZone: 'easy', sessionName: 'Pre-race Shakeout', notes: '15 min jog + 4 strides. Stay loose.', isOptional: true },
          { dayOfWeek: 6, sessionType: 'rest', sessionName: 'Race Day Eve — rest + prep' },
          { dayOfWeek: 7, sessionType: 'long', targetDistanceKm: 42.2, targetPaceZone: 'tempo', sessionName: 'GOLD COAST MARATHON 🏃', notes: 'This is what it\'s all for. Trust the training. Negative split. Strong finish.' },
        ],
      },
    ],
  },
]

async function seed() {
  console.log('Seeding GC Marathon Training Plan...\n')

  // Delete existing training plan data (idempotent re-run)
  await prisma.plannedSession.deleteMany({})
  await prisma.trainingWeek.deleteMany({})
  await prisma.trainingBlock.deleteMany({})
  console.log('Cleared existing training plan data.\n')

  for (const blockInput of blocks) {
    const block = await prisma.trainingBlock.create({
      data: {
        name: blockInput.name,
        phase: blockInput.phase,
        startDate: new Date(blockInput.startDate),
        endDate: new Date(blockInput.endDate),
        targetWeeklyKm: blockInput.targetWeeklyKm,
        notes: blockInput.notes ?? null,
        status: blockInput.status,
      },
    })
    console.log(`✓ Block: ${block.name} (${block.phase}) — ${blockInput.weeks.length} weeks`)

    for (const weekInput of blockInput.weeks) {
      const week = await prisma.trainingWeek.create({
        data: {
          blockId: block.id,
          weekNumber: weekInput.weekNumber,
          startDate: new Date(weekInput.startDate),
          targetKm: weekInput.targetKm,
          keyFocus: weekInput.keyFocus,
          status: blockInput.status === 'active' && weekInput.weekNumber === 1 ? 'active' : 'planned',
        },
      })

      for (const session of weekInput.sessions) {
        await prisma.plannedSession.create({
          data: {
            weekId: week.id,
            dayOfWeek: session.dayOfWeek,
            sessionType: session.sessionType,
            targetDistanceKm: session.targetDistanceKm ?? null,
            targetPaceZone: session.targetPaceZone ?? null,
            sessionName: session.sessionName ?? null,
            notes: session.notes ?? null,
            isOptional: session.isOptional ?? false,
            isKidWeekOnly: session.isKidWeekOnly ?? false,
            isNonKidOnly: session.isNonKidOnly ?? false,
          },
        })
      }

      console.log(`  Week ${weekInput.weekNumber}: ${weekInput.targetKm}km — ${weekInput.sessions.length} sessions`)
    }
  }

  // Summary
  const [blockCount, weekCount, sessionCount] = await Promise.all([
    prisma.trainingBlock.count(),
    prisma.trainingWeek.count(),
    prisma.plannedSession.count(),
  ])
  console.log(`\nDone! ${blockCount} blocks, ${weekCount} weeks, ${sessionCount} sessions seeded.`)
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
