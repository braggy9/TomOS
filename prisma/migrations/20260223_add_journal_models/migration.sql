-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "excerpt" TEXT,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "mood" TEXT,
    "energy" TEXT,
    "reflection" TEXT,
    "themes" TEXT[],
    "tags" TEXT[],
    "entryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_conversations" (
    "id" TEXT NOT NULL,
    "entryId" TEXT,
    "title" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'chat',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_summaries" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "themes" TEXT[],
    "moodPattern" TEXT,
    "insights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "journal_entries_entryDate_idx" ON "journal_entries"("entryDate");
CREATE INDEX "journal_entries_mood_idx" ON "journal_entries"("mood");
CREATE INDEX "journal_entries_createdAt_idx" ON "journal_entries"("createdAt");

-- CreateIndex
CREATE INDEX "journal_conversations_entryId_idx" ON "journal_conversations"("entryId");
CREATE INDEX "journal_conversations_createdAt_idx" ON "journal_conversations"("createdAt");

-- CreateIndex
CREATE INDEX "journal_messages_conversationId_idx" ON "journal_messages"("conversationId");
CREATE INDEX "journal_messages_createdAt_idx" ON "journal_messages"("createdAt");

-- CreateIndex
CREATE INDEX "journal_summaries_type_idx" ON "journal_summaries"("type");
CREATE INDEX "journal_summaries_periodStart_idx" ON "journal_summaries"("periodStart");

-- AddForeignKey
ALTER TABLE "journal_conversations" ADD CONSTRAINT "journal_conversations_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_messages" ADD CONSTRAINT "journal_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "journal_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
