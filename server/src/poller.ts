import { prisma } from './db.js';
import { adapters } from './venues/index.js';
import type { Venue } from './venues/types.js';

export const POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface PollResult {
  written: number;
  failed: number;
}

/**
 * Fetch every venue market once and write a PriceSnapshot for each success.
 *
 * Failure policy: one market's failure must never abort the run and must never reject.
 * A venue outage should show up as a gap in that venue's history, not as a dead poller.
 */
export async function pollOnce(): Promise<PollResult> {
  const markets = await prisma.venueMarket.findMany();
  let written = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    markets.map(async (m) => {
      const adapter = adapters[m.venue as Venue];
      if (!adapter) throw new Error(`no adapter registered for venue ${m.venue}`);
      const quote = await adapter.fetchQuote(m.externalId);
      await prisma.priceSnapshot.create({
        data: {
          venueMarketId: m.id,
          yesBid: quote.yesBid,
          yesAsk: quote.yesAsk,
          volume: quote.volume ?? null,
          fetchedAt: quote.fetchedAt,
        },
      });
      // Keep the close time current. Venues occasionally move a settlement date, and this is
      // what lets the board retire a decided topic without a redeploy.
      if (quote.closesAt && quote.closesAt.getTime() !== m.closesAt?.getTime()) {
        await prisma.venueMarket.update({ where: { id: m.id }, data: { closesAt: quote.closesAt } });
      }
    }),
  );

  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') {
      written++;
    } else {
      failed++;
      const m = markets[i];
      console.error(`[poller] ${m?.venue} ${m?.externalId} failed: ${r.reason?.message ?? r.reason}`);
    }
  }

  console.log(`[poller] wrote ${written} snapshots, ${failed} failed`);
  return { written, failed };
}

/** Poll immediately on boot, then on a fixed interval. */
export function startPoller() {
  void pollOnce().catch((e) => console.error('[poller] initial poll failed', e));
  const timer = setInterval(() => {
    void pollOnce().catch((e) => console.error('[poller] scheduled poll failed', e));
  }, POLL_INTERVAL_MS);
  timer.unref?.();
  return timer;
}
