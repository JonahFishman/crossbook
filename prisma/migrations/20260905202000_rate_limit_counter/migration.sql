-- Shared store for the auth rate limiter so the cap holds across processes and restarts.
CREATE TABLE IF NOT EXISTS "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key","windowStart")
);
CREATE INDEX IF NOT EXISTS "RateLimitCounter_expiresAt_idx" ON "RateLimitCounter" ("expiresAt");
