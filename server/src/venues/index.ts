import { KalshiAdapter } from './kalshi.js';
import { PolymarketAdapter } from './polymarket.js';
import type { Venue, VenueAdapter } from './types.js';

/** Registry so the poller can look an adapter up by the venue stored on the row. */
export const adapters: Record<Venue, VenueAdapter> = {
  KALSHI: new KalshiAdapter(),
  POLYMARKET: new PolymarketAdapter(),
};

export { KalshiAdapter, PolymarketAdapter };
export * from './types.js';
