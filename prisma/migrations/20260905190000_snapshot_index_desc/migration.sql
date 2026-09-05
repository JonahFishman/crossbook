-- Reverse the fetchedAt direction so DISTINCT ON (venueMarketId) ... ORDER BY fetchedAt DESC
-- is served by a plain index scan instead of an incremental sort over the whole history.
DROP INDEX IF EXISTS "PriceSnapshot_venueMarketId_fetchedAt_idx";
CREATE INDEX "PriceSnapshot_venueMarketId_fetchedAt_idx"
    ON "PriceSnapshot" ("venueMarketId", "fetchedAt" DESC);
