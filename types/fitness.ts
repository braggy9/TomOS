/**
 * FitnessOS TypeScript Types
 * Gym and fitness tracking types for TomOS ecosystem
 */

export type ExerciseCategory =
  | 'power'
  | 'strength'
  | 'accessory'
  | 'core'
  | 'warmup'
  | 'conditioning';

export type MovementPattern =
  | 'hip_hinge'
  | 'squat'
  | 'push'
  | 'pull'
  | 'carry'
  | 'rotation'
  | 'anti_extension'
  | 'anti_rotation'
  | 'hip_extension'
  | 'plyometric'
  | 'compound'
  | 'cardio';

export type SessionType = 'A' | 'B' | 'C' | string;

export type WeekType = 'kid' | 'non-kid';

export type RunType = 'easy' | 'intervals' | 'tempo' | 'hills' | 'long';

export type RunSource = 'strava' | 'garmin' | 'manual';

export type LoadFactor = 'low' | 'moderate' | 'high';

// Exercise
export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  equipment: string[];
  primaryMuscles: string[];
  movementPattern: MovementPattern | null;
  cues: string | null;
  spineNotes: string | null;
  videoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Gym Session
export interface GymSession {
  id: string;
  date: Date;
  sessionType: string;
  duration: number | null;
  notes: string | null;
  overallRPE: number | null;
  weekType: string | null;
  completedAt: Date | null;
  taskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GymSessionWithExercises extends GymSession {
  sessionExercises: SessionExerciseWithDetails[];
}

// Session Exercise
export interface SessionExercise {
  id: string;
  order: number;
  sessionId: string;
  exerciseId: string;
  createdAt: Date;
}

export interface SessionExerciseWithDetails extends SessionExercise {
  exercise: Exercise;
  sets: ExerciseSet[];
}

// Exercise Set
export interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  time: number | null;
  distance: number | null;
  rpe: number | null;
  notes: string | null;
  sessionExerciseId: string;
  createdAt: Date;
}

// Running Sync
export interface RunningSync {
  id: string;
  externalId: string;
  source: RunSource;
  date: Date;
  type: RunType;
  distance: number;
  duration: number;
  avgPace: number | null;
  avgHeartRate: number | null;
  elevationGain: number | null;
  trainingLoad: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// API Request Types

export interface CreateSessionRequest {
  sessionType: string;
  date?: string;
  duration?: number;
  notes?: string;
  overallRPE?: number;
  weekType?: WeekType;
  taskId?: string;
  exercises?: CreateSessionExerciseInput[];
}

export interface CreateSessionExerciseInput {
  exerciseId: string;
  sets?: CreateSetInput[];
}

export interface CreateSetInput {
  weight?: number;
  reps?: number;
  time?: number;
  distance?: number;
  rpe?: number;
  notes?: string;
}

export interface UpdateSessionRequest {
  sessionType?: string;
  date?: string;
  duration?: number;
  notes?: string;
  overallRPE?: number;
  weekType?: WeekType;
  completedAt?: string;
}

export interface CreateExerciseRequest {
  name: string;
  category: ExerciseCategory;
  equipment?: string[];
  primaryMuscles?: string[];
  movementPattern?: string;
  cues?: string;
  spineNotes?: string;
  videoUrl?: string;
}

export interface QuickLogRequest {
  sessionType: string;
  weekType?: WeekType;
  notes?: string;
  overallRPE?: number;
  exercises: QuickLogExerciseInput[];
}

export interface QuickLogExerciseInput {
  name: string;
  weight?: number;
  sets: number;
  reps?: number;
  time?: number;
  distance?: number;
  rpe?: number;
}

// Suggestion Types

export interface WeightSuggestion {
  weight: number;
  rationale: string;
}

export interface ExerciseSuggestion {
  name: string;
  exerciseId: string;
  suggestedWeight: number;
  lastWeight: number | null;
  rationale: string;
}

export interface SessionSuggestion {
  recommendedSession: string;
  rationale: string;
  weekType: WeekType;
  runningLoadLast7Days: number;
  lastSession: {
    type: string;
    date: string;
    daysAgo: number;
  } | null;
  suggestedExercises: ExerciseSuggestion[];
}

export interface RunningStats {
  last7Days: {
    totalDistance: number;
    totalDuration: number;
    trainingLoad: number;
    sessions: number;
  };
  last30Days: {
    totalDistance: number;
    totalDuration: number;
    trainingLoad: number;
    sessions: number;
  };
  loadTrend: 'increasing' | 'decreasing' | 'stable';
}
