import { Prisma, PrismaClient } from '@prisma/client';

/**
 * One Prisma client for the process. Re-instantiating per request exhausts the
 * connection pool, which on a serverless Postgres shows up as intermittent timeouts
 * rather than an obvious error, so it is worth being deliberate about.
 */
export const prisma = new PrismaClient();

/**
 * True for a unique-constraint violation (Prisma P2002).
 *
 * Any "check whether it exists, then insert" pair is a race: two requests can both pass the
 * check and both insert, and the database is what actually settles it. Catching P2002 turns
 * that lost race into the right answer for the caller instead of a 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

/** True when a write targeted a row that no longer exists (Prisma P2025). */
export function isMissingRecord(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}
