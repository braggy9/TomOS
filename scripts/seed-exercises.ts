import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const exercises = [
  // ============================================
  // POWER
  // ============================================
  {
    name: 'Box Jump',
    category: 'power',
    equipment: ['box'],
    primaryMuscles: ['quads', 'glutes', 'calves'],
    movementPattern: 'plyometric',
    cues: 'Soft landing, full hip extension at top. Step down to reduce impact.',
    spineNotes: 'Step down (don\'t jump down) to reduce spinal impact',
  },
  {
    name: 'KB Swing',
    category: 'power',
    equipment: ['kettlebell'],
    primaryMuscles: ['glutes', 'hamstrings', 'core'],
    movementPattern: 'hip_hinge',
    cues: 'Hip snap, not a squat. Arms are just along for the ride. Squeeze glutes at top.',
    spineNotes: 'Excellent — hip snap pattern, not spinal flexion',
  },

  // ============================================
  // STRENGTH — LOWER
  // ============================================
  {
    name: 'RDL',
    category: 'strength',
    equipment: ['barbell', 'dumbbell'],
    primaryMuscles: ['hamstrings', 'glutes'],
    movementPattern: 'hip_hinge',
    cues: 'Hinge at hips, slight knee bend, back neutral. Feel the stretch in hamstrings.',
    spineNotes: 'Excellent for L4/5 — loads posterior chain without spinal flexion',
  },
  {
    name: 'Trap Bar Deadlift',
    category: 'strength',
    equipment: ['trap_bar'],
    primaryMuscles: ['quads', 'glutes', 'hamstrings'],
    movementPattern: 'hip_hinge',
    cues: 'Push the floor away. Neutral spine. Drive through heels.',
    spineNotes: 'Great alternative to conventional — more neutral spine position',
  },
  {
    name: 'Bulgarian Split Squat',
    category: 'strength',
    equipment: ['dumbbell', 'bench'],
    primaryMuscles: ['quads', 'glutes'],
    movementPattern: 'squat',
    cues: 'Rear foot elevated. Torso upright. Drive through front heel.',
    spineNotes: 'Single-leg, less spinal load than bilateral squats',
  },
  {
    name: 'Hip Thrust',
    category: 'strength',
    equipment: ['barbell', 'bench'],
    primaryMuscles: ['glutes'],
    movementPattern: 'hip_extension',
    cues: 'Upper back on bench. Drive hips up. Squeeze glutes at top. Chin tucked.',
    spineNotes: 'Excellent glute work with no spinal compression',
  },
  {
    name: 'Glute Bridge',
    category: 'strength',
    equipment: ['bodyweight'],
    primaryMuscles: ['glutes', 'core'],
    movementPattern: 'hip_extension',
    cues: 'Feet flat, drive through heels. Squeeze at top. Great for activation.',
    spineNotes: 'Great warmup and core activation for L4/5',
  },

  // ============================================
  // STRENGTH — UPPER
  // ============================================
  {
    name: 'DB Bench Press',
    category: 'strength',
    equipment: ['dumbbell', 'bench'],
    primaryMuscles: ['chest', 'triceps', 'shoulders'],
    movementPattern: 'push',
    cues: 'Shoulder blades pinched. Lower with control. Press up and slightly in.',
    spineNotes: 'Neutral spine on bench — no concerns',
  },
  {
    name: 'DB Shoulder Press',
    category: 'strength',
    equipment: ['dumbbell'],
    primaryMuscles: ['shoulders', 'triceps'],
    movementPattern: 'push',
    cues: 'Keep core tight. Press overhead. Don\'t arch the back.',
    spineNotes: 'Keep core braced to protect lower back',
  },
  {
    name: 'DB Row',
    category: 'strength',
    equipment: ['dumbbell', 'bench'],
    primaryMuscles: ['lats', 'rhomboids', 'biceps'],
    movementPattern: 'pull',
    cues: 'One hand on bench for support. Pull to hip. Squeeze shoulder blade.',
    spineNotes: 'Support with bench for neutral spine',
  },
  {
    name: 'Lat Pulldown',
    category: 'strength',
    equipment: ['cable'],
    primaryMuscles: ['lats', 'biceps'],
    movementPattern: 'pull',
    cues: 'Lean slightly back. Pull to upper chest. Control the return.',
    spineNotes: null,
  },
  {
    name: 'Pull-up',
    category: 'strength',
    equipment: ['bodyweight'],
    primaryMuscles: ['lats', 'biceps', 'core'],
    movementPattern: 'pull',
    cues: 'Full hang at bottom. Pull chin over bar. Control descent.',
    spineNotes: null,
  },

  // ============================================
  // CORE
  // ============================================
  {
    name: 'Dead Bug',
    category: 'core',
    equipment: ['bodyweight'],
    primaryMuscles: ['core', 'deep_stabilizers'],
    movementPattern: 'anti_extension',
    cues: 'Lower back pressed into floor. Opposite arm and leg extend. Breathe out on extension.',
    spineNotes: 'Excellent for L4/5 — teaches core stability with neutral spine',
  },
  {
    name: 'Pallof Press',
    category: 'core',
    equipment: ['cable', 'band'],
    primaryMuscles: ['core', 'obliques'],
    movementPattern: 'anti_rotation',
    cues: 'Resist the rotation. Press out and hold. Keep hips square.',
    spineNotes: 'Core stability without spinal flexion — ideal',
  },
  {
    name: 'Bird Dog',
    category: 'core',
    equipment: ['bodyweight'],
    primaryMuscles: ['core', 'glutes', 'erectors'],
    movementPattern: 'anti_rotation',
    cues: 'Opposite arm and leg extend. Don\'t let hips rotate. Hold briefly.',
    spineNotes: 'Great for back — builds stability through posterior chain',
  },
  {
    name: 'Farmers Carry',
    category: 'core',
    equipment: ['dumbbell', 'kettlebell'],
    primaryMuscles: ['core', 'grip', 'traps'],
    movementPattern: 'carry',
    cues: 'Tall posture. Shoulders packed. Walk with control.',
    spineNotes: 'Functional core training — great for spinal stability',
  },
  {
    name: 'Suitcase Carry',
    category: 'core',
    equipment: ['dumbbell', 'kettlebell'],
    primaryMuscles: ['obliques', 'core', 'grip'],
    movementPattern: 'carry',
    cues: 'One side only. Don\'t lean. Walk straight and tall.',
    spineNotes: 'Anti-lateral flexion — great for oblique and spine stability',
  },
  {
    name: 'Copenhagen Plank',
    category: 'core',
    equipment: ['bodyweight'],
    primaryMuscles: ['adductors', 'core'],
    movementPattern: null,
    cues: 'Top leg on bench. Lift hips. Hold. Build time gradually.',
    spineNotes: 'Adductor + core — good for overall stability',
  },
  {
    name: 'Side Plank',
    category: 'core',
    equipment: ['bodyweight'],
    primaryMuscles: ['obliques', 'core'],
    movementPattern: null,
    cues: 'Elbow under shoulder. Hips up. Straight line from head to feet.',
    spineNotes: null,
  },

  // ============================================
  // CONDITIONING (CrossFit-style)
  // ============================================
  {
    name: 'Wall Ball',
    category: 'conditioning',
    equipment: ['medicine_ball'],
    primaryMuscles: ['quads', 'glutes', 'shoulders'],
    movementPattern: 'squat',
    cues: 'Full depth squat. Throw ball to target. Catch and descend.',
    spineNotes: null,
  },
  {
    name: 'DB Thruster',
    category: 'conditioning',
    equipment: ['dumbbell'],
    primaryMuscles: ['quads', 'glutes', 'shoulders'],
    movementPattern: 'compound',
    cues: 'Squat to press in one fluid motion. Keep core braced.',
    spineNotes: 'Keep core braced throughout',
  },
  {
    name: 'Burpee',
    category: 'conditioning',
    equipment: ['bodyweight'],
    primaryMuscles: ['full_body'],
    movementPattern: 'compound',
    cues: 'Chest to deck. Pop up. Jump and clap. Control the descent.',
    spineNotes: 'Control the descent — don\'t collapse into the floor',
  },
  {
    name: 'Rowing',
    category: 'conditioning',
    equipment: ['erg'],
    primaryMuscles: ['full_body'],
    movementPattern: 'cardio',
    cues: 'Legs-back-arms on drive. Arms-back-legs on recovery. Steady rhythm.',
    spineNotes: null,
  },
  {
    name: 'Goblet Squat',
    category: 'conditioning',
    equipment: ['kettlebell', 'dumbbell'],
    primaryMuscles: ['quads', 'glutes', 'core'],
    movementPattern: 'squat',
    cues: 'Hold weight at chest. Elbows inside knees. Sit deep. Drive up.',
    spineNotes: null,
  },

  // ============================================
  // CONDITIONING — CrossFit/Metcon additions (Training Plan System)
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
    name: "Devil's Press",
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
]

async function seed() {
  console.log('Seeding exercise library...\n')

  let created = 0
  let skipped = 0

  for (const exercise of exercises) {
    try {
      await prisma.exercise.upsert({
        where: { name: exercise.name },
        update: {
          category: exercise.category,
          equipment: exercise.equipment,
          primaryMuscles: exercise.primaryMuscles,
          movementPattern: exercise.movementPattern,
          cues: exercise.cues,
          spineNotes: exercise.spineNotes,
        },
        create: exercise,
      })
      created++
      console.log(`  ✓ ${exercise.name} (${exercise.category})`)
    } catch (error) {
      skipped++
      console.error(`  ✗ ${exercise.name}: ${error}`)
    }
  }

  console.log(`\nDone! ${created} exercises seeded, ${skipped} errors.`)
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
