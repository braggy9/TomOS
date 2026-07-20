# FitnessOS Phase 3 — Bug Fixes + CrossFit Enhancements

## SECTION 1: BUG FIXES (Critical)

### 1.1 CRASH: Substitute exercise
Going to sub an exercise causes app to crash.

Fix:
- Check substitute sheet/modal presentation
- Verify substitutes array is not nil
- Add nil checks and error handling
- Test swap flow end-to-end

### 1.2 CRASH: WOD Library infinite loop
Tapping into Benchmark Library causes infinite loop then crash.

Fix:
- Check navigation to WOD library view
- Look for recursive view updates or infinite state changes
- Check if benchmark data loading causes loop
- Add logging to identify loop source

### 1.3 BUG: Custom workout shows error but actually saves
When building a custom workout, shows error but workout appears when tapping back.

Fix:
- Check save/create flow for custom workouts
- Find where error is thrown incorrectly
- Show success state after save, not error
- Navigate to workout or show confirmation

---

## SECTION 2: TRUE CROSSFIT WORKOUT STRUCTURE

### 2.1 Combined Workout Format
Real CrossFit classes have multiple components. Support this structure:

Workout Components (user can include any/all):
- Warm-up (optional, timed or checklist)
- Strength/Skill (e.g., 5x5 Back Squat or 10 min EMOM: 2 Power Cleans)
- Metcon/WOD (AMRAP, EMOM, For Time, etc.)
- Accessory/Cash-out (optional finisher)
- Cool-down/Mobility (optional)

### 2.2 Data Model

CrossFitWorkout structure:
- id: String
- name: String
- components: array of WorkoutComponent
- estimatedDuration: Int (minutes)
- category: WorkoutCategory (cardio, strength, combo, skill)

WorkoutComponent structure:
- id: String
- type: ComponentType (warmup, strength, skill, metcon, accessory, cooldown)
- name: String
- format: WorkoutFormat (AMRAP, EMOM, ForTime, Rounds, etc.) - optional
- duration: Int (minutes) - optional
- movements: array of Movement
- notes: String - optional

WorkoutCategory enum:
- cardio (metcon-heavy, minimal lifting)
- strength (lifting-focused)
- combo (balanced strength + metcon)
- skill (technique/gymnastics focus)

### 2.3 Example Combined Workout

Name: Tuesday Strength + Metcon

Component 1 - Warm-up (8 min):
- 400m Row
- 10 Hip CARs each
- 10 Glute Bridges
- Worlds Greatest Stretch

Component 2 - Strength (15 min):
- Back Squat 5x5 at RPE 7
- Rest 2:00 between sets

Component 3 - Metcon (12 min):
- AMRAP 12
- 10 KB Swings
- 10 Box Jumps
- 10 Push-ups

Component 4 - Cash-out (5 min):
- 3 Rounds
- 10 GHD Sit-ups
- 30s Plank

### 2.4 UI Flow

1. User selects "New Workout" or "Build Custom"
2. Add components one by one (Warm-up, Strength, Metcon, etc.)
3. For each component, select format and add movements
4. Preview full workout with estimated time
5. Save to library or start immediately
6. During workout, navigate between components with clear transitions

---

## SECTION 3: SMART WORKOUT RECOMMENDATIONS

### 3.1 Recommendation Categories

Categories to offer:
- Cardio Blast: metcon-heavy, minimal/no lifting (rowing, running, burpees)
- Strength Focus: lifting + short metcon or no metcon
- The Combo: balanced strength + metcon (true CrossFit style)
- Skill Builder: technique work (Olympic lifts, gymnastics)
- Quick Hit: under 20 min total
- The Grind: 45+ min full session

### 3.2 Recommendation Logic

Base suggestions on:
- Day of week (align with running schedule)
- Kid week vs non-kid week (shorter options for kid weeks)
- Running load (high running load = less cardio metcon)
- Recent workout history (dont repeat same focus back-to-back)
- Time available (if specified)
- User preference if stated

### 3.3 UI for Recommendations

On dashboard show:
- Primary recommendation with category tag
- Other options expandable with 2-3 alternatives
- Quick filters: I want cardio / I want strength / Surprise me

---

## SECTION 4: DURATION SCALING

### 4.1 Scalable Metcons

Allow user to adjust metcon duration while keeping workout structure.

Example:
- Base: AMRAP 15
- User can adjust: 10 / 12 / 15 / 20 / 25 min
- Movements stay same, just more/less time

### 4.2 Implementation

- Add duration picker on workout preview screen
- Show estimated rounds based on duration
- Log actual duration selected

---

## SECTION 5: PUSH NOTIFICATIONS

### 5.1 Scheduled Reminders

- Gym day! - morning of scheduled workout days
- Rest day - recover well - on rest days
- Weekly summary - You trained 3x this week

### 5.2 In-Workout Notifications

For Sessions A and B (strength work):
- Rest timer: Rest complete - next set
- RPE prompt after set: How did that feel?

User can enable/disable each notification type in settings.

### 5.3 Implementation

- Use UNUserNotificationCenter
- Request permission on first workout logged
- Settings screen to toggle notification types
- Schedule based on users typical workout times

---

## SECTION 6: IMPLEMENTATION ORDER

1. Fix all 3 crashes (blocking issues)
2. Add combined workout data model
3. Update UI to show multi-component workouts
4. Add recommendation categories and filters
5. Add duration scaling UI
6. Add push notifications

Test each flow end-to-end before moving to next item.
