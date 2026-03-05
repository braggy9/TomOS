-- CreateTable
CREATE TABLE "training_blocks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "targetWeeklyKm" DOUBLE PRECISION,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "training_weeks" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "targetKm" DOUBLE PRECISION,
    "actualKm" DOUBLE PRECISION,
    "keyFocus" TEXT,
    "weekType" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "training_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_sessions" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "sessionType" TEXT NOT NULL,
    "targetDistanceKm" DOUBLE PRECISION,
    "targetPaceZone" TEXT,
    "sessionName" TEXT,
    "notes" TEXT,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "isKidWeekOnly" BOOLEAN NOT NULL DEFAULT false,
    "isNonKidOnly" BOOLEAN NOT NULL DEFAULT false,
    "linkedRunId" TEXT,
    "linkedGymSessionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planned_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "training_blocks_status_idx" ON "training_blocks"("status");
CREATE INDEX "training_blocks_startDate_idx" ON "training_blocks"("startDate");

-- CreateIndex
CREATE INDEX "training_weeks_blockId_idx" ON "training_weeks"("blockId");
CREATE INDEX "training_weeks_startDate_idx" ON "training_weeks"("startDate");
CREATE INDEX "training_weeks_status_idx" ON "training_weeks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "planned_sessions_linkedRunId_key" ON "planned_sessions"("linkedRunId");
CREATE UNIQUE INDEX "planned_sessions_linkedGymSessionId_key" ON "planned_sessions"("linkedGymSessionId");
CREATE INDEX "planned_sessions_weekId_idx" ON "planned_sessions"("weekId");
CREATE INDEX "planned_sessions_dayOfWeek_idx" ON "planned_sessions"("dayOfWeek");
CREATE INDEX "planned_sessions_status_idx" ON "planned_sessions"("status");
CREATE INDEX "planned_sessions_sessionType_idx" ON "planned_sessions"("sessionType");

-- AddForeignKey
ALTER TABLE "training_weeks" ADD CONSTRAINT "training_weeks_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "training_blocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "training_weeks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_linkedRunId_fkey" FOREIGN KEY ("linkedRunId") REFERENCES "running_sync"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_sessions" ADD CONSTRAINT "planned_sessions_linkedGymSessionId_fkey" FOREIGN KEY ("linkedGymSessionId") REFERENCES "gym_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
