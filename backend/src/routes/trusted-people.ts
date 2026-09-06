import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { CreateTrustedPersonSchema } from '../schemas';
import {
  createTrustedPerson,
  listTrustedPeople,
  revokeTrustedPerson,
} from '../services/firestore';

export const trustedPeopleRouter = Router();

trustedPeopleRouter.use(requireAuth);

/**
 * POST /v1/trusted-people
 * Invites a trusted person by email to view specific reports
 */
trustedPeopleRouter.post('/', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const callerEmail = req.user!.email?.toLowerCase() || '';

    const validation = CreateTrustedPersonSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.flatten().fieldErrors,
      });
    }

    const { email, displayName } = validation.data;

    // Self-invite prohibition
    if (callerEmail && email.toLowerCase() === callerEmail) {
      return res.status(400).json({
        error: 'Cannot invite yourself as a trusted person.',
      });
    }

    const person = await createTrustedPerson(uid, { email, displayName });
    return res.status(201).json(person);
  } catch (err: any) {
    console.error('Error creating trusted person:', err);
    return res.status(500).json({ error: 'Failed to create trusted person.' });
  }
});

/**
 * GET /v1/trusted-people
 * List all trusted people for the authenticated caller
 */
trustedPeopleRouter.get('/', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const trustedPeople = await listTrustedPeople(uid);
    return res.json({ trustedPeople });
  } catch (err: any) {
    console.error('Error listing trusted people:', err);
    return res.status(500).json({ error: 'Failed to list trusted people.' });
  }
});

/**
 * DELETE /v1/trusted-people/:personId
 * Revoke trusted person status and cascade revoke active share grants
 */
trustedPeopleRouter.delete('/:personId', async (req: Request, res: Response) => {
  try {
    const uid = req.user!.uid;
    const personId = req.params.personId;

    const success = await revokeTrustedPerson(uid, personId);
    if (!success) {
      return res.status(404).json({ error: 'Trusted person not found.' });
    }

    return res.json({ success: true, message: 'Trusted person access revoked.' });
  } catch (err: any) {
    console.error('Error revoking trusted person:', err);
    return res.status(500).json({ error: 'Failed to revoke trusted person.' });
  }
});
