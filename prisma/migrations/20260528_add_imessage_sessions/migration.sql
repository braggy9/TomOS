-- CreateTable: imessage_sessions (Blooio iMessage bridge conversation history)
-- Uses IF NOT EXISTS so this is safe to run even if the table was created via db push
CREATE TABLE IF NOT EXISTS "imessage_sessions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "phone_number" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "last_active" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imessage_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "imessage_sessions_phone_number_key" ON "imessage_sessions"("phone_number");
CREATE INDEX IF NOT EXISTS "imessage_sessions_last_active_idx" ON "imessage_sessions"("last_active");
