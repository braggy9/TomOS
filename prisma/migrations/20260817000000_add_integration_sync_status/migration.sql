CREATE TABLE "integration_sync_status" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "lastAttemptAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integration_sync_status_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_sync_status_provider_key"
ON "integration_sync_status"("provider");

CREATE INDEX "integration_sync_status_lastSuccessAt_idx"
ON "integration_sync_status"("lastSuccessAt");

