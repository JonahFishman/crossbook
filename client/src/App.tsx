import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Nav } from './components/Nav';
import { BoardPage } from './pages/BoardPage';

// The topic page is the only thing that pulls in the charting library, which is most of
// the bundle. Loading it on demand keeps the board's first paint small.
const TopicPage = lazy(() => import('./pages/TopicPage').then((m) => ({ default: m.TopicPage })));
import { WatchlistPage } from './pages/WatchlistPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

export function App() {
  return (
    <div className="min-h-screen bg-ink text-white antialiased">
      <Nav />
      <Suspense fallback={<main className="px-4 py-16 text-center text-sm text-muted">Loading…</main>}>
      <Routes>
        <Route path="/" element={<BoardPage />} />
        <Route path="/t/:slug" element={<TopicPage />} />
        <Route path="/watchlist" element={<WatchlistPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="*"
          element={<main className="px-4 py-16 text-center text-sm text-muted">Page not found.</main>}
        />
      </Routes>
      </Suspense>
      <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-xs text-muted">
        Read-only public market data from Kalshi and Polymarket. Not trading advice.
      </footer>
    </div>
  );
}
