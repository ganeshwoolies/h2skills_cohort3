import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { ShareReportRequestSchema } from '../schemas';
import {
  getReport,
  getTrustedPerson,
  createShareGrant,
  listGrantsForReport,
  revokeShareGrant,
  listSharedWithMe,
  getReportForSharedView,
} from '../services/firestore';

export const reportSharesRouter = Router({ mergeParams: true });
export const sharedWithMeRouter = Router();

// Apply auth to all share routes
reportSharesRouter.use(requireAuth);
sharedWithMeRouter.use(requireAuth);

/**
 * POST /v1/reports/:reportId/share
 * Grant read-only access to a Reflection Compass report to an active trusted person
 */
reportSharesRouter.post('/:reportId/share', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const reportId = req.params.reportId;

    const validation = ShareReportRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { personId } = validation.data;

    // Verify report belongs to caller
    const report = await getReport(uid, reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found or not owned by user.' });
    }

    // Verify trusted person belongs to caller and is not revoked
    const person = await getTrustedPerson(uid, personId);
    if (!person || person.status === 'revoked') {
      return res.status(400).json({ error: 'Trusted person not found or access has been revoked.' });
    }

    const ownerDisplayName = req.user?.name || req.user?.email || 'Reflective Journaler';

    const grant = await createShareGrant({
      ownerUid: uid,
      ownerDisplayName,
      viewerEmail: person.email,
      reportId: report.id,
      reportTitle: report.title,
    });

    return res.status(201).json(grant);
  } catch (err: any) {
    console.error('Error creating share grant:', err);
    return res.status(500).json({ error: 'Failed to share report.' });
  }
});

/**
 * GET /v1/reports/:reportId/shares
 * Lists active shares for a report owned by the caller
 */
reportSharesRouter.get('/:reportId/shares', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const reportId = req.params.reportId;

    const report = await getReport(uid, reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found or not owned by user.' });
    }

    const shares = await listGrantsForReport(uid, reportId);
    return res.json({ shares });
  } catch (err: any) {
    console.error('Error listing report shares:', err);
    return res.status(500).json({ error: 'Failed to list shares for report.' });
  }
});

/**
 * DELETE /v1/reports/:reportId/share/:grantId
 * Revokes a specific report share grant
 */
reportSharesRouter.delete('/:reportId/share/:grantId', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const { reportId, grantId } = req.params;

    const success = await revokeShareGrant(uid, reportId, grantId);
    if (!success) {
      return res.status(404).json({ error: 'Share grant not found or does not belong to this report.' });
    }

    return res.json({ success: true, message: 'Share grant revoked.' });
  } catch (err: any) {
    console.error('Error revoking share grant:', err);
    return res.status(500).json({ error: 'Failed to revoke share grant.' });
  }
});

/**
 * GET /v1/shared-with-me
 * Lists reports shared with the signed-in user
 */
sharedWithMeRouter.get('/shared-with-me', async (req: Request, res: Response) => {
  try {
    const callerEmail = req.user!.email || '';
    const callerUid = req.user!.uid;

    if (!callerEmail) {
      return res.json({ sharedWithMe: [] });
    }

    const list = await listSharedWithMe(callerEmail, callerUid);
    return res.json({ sharedWithMe: list });
  } catch (err: any) {
    console.error('Error listing shared reports:', err);
    return res.status(500).json({ error: 'Failed to list shared reports.' });
  }
});

/**
 * GET /v1/shared-with-me/:grantId
 * Fetches read-only Compass content for a specific shared grant
 */
sharedWithMeRouter.get('/shared-with-me/:grantId', async (req: Request, res: Response) => {
  try {
    const callerUid = req.user!.uid;
    const callerEmail = req.user!.email || '';
    const grantId = req.params.grantId;

    const sharedReport = await getReportForSharedView(callerUid, callerEmail, grantId);
    if (!sharedReport) {
      return res.status(404).json({ error: 'Shared report not found or access has expired/been revoked.' });
    }

    return res.json(sharedReport);
  } catch (err: any) {
    console.error('Error retrieving shared report:', err);
    return res.status(500).json({ error: 'Failed to load shared report.' });
  }
});
