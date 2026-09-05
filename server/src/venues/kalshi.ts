import { fetchJson, parseDate, parsePrice, type VenueAdapter, type VenueQuote } from './types.js';

const BASE = 'https://external-api.kalshi.com/trade-api/v2';

/**
 * The orderbook endpoint returns two arrays and both are bids. There is no ask side anywhere
 * in the response. In a binary market YES and NO are reciprocal, so selling YES at p is the
 * same as bidding 1-p for NO, and the best YES ask is 1 minus the best NO bid.
 *
 * The market object already encodes that identity, so we read prices straight off it and skip
 * the orderbook call. deriveYesAskFromBook exists so the probe can check that against the raw
 * book rather than trusting the reasoning above.
 */
export class KalshiAdapter implements VenueAdapter {
  readonly venue = 'KALSHI' as const;

  async fetchQuote(ticker: string): Promise<VenueQuote> {
    const body = (await fetchJson(`${BASE}/markets/${encodeURIComponent(ticker)}`)) as {
      market?: Record<string, unknown>;
    };
    const m = body.market;
    if (!m) throw new Error(`Kalshi ${ticker}: response had no "market" object`);

    const yesBid = parsePrice(m.yes_bid_dollars, `Kalshi ${ticker} yes_bid_dollars`);
    const yesAsk = parsePrice(m.yes_ask_dollars, `Kalshi ${ticker} yes_ask_dollars`);

    // If this identity ever stops holding we are reading the wrong side of the book.
    const noBid = parsePrice(m.no_bid_dollars, `Kalshi ${ticker} no_bid_dollars`);
    if (Math.abs(yesAsk + noBid - 1) > 0.011) {
      throw new Error(
        `Kalshi ${ticker}: yes_ask (${yesAsk}) + no_bid (${noBid}) = ${(yesAsk + noBid).toFixed(4)}, expected 1`,
      );
    }

    const volumeRaw = m.volume_fp;
    const volume = volumeRaw == null ? undefined : Number.parseFloat(String(volumeRaw));

    return {
      venue: this.venue,
      externalId: ticker,
      yesBid,
      yesAsk,
      volume: Number.isFinite(volume) ? volume : undefined,
      closesAt: parseDate(m.close_time),
      fetchedAt: new Date(),
    };
  }

  marketUrl(ticker: string): string {
    // A market ticker alone cannot address a page; Kalshi's web routes are keyed on the
    // event. Callers that have the event ticker should use kalshiEventUrl directly.
    return KalshiAdapter.eventUrl(ticker);
  }

  /**
   * Market pages live at /markets/{series}/{slug}/{event}, lowercase. The slug segment is
   * cosmetic and gets canonicalised, so repeating the series ticker works and saves us needing
   * a slug the API never exposes.
   *
   * The event segment matters. /markets/kxrecssnber alone resolves to whichever year the site
   * thinks is current, which is how a 2027 link ended up opening the 2026 market.
   */
  static eventUrl(eventTicker: string): string {
    const series = eventTicker.split('-')[0] ?? eventTicker;
    const s = series.toLowerCase();
    return `https://kalshi.com/markets/${s}/${s}/${eventTicker.toLowerCase()}`;
  }

  /** Best YES ask derived from the bids-only book: 1 - best NO bid. Used by the probe to verify. */
  static deriveYesAskFromBook(noDollars: [string, string][]): number | null {
    if (!noDollars.length) return null;
    // Kalshi returns each side sorted ascending by price, so the best (highest) bid is last.
    const bestNoBid = Math.max(...noDollars.map(([price]) => Number.parseFloat(price)));
    return 1 - bestNoBid;
  }
}
