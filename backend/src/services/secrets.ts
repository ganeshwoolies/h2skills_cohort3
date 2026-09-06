import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { config } from '../config';

// Lazy instantiation of Secret Manager Client to prevent module load crashes
let secretClient: SecretManagerServiceClient | null = null;

function getSecretClient(): SecretManagerServiceClient {
  if (!secretClient) {
    secretClient = new SecretManagerServiceClient();
  }
  return secretClient;
}

// In-memory cache for accessed secrets (TTL: 1 hour)
interface CachedSecret {
  value: string;
  cachedAt: number;
}

const secretCache = new Map<string, CachedSecret>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Dynamically retrieves a secret payload from Google Cloud Secret Manager.
 * Uses in-memory caching to minimize latency and API quota usage.
 *
 * @param secretId - The ID of the secret in Secret Manager (e.g. 'GEMINI_API_KEY')
 * @param versionId - Version to access (default: 'latest')
 * @returns The secret string value
 */
export async function accessSecret(
  secretId: string,
  versionId: string = 'latest'
): Promise<string> {
  const cacheKey = `${secretId}:${versionId}`;
  const now = Date.now();
  const cached = secretCache.get(cacheKey);

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  try {
    const client = getSecretClient();

    // Resolve project ID: prefer GOOGLE_CLOUD_PROJECT, FIREBASE_PROJECT_ID, config.projectId, or auto-detect
    let projectId =
      process.env.GOOGLE_CLOUD_PROJECT ||
      process.env.GCP_PROJECT ||
      config.projectId;

    if (!projectId) {
      projectId = await client.getProjectId();
    }

    const name = `projects/${projectId}/secrets/${secretId}/versions/${versionId}`;
    const [response] = await client.accessSecretVersion({ name });

    const payload = response.payload?.data?.toString() || '';
    if (!payload) {
      throw new Error(`Secret ${secretId} version ${versionId} returned an empty payload.`);
    }

    // Cache the secret in memory
    secretCache.set(cacheKey, { value: payload, cachedAt: now });
    return payload;
  } catch (err: any) {
    // Evict corrupted or failed cache entry
    secretCache.delete(cacheKey);
    console.warn(
      `[SecretManager] Could not access secret '${secretId}' (version: ${versionId}): ${err?.message || err}`
    );
    throw err;
  }
}

/**
 * Securely resolves the GEMINI_API_KEY using Google Cloud Secret Manager
 * with automatic fallback to environment variable injection (e.g. for local dev or container env).
 *
 * Priority order:
 * 1. Active in-memory cache
 * 2. Cloud Secret Manager (if USE_SECRET_MANAGER === 'true' or in GCP Cloud Run environment)
 * 3. Injected environment variable process.env.GEMINI_API_KEY
 * 4. Cloud Secret Manager attempt as dynamic fallback
 */
export async function getGeminiApiKey(): Promise<string> {
  const cacheKey = 'GEMINI_API_KEY:latest';
  const cached = secretCache.get(cacheKey);
  const now = Date.now();

  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  // If explicitly requested to fetch directly from Secret Manager
  const preferSecretManager =
    process.env.USE_SECRET_MANAGER === 'true' ||
    (process.env.K_SERVICE && !process.env.GEMINI_API_KEY);

  if (preferSecretManager) {
    try {
      const secret = await accessSecret('GEMINI_API_KEY', 'latest');
      if (secret) {
        return secret;
      }
    } catch (smError: any) {
      console.warn(
        `[SecretManager] Direct Secret Manager lookup failed: ${smError?.message}. Checking environment variables...`
      );
    }
  }

  // Check injected environment variable (e.g. from Cloud Run --set-secrets or local .env)
  const envKey = process.env.GEMINI_API_KEY?.trim();
  if (envKey) {
    // Cache the validated environment key
    secretCache.set(cacheKey, { value: envKey, cachedAt: now });
    return envKey;
  }

  // Attempt dynamic retrieval from Secret Manager as fallback
  try {
    const secret = await accessSecret('GEMINI_API_KEY', 'latest');
    if (secret) {
      return secret;
    }
  } catch (err: any) {
    console.error(
      `[SecretManager] Fatal: Unable to retrieve GEMINI_API_KEY from Secret Manager or environment variables. ` +
        `Ensure that GEMINI_API_KEY is stored in Secret Manager and the service account has 'roles/secretmanager.secretAccessor'. Error: ${err?.message}`
    );
  }

  throw new Error(
    'GEMINI_API_KEY is not configured. Please store it in Google Cloud Secret Manager or set it in the environment.'
  );
}
