import path from 'path';
import fs from 'fs';

export interface AppConfig {
  projectId: string;
  firestoreDatabaseId: string;
  geminiModel: string;
  geminiApiKey: string;
  port: number;
  nodeEnv: string;
}

// Load local configuration if available
let localConfig: any = {};
const localConfigCandidates = [
  path.join(process.cwd(), 'firebase-applet-config.json'),
  path.resolve(__dirname, '../../../firebase-applet-config.json'),
  path.resolve(__dirname, '../../firebase-applet-config.json'),
  '/app/applet/firebase-applet-config.json',
];

for (const candidate of localConfigCandidates) {
  if (fs.existsSync(candidate)) {
    try {
      localConfig = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      break;
    } catch {
      // Ignore JSON parsing errors for candidate
    }
  }
}

export const config: AppConfig = {
  // CRITICAL: Prioritize Firebase configuration from firebase-applet-config.json
  // or FIREBASE_PROJECT_ID over Cloud Run's infrastructure GOOGLE_CLOUD_PROJECT (e.g. 281185310310)
  projectId:
    process.env.FIREBASE_PROJECT_ID ||
    localConfig.projectId ||
    'wooliesganeshtest',
  firestoreDatabaseId:
    process.env.FIRESTORE_DATABASE_ID ||
    localConfig.firestoreDatabaseId ||
    'ai-studio-personalgeminijo-4bd63985-06f6-42cc-8e65-abce049f8a6d',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
};
