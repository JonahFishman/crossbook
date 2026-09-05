import { Link } from 'react-router-dom';
import { pct, type BoardRow } from '../lib/api';
import { MatchBadge } from './MatchBadge';
import { SettledBadge } from './SettledBadge';
import { SpreadBadge } from './SpreadBadge';
import { VenuePrice } from './VenuePrice';
import { WatchToggle } from './WatchToggle';

interface Props {
  row: BoardRow;
  index: number;
  onToggleWatch: (row: BoardRow) => void;
  canWatch: boolean;
}

/**
 * Rendered twice by the board: as a table row from md up, and as a stacked card below it.
 * Keeping both in one component means the two never drift apart.
 */
export function TopicRow({ row, index, onToggleWatch, canWatch }: Props) {
  const delay = { animationDelay: `${Math.min(index, 12) * 35}ms` };

  return (
    // A settled row is deliberately NOT given animate-rise. That animation ends on
    // `opacity: 1` with a forwards fill, and an animation's final value beats a utility
    // class in the cascade, so the dimming below is silently ignored on an animated row.
    <tr
      className={`border-b border-edge/60 last:border-0 hover:bg-panel/60 ${
        row.topic.settled ? 'opacity-45' : 'animate-rise'
      }`}
      style={row.topic.settled ? undefined : delay}
    >
      <td className="py-3 pr-3">
        <Link to={`/t/${row.topic.slug}`} className="text-sm text-white hover:underline">
          {row.topic.label}
        </Link>
        {!row.topic.exactMatch && <MatchBadge />}
        {row.topic.settled && <SettledBadge closesAt={row.topic.closesAt} />}
      </td>
      <td className="px-3 py-3">
        <VenuePrice venue="KALSHI" quote={row.quotes.KALSHI} mid={row.midpoints.KALSHI} />
      </td>
      <td className="px-3 py-3">
        <VenuePrice venue="POLYMARKET" quote={row.quotes.POLYMARKET} mid={row.midpoints.POLYMARKET} />
      </td>
      <td className="px-3 py-3">
        <SpreadBadge value={row.midSpread} />
      </td>
      <td
        className={`px-3 py-3 text-sm tabular-nums ${row.topic.exactMatch ? 'text-muted' : 'text-muted/40 line-through'}`}
        title={row.topic.exactMatch ? undefined : 'Not meaningful: these two markets resolve on different criteria'}
      >
        {pct(row.grossEdge, 2)}
      </td>
      <td className="py-3 pl-3 text-right">
        <WatchToggle watched={row.watched} disabled={!canWatch} onToggle={() => onToggleWatch(row)} />
      </td>
    </tr>
  );
}

export function TopicCard({ row, index, onToggleWatch, canWatch }: Props) {
  const delay = { animationDelay: `${Math.min(index, 12) * 35}ms` };

  return (
    <li
      className={`rounded-lg border border-edge bg-panel p-4 ${
        row.topic.settled ? 'opacity-45' : 'animate-rise'
      }`}
      style={row.topic.settled ? undefined : delay}
    >
      <div className="flex items-start gap-3">
        <span className="flex-1">
          <Link to={`/t/${row.topic.slug}`} className="text-sm font-medium text-white hover:underline">
            {row.topic.label}
          </Link>
          {!row.topic.exactMatch && <MatchBadge />}
          {row.topic.settled && <SettledBadge closesAt={row.topic.closesAt} />}
        </span>
        <WatchToggle watched={row.watched} disabled={!canWatch} onToggle={() => onToggleWatch(row)} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <VenuePrice venue="KALSHI" quote={row.quotes.KALSHI} mid={row.midpoints.KALSHI} showLabel />
        <VenuePrice venue="POLYMARKET" quote={row.quotes.POLYMARKET} mid={row.midpoints.POLYMARKET} showLabel />
      </div>
      <div className="mt-3 flex items-center gap-4 border-t border-edge pt-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          Spread <SpreadBadge value={row.midSpread} />
        </span>
        <span className={`tabular-nums ${row.topic.exactMatch ? '' : 'text-muted/40 line-through'}`}>
          Gross edge {pct(row.grossEdge, 2)}
        </span>
      </div>
    </li>
  );
}
