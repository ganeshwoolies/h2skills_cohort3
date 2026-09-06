import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { GenerateCompassRequestSchema } from '../schemas';
import {
  createReport,
  listReports,
  getReport,
  deleteReport,
  listSessions,
  listMessages,
} from '../services/firestore';
import { generateReflectionCompass } from '../services/gemini';

export const reportsRouter = Router();

// Apply auth to all report routes
reportsRouter.use(requireAuth);

/**
 * POST /v1/reports/generate
 * Explicit action to generate a new Reflection Compass report from user's journal history
 */
reportsRouter.post('/generate', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;

    const validation = GenerateCompassRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { title, periodStart, periodEnd, sessionIds } = validation.data;

    // Fetch user's sessions to include
    let candidateSessions = await listSessions(uid, {
      startDate: periodStart,
      endDate: periodEnd,
    });

    if (sessionIds && sessionIds.length > 0) {
      candidateSessions = candidateSessions.filter((s) => sessionIds.includes(s.id));
    }

    if (candidateSessions.length === 0) {
      // Still allow compass generation, but note that no sessions were found
      console.log(`Generating Compass for ${uid} with 0 filtered sessions.`);
    }

    // Collect message samples for the candidate sessions (limit to 5 sessions max for token optimization)
    const sessionsWithContext = await Promise.all(
      candidateSessions.slice(0, 5).map(async (sess) => {
        const messages = await listMessages(uid, sess.id);
        return {
          title: sess.title,
          summary: sess.summary,
          messages: messages.map((m) => ({ role: m.role, text: m.text })),
        };
      })
    );

    // Explicit call to Gemini with structured output validation
    const compassContent = await generateReflectionCompass(
      periodStart,
      periodEnd,
      sessionsWithContext
    );

    const reportTitle =
      title?.trim() ||
      `Reflection Compass (${new Date(periodStart).toLocaleDateString()} - ${new Date(periodEnd).toLocaleDateString()})`;

    const report = await createReport(uid, {
      title: reportTitle,
      periodStart,
      periodEnd,
      content: compassContent,
    });

    return res.status(201).json(report);
  } catch (error: any) {
    console.error('POST /v1/reports/generate error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to generate Reflection Compass report',
    });
  }
});

/**
 * GET /v1/reports
 * List all saved Reflection Compass reports for the authenticated user
 */
reportsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const reports = await listReports(uid);
    return res.status(200).json({ reports });
  } catch (error: any) {
    console.error('GET /v1/reports error:', error);
    return res.status(500).json({ error: 'Failed to list Reflection Compass reports' });
  }
});

/**
 * GET /v1/reports/:reportId
 * Retrieve a specific report by ID
 */
reportsRouter.get('/:reportId', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { reportId } = req.params;

    const report = await getReport(uid, reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.status(200).json(report);
  } catch (error: any) {
    console.error(`GET /v1/reports/${req.params.reportId} error:`, error);
    return res.status(500).json({ error: 'Failed to retrieve report' });
  }
});

/**
 * DELETE /v1/reports/:reportId
 * Delete a saved Reflection Compass report
 */
reportsRouter.delete('/:reportId', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { reportId } = req.params;

    const deleted = await deleteReport(uid, reportId);
    if (!deleted) {
      return res.status(404).json({ error: 'Report not found' });
    }

    return res.status(200).json({ success: true, message: 'Report deleted' });
  } catch (error: any) {
    console.error(`DELETE /v1/reports/${req.params.reportId} error:`, error);
    return res.status(500).json({ error: 'Failed to delete report' });
  }
});
