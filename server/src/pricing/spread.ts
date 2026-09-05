import type { Venue, VenueQuote } from '../venues/types.js';

/**
 * Cross-venue price math, as pure functions over VenueQuote. Nothing here touches the network
 * or the database, which is what makes it testable.
 *
 * All of it is derived on read. We store only what the venue told us, so these definitions can
 * change without a migration.
 */

/** In a binary market YES and NO are reciprocal, so the NO side is a restatement of the YES side. */
export function noAsk(quote: Pick<VenueQuote, 'yesBid'>): number {
  return 1 - quote.yesBid;
}

export function noBid(quote: Pick<VenueQuote, 'yesAsk'>): number {
  return 1 - quote.yesAsk;
}

/** The board's "implied probability" for a venue: the midpoint of its YES bid/ask. */
export function midpoint(quote: Pick<VenueQuote, 'yesBid' | 'yesAsk'>): number {
  return (quote.yesBid + quote.yesAsk) / 2;
}

/** How far apart the two venues price the same question. This is what the board sorts by. */
export function midSpread(
  a: Pick<VenueQuote, 'yesBid' | 'yesAsk'>,
  b: Pick<VenueQuote, 'yesBid' | 'yesAsk'>,
): number {
  return Math.abs(midpoint(a) - midpoint(b));
}

/**
 * Gross edge, before fees.
 *
 * Buy YES wherever it's cheapest and NO wherever that's cheapest and exactly one leg pays out,
 * so you get $1 back. If the pair costs less than $1, the difference is the edge:
 *
 *   grossEdge = 1 - (cheapest YES ask + cheapest NO ask)
 *
 * Do not call this an arbitrage. Kalshi charges fees this doesn't include, the two venues
 * settle differently so the capital isn't fungible, and it ignores depth entirely. A positive
 * number means the venues disagree.
 */
export function grossEdge(quotes: Pick<VenueQuote, 'yesBid' | 'yesAsk'>[]): number | null {
  if (quotes.length < 2) return null;
  const cheapestYesAsk = Math.min(...quotes.map((q) => q.yesAsk));
  const cheapestNoAsk = Math.min(...quotes.map((q) => noAsk(q)));
  return 1 - (cheapestYesAsk + cheapestNoAsk);
}

export interface TopicPricing {
  midpoints: Partial<Record<Venue, number>>;
  midSpread: number | null;
  grossEdge: number | null;
}

/**
 * Fold the latest quote from each venue into everything the board needs for one topic.
 * Returns nulls rather than throwing when a venue is missing, because the poller is allowed
 * to record a gap and the UI has to render that gap rather than blow up.
 */
export function priceTopic(quotes: Pick<VenueQuote, 'venue' | 'yesBid' | 'yesAsk'>[]): TopicPricing {
  const midpoints: Partial<Record<Venue, number>> = {};
  for (const q of quotes) midpoints[q.venue] = midpoint(q);

  const both = quotes.length >= 2 ? quotes : [];
  return {
    midpoints,
    midSpread: both.length >= 2 ? midSpread(both[0]!, both[1]!) : null,
    grossEdge: grossEdge(quotes),
  };
}
