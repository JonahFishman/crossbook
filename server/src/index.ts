import { join } from 'node:path';
import { existsSync } from 'node:fs';
import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { authRouter } from './auth/index.js';
import { topicsRouter } from './routes/topics.js';
import { watchlistRouter } from './routes/watchlist.js';
import { pollOnce, startPoller } from './poller.js';

const PORT = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === 'production';

const app = express();

// Render terminates TLS at its proxy. Without this, express-session sees a plain-http
// request, refuses to set a `secure` cookie, and login silently never persists.
if (isProd) app.set('trust proxy', 1);

app.use(express.json({ limit: '64kb' }));

const PgStore = connectPgSimple(session);
app.use(
  session({
    name: 'crossbook.sid',
    store: new PgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET ?? 'dev-only-insecure-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/watchlist', watchlistRouter);

/** Manual poll, used to warm the database right after a deploy and for demos. */
app.post('/api/admin/poll', async (req, res) => {
  const secret = process.env.ADMIN_POLL_SECRET;
  if (!secret || req.get('x-admin-secret') !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  res.json(await pollOnce());
});

// Serve the built React app from the same origin as the API, so the session cookie is
// first-party and there is no CORS or cross-site-cookie configuration to get wrong.
// Resolved from the working directory, which is the repo root in both `npm run dev`
// (tsx from source) and `npm start` (node from dist). Deriving it from import.meta.url
// instead would point at different places in those two cases.
const clientDist = join(process.cwd(), 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

/**
 * Final error handler. Logs the real error, returns something generic.
 *
 * express.json() throws on malformed or oversized bodies. Without the two cases below they
 * land here as 500s, which buries genuine server faults in the logs and tells the caller the
 * server broke when they sent bad input.
 */
app.use((err: Error & { type?: string; status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large' });
    return;
  }
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    res.status(400).json({ error: 'Malformed JSON body' });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`crossbook listening on :${PORT}`);
  startPoller();
});
