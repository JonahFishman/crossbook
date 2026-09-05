import { fetchJson, parseDate, parsePrice, type VenueAdapter, type VenueQuote } from './types.js';

const GAMMA = 'https://gamma-api.polymarket.com';

/**
 * Gamma's market object carries bestBid and bestAsk for the YES token, and those match the
 * CLOB's BUY and SELL prices exactly, so one request is enough.
 *
 * The catch: outcomes, outcomePrices and clobTokenIds come back as JSON-encoded strings rather
 * than arrays. We also check outcomes[0] is "Yes" instead of assuming, since a reversed market
 * would invert every price without erroring.
 */
export class PolymarketAdapter implements VenueAdapter {
  readonly venue = 'POLYMARKET' as const;

  async fetchQuote(marketId: string): Promise<VenueQuote> {
    const m = (await fetchJson(`${GAMMA}/markets/${encodeURIComponent(marketId)}`)) as Record<
      string,
      unknown
    >;
    if (!m || typeof m !== 'object') throw new Error(`Polymarket ${marketId}: empty response`);

    const outcomes = parseStringifiedArray(m.outcomes, `Polymarket ${marketId} outcomes`);
    if (outcomes.length !== 2) {
      throw new Error(
        `Polymarket ${marketId}: expected a binary market, got ${outcomes.length} outcomes (${outcomes.join('/')})`,
      );
    }
    if (outcomes[0] !== 'Yes') {
      throw new Error(`Polymarket ${marketId}: outcomes[0] is "${outcomes[0]}", expected "Yes"`);
    }

    const yesBid = parsePrice(m.bestBid, `Polymarket ${marketId} bestBid`);
    const yesAsk = parsePrice(m.bestAsk, `Polymarket ${marketId} bestAsk`);

    const volumeRaw = m.volumeNum ?? m.volume;
    const volume = volumeRaw == null ? undefined : Number.parseFloat(String(volumeRaw));

    return {
      venue: this.venue,
      externalId: marketId,
      yesBid,
      yesAsk,
      volume: Number.isFinite(volume) ? volume : undefined,
      closesAt: parseDate(m.endDate),
      fetchedAt: new Date(),
    };
  }

  marketUrl(marketIdOrSlug: string): string {
    return `https://polymarket.com/market/${encodeURIComponent(marketIdOrSlug)}`;
  }
}

/** Polymarket ships arrays as JSON strings. Accept either, fail loudly on anything else. */
export function parseStringifiedArray(raw: unknown, field: string): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== 'string') throw new Error(`${field}: expected string or array, got ${typeof raw}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${field}: value was not valid JSON: ${raw.slice(0, 80)}`);
  }
  if (!Array.isArray(parsed)) throw new Error(`${field}: parsed to ${typeof parsed}, expected an array`);
  return parsed.map(String);
}
