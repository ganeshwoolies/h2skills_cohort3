import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  CreateSessionSchema,
  UpdateSessionSchema,
  CreateMessageSchema,
} from '../schemas';
import {
  createSession,
  listSessions,
  getSession,
  updateSession,
  deleteSession,
  listMessages,
  appendTurn,
  setSessionSummary,
  upsertUserProfile,
} from '../services/firestore';
import { generateJournalReply, summarizeJournalSession } from '../services/gemini';

export const sessionsRouter = Router();

// Apply auth to all session routes
sessionsRouter.use(requireAuth);

/**
 * POST /v1/sessions
 * Create a new journal session for the authenticated user
 */
sessionsRouter.post('/', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const validation = CreateSessionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    if (req.user?.name) {
      // Background async update of user profile
      upsertUserProfile(uid, req.user.name).catch((e) =>
        console.warn('Background upsertUserProfile notice:', e.message)
      );
    }

    const session = await createSession(uid, validation.data);
    return res.status(201).json(session);
  } catch (error: any) {
    console.error('POST /v1/sessions error:', error);
    return res.status(500).json({ error: 'Failed to create journal session' });
  }
});

/**
 * GET /v1/sessions
 * List sessions for the authenticated user with optional filters
 */
sessionsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { startDate, endDate, tag } = req.query;

    const sessions = await listSessions(uid, {
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      tag: typeof tag === 'string' ? tag : undefined,
    });

    return res.status(200).json({ sessions });
  } catch (error: any) {
    console.error('GET /v1/sessions error:', error);
    return res.status(500).json({ error: 'Failed to list journal sessions' });
  }
});

/**
 * GET /v1/sessions/:sessionId
 * Fetch details and messages for a specific session
 */
sessionsRouter.get('/:sessionId', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { sessionId } = req.params;

    const session = await getSession(uid, sessionId);
    if (!session) {
      // Generic 404: never disclose if session exists under another user
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = await listMessages(uid, sessionId);
    return res.status(200).json({
      session,
      messages,
    });
  } catch (error: any) {
    console.error(`GET /v1/sessions/${req.params.sessionId} error:`, error);
    return res.status(500).json({ error: 'Failed to retrieve session' });
  }
});

/**
 * PATCH /v1/sessions/:sessionId
 * Update title or tags of a session
 */
sessionsRouter.patch('/:sessionId', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { sessionId } = req.params;

    const validation = UpdateSessionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const updated = await updateSession(uid, sessionId, validation.data);
    if (!updated) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.status(200).json(updated);
  } catch (error: any) {
    console.error(`PATCH /v1/sessions/${req.params.sessionId} error:`, error);
    return res.status(500).json({ error: 'Failed to update session' });
  }
});

/**
 * DELETE /v1/sessions/:sessionId
 * Delete a session and all its messages
 */
sessionsRouter.delete('/:sessionId', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { sessionId } = req.params;

    const deleted = await deleteSession(uid, sessionId);
    if (!deleted) {
      return res.status(404).json({ error: 'Session not found' });
    }

    return res.status(200).json({ success: true, message: 'Session deleted' });
  } catch (error: any) {
    console.error(`DELETE /v1/sessions/${req.params.sessionId} error:`, error);
    return res.status(500).json({ error: 'Failed to delete session' });
  }
});

/**
 * POST /v1/sessions/:sessionId/messages
 * Post a user message and receive an AI reflection response
 */
sessionsRouter.post('/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { sessionId } = req.params;

    const validation = CreateMessageSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    // Verify session exists and belongs to user
    const session = await getSession(uid, sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const existingMessages = await listMessages(uid, sessionId);

    // Call Gemini with conversation history (bounded to last 20)
    const { reply, modelUsed } = await generateJournalReply(
      existingMessages.map((m) => ({ role: m.role, text: m.text })),
      validation.data.text
    );

    // Append turn in server transaction with strict sequencing
    const turn = await appendTurn(uid, sessionId, validation.data.text, reply);

    return res.status(201).json({
      ...turn,
      modelUsed,
    });
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      return res.status(404).json({ error: 'Session not found' });
    }
    console.error(`POST /v1/sessions/${req.params.sessionId}/messages error:`, error);
    return res.status(500).json({
      error: error.message || 'Failed to process journal reflection with Gemini',
    });
  }
});

/**
 * POST /v1/sessions/:sessionId/summarize
 * Generate and save an automated structured summary of the session
 */
sessionsRouter.post('/:sessionId/summarize', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { sessionId } = req.params;

    const session = await getSession(uid, sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = await listMessages(uid, sessionId);
    if (!messages.length) {
      return res.status(400).json({ error: 'Cannot summarize a session with no messages' });
    }

    // Call Gemini structured summarizer
    const summary = await summarizeJournalSession(
      messages.map((m) => ({ role: m.role, text: m.text }))
    );

    const serializedSummary = JSON.stringify(summary);
    const updatedSession = await setSessionSummary(uid, sessionId, serializedSummary);

    return res.status(200).json({
      session: updatedSession,
      summary,
    });
  } catch (error: any) {
    console.error(`POST /v1/sessions/${req.params.sessionId}/summarize error:`, error);
    return res.status(500).json({
      error: error.message || 'Failed to summarize journal session',
    });
  }
});
