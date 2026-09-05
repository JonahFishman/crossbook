import { afterEach, describe, expect, it, vi } from 'vitest';
import { KalshiAdapter } from './kalshi.js';

/** Trimmed from a real GET /markets/KXFEDDECISION-26SEP-H0 response. */
const market = {
  ticker: 'KXFEDDECISION-26SEP-H0',
  title: 'Will the Federal Reserve Hike rates by 0bps at their September 2026 meeting?',
  market_type: 'binary',
  yes_bid_dollars: '0.4700',
  yes_ask_dollars: '0.4800',
  no_bid_dollars: '0.5200',
  no_ask_dollars: '0.5300',
  volume_fp: '13872494.00',
};

const mockFetch = (body: unknown, ok = true) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 500, json: async () => body }),
  );

afterEach(() => vi.unstubAllGlobals());

describe('KalshiAdapter.fetchQuote', () => {
  it('normalizes dollar strings into a VenueQuote', async () => {
    mockFetch({ market });
    const q = await new KalshiAdapter().fetchQuote('KXFEDDECISION-26SEP-H0');

    expect(q.venue).toBe('KALSHI');
    expect(q.externalId).toBe('KXFEDDECISION-26SEP-H0');
    expect(q.yesBid).toBeCloseTo(0.47, 10);
    expect(q.yesAsk).toBeCloseTo(0.48, 10);
    expect(q.volume).toBeCloseTo(13872494, 10);
    expect(q.fetchedAt).toBeInstanceOf(Date);
  });

  it('rejects a market whose YES ask and NO bid do not sum to 1', async () => {
    // If Kalshi ever changed which side these fields describe, the spread math would be
    // silently inverted. Better to fail the fetch than to publish a wrong price.
    mockFetch({ market: { ...market, no_bid_dollars: '0.2000' } });
    await expect(new KalshiAdapter().fetchQuote('X')).rejects.toThrow(/expected 1/);
  });

  it('rejects a price outside [0,1]', async () => {
    mockFetch({ market: { ...market, yes_bid_dollars: '1.4000' } });
    await expect(new KalshiAdapter().fetchQuote('X')).rejects.toThrow(/outside \[0,1\]/);
  });

  it('throws when the payload has no market object', async () => {
    mockFetch({});
    await expect(new KalshiAdapter().fetchQuote('X')).rejects.toThrow(/no "market" object/);
  });

  it('throws on a non-2xx response', async () => {
    mockFetch({}, false);
    await expect(new KalshiAdapter().fetchQuote('X')).rejects.toThrow(/responded 500/);
  });
});

describe('eventUrl', () => {
  it('addresses the event, not just the series', () => {
    // The bug this guards: /markets/kxrecssnber resolves to whichever year Kalshi considers
    // current, so a 2027 link silently landed on the 2026 market.
    expect(KalshiAdapter.eventUrl('KXRECSSNBER-27')).toBe(
      'https://kalshi.com/markets/kxrecssnber/kxrecssnber/kxrecssnber-27',
    );
    expect(KalshiAdapter.eventUrl('KXRECSSNBER-27')).not.toBe(
      KalshiAdapter.eventUrl('KXRECSSNBER-26'),
    );
  });

  it('lowercases and keeps multi-segment event tickers intact', () => {
    expect(KalshiAdapter.eventUrl('KXFEDDECISION-26SEP')).toBe(
      'https://kalshi.com/markets/kxfeddecision/kxfeddecision/kxfeddecision-26sep',
    );
  });

  it('handles a series ticker with no suffix', () => {
    expect(KalshiAdapter.eventUrl('KXIMPEACH')).toBe(
      'https://kalshi.com/markets/kximpeach/kximpeach/kximpeach',
    );
  });

  it('produces a distinct url per event in the same series', () => {
    const urls = ['KXFEDDECISION-26SEP', 'KXFEDDECISION-26OCT', 'KXFEDDECISION-26DEC'].map((e) =>
      KalshiAdapter.eventUrl(e),
    );
    expect(new Set(urls).size).toBe(3);
  });
});

describe('deriveYesAskFromBook', () => {
  it('derives the YES ask from the bids-only NO side', () => {
    // The orderbook has no ask side at all. Best NO bid 0.52 -> best YES ask 0.48.
    const noSide: [string, string][] = [
      ['0.5000', '250024.81'],
      ['0.5100', '452501.00'],
      ['0.5200', '3829.10'],
    ];
    expect(KalshiAdapter.deriveYesAskFromBook(noSide)).toBeCloseTo(0.48, 10);
  });

  it('agrees with the ask the market object publishes', () => {
    const noSide: [string, string][] = [['0.6900', '1'], ['0.7000', '1']];
    expect(KalshiAdapter.deriveYesAskFromBook(noSide)).toBeCloseTo(0.3, 10);
  });

  it('does not assume the best bid is last', () => {
    // Kalshi sorts ascending, but taking the max is order-independent either way.
    expect(KalshiAdapter.deriveYesAskFromBook([['0.5200', '1'], ['0.5000', '1']])).toBeCloseTo(0.48, 10);
  });

  it('returns null for an empty book rather than pretending to know a price', () => {
    expect(KalshiAdapter.deriveYesAskFromBook([])).toBeNull();
  });
});
