-- CreateTable: activities (lightweight non-run activity tracking)
CREATE TABLE "activities" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "date" TIMESTAMP(3) NOT NULL,
    "activityType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "externalId" TEXT,
    "duration" INTEGER NOT NULL,
    "distance" DOUBLE PRECISION,
    "avgHeartRate" INTEGER,
    "calories" INTEGER,
    "activityName" TEXT,
    "rpe" INTEGER,
    "moodPost" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "activities_externalId_key" ON "activities"("externalId");
CREATE INDEX "activities_date_idx" ON "activities"("date");
CREATE INDEX "activities_activityType_idx" ON "activities"("activityType");
CREATE INDEX "activities_source_idx" ON "activities"("source");
