import { InfoTip } from './InfoTip';
import { TopicCard, TopicRow } from './TopicRow';
import type { BoardRow } from '../lib/api';

const EDGE_TIP =
  'Cost of buying YES on the cheaper venue and NO on the other. Positive means the pair costs under $1, before any fees. Not an arbitrage: Kalshi charges fees and settles in USD, Polymarket settles onchain, and this ignores order book depth.';

/** Shared by the board page and the watchlist page, so both stay identical. */
export function Board({
  rows,
  canWatch,
  onToggleWatch,
  emptyMessage,
}: {
  rows: BoardRow[];
  canWatch: boolean;
  onToggleWatch: (row: BoardRow) => void;
  emptyMessage: string;
}) {
  if (!rows.length) {
    return (
      <p className="rounded-lg border border-dashed border-edge px-4 py-12 text-center text-sm text-muted">
        {emptyMessage}
      </p>
    );
  }

  const props = { canWatch, onToggleWatch };

  return (
    <>
      {/* Table from md up. */}
      <table className="hidden w-full border-collapse md:table">
        <thead>
          <tr className="border-b border-edge text-left text-xs font-normal text-muted">
            <th scope="col" className="pb-2 pr-3 font-normal">Topic</th>
            <th scope="col" className="px-3 pb-2 font-normal">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-kalshi" aria-hidden="true" />
                Kalshi
              </span>
            </th>
            <th scope="col" className="px-3 pb-2 font-normal">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-poly" aria-hidden="true" />
                Polymarket
              </span>
            </th>
            <th scope="col" className="px-3 pb-2 font-normal">Spread</th>
            <th scope="col" className="px-3 pb-2 font-normal">
              Gross edge
              <InfoTip label="What gross edge means">{EDGE_TIP}</InfoTip>
            </th>
            <th scope="col" className="pb-2 pl-3 text-right font-normal">Watch</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <TopicRow key={row.topic.id} row={row} index={i} {...props} />
          ))}
        </tbody>
      </table>

      {/* Stacked cards below md. */}
      <ul className="grid gap-3 md:hidden">
        {rows.map((row, i) => (
          <TopicCard key={row.topic.id} row={row} index={i} {...props} />
        ))}
      </ul>
    </>
  );
}
