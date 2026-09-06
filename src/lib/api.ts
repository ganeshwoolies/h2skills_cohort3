import { auth } from './firebase';
import type {
  JournalSession,
  SessionMessage,
  SessionSummary,
  ReflectionCompassReport,
  CompassContent,
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
