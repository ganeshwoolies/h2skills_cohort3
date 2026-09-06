import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { config } from './config';
import { healthRouter } from './routes/health';
import { sessionsRouter } from './routes/sessions';
import { reportsRouter } from './routes/reports';
import { trustedPeopleRouter } from './routes/trusted-people';
import { reportSharesRouter, sharedWithMeRouter } from './routes/shares';
import { progressRouter } from './routes/progress';
import { discoverRouter } from './routes/discover';

export function createExpressApp() {
  const app = express();

  // Top-Level Request Deserialization (Ordering Guarantee)
  app.use(express.json({ limit: '2mb' }));

  // Security Headers Middleware
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // Health check endpoint (Cloud Run probe)
  app.use('/', healthRouter);

  // Protected REST API endpoints
  app.use('/v1/sessions', sessionsRouter);
  app.use('/v1/reports', reportsRouter);
  app.use('/v1/reports', reportSharesRouter);
  app.use('/v1/trusted-people', trustedPeopleRouter);
  app.use('/v1/progress', progressRouter);
  app.use('/v1/discover', discoverRouter);
  app.use('/v1', sharedWithMeRouter);

  // Public Firebase client configuration endpoint
  app.get('/api/config/firebase', (_req: Request, res: Response) => {
    try {
      const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return res.json({
          projectId: parsed.projectId || config.projectId,
          appId: parsed.appId || '',
          apiKey: parsed.apiKey || '',
          authDomain: parsed.authDomain || (parsed.projectId ? `${parsed.projectId}.firebaseapp.com` : ''),
          firestoreDatabaseId: parsed.firestoreDatabaseId || '(default)',
          storageBucket: parsed.storageBucket || '',
          messagingSenderId: parsed.messagingSenderId || '',
        });
      }

      return res.json({
        projectId: config.projectId,
        appId: process.env.FIREBASE_APP_ID || '',
        apiKey: process.env.FIREBASE_API_KEY || '',
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${config.projectId}.firebaseapp.com`,
        firestoreDatabaseId: config.firestoreDatabaseId,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
      });
    } catch (error: any) {
      console.error('Error loading firebase configuration:', error);
      return res.status(500).json({ error: 'Failed to load Firebase configuration' });
    }
  });

  return app;
}

export async function startServer() {
  const app = createExpressApp();
  const PORT = config.port;

  // Vite middleware for development vs static build serving for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Personal Gemini Journal server running on http://0.0.0.0:${PORT} in ${config.nodeEnv} mode`);
  });

  return app;
}

// Start if executed directly
if (process.env.NODE_ENV !== 'test') {
  startServer().catch((err) => {
    console.error('Server startup failed:', err);
    process.exit(1);
  });
}
