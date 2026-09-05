/** Shapes returned by the Express API. Kept in one place so pages stay thin. */

export type Venue = 'KALSHI' | 'POLYMARKET';

export interface Quote {
  yesBid: number;
  yesAsk: number;
  noBid?: number;
  noAsk?: number;
  volume: number | null;
  fetchedAt: string;
  externalUrl: string;
  externalId: string;
}

export interface BoardRow {
  topic: {
    id: string;
    slug: string;
    label: string;
    resolutionNote: string;
    exactMatch: boolean;
    closesAt: string | null;
    settled: boolean;
  };
  quotes: Partial<Record<Venue, Quote>>;
  midpoints: Partial<Record<Venue, number>>;
  midSpread: number | null;
  grossEdge: number | null;
  watched: boolean;
}

export interface HistoryPoint {
  fetchedAt: string;
  KALSHI?: number;
  POLYMARKET?: number;
}

export interface TopicDetail extends Omit<BoardRow, 'watched'> {
  history: HistoryPoint[];
}

export interface User {
  id: string;
  email: string;
}

/** Thin fetch wrapper: always same-origin, always sends the session cookie. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export const api = {
  board: () => request<BoardRow[]>('/topics'),
  topic: (slug: string) => request<TopicDetail>(`/topics/${slug}`),
  me: () => request<{ user: User | null }>('/auth/me'),
  login: (email: string, password: string) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string) =>
    request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  watchlist: () => request<{ id: string; slug: string; label: string }[]>('/watchlist'),
  watch: (topicId: string) => request<unknown>(`/watchlist/${topicId}`, { method: 'POST' }),
  unwatch: (topicId: string) => request<void>(`/watchlist/${topicId}`, { method: 'DELETE' }),
};

/**
 * Prices are probabilities in [0,1]; the board speaks percent.
 *
 * Precision follows magnitude. One decimal is fine at 24.0% and useless at 0.65%, and rounding
 * quotes to whole percent produced rows reading "0.7%" above "1% / 1%". Under 5% gets two
 * decimals so a quote can't contradict the midpoint taken from it.
 */
export function pct(n: number | null | undefined, digits?: number): string {
  if (n == null || Number.isNaN(n)) return '--';
  // Round before choosing precision. Two spreads that are both 5% can land either side of a
  // raw 0.05 test through float error, which rendered one as "5.0%" and the other "5.00%".
  const rounded = Math.round(Math.abs(n) * 1e6) / 1e6;
  const places = digits ?? (rounded < 0.05 ? 2 : 1);
  return `${(n * 100).toFixed(places)}%`;
}
