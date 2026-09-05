import { afterEach, describe, expect, it, vi } from 'vitest';
import { PolymarketAdapter, parseStringifiedArray } from './polymarket.js';

/** Trimmed from a real GET /markets/2252244 response. Note the stringified arrays. */
const market = {
  id: '2252244',
  question: 'Will there be no change in Fed interest rates after the September 2026 meeting?',
  slug: 'will-there-be-no-change-in-fed-interest-rates-after-the-september-2026-meeting-615',
  outcomes: '["Yes", "No"]',
  outcomePrices: '["0.495", "0.505"]',
  clobTokenIds: '["5774813808502271976034577231004070384856737782240013284201429020998651188", "2823941877263364518492465143495600084907836556684262956"]',
  bestBid: 0.49,
  bestAsk: 0.5,
  volumeNum: 22597364.84736,
};

const mockFetch = (body: unknown, ok = true) =>
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok, status: ok ? 200 : 404, json: async () => body }),
  );

afterEach(() => vi.unstubAllGlobals());

describe('parseStringifiedArray', () => {
  it('parses the JSON-encoded strings Polymarket actually sends', () => {
    expect(parseStringifiedArray('["Yes", "No"]', 'outcomes')).toEqual(['Yes', 'No']);
  });

  it('accepts a real array too, in case the API is ever fixed', () => {
    expect(parseStringifiedArray(['Yes', 'No'], 'outcomes')).toEqual(['Yes', 'No']);
  });

  it('names the field when the value is not valid JSON', () => {
    expect(() => parseStringifiedArray('not json', 'outcomes')).toThrow(/outcomes: value was not valid JSON/);
  });

  it('rejects JSON that parses to something other than an array', () => {
    expect(() => parseStringifiedArray('{"a":1}', 'outcomes')).toThrow(/expected an array/);
  });

  it('rejects a non-string, non-array value', () => {
    expect(() => parseStringifiedArray(42, 'outcomes')).toThrow(/expected string or array/);
  });
});

describe('PolymarketAdapter.fetchQuote', () => {
  it('normalizes a binary market into a VenueQuote', async () => {
    mockFetch(market);
    const q = await new PolymarketAdapter().fetchQuote('2252244');

    expect(q.venue).toBe('POLYMARKET');
    expect(q.externalId).toBe('2252244');
    expect(q.yesBid).toBeCloseTo(0.49, 10);
    expect(q.yesAsk).toBeCloseTo(0.5, 10);
    expect(q.volume).toBeCloseTo(22597364.84736, 5);
  });

  it('rejects a multi-outcome market instead of silently pricing one leg', async () => {
    mockFetch({ ...market, outcomes: '["Trump", "Biden", "Other"]' });
    await expect(new PolymarketAdapter().fetchQuote('x')).rejects.toThrow(/expected a binary market/);
  });

  it('asserts outcomes[0] is Yes rather than assuming it', async () => {
    // A reversed market would invert every price on the board without erroring.
    mockFetch({ ...market, outcomes: '["No", "Yes"]' });
    await expect(new PolymarketAdapter().fetchQuote('x')).rejects.toThrow(/outcomes\[0\] is "No"/);
  });

  it('rejects a price outside [0,1]', async () => {
    mockFetch({ ...market, bestAsk: 1.5 });
    await expect(new PolymarketAdapter().fetchQuote('x')).rejects.toThrow(/outside \[0,1\]/);
  });

  it('throws on a non-2xx response', async () => {
    mockFetch({}, false);
    await expect(new PolymarketAdapter().fetchQuote('x')).rejects.toThrow(/responded 404/);
  });
});
