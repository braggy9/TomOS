# FitnessOS Phase 2 — Complete Build-Out (Swift + API)

**Copy this entire prompt to Claude Code**

---

```
I want to complete the full FitnessOS build-out — finish the API, add a SwiftUI module to my existing TomOS app, and wire up Shortcuts.

## Context

**FitnessOS Phase 1 is done:**
- 5 database tables live in Neon Postgres
- 24 exercises seeded with coaching cues and spine notes
- 7 API routes working
- Progressive overload logic implemented

**Documentation:**
📁 ~/Desktop/🖥️ TomOS/tomos-command-tower/projects/fitness/
- CLAUDE.md — Development patterns
- SPEC.md — Full technical spec (schema, APIs, algorithms)

**Codebases:**
📁 ~/Desktop/Projects/TomOS/ — Next.js API (Vercel)
📁 ~/Desktop/🖥️ TomOS/TomOS-Apps/ — SwiftUI app (iOS + macOS)

The TomOS Swift app already has: APIService.swift, DesignSystem.swift, AppIntents.swift, and modules for Matters, Notes, BrainDump, etc. FitnessOS should follow the same patterns.

---

## PART 1: API Completion (Next.js)

Work in ~/Desktop/Projects/TomOS/

### 1.1 Running Stats Endpoint

Create `GET /api/gym/running/stats`

Response:
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

Calculate loadTrend by comparing last7Days to previous 7 days.

### 1.2 TomOS Task Auto-Creation

When a gym_session is created:
1. Auto-create a linked Task with title "Gym: Session {type}"
2. Set due date to session date
3. Store task.id in gym_session.taskId
4. When session is marked complete (completedAt is set), mark the task as done

Use existing TomOS task creation patterns from the codebase.

### 1.3 Strava OAuth Flow

**New endpoints:**

`GET /api/gym/sync/strava/auth`
- Redirects to Strava OAuth authorization URL
- Scopes: activity:read_all
- State parameter for CSRF protection

`GET /api/gym/sync/strava/callback`
- Handles OAuth callback
- Exchanges code for access_token and refresh_token
- Store tokens securely (database or encrypted env)
- Redirects to success page

`POST /api/gym/sync/strava/refresh`
- Internal: refresh access token when expired
- Use refresh_token to get new access_token

**Enhance existing sync:**

`POST /api/gym/sync/strava/manual`
- Fetch last 30 days of activities from Strava API
- Filter for type: Run, TrailRun
- Map to our types based on name/description patterns:
  - Contains "easy" or "recovery" → easy
  - Contains "interval" or "speed" or "track" → intervals
  - Contains "tempo" or "threshold" → tempo
  - Contains "hill" → hills
  - Contains "long" → long
  - Default → easy
- Calculate training_load: (distance_km * 10) + (duration_min * 2) + (elevation_m * 0.5)
- Upsert into running_sync table (use external_id to avoid duplicates)

**Environment variables needed:**
```
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=https://tomos-task-api.vercel.app/api/gym/sync/strava/callback
```

---

## PART 2: SwiftUI App Module

Work in ~/Desktop/🖥️ TomOS/TomOS-Apps/

Add FitnessOS as a new module in the existing TomOS app structure.

### 2.1 Data Models

Create `GymModels.swift`:

```swift
struct GymSession: Codable, Identifiable {
    let id: String
    let sessionType: String
    let date: Date
    var duration: Int?
    var notes: String?
    var overallRPE: Int?
    var weekType: String?
    var completedAt: Date?
    var sessionExercises: [SessionExercise]?
}

struct Exercise: Codable, Identifiable {
    let id: String
    let name: String
    let category: String
    let equipment: [String]?
    let primaryMuscles: [String]?
    let movementPattern: String?
    let cues: String?
    let spineNotes: String?
}

struct SessionExercise: Codable, Identifiable {
    let id: String
    let order: Int
    let exercise: Exercise
    var sets: [ExerciseSet]
}

struct ExerciseSet: Codable, Identifiable {
    let id: String?
    var setNumber: Int
    var weight: Double?
    var reps: Int?
    var rpe: Int?
}

struct GymSuggestion: Codable {
    let recommendedSession: String
    let rationale: String
    let weekType: String
    let runningLoadLast7Days: Double?
    let suggestedExercises: [ExerciseSuggestion]?
}

struct ExerciseSuggestion: Codable {
    let name: String
    let suggestedWeight: Double
    let lastWeight: Double?
    let rationale: String
}
```

### 2.2 API Service Extension

Add to `APIService.swift` (or create `GymAPIService.swift`):

```swift
// MARK: - Gym API

func fetchGymSuggestion() async throws -> GymSuggestion {
    // GET /api/gym/suggest
}

func fetchExercises(category: String? = nil) async throws -> [Exercise] {
    // GET /api/gym/exercises
}

func fetchExercise(id: String) async throws -> Exercise {
    // GET /api/gym/exercises/{id}
}

func fetchGymSessions(limit: Int = 20) async throws -> [GymSession] {
    // GET /api/gym/sessions
}

func fetchGymSession(id: String) async throws -> GymSession {
    // GET /api/gym/sessions/{id}
}

func createGymSession(_ session: CreateSessionRequest) async throws -> GymSession {
    // POST /api/gym/sessions
}

func quickLogSession(type: String, duration: Int, rpe: Int) async throws -> GymSession {
    // POST /api/gym/log
}

func syncStrava() async throws {
    // POST /api/gym/sync/strava/manual
}
```

### 2.3 Views

Follow existing TomOS design patterns (DesignSystem.swift).

**GymDashboardView.swift** — Main gym tab
- Today's recommendation (from /api/gym/suggest)
- "Start Session" button → navigates to session logging
- Quick stats: sessions this week, current streak
- Recent sessions list (last 5)

**GymSessionView.swift** — Log a new session
- Session type picker (A, B, C, Custom)
- When type selected, auto-load exercises for that session
- For each exercise:
  - Exercise name + coaching cue preview
  - Set logging: weight (kg), reps, RPE (1-10 slider)
  - "Add Set" button
  - Swipe to delete set
- Running session timer at top
- "Complete Session" button
- Auto-save progress (UserDefaults or local draft)

**GymSessionDetailView.swift** — View past session
- Show all exercises and sets
- Edit capability
- Delete session option

**GymExercisesView.swift** — Exercise library
- List grouped by category (Power, Strength, Core, Conditioning)
- Search/filter
- Tap exercise → detail view

**GymExerciseDetailView.swift** — Single exercise
- Name, category, equipment
- Coaching cues (prominent)
- Spine notes (if any, highlighted)
- Personal history chart (weight over time)
- "Add to Session" if in session-logging flow

**GymHistoryView.swift** — Session history
- List view with date, session type, duration, RPE
- Filter by session type
- Tap → GymSessionDetailView

### 2.4 Navigation Integration

Add Gym tab to the main ContentView tab bar:
- Icon: dumbbell or figure.strengthtraining.traditional
- Title: "Gym"

Or add to existing navigation structure following current app patterns.

### 2.5 Design Requirements

- Follow DesignSystem.swift colors and typography
- Dark mode support
- ADHD-friendly:
  - Big touch targets (minimum 44pt)
  - Minimal taps to log a set
  - Visual feedback on actions
  - Progress indicators
  - No data loss (auto-save)
- Works on iPhone and Mac (SwiftUI adaptive)

---

## PART 3: iOS Shortcuts (AppIntents)

Add to `AppIntents.swift`:

### 3.1 GymTodayIntent

```swift
struct GymTodayIntent: AppIntent {
    static var title: LocalizedStringResource = "What's my gym session today?"
    static var description = IntentDescription("Get today's gym recommendation")

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let suggestion = try await APIService.shared.fetchGymSuggestion()
        let response = "Today: Session \(suggestion.recommendedSession). \(suggestion.rationale)"
        return .result(value: response)
    }
}
```

### 3.2 QuickLogGymIntent

```swift
struct QuickLogGymIntent: AppIntent {
    static var title: LocalizedStringResource = "Log gym session"
    static var description = IntentDescription("Quickly log a completed gym session")

    @Parameter(title: "Session Type")
    var sessionType: String

    @Parameter(title: "Duration (minutes)")
    var duration: Int

    @Parameter(title: "RPE (1-10)")
    var rpe: Int

    func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let session = try await APIService.shared.quickLogSession(
            type: sessionType,
            duration: duration,
            rpe: rpe
        )
        return .result(value: "Logged Session \(sessionType) - \(duration) min, RPE \(rpe)")
    }
}
```

### 3.3 Register Shortcuts

Add to App Shortcuts provider:
- "Gym Today" → GymTodayIntent
- "Log Gym" → QuickLogGymIntent

---

## PART 4: Widget (Optional but nice)

If time permits, add a simple widget in TomOSWidget/:

**GymTodayWidget**
- Small: Just shows "Session A" or "Rest Day"
- Medium: Shows session type + brief rationale

---

## Implementation Order

1. **API Completion** (30-45 min)
   - Running stats endpoint
   - Task auto-creation logic
   - Strava OAuth flow

2. **Swift Models + API Service** (30 min)
   - GymModels.swift
   - API service methods

3. **Core Views** (1-2 hrs)
   - GymDashboardView
   - GymSessionView (this is the most complex)
   - GymExercisesView

4. **Supporting Views** (30-45 min)
   - GymSessionDetailView
   - GymExerciseDetailView
   - GymHistoryView

5. **Navigation Integration** (15 min)
   - Add to tab bar / navigation

6. **Shortcuts** (20 min)
   - AppIntents
   - Register shortcuts

7. **Widget** (optional, 20 min)

---

## Testing Checklist

After implementation:

- [ ] API: `curl https://tomos-task-api.vercel.app/api/gym/running/stats` returns data
- [ ] API: Creating a session auto-creates a linked task
- [ ] API: Strava OAuth flow works (need to set env vars first)
- [ ] App: Gym tab appears in TomOS app
- [ ] App: Can see today's recommendation
- [ ] App: Can log a full session with sets
- [ ] App: Session saves correctly and appears in history
- [ ] App: Exercise library loads with all 24 exercises
- [ ] Shortcuts: "Hey Siri, Gym Today" works
- [ ] Shortcuts: "Hey Siri, Log Gym" works

---

## Notes

- Back health (L4/5, S1) considerations are in the exercise spine_notes — display these prominently
- Kid weeks vs non-kid weeks affects recommendations — the suggest endpoint handles this
- Follow existing TomOS code style and patterns
- Commit incrementally as you go

Let's start with Part 1 (API completion), then move to Part 2 (Swift).
```

---

## After Claude Code Finishes

### 1. Set Up Strava (if you want running sync)

1. Go to https://www.strava.com/settings/api
2. Create application
3. Add to Vercel environment variables:
   - STRAVA_CLIENT_ID
   - STRAVA_CLIENT_SECRET
   - STRAVA_REDIRECT_URI
4. Redeploy
5. Visit `/api/gym/sync/strava/auth` to authorize

### 2. Build & Deploy App

```bash
cd ~/Desktop/🖥️\ TomOS/TomOS-Apps/
# Open in Xcode
open TomOS.xcodeproj
# Build and run on device/simulator
# Archive and upload to TestFlight
```

### 3. Test Shortcuts

1. Open Shortcuts app
2. Create new shortcut
3. Search for "Gym Today" or "Log Gym"
4. Add to Siri

---

*Phase 2 Handoff (Swift Edition) — February 3, 2026*
