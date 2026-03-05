-- CreateTable
CREATE TABLE "coach_prescriptions" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "sessionType" TEXT NOT NULL,
    "targetDistanceKm" DOUBLE PRECISION,
    "targetHRZone" TEXT,
    "targetPace" TEXT,
    "warmup" TEXT,
    "mainSet" TEXT,
    "cooldown" TEXT,
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'claude-coach',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coach_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coach_prescriptions_date_idx" ON "coach_prescriptions"("date");
