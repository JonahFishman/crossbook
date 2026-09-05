-- When the venue stops trading this market, refreshed by the poller.
ALTER TABLE "VenueMarket" ADD COLUMN IF NOT EXISTS "closesAt" TIMESTAMP(3);
