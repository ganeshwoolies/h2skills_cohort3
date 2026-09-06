import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { ProgressQuerySchema } from '../schemas';
import { getProgressSnapshot } from '../services/firestore';

export const progressRouter = Router();

progressRouter.use(requireAuth);

/**
 * GET /v1/progress
 * Pure aggregation endpoint for user streak, consistency, top themes, and recurring challenges
 */
progressRouter.get('/', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;

    const validation = ProgressQuerySchema.safeParse(req.query);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { rangeDays } = validation.data;
    const snapshot = await getProgressSnapshot(uid, rangeDays);

    return res.json(snapshot);
  } catch (err: any) {
    console.error('Error computing progress snapshot:', err);
    return res.status(500).json({ error: 'Failed to compute progress trends.' });
  }
});
