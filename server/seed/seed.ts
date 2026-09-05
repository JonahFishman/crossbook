/**
 * Idempotent seed. Upserts the hand-curated topic list and its venue markets.
 * Safe to re-run: it never deletes price history.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import 'dotenv/config';
import { prisma } from '../src/db.js';
import { KalshiAdapter } from '../src/venues/kalshi.js';

interface SeedEntry {
  slug: string;
  label: string;
  resolutionNote: string;
  exactMatch: boolean;
  kalshiTicker: string;
  kalshiEventTicker: string;
  polymarketId: string;
  polymarketUrl: string;
}

const here = dirname(fileURLToPath(import.meta.url));
const topics: SeedEntry[] = JSON.parse(readFileSync(join(here, 'topics.json'), 'utf8'));

async function main() {
  for (const t of topics) {
    const topic = await prisma.topic.upsert({
      where: { slug: t.slug },
      create: { slug: t.slug, label: t.label, resolutionNote: t.resolutionNote, exactMatch: t.exactMatch },
      update: { label: t.label, resolutionNote: t.resolutionNote, exactMatch: t.exactMatch },
    });

    for (const vm of [
      {
        venue: 'KALSHI' as const,
        externalId: t.kalshiTicker,
        externalUrl: KalshiAdapter.eventUrl(t.kalshiEventTicker),
      },
      { venue: 'POLYMARKET' as const, externalId: t.polymarketId, externalUrl: t.polymarketUrl },
    ]) {
      await prisma.venueMarket.upsert({
        where: { topicId_venue: { topicId: topic.id, venue: vm.venue } },
        create: { topicId: topic.id, question: t.label, ...vm },
        update: { externalId: vm.externalId, externalUrl: vm.externalUrl, question: t.label },
      });
    }
    console.log(`seeded ${t.slug}`);
  }
  const [topicCount, marketCount] = await Promise.all([prisma.topic.count(), prisma.venueMarket.count()]);
  console.log(`\ndone: ${topicCount} topics, ${marketCount} venue markets`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
