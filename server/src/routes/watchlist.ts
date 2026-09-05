import { Router } from 'express';
import { isMissingRecord, isUniqueViolation, prisma } from '../db.js';
import { requireAuth } from '../auth/index.js';

export const watchlistRouter = Router();

watchlistRouter.use(requireAuth);

watchlistRouter.get('/', async (req, res) => {
  const items = await prisma.watchlistItem.findMany({
    where: { userId: req.session.userId! },
    include: { topic: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items.map((i) => ({ id: i.topic.id, slug: i.topic.slug, label: i.topic.label })));
});

watchlistRouter.post('/:topicId', async (req, res) => {
  const topic = await prisma.topic.findUnique({ where: { id: req.params.topicId } });
  if (!topic) {
    res.status(404).json({ error: 'Topic not found' });
    return;
  }
  // Upsert rather than create so double-clicking the star is not an error. The upsert is
  // itself a check-then-act though, so a concurrent DELETE or a second POST can still make it
  // lose the race. Both outcomes mean "the row is watched", which is what the caller asked
  // for, so they are successes rather than 500s.
  try {
    await prisma.watchlistItem.upsert({
      where: { userId_topicId: { userId: req.session.userId!, topicId: topic.id } },
      create: { userId: req.session.userId!, topicId: topic.id },
      update: {},
    });
  } catch (err) {
    if (!isUniqueViolation(err) && !isMissingRecord(err)) throw err;
  }
  res.status(201).json({ topicId: topic.id, watched: true });
});

watchlistRouter.delete('/:topicId', async (req, res) => {
  await prisma.watchlistItem.deleteMany({
    where: { userId: req.session.userId!, topicId: req.params.topicId },
  });
  res.status(204).end();
});
