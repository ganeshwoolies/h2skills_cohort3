import { Router, Request, Response } from 'express';
import { config } from '../config';

export const healthRouter = Router();

healthRouter.get('/healthz', (_req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    service: 'personal-gemini-journal-api',
    projectId: config.projectId,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});
