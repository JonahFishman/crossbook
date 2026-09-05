export type Venue = 'KALSHI' | 'POLYMARKET';

/**
 * The single shape every venue is normalized into.
 * Both venues quote YES in dollars on [0,1], which is already an implied probability,
 * so no unit conversion is needed - only field extraction and parsing.
 */
export interface VenueQuote {
  venue: Venue;
  externalId: string;
  /** Best price someone will pay for YES, in [0,1]. */
  yesBid: number;
  /** Best price you can buy YES at, in [0,1]. */
  yesAsk: number;
  volume?: number;
  /**
   * When the venue stops trading this market. Read from the venue on every poll rather than
   * stored by hand, so the board can retire a topic on its own once the question is decided
   * instead of showing a settled market at 0% or 100% forever.
   */
  closesAt?: Date;
  fetchedAt: Date;
}

export interface VenueAdapter {
  readonly venue: Venue;
  /** Fetch a live quote for one market. Throws on network/parse failure; the poller catches. */
  fetchQuote(externalId: string): Promise<VenueQuote>;
  /** Public web page for a market, used for "view on venue" links. */
  marketUrl(externalId: string): string;
}

export const USER_AGENT = 'crossbook/0.1 (technical-assessment; contact via github)';
export const FETCH_TIMEOUT_MS = 5000;

/** fetch with a hard timeout so one slow venue can never stall the poller. */
export async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`${url} responded ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a venue timestamp, returning undefined rather than an Invalid Date. */
export function parseDate(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' || !raw) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Parse a venue's price string into a number and reject anything outside [0,1]. */
export function parsePrice(raw: unknown, field: string): number {
  const n = typeof raw === 'number' ? raw : Number.parseFloat(String(raw));
  if (!Number.isFinite(n)) throw new Error(`${field}: expected a number, got ${JSON.stringify(raw)}`);
  if (n < 0 || n > 1) throw new Error(`${field}: price ${n} outside [0,1]`);
  return n;
}
