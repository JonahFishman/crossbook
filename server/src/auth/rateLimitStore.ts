import type { Store, ClientRateLimitInfo, Options } from 'express-rate-limit';
import { prisma } from '../db.js';

/**
 * Rate-limit store in Postgres instead of process memory.
 *
 * The default store counts per process, and this service runs more than one, so each kept its
 * own tally and the real cap was a multiple of the configured one. Free-tier sleep would wipe
 * the counts anyway.
 *
 * Windows are fixed rather than sliding, derived from the clock so processes agree on the
 * bucket without coordinating. Costs you up to 2x the limit across a boundary.
 */
export class PrismaRateLimitStore implements Store {
  private windowMs = 60_000;
  private lastSweep = 0;

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private windowFor(now: number): { start: Date; reset: Date } {
    const startMs = Math.floor(now / this.windowMs) * this.windowMs;
    return { start: new Date(startMs), reset: new Date(startMs + this.windowMs) };
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = Date.now();
    const { start, reset } = this.windowFor(now);

    const row = await prisma.rateLimitCounter.upsert({
      where: { key_windowStart: { key, windowStart: start } },
      create: { key, windowStart: start, hits: 1, expiresAt: reset },
      update: { hits: { increment: 1 } },
    });

    void this.sweep(now);
    return { totalHits: row.hits, resetTime: reset };
  }

  async decrement(key: string): Promise<void> {
    const { start } = this.windowFor(Date.now());
    await prisma.rateLimitCounter
      .update({ where: { key_windowStart: { key, windowStart: start } }, data: { hits: { decrement: 1 } } })
      .catch(() => undefined); // the row may already have expired; nothing to undo
  }

  async resetKey(key: string): Promise<void> {
    await prisma.rateLimitCounter.deleteMany({ where: { key } });
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const { start, reset } = this.windowFor(Date.now());
    const row = await prisma.rateLimitCounter.findUnique({
      where: { key_windowStart: { key, windowStart: start } },
    });
    return row ? { totalHits: row.hits, resetTime: reset } : undefined;
  }

  /** Drop expired rows occasionally so the table cannot grow without bound. */
  private async sweep(now: number): Promise<void> {
    if (now - this.lastSweep < 10 * 60_000) return;
    this.lastSweep = now;
    await prisma.rateLimitCounter
      .deleteMany({ where: { expiresAt: { lt: new Date(now) } } })
      .catch((e) => console.error('[ratelimit] sweep failed', e));
  }
}
