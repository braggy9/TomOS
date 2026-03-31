-- CreateTable: race_costs (season race cost tracking)
-- Uses IF NOT EXISTS so this is safe to run even if table was created via db push
CREATE TABLE IF NOT EXISTS "race_costs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "raceSlug" TEXT NOT NULL,
    "raceName" TEXT NOT NULL,
    "entryFee" DOUBLE PRECISION,
    "entryPaid" BOOLEAN NOT NULL DEFAULT false,
    "entryNote" TEXT,
    "accomEst" DOUBLE PRECISION,
    "accomBooked" DOUBLE PRECISION,
    "accomNote" TEXT,
    "travelEst" DOUBLE PRECISION,
    "travelBooked" DOUBLE PRECISION,
    "travelNote" TEXT,
    "gear" DOUBLE PRECISION,
    "gearNote" TEXT,
    "food" DOUBLE PRECISION,
    "foodNote" TEXT,
    "other" DOUBLE PRECISION,
    "otherNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "race_costs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "race_costs_raceSlug_key" ON "race_costs"("raceSlug");

-- Seed: Sri Chinmoy series (4 races, $31.75 each via series pass)
INSERT INTO "race_costs" ("id", "raceSlug", "raceName", "entryFee", "entryPaid", "entryNote", "updatedAt")
VALUES
  (gen_random_uuid(), 'sri-chinmoy-centennial-park-half',       'Sri Chinmoy Centennial Park Half',       31.75, true, 'Series pass $127 / 4 races', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sri-chinmoy-iron-cove-half',             'Sri Chinmoy Iron Cove Half',             31.75, true, 'Series pass $127 / 4 races', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sri-chinmoy-dolls-point-half',           'Sri Chinmoy Dolls Point Half',           31.75, true, 'Series pass $127 / 4 races', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'sri-chinmoy-royal-national-park-marathon','Sri Chinmoy Royal National Park Marathon',31.75, true, 'Series pass $127 / 4 races', CURRENT_TIMESTAMP)
ON CONFLICT ("raceSlug") DO UPDATE SET
  "entryFee"  = EXCLUDED."entryFee",
  "entryPaid" = EXCLUDED."entryPaid",
  "entryNote" = EXCLUDED."entryNote",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Seed: Sunshine Coast Marathon
INSERT INTO "race_costs" ("id", "raceSlug", "raceName", "entryFee", "entryPaid", "entryNote", "updatedAt")
VALUES (gen_random_uuid(), 'sunshine-coast-marathon', 'Sunshine Coast Marathon', 200, true, 'Super early bird', CURRENT_TIMESTAMP)
ON CONFLICT ("raceSlug") DO UPDATE SET
  "entryFee"  = EXCLUDED."entryFee",
  "entryPaid" = EXCLUDED."entryPaid",
  "entryNote" = EXCLUDED."entryNote",
  "updatedAt" = CURRENT_TIMESTAMP;

-- Seed: Paid races with unknown amounts (check Gmail)
INSERT INTO "race_costs" ("id", "raceSlug", "raceName", "entryFee", "entryPaid", "entryNote", "updatedAt")
VALUES
  (gen_random_uuid(), 'jabulani-challenge-22km',      'Jabulani Challenge 22km',      null, true, 'Check Gmail for amount', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'hounslow-classic-17km',         'Hounslow Classic 17km',         null, true, 'Check Gmail for amount', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'ultra-trail-kosciuszko-50km',   'Ultra-Trail Kosciuszko 50km',   null, true, 'Check Gmail for amount', CURRENT_TIMESTAMP)
ON CONFLICT ("raceSlug") DO UPDATE SET
  "entryPaid" = EXCLUDED."entryPaid",
  "entryNote" = EXCLUDED."entryNote",
  "updatedAt" = CURRENT_TIMESTAMP;
