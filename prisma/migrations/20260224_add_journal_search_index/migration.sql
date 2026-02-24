-- Add GIN index for full-text search on journal entries
CREATE INDEX "journal_entries_search_idx" ON "journal_entries" USING GIN (
  to_tsvector('english', coalesce("title", '') || ' ' || "content")
);
