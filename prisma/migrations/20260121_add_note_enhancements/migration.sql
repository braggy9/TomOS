-- Add enhanced properties to notes table

-- Step 1: Add new columns
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'medium';

ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'active';

ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "reviewDate" TIMESTAMP(3);

ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "confidential" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "links" JSONB;

-- Step 2: Create indexes for new fields
CREATE INDEX IF NOT EXISTS "notes_priority_idx" ON "notes"("priority");

CREATE INDEX IF NOT EXISTS "notes_status_idx" ON "notes"("status");

CREATE INDEX IF NOT EXISTS "notes_reviewDate_idx" ON "notes"("reviewDate");

CREATE INDEX IF NOT EXISTS "notes_confidential_idx" ON "notes"("confidential");

-- Step 3: Create full-text search index for enhanced search
CREATE INDEX IF NOT EXISTS "notes_search_idx" ON "notes"
  USING GIN (to_tsvector('english', title || ' ' || content));
