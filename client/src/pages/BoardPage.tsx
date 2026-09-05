import { useCallback, useEffect, useState } from 'react';
import { Board } from '../components/Board';
import { api, type BoardRow } from '../lib/api';
import { useAuth } from '../lib/useAuth';

const REFRESH_MS = 60_000;

export function BoardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<BoardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .board()
      .then(setRows)
      .catch((e: Error) => setError(e.message));
  }, []);

  // Refetch on an interval so the spread badge visibly updates as the poller writes.
  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load, user]);

  const toggleWatch = useCallback(
    async (row: BoardRow) => {
      // Optimistic: flip locally first so the star responds instantly, roll back on failure.
      setRows((prev) =>
        prev?.map((r) => (r.topic.id === row.topic.id ? { ...r, watched: !r.watched } : r)) ?? prev,
      );
      try {
        await (row.watched ? api.unwatch(row.topic.id) : api.watch(row.topic.id));
      } catch {
        load();
      }
    },
    [load],
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Cross-venue board</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The same question priced on Kalshi and Polymarket, sorted by how far apart the two venues
          are. Percentages are implied probability, taken as the midpoint of each venue's YES
          bid/ask. Prices refresh every 5 minutes.
        </p>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {rows === null && !error ? (
        <div className="grid gap-2" aria-busy="true" aria-label="Loading board">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-md bg-panel" />
          ))}
        </div>
      ) : (
        <Board
          rows={rows ?? []}
          canWatch={Boolean(user)}
          onToggleWatch={toggleWatch}
          emptyMessage="No snapshots yet. The poller runs every 5 minutes; check back shortly."
        />
      )}

      {!user && rows?.length ? (
        <p className="mt-6 text-xs text-muted">Sign in to save topics to a watchlist.</p>
      ) : null}
    </main>
  );
}
