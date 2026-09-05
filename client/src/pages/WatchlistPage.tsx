import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Board } from '../components/Board';
import { api, type BoardRow } from '../lib/api';
import { useAuth } from '../lib/useAuth';

export function WatchlistPage() {
  const { user, loading } = useAuth();
  const [rows, setRows] = useState<BoardRow[] | null>(null);

  const load = useCallback(() => {
    // The watchlist is the board filtered by the flag the API already returns,
    // so the two views can never disagree about prices.
    api.board().then((all) => setRows(all.filter((r) => r.watched)));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const toggleWatch = useCallback(
    async (row: BoardRow) => {
      setRows((prev) => prev?.filter((r) => r.topic.id !== row.topic.id) ?? prev);
      try {
        await api.unwatch(row.topic.id);
      } catch {
        load();
      }
    },
    [load],
  );

  if (loading) return <main className="mx-auto max-w-5xl px-4 py-8" aria-busy="true" />;

  if (!user) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-12 text-center text-sm text-muted">
        <Link to="/login" className="text-white underline underline-offset-2">
          Sign in
        </Link>{' '}
        to see your watchlist.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-xl font-semibold text-white">Your watchlist</h1>
      <Board
        rows={rows ?? []}
        canWatch
        onToggleWatch={toggleWatch}
        emptyMessage="Nothing saved yet. Tap the star on any topic on the board."
      />
    </main>
  );
}
