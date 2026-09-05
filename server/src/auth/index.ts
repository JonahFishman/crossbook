import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { isUniqueViolation, prisma } from '../db.js';
import { PrismaRateLimitStore } from './rateLimitStore.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

const BCRYPT_ROUNDS = 12;

/**
 * In production the forwarded chain is: real client, Cloudflare edge, Render load balancer.
 * `req.ip` under `trust proxy: 1` gives the last one, which rotates per request, so the
 * limiter ended up counting load balancers instead of callers. Cloudflare sets
 * cf-connecting-ip to the true client and overwrites whatever the caller sends.
 */
function clientIp(req: Request): string {
  const cf = req.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const forwarded = req.get('x-forwarded-for');
  const leftmost = forwarded?.split(',')[0]?.trim();
  return leftmost || req.ip || 'unknown';
}

// Attached to /register and /login only. /me runs on every page load, so limiting the whole
// router would lock a normal visitor out after a few navigations.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  store: new PrismaRateLimitStore(),
  // ipKeyGenerator normalises IPv6 so a whole /64 cannot trivially sidestep the limit.
  keyGenerator: (req) => ipKeyGenerator(clientIp(req as Request)),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) =>
    res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' }),
});

const credentials = z.object({
  email: z.string().email('must be a valid email address').max(254),
  password: z.string().min(8, 'password must be at least 8 characters').max(200),
});

/** Route guard for anything that reads or writes a specific user's data. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not signed in' });
    return;
  }
  next();
}

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' });
    return;
  }
  const email = parsed.data.email.toLowerCase();

  // Cheap pre-check so the common duplicate skips the deliberately slow hash.
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'An account with that email already exists' });
    return;
  }

  // That check isn't enough on its own. Two simultaneous registrations of the same address
  // both pass it, both insert, and the loser hits the unique index. Still a duplicate, so 409.
  let user;
  try {
    user = await prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS) },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(409).json({ error: 'An account with that email already exists' });
      return;
    }
    throw err;
  }
  req.session.userId = user.id;
  res.status(201).json({ user: { id: user.id, email: user.email } });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid email or password' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });

  // Hash against a dummy when there's no such user, so a wrong email and a wrong password take
  // the same time. Otherwise response latency tells an attacker which emails are registered.
  const hash = user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvaliduO';
  const ok = await bcrypt.compare(parsed.data.password, hash);

  if (!user || !ok) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  req.session.userId = user.id;
  res.json({ user: { id: user.id, email: user.email } });
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('crossbook.sid');
    res.status(204).end();
  });
});

// 200 with a null user rather than 401. The board is public and every page load asks this, so
// being signed out is an expected answer. A 401 paints a red error in the console on a healthy
// page. Routes that actually need a session still 401 via requireAuth.
authRouter.get('/me', async (req, res) => {
  if (!req.session.userId) {
    res.json({ user: null });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
  if (!user) {
    // Session outlived the user row; clear it rather than 500.
    req.session.destroy(() => {});
    res.json({ user: null });
    return;
  }
  res.json({ user: { id: user.id, email: user.email } });
});
