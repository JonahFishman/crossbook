/**
 * Throwaway-but-kept probe. Run with: npx tsx scripts/probe.ts
 *
 * Purpose: prove, against the live APIs, the three things this app's correctness rests on
 * before trusting either adapter.
 *   1. Kalshi's orderbook is bids-only, and yes_ask really does equal 1 - (best NO bid).
 *   2. Polymarket ships outcomes/outcomePrices/clobTokenIds as JSON *strings*, and its
 *      Gamma bestBid/bestAsk agree with the CLOB.
 *   3. Both adapters produce a normalized VenueQuote for every seeded market.
 */
import { readFileSync } from 'node:fs';
import { KalshiAdapter } from '../server/src/venues/kalshi.js';
import { PolymarketAdapter, parseStringifiedArray } from '../server/src/venues/polymarket.js';
import { grossEdge, midSpread, midpoint } from '../server/src/pricing/spread.js';
import { USER_AGENT } from '../server/src/venues/types.js';

const K = 'https://external-api.kalshi.com/trade-api/v2';
const GAMMA = 'https://gamma-api.polymarket.com';
const CLOB = 'https://clob.polymarket.com';
const get = async (u: string) =>
  (await fetch(u, { headers: { 'User-Agent': USER_AGENT } })).json() as Promise<any>;

interface SeedEntry {
  slug: string;
  label: string;
  resolutionNote: string;
  kalshiTicker: string;
  polymarketId: string;
  polymarketSlug: string;
}

const topics: SeedEntry[] = JSON.parse(readFileSync('server/seed/topics.json', 'utf8'));

async function verifyKalshiOrderbook(ticker: string) {
  console.log(`\n[1] Kalshi bids-only orderbook: ${ticker}`);
  const { market } = await get(`${K}/markets/${ticker}`);
  const book = (await get(`${K}/markets/${ticker}/orderbook`)).orderbook_fp ?? {};
  const yesSide: [string, string][] = book.yes_dollars ?? [];
  const noSide: [string, string][] = book.no_dollars ?? [];

  console.log(`    book sides present: ${Object.keys(book).join(', ')} (note: no ask side exists)`);
  console.log(`    best YES bid in book: ${yesSide.at(-1)?.[0]}   market.yes_bid_dollars: ${market.yes_bid_dollars}`);
  console.log(`    best NO  bid in book: ${noSide.at(-1)?.[0]}   market.no_bid_dollars:  ${market.no_bid_dollars}`);

  const derived = KalshiAdapter.deriveYesAskFromBook(noSide);
  const stated = Number.parseFloat(market.yes_ask_dollars);
  console.log(`    derived yes_ask = 1 - bestNoBid = ${derived?.toFixed(4)}  vs stated ${stated.toFixed(4)}`);
  console.log(
    derived !== null && Math.abs(derived - stated) < 0.011
      ? '    OK: derivation agrees with the market object, so reading yes_ask directly is safe.'
      : '    MISMATCH: do not trust yes_ask_dollars; derive from the book instead.',
  );
}

async function verifyPolymarketShapes(marketId: string) {
  console.log(`\n[2] Polymarket stringified arrays + CLOB agreement: ${marketId}`);
  const m = await get(`${GAMMA}/markets/${marketId}`);
  console.log(`    typeof outcomes: ${typeof m.outcomes}  raw: ${String(m.outcomes).slice(0, 40)}`);
  const outcomes = parseStringifiedArray(m.outcomes, 'outcomes');
  console.log(`    parsed outcomes: ${JSON.stringify(outcomes)}  (outcomes[0] === 'Yes' -> ${outcomes[0] === 'Yes'})`);

  const tokens = parseStringifiedArray(m.clobTokenIds, 'clobTokenIds');
  const buy = await get(`${CLOB}/price?token_id=${tokens[0]}&side=BUY`);
  const sell = await get(`${CLOB}/price?token_id=${tokens[0]}&side=SELL`);
  console.log(`    gamma bestBid/bestAsk: ${m.bestBid} / ${m.bestAsk}`);
  console.log(`    clob  BUY/SELL:        ${buy.price} / ${sell.price}`);
  const agrees =
    Math.abs(Number(m.bestBid) - Number(buy.price)) < 1e-6 &&
    Math.abs(Number(m.bestAsk) - Number(sell.price)) < 1e-6;
  console.log(agrees ? '    OK: Gamma matches the CLOB, so one Gamma call is enough.' : '    MISMATCH: prefer the CLOB.');
}

async function main() {
  const first = topics[0];
  if (first) {
    await verifyKalshiOrderbook(first.kalshiTicker);
    await verifyPolymarketShapes(first.polymarketId);
  }

  console.log('\n[3] Normalized VenueQuotes for every seeded topic\n');
  const kalshi = new KalshiAdapter();
  const poly = new PolymarketAdapter();

  for (const t of topics) {
    const [k, p] = await Promise.all([
      kalshi.fetchQuote(t.kalshiTicker).catch((e: Error) => e),
      poly.fetchQuote(t.polymarketId).catch((e: Error) => e),
    ]);
    if (k instanceof Error || p instanceof Error) {
      console.log(`${t.slug}: FAILED  ${k instanceof Error ? k.message : ''} ${p instanceof Error ? p.message : ''}`);
      continue;
    }
    console.log(
      `${t.slug.padEnd(30)} K ${k.yesBid.toFixed(3)}/${k.yesAsk.toFixed(3)} (${midpoint(k).toFixed(3)})  ` +
        `P ${p.yesBid.toFixed(3)}/${p.yesAsk.toFixed(3)} (${midpoint(p).toFixed(3)})  ` +
        `spread ${midSpread(k, p).toFixed(4)}  grossEdge ${grossEdge([k, p])!.toFixed(4)}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
