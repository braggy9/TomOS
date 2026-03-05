-- AlterTable: GymSession — add moodPost and recoveryId
ALTER TABLE "gym_sessions" ADD COLUMN IF NOT EXISTS "moodPost" INTEGER;
ALTER TABLE "gym_sessions" ADD COLUMN IF NOT EXISTS "recoveryId" TEXT;

-- AlterTable: RunningSync — add extended Strava fields
ALTER TABLE "running_sync" ADD COLUMN IF NOT EXISTS "maxHeartRate" INTEGER;
ALTER TABLE "running_sync" ADD COLUMN IF NOT EXISTS "avgCadence" DOUBLE PRECISION;
ALTER TABLE "running_sync" ADD COLUMN IF NOT EXISTS "calories" INTEGER;
ALTER TABLE "running_sync" ADD COLUMN IF NOT EXISTS "activityName" TEXT;
ALTER TABLE "running_sync" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "running_sync" ADD COLUMN IF NOT EXISTS "splits" JSONB;
ALTER TABLE "running_sync" ADD COLUMN IF NOT EXISTS "sufferScore" INTEGER;
ALTER TABLE "running_sync" ADD COLUMN IF NOT EXISTS "streamsCache" JSONB;
ALTER TABLE "running_sync" ADD COLUMN IF NOT EXISTS "streamsCachedAt" TIMESTAMP(3);

-- CreateTable: user_settings
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "maxHeartRate" INTEGER NOT NULL DEFAULT 192,
    "restingHR" INTEGER,
    "defaultWeekType" TEXT NOT NULL DEFAULT 'non-kid',

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable: run_sessions
CREATE TABLE IF NOT EXISTS "run_sessions" (
    "id" TEXT NOT NULL,
    "runningSyncId" TEXT NOT NULL,
    "rpe" INTEGER,
    "moodPost" INTEGER,
    "sessionTypeOverride" TEXT,
    "notes" TEXT,
    "recoveryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "run_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: run_sessions unique on runningSyncId
CREATE UNIQUE INDEX IF NOT EXISTS "run_sessions_runningSyncId_key" ON "run_sessions"("runningSyncId");
CREATE INDEX IF NOT EXISTS "run_sessions_runningSyncId_idx" ON "run_sessions"("runningSyncId");

-- CreateTable: garmin_tokens
CREATE TABLE IF NOT EXISTS "garmin_tokens" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "accessToken" TEXT,
    "accessTokenSecret" TEXT,
    "userId" TEXT,

    CONSTRAINT "garmin_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable: garmin_workouts
CREATE TABLE IF NOT EXISTS "garmin_workouts" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3),
    "steps" JSONB,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "garmin_workouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: garmin_workouts unique on externalId
CREATE UNIQUE INDEX IF NOT EXISTS "garmin_workouts_externalId_key" ON "garmin_workouts"("externalId");

-- AddForeignKey: gym_sessions → recovery_checkins
DO $$ BEGIN
  ALTER TABLE "gym_sessions" ADD CONSTRAINT "gym_sessions_recoveryId_fkey"
    FOREIGN KEY ("recoveryId") REFERENCES "recovery_checkins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: run_sessions → running_sync
DO $$ BEGIN
  ALTER TABLE "run_sessions" ADD CONSTRAINT "run_sessions_runningSyncId_fkey"
    FOREIGN KEY ("runningSyncId") REFERENCES "running_sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey: run_sessions → recovery_checkins
DO $$ BEGIN
  ALTER TABLE "run_sessions" ADD CONSTRAINT "run_sessions_recoveryId_fkey"
    FOREIGN KEY ("recoveryId") REFERENCES "recovery_checkins"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
