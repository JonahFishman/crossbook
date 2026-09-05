import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { HistoryChart } from '../components/HistoryChart';
import { MatchBadge } from '../components/MatchBadge';
import { SettledBadge } from '../components/SettledBadge';
import { InfoTip } from '../components/InfoTip';
import { api, pct, type TopicDetail, type Venue } from '../lib/api';

const VENUES: { key: Venue; label: string; dot: string }[] = [
  { key: 'KALSHI', label: 'Kalshi', dot: 'bg-kalshi' },
  { key: 'POLYMARKET', label: 'Polymarket', dot: 'bg-poly' },
];

export function TopicPage() {
  const { slug = '' } = useParams();
  const [data, setData] = useState<TopicDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    api
      .topic(slug)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <Link to="/" className="mt-4 inline-block text-sm text-muted hover:text-white">
          Back to the board
        </Link>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8" aria-busy="true">
        <div className="h-8 w-2/3 animate-pulse rounded bg-panel" />
        <div className="mt-6 h-64 animate-pulse rounded-lg bg-panel" />
      </main>
    );
  }

  return (
    <main className="animate-rise mx-auto max-w-3xl px-4 py-8">
      <Link to="/" className="text-xs text-muted hover:text-white">
        ← Board
      </Link>
      <h1 className="mt-2 text-xl font-semibold text-white">
        {data.topic.label}
        {!data.topic.exactMatch && <MatchBadge />}
        {data.topic.settled && <SettledBadge closesAt={data.topic.closesAt} />}
      </h1>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {VENUES.map(({ key, label, dot }) => {
          const q = data.quotes[key];
          return (
            <section key={key} className="rounded-lg border border-edge bg-panel p-4">
              <h2 className="mb-2 flex items-center gap-2 text-sm text-muted">
                <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
                {label}
              </h2>
              {q ? (
                <>
                  <p className="text-2xl font-semibold tabular-nums text-white">
                    {pct(data.midpoints[key])}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabular-nums">
                    <dt className="text-muted">YES bid / ask</dt>
                    <dd className="text-right text-white">
                      {pct(q.yesBid)} / {pct(q.yesAsk)}
                    </dd>
                    <dt className="text-muted">NO bid / ask</dt>
                    <dd className="text-right text-white">
                      {pct(q.noBid)} / {pct(q.noAsk)}
                    </dd>
                    <dt className="text-muted">Volume</dt>
                    <dd className="text-right text-white">
                      {q.volume === null ? '--' : Math.round(q.volume).toLocaleString()}
                    </dd>
                  </dl>
                  <a
                    href={q.externalUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-block text-xs text-muted underline underline-offset-2 hover:text-white"
                  >
                    View on {label}
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted">No snapshot recorded yet.</p>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <div className="flex-1 rounded-lg border border-edge bg-panel p-4">
          <h2 className="text-xs text-muted">Mid spread</h2>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">{pct(data.midSpread)}</p>
        </div>
        <div className="flex-1 rounded-lg border border-edge bg-panel p-4">
          <h2 className="text-xs text-muted">
            Gross edge, before fees
            <InfoTip label="What gross edge means">
              Cost of buying YES on the cheaper venue and NO on the other. Positive means the pair
              costs under $1, before any fees. Not an arbitrage: Kalshi charges fees and settles in
              USD, Polymarket settles onchain, and this ignores order book depth.
            </InfoTip>
          </h2>
          <p className="mt-1 text-lg font-semibold tabular-nums text-white">{pct(data.grossEdge, 2)}</p>
        </div>
      </div>

      <section className="mt-3 rounded-lg border border-edge bg-panel p-4">
        <h2 className="mb-2 text-sm text-muted">Implied probability, last 48 hours</h2>
        <HistoryChart data={data.history} />
      </section>

      <section className="mt-3 rounded-lg border border-edge bg-panel p-4">
        <h2 className="mb-2 text-sm text-muted">How these two markets were matched</h2>
        <p className="text-sm leading-relaxed text-muted">{data.topic.resolutionNote}</p>
      </section>
    </main>
  );
}
