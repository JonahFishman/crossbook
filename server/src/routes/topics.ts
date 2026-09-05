import { Router } from 'express';
import { prisma } from '../db.js';
import { priceTopic } from '../pricing/spread.js';
import type { Venue } from '../venues/types.js';

export const topicsRouter = Router();

/**
 * A topic is only tradeable while BOTH venues are still open, so the earlier of the two close
 * times is the one that matters. Null when neither venue has reported a close time yet.
 */
function earliestClose(markets: { closesAt: Date | null }[]): Date | null {
  const times = markets.map((m) => m.closesAt).filter((d): d is Date => d != null);
  if (!times.length) return null;
  return new Date(Math.min(...times.map((d) => d.getTime())));
}

/** Decided: past its close time, so its price is a settled 0 or 1 rather than a forecast. */
function isSettled(closesAt: Date | null): boolean {
  return closesAt != null && closesAt.getTime() < Date.now();
}

interface LatestSnapshot {
  venueMarketId: string;
  yesBid: number;
  yesAsk: number;
  volume: number | null;
  fetchedAt: Date;
}

/**
 * Latest snapshot per venue market.
 *
 * Raw SQL rather than findMany({ distinct }) because Prisma implements distinct by selecting
 * every matching row and de-duplicating in memory. No LIMIT, so loading the board read the
 * entire price history and threw nearly all of it away. That grows by a few thousand rows a
 * day. DISTINCT ON with the matching index stays flat instead.
 */
async function latestSnapshotByMarket(marketIds: string[]) {
  if (!marketIds.length) return new Map<string, LatestSnapshot>();
  const rows = await prisma.$queryRaw<LatestSnapshot[]>`
    SELECT DISTINCT ON ("venueMarketId")
           "venueMarketId", "yesBid", "yesAsk", "volume", "fetchedAt"
    FROM "PriceSnapshot"
    WHERE "venueMarketId" = ANY(${marketIds})
    ORDER BY "venueMarketId", "fetchedAt" DESC
  `;
  return new Map(rows.map((r) => [r.venueMarketId, r]));
}

topicsRouter.get('/', async (req, res) => {
  const topics = await prisma.topic.findMany({ include: { venueMarkets: true } });
  const latest = await latestSnapshotByMarket(topics.flatMap((t) => t.venueMarkets.map((m) => m.id)));

  const watched = new Set<string>();
  if (req.session.userId) {
    const items = await prisma.watchlistItem.findMany({ where: { userId: req.session.userId } });
    for (const i of items) watched.add(i.topicId);
  }

  const board = topics.map((t) => {
    const quotes: Partial<Record<Venue, unknown>> = {};
    const forPricing: { venue: Venue; yesBid: number; yesAsk: number }[] = [];

    for (const m of t.venueMarkets) {
      const s = latest.get(m.id);
      if (!s) continue;
      const venue = m.venue as Venue;
      quotes[venue] = {
        yesBid: s.yesBid,
        yesAsk: s.yesAsk,
        volume: s.volume,
        fetchedAt: s.fetchedAt,
        externalUrl: m.externalUrl,
        externalId: m.externalId,
      };
      forPricing.push({ venue, yesBid: s.yesBid, yesAsk: s.yesAsk });
    }

    const pricing = priceTopic(forPricing);
    const closesAt = earliestClose(t.venueMarkets);
    return {
      topic: {
        id: t.id,
        slug: t.slug,
        label: t.label,
        resolutionNote: t.resolutionNote,
        exactMatch: t.exactMatch,
        closesAt,
        settled: isSettled(closesAt),
      },
      quotes,
      midpoints: pricing.midpoints,
      midSpread: pricing.midSpread,
      grossEdge: pricing.grossEdge,
      watched: watched.has(t.id),
    };
  });

  // Decided topics sink below live ones; within each group, widest spread first, and topics
  // still missing a venue fall to the bottom of their group.
  board.sort(
    (a, b) =>
      Number(a.topic.settled) - Number(b.topic.settled) || (b.midSpread ?? -1) - (a.midSpread ?? -1),
  );
  res.json(board);
});

topicsRouter.get('/:slug', async (req, res) => {
  const topic = await prisma.topic.findUnique({
    where: { slug: req.params.slug },
    include: { venueMarkets: true },
  });
  if (!topic) {
    res.status(404).json({ error: 'Topic not found' });
    return;
  }

  const marketIds = topic.venueMarkets.map((m) => m.id);
  const latest = await latestSnapshotByMarket(marketIds);

  const quotes: Partial<Record<Venue, unknown>> = {};
  const forPricing: { venue: Venue; yesBid: number; yesAsk: number }[] = [];
  for (const m of topic.venueMarkets) {
    const s = latest.get(m.id);
    if (!s) continue;
    const venue = m.venue as Venue;
    quotes[venue] = {
      yesBid: s.yesBid,
      yesAsk: s.yesAsk,
      noBid: 1 - s.yesAsk,
      noAsk: 1 - s.yesBid,
      volume: s.volume,
      fetchedAt: s.fetchedAt,
      externalUrl: m.externalUrl,
      externalId: m.externalId,
    };
    forPricing.push({ venue, yesBid: s.yesBid, yesAsk: s.yesAsk });
  }
  const pricing = priceTopic(forPricing);

  // Last 48h of both venues' midpoints, bucketed so the chart gets one row per timestamp.
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const snapshots = await prisma.priceSnapshot.findMany({
    where: { venueMarketId: { in: marketIds }, fetchedAt: { gte: since } },
    orderBy: { fetchedAt: 'asc' },
  });
  const venueOf = new Map(topic.venueMarkets.map((m) => [m.id, m.venue as Venue]));

  const buckets = new Map<number, { fetchedAt: string; KALSHI?: number; POLYMARKET?: number }>();
  for (const s of snapshots) {
    // Round to the minute so the two venues' writes from one poll land on the same x value.
    const key = Math.floor(s.fetchedAt.getTime() / 60000) * 60000;
    const row = buckets.get(key) ?? { fetchedAt: new Date(key).toISOString() };
    const venue = venueOf.get(s.venueMarketId);
    if (venue) row[venue] = (s.yesBid + s.yesAsk) / 2;
    buckets.set(key, row);
  }

  let history = [...buckets.values()];
  // Downsample by taking every nth point so the payload and the chart stay manageable.
  if (history.length > 300) {
    const step = Math.ceil(history.length / 300);
    history = history.filter((_, i) => i % step === 0 || i === history.length - 1);
  }

  res.json({
    topic: {
      id: topic.id,
      slug: topic.slug,
      label: topic.label,
      resolutionNote: topic.resolutionNote,
      exactMatch: topic.exactMatch,
      closesAt: earliestClose(topic.venueMarkets),
      settled: isSettled(earliestClose(topic.venueMarkets)),
    },
    quotes,
    midpoints: pricing.midpoints,
    midSpread: pricing.midSpread,
    grossEdge: pricing.grossEdge,
    history,
  });
});
