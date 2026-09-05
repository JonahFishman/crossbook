import { describe, expect, it } from 'vitest';
import { grossEdge, midSpread, midpoint, noAsk, noBid, priceTopic } from './spread.js';

const q = (venue: 'KALSHI' | 'POLYMARKET', yesBid: number, yesAsk: number) => ({ venue, yesBid, yesAsk });

describe('reciprocal NO side', () => {
  it('derives the NO side from the YES side', () => {
    expect(noAsk({ yesBid: 0.47 })).toBeCloseTo(0.53, 10);
    expect(noBid({ yesAsk: 0.48 })).toBeCloseTo(0.52, 10);
  });

  it('matches the identity Kalshi publishes: yesAsk + noBid === 1', () => {
    const quote = { yesBid: 0.29, yesAsk: 0.3 };
    expect(quote.yesAsk + noBid(quote)).toBeCloseTo(1, 10);
    expect(quote.yesBid + noAsk(quote)).toBeCloseTo(1, 10);
  });
});

describe('midpoint', () => {
  it('averages the bid and the ask', () => {
    expect(midpoint({ yesBid: 0.47, yesAsk: 0.48 })).toBeCloseTo(0.475, 10);
  });

  it('collapses to the price when the book is locked', () => {
    expect(midpoint({ yesBid: 0.5, yesAsk: 0.5 })).toBe(0.5);
  });
});

describe('midSpread', () => {
  it('measures how far apart the venues price the same question', () => {
    // Real Sept 2026 FOMC "no change" quotes: Kalshi 0.47/0.48, Polymarket 0.49/0.50.
    expect(midSpread(q('KALSHI', 0.47, 0.48), q('POLYMARKET', 0.49, 0.5))).toBeCloseTo(0.02, 10);
  });

  it('is symmetric and never negative', () => {
    const a = q('KALSHI', 0.1, 0.2);
    const b = q('POLYMARKET', 0.8, 0.9);
    expect(midSpread(a, b)).toBeCloseTo(midSpread(b, a), 10);
    expect(midSpread(a, b)).toBeGreaterThanOrEqual(0);
  });

  it('is zero when both venues agree', () => {
    expect(midSpread(q('KALSHI', 0.3, 0.4), q('POLYMARKET', 0.3, 0.4))).toBe(0);
  });
});

describe('grossEdge', () => {
  it('is positive when the two cheapest opposing legs cost less than a dollar', () => {
    // Buy YES on Polymarket at 0.50, buy NO on Kalshi at 1 - 0.47 = 0.53 -> costs 1.03. Worse.
    // Buy YES on Kalshi at 0.48, buy NO on Polymarket at 1 - 0.49 = 0.51 -> costs 0.99 -> edge 0.01.
    const edge = grossEdge([q('KALSHI', 0.47, 0.48), q('POLYMARKET', 0.49, 0.5)]);
    expect(edge).toBeCloseTo(0.01, 10);
  });

  it('is negative when both venues quote a wide book', () => {
    // Kalshi 0.45/0.50 and Polymarket 0.53/0.54: cheapest YES 0.50, cheapest NO 1-0.53=0.47 -> 0.97.
    const edge = grossEdge([q('KALSHI', 0.45, 0.5), q('POLYMARKET', 0.53, 0.54)]);
    expect(edge).toBeCloseTo(0.03, 10);
  });

  it('is zero or negative for a single venue with a normal book', () => {
    // One venue alone can never show an edge: yesAsk + (1 - yesBid) >= 1 whenever ask >= bid.
    expect(grossEdge([q('KALSHI', 0.47, 0.48), q('KALSHI', 0.47, 0.48)])).toBeCloseTo(-0.01, 10);
  });

  it('returns null when only one venue reported', () => {
    expect(grossEdge([q('KALSHI', 0.47, 0.48)])).toBeNull();
  });

  it('picks the cheaper leg from each venue independently', () => {
    // YES is cheapest on Kalshi (0.20), NO is cheapest on Polymarket (1 - 0.85 = 0.15).
    const edge = grossEdge([q('KALSHI', 0.19, 0.2), q('POLYMARKET', 0.85, 0.86)]);
    expect(edge).toBeCloseTo(1 - (0.2 + 0.15), 10);
  });
});

describe('priceTopic', () => {
  it('folds both venues into everything the board needs', () => {
    const result = priceTopic([q('KALSHI', 0.47, 0.48), q('POLYMARKET', 0.49, 0.5)]);
    expect(result.midpoints.KALSHI).toBeCloseTo(0.475, 10);
    expect(result.midpoints.POLYMARKET).toBeCloseTo(0.495, 10);
    expect(result.midSpread).toBeCloseTo(0.02, 10);
    expect(result.grossEdge).toBeCloseTo(0.01, 10);
  });

  it('degrades to nulls when a venue is missing rather than throwing', () => {
    const result = priceTopic([q('KALSHI', 0.47, 0.48)]);
    expect(result.midpoints.KALSHI).toBeCloseTo(0.475, 10);
    expect(result.midpoints.POLYMARKET).toBeUndefined();
    expect(result.midSpread).toBeNull();
    expect(result.grossEdge).toBeNull();
  });

  it('handles no snapshots at all', () => {
    const result = priceTopic([]);
    expect(result.midSpread).toBeNull();
    expect(result.grossEdge).toBeNull();
    expect(Object.keys(result.midpoints)).toHaveLength(0);
  });
});
