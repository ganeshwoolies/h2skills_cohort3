import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getProgressSnapshot,
  saveDiscovery,
  getLatestDiscovery,
} from '../services/firestore';
import { discoverContentForThemes } from '../services/gemini';

export const discoverRouter = Router();

discoverRouter.use(requireAuth);

/**
 * GET /v1/discover/latest
 * Retrieves the most recent curated discovery record for the user
 */
discoverRouter.get('/latest', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const discovery = await getLatestDiscovery(uid);
    return res.json({ discovery });
  } catch (err: any) {
    console.error('Error fetching latest discovery:', err);
    return res.status(500).json({ error: 'Failed to retrieve discovery recommendations.' });
  }
});

/**
 * POST /v1/discover
 * Explicitly triggers discovery of external creators, books, articles, and podcasts
 * based on aggregated reflection themes.
 * Privacy boundary: ONLY abstracted theme labels are sent to Gemini with Search grounding.
 */
discoverRouter.post('/', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;

    // Optional user-specified themes or automatic extraction from progress snapshot
    let themesToSearch: string[] = [];

    if (req.body && Array.isArray(req.body.themes) && req.body.themes.length > 0) {
      themesToSearch = req.body.themes
        .filter((t: any) => typeof t === 'string' && t.trim().length > 0)
        .slice(0, 5);
    }

    if (themesToSearch.length === 0) {
      // Pull top themes from recent 60-day reflection history
      const progress = await getProgressSnapshot(uid, 60);
      themesToSearch = progress.themeFrequency.slice(0, 4).map((t) => t.theme);
    }

    // Default themes if brand new user with no journal entries yet
    if (themesToSearch.length === 0) {
      themesToSearch = ['Mindfulness & Clarity', 'Deep Work & Focus', 'Personal Resilience'];
    }

    // Call Gemini with Google Search grounding — only sending themes
    const content = await discoverContentForThemes(themesToSearch);

    // Save record server-side
    const record = await saveDiscovery(uid, { themesUsed: themesToSearch, content });

    return res.status(201).json(record);
  } catch (err: any) {
    console.error('Error executing discover content:', err);
    return res.status(500).json({ error: 'Failed to generate discovery recommendations.' });
  }
});
