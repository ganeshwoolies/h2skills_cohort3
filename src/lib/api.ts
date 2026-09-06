import { auth } from './firebase';
import type {
  JournalSession,
  SessionMessage,
  SessionSummary,
  ReflectionCompassReport,
  CompassContent,
  TrustedPerson,
  ShareGrant,
  SharedReportView,
  ProgressSnapshot,
  DiscoveryRecord,
} from '../types';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('User is not authenticated. Please sign in.');
  }
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function apiFetchSessions(filters?: {
  startDate?: string;
  endDate?: string;
  tag?: string;
}): Promise<JournalSession[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams();
  if (filters?.startDate) params.set('startDate', filters.startDate);
  if (filters?.endDate) params.set('endDate', filters.endDate);
  if (filters?.tag) params.set('tag', filters.tag);

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`/v1/sessions${queryStr}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch sessions');
  }
  const data = await res.json();
  return data.sessions || [];
}

export async function apiCreateSession(params: {
  title?: string;
  tags?: string[];
}): Promise<JournalSession> {
  const headers = await getAuthHeaders();
  const res = await fetch('/v1/sessions', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create session');
  }
  return await res.json();
}

export async function apiGetSession(sessionId: string): Promise<{
  session: JournalSession;
  messages: SessionMessage[];
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/sessions/${sessionId}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Session not found');
  }
  return await res.json();
}

export async function apiUpdateSession(
  sessionId: string,
  updates: { title?: string; tags?: string[] }
): Promise<JournalSession> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/sessions/${sessionId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update session');
  }
  return await res.json();
}

export async function apiDeleteSession(sessionId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/sessions/${sessionId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete session');
  }
}

export async function apiSendMessage(
  sessionId: string,
  text: string
): Promise<{
  userMessage: SessionMessage;
  modelMessage: SessionMessage;
  modelUsed?: string;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/sessions/${sessionId}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send message to Gemini');
  }
  return await res.json();
}

export async function apiSummarizeSession(sessionId: string): Promise<{
  session: JournalSession;
  summary: SessionSummary;
}> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/sessions/${sessionId}/summarize`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to summarize session');
  }
  return await res.json();
}

export async function apiFetchReports(): Promise<ReflectionCompassReport[]> {
  const headers = await getAuthHeaders();
  const res = await fetch('/v1/reports', { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch reports');
  }
  const data = await res.json();
  return data.reports || [];
}

export async function apiGetReport(reportId: string): Promise<ReflectionCompassReport> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/reports/${reportId}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Report not found');
  }
  return await res.json();
}

export async function apiGenerateCompass(params: {
  title?: string;
  periodStart: string;
  periodEnd: string;
  sessionIds?: string[];
}): Promise<ReflectionCompassReport> {
  const headers = await getAuthHeaders();
  const res = await fetch('/v1/reports/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to generate Reflection Compass report');
  }
  return await res.json();
}

export async function apiDeleteReport(reportId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/reports/${reportId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete report');
  }
}

// --- Trusted People & Sharing API ---

export async function apiListTrustedPeople(): Promise<TrustedPerson[]> {
  const headers = await getAuthHeaders();
  const res = await fetch('/v1/trusted-people', { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch trusted people');
  }
  const data = await res.json();
  return data.trustedPeople || [];
}

export async function apiCreateTrustedPerson(params: {
  email: string;
  displayName: string;
}): Promise<TrustedPerson> {
  const headers = await getAuthHeaders();
  const res = await fetch('/v1/trusted-people', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add trusted person');
  }
  return await res.json();
}

export async function apiRevokeTrustedPerson(personId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/trusted-people/${personId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to revoke trusted person');
  }
}

export async function apiShareReport(
  reportId: string,
  personId: string
): Promise<ShareGrant> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/reports/${reportId}/share`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ personId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to share report');
  }
  return await res.json();
}

export async function apiListReportShares(reportId: string): Promise<ShareGrant[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/reports/${reportId}/shares`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to list report shares');
  }
  const data = await res.json();
  return data.shares || [];
}

export async function apiRevokeReportShare(
  reportId: string,
  grantId: string
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/reports/${reportId}/share/${grantId}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to revoke share access');
  }
}

export async function apiListSharedWithMe(): Promise<ShareGrant[]> {
  const headers = await getAuthHeaders();
  const res = await fetch('/v1/shared-with-me', { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to list shared reports');
  }
  const data = await res.json();
  return data.sharedWithMe || [];
}

export async function apiGetSharedReport(grantId: string): Promise<SharedReportView> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/shared-with-me/${grantId}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load shared report');
  }
  return await res.json();
}

// --- Progress Trends API ---

export async function apiGetProgress(rangeDays = 30): Promise<ProgressSnapshot> {
  const headers = await getAuthHeaders();
  const res = await fetch(`/v1/progress?rangeDays=${rangeDays}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch progress trends');
  }
  return await res.json();
}

// --- Discover & External Trends API ---

export async function apiGetLatestDiscovery(): Promise<DiscoveryRecord | null> {
  const headers = await getAuthHeaders();
  const res = await fetch('/v1/discover/latest', { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch discovery recommendations');
  }
  const data = await res.json();
  return data.discovery || null;
}

export async function apiTriggerDiscovery(themes?: string[]): Promise<DiscoveryRecord> {
  const headers = await getAuthHeaders();
  const res = await fetch('/v1/discover', {
    method: 'POST',
    headers,
    body: JSON.stringify({ themes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to discover resources');
  }
  return await res.json();
}

