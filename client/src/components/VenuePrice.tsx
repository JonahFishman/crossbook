import { pct, type Quote, type Venue } from '../lib/api';

const LABEL: Record<Venue, string> = { KALSHI: 'Kalshi', POLYMARKET: 'Polymarket' };
// Palette validated for colorblind separation and dark-surface contrast; see README.
const DOT: Record<Venue, string> = { KALSHI: 'bg-kalshi', POLYMARKET: 'bg-poly' };

/** One venue's implied probability, with its bid/ask underneath. */
export function VenuePrice({
  venue,
  quote,
  mid,
  showLabel = false,
}: {
  venue: Venue;
  quote?: Quote;
  mid?: number;
  showLabel?: boolean;
}) {
  if (!quote || mid === undefined) {
    return <span className="text-sm text-muted">no data</span>;
  }
  return (
    <div className="leading-tight">
      {showLabel && (
        <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted">
          <span className={`inline-block h-2 w-2 rounded-full ${DOT[venue]}`} aria-hidden="true" />
          {LABEL[venue]}
        </div>
      )}
      <div className="font-medium tabular-nums text-white">{pct(mid)}</div>
      <div className="text-xs tabular-nums text-muted">
        {pct(quote.yesBid)} / {pct(quote.yesAsk)}
      </div>
    </div>
  );
}
