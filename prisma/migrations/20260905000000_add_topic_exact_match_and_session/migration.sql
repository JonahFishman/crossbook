-- The session store table is created at runtime by connect-pg-simple. Declaring it here
-- keeps Prisma's view of the schema honest without taking ownership away from that library.
-- IF NOT EXISTS makes this safe against a database where the app has already booted once.
CREATE TABLE IF NOT EXISTS "session" (
    "sid" varchar NOT NULL,
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");

-- Marks a topic whose two venues resolve on materially different criteria.
ALTER TABLE "Topic" ADD COLUMN IF NOT EXISTS "exactMatch" BOOLEAN NOT NULL DEFAULT true;
