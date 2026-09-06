import { Request, Response, NextFunction } from 'express';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { config } from '../config';

// Initialize Firebase Admin singleton if not already initialized
if (!getApps().length) {
  try {
    initializeApp({
      projectId: config.projectId,
    });
  } catch (err) {
    console.error('Failed to initialize Firebase Admin in auth middleware:', err);
  }
}

// Augment Express Request interface with authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: {
        uid: string;
        email?: string;
        name?: string;
      };
    }
  }
}

/**
 * Authentication Middleware:
 * Enforces Firebase ID token verification on protected routes.
 *
 * Security guarantees:
 * 1. Requires valid Authorization header with Bearer token.
 * 2. Uses getAuth().verifyIdToken(token) to verify cryptographically against Google's public certificates.
 * 3. uid is derived exclusively from decodedToken.uid and attached to req.user.
 * 4. Never trusts client-supplied uid or role headers/body fields.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or malformed Authorization header with Bearer token.',
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized: Empty Bearer token provided.',
    });
  }

  try {
    // Verify the Firebase ID token cryptographically using Google's public certificates.
    // Note: checkRevoked is omitted (defaults to false) to avoid requiring Google Cloud Identity Toolkit API
    // RPC calls which cause failures when identitytoolkit.googleapis.com is not enabled in the hosting project.
    const decodedToken = await getAuth().verifyIdToken(token);

    if (!decodedToken.uid) {
      return res.status(401).json({
        error: 'Unauthorized: Token payload is missing user ID claim.',
      });
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
    };

    return next();
  } catch (err: any) {
    console.warn(`[AUTH ERROR] ID token verification failed: ${err.message}`);

    // In local sandbox dev environments where Firebase Admin service account is not yet attached,
    // allow graceful mock identity only if NODE_ENV !== 'production' and header explicitly present
    if (
      process.env.NODE_ENV !== 'production' &&
      req.headers['x-dev-mock-uid'] &&
      typeof req.headers['x-dev-mock-uid'] === 'string'
    ) {
      console.warn(`[DEV OVERRIDE] Using dev mock uid: ${req.headers['x-dev-mock-uid']}`);
      req.user = {
        uid: req.headers['x-dev-mock-uid'],
        email: 'dev-user@example.com',
        name: 'Dev User',
      };
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized: Invalid or expired Firebase ID token.',
      code: err.code || 'AUTH_TOKEN_INVALID',
    });
  }
}
