import fs from 'fs';
import path from 'path';
import { getApps, initializeApp, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { config } from '../config';
import type { CompassContent, SessionSummary } from '../schemas';

// Initialize Firebase Admin singleton
if (!getApps().length) {
  try {
    initializeApp({
      projectId: config.projectId,
    });
  } catch (err) {
    console.warn('Firebase Admin already initialized or init failed:', err);
  }
}

// Initialize Firestore reference
let firestoreInstance: Firestore | null = null;
let firestoreUnavailable = false;

export function getAdminDb(): Firestore {
  if (!firestoreInstance) {
    const databaseId =
      config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
        ? config.firestoreDatabaseId
        : undefined;

    const currentApp = getApp();
    firestoreInstance = databaseId
      ? getFirestore(currentApp, databaseId)
      : getFirestore(currentApp);
  }
  return firestoreInstance;
}

// Persistent fallback cache for dev preview environments where GCP ADC or IAM permissions are not bound
const STORE_DIR = path.join(process.cwd(), '.data');
const STORE_FILE = path.join(STORE_DIR, 'journal_store.json');

const localFallbackStore = {
  users: new Map<string, any>(),
  sessions: new Map<string, any>(), // key: `${uid}:${sessionId}`
  messages: new Map<string, any[]>(), // key: `${uid}:${sessionId}`
  reports: new Map<string, any>(), // key: `${uid}:${reportId}`
};

function ensureDataDir(): void {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
  } catch {
    // Ignore error if directory already exists or filesystem is read-only
  }
}

function loadLocalStore(): void {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (data.users && typeof data.users === 'object') {
        for (const [k, v] of Object.entries(data.users)) localFallbackStore.users.set(k, v);
      }
      if (data.sessions && typeof data.sessions === 'object') {
        for (const [k, v] of Object.entries(data.sessions)) localFallbackStore.sessions.set(k, v);
      }
      if (data.messages && typeof data.messages === 'object') {
        for (const [k, v] of Object.entries(data.messages)) localFallbackStore.messages.set(k, v as any[]);
      }
      if (data.reports && typeof data.reports === 'object') {
        for (const [k, v] of Object.entries(data.reports)) localFallbackStore.reports.set(k, v);
      }
    }
  } catch (err) {
    console.warn('Unable to load fallback cache from disk:', err);
  }
}

function persistLocalStore(): void {
  try {
    ensureDataDir();
    const payload = {
      users: Object.fromEntries(localFallbackStore.users.entries()),
      sessions: Object.fromEntries(localFallbackStore.sessions.entries()),
      messages: Object.fromEntries(localFallbackStore.messages.entries()),
      reports: Object.fromEntries(localFallbackStore.reports.entries()),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch {
    // Non-fatal if filesystem is restricted
  }
}

// Preload cache
loadLocalStore();

/**
 * Strict undefined-stripping utility (Zero-Crash Payload Hygiene)
 */
export function sanitizePayload<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (value === undefined) return null;
      return value;
    })
  );
}

/**
 * Helper to check if an error is due to missing GCP ADC credentials or Firestore permission denial
 */
export function isAdcOrPermissionError(err: any): boolean {
  if (!err) return false;
  if (err.code === 7 || err.code === '7' || err.status === 7) return true;
  const msg = (err.message || String(err) || '').toLowerCase();
  return (
    msg.includes('permission_denied') ||
    msg.includes('permission denied') ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('insufficient permissions') ||
    msg.includes('unauthenticated') ||
    msg.includes('could not load the default credentials') ||
    msg.includes('default credentials') ||
    msg.includes('metadata server') ||
    msg.includes('failed to get document')
  );
}

// ==========================================
// USER PROFILE OPERATIONS
// ==========================================

export async function upsertUserProfile(uid: string, displayName: string): Promise<void> {
  if (firestoreUnavailable) {
    localFallbackStore.users.set(uid, {
      displayName: displayName || 'Journal User',
      updatedAt: new Date().toISOString(),
    });
    persistLocalStore();
    return;
  }

  try {
    const db = getAdminDb();
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();

    const now = FieldValue.serverTimestamp();
    if (!snap.exists) {
      await userRef.set(
        sanitizePayload({
          displayName: displayName || 'Journal User',
          createdAt: now,
          updatedAt: now,
        })
      );
    } else {
      await userRef.update(
        sanitizePayload({
          displayName: displayName || 'Journal User',
          updatedAt: now,
        })
      );
    }
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      localFallbackStore.users.set(uid, {
        displayName: displayName || 'Journal User',
        updatedAt: new Date().toISOString(),
      });
      persistLocalStore();
      return;
    }
    throw err;
  }
}

// ==========================================
// SESSIONS OPERATIONS
// ==========================================

export interface SessionRecord {
  id: string;
  title: string;
  tags: string[];
  createdAt: string | any;
  updatedAt: string | any;
  lastActivityAt: string | any;
  summary: string | null;
  summaryUpdatedAt: string | null | any;
  messageCount: number;
  schemaVersion: number;
}

export async function createSession(
  uid: string,
  params: { title?: string; tags?: string[] }
): Promise<SessionRecord> {
  const title = params.title?.trim() || 'Untitled Reflection';
  const tags = params.tags || [];

  if (firestoreUnavailable) {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const session: SessionRecord = {
      id: sessionId,
      title,
      tags,
      createdAt: nowIso,
      updatedAt: nowIso,
      lastActivityAt: nowIso,
      summary: null,
      summaryUpdatedAt: null,
      messageCount: 0,
      schemaVersion: 1,
    };
    localFallbackStore.sessions.set(`${uid}:${sessionId}`, session);
    persistLocalStore();
    return session;
  }

  try {
    const db = getAdminDb();
    const sessionRef = db.collection('users').doc(uid).collection('sessions').doc();
    const now = FieldValue.serverTimestamp();

    const newSessionData = {
      title,
      tags,
      createdAt: now,
      updatedAt: now,
      lastActivityAt: now,
      summary: null,
      summaryUpdatedAt: null,
      messageCount: 0,
      schemaVersion: 1,
    };

    await sessionRef.set(sanitizePayload(newSessionData));

    return {
      id: sessionRef.id,
      title,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      summary: null,
      summaryUpdatedAt: null,
      messageCount: 0,
      schemaVersion: 1,
    };
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const nowIso = new Date().toISOString();
      const session: SessionRecord = {
        id: sessionId,
        title,
        tags,
        createdAt: nowIso,
        updatedAt: nowIso,
        lastActivityAt: nowIso,
        summary: null,
        summaryUpdatedAt: null,
        messageCount: 0,
        schemaVersion: 1,
      };
      localFallbackStore.sessions.set(`${uid}:${sessionId}`, session);
      persistLocalStore();
      return session;
    }
    throw err;
  }
}

export async function listSessions(
  uid: string,
  filters?: { startDate?: string; endDate?: string; tag?: string }
): Promise<SessionRecord[]> {
  if (firestoreUnavailable) {
    let sessions: SessionRecord[] = [];
    for (const [key, sess] of localFallbackStore.sessions.entries()) {
      if (key.startsWith(`${uid}:`)) {
        sessions.push(sess);
      }
    }
    sessions.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
    if (filters?.tag) {
      sessions = sessions.filter((s) => s.tags.includes(filters.tag!));
    }
    if (filters?.startDate) {
      const startMs = new Date(filters.startDate).getTime();
      sessions = sessions.filter((s) => new Date(s.lastActivityAt).getTime() >= startMs);
    }
    if (filters?.endDate) {
      const endMs = new Date(filters.endDate).getTime();
      sessions = sessions.filter((s) => new Date(s.lastActivityAt).getTime() <= endMs);
    }
    return sessions;
  }

  try {
    const db = getAdminDb();
    let queryRef = db
      .collection('users')
      .doc(uid)
      .collection('sessions')
      .orderBy('lastActivityAt', 'desc');

    const snap = await queryRef.get();
    let sessions: SessionRecord[] = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || 'Untitled Reflection',
        tags: data.tags || [],
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
        lastActivityAt: data.lastActivityAt?.toDate
          ? data.lastActivityAt.toDate().toISOString()
          : data.lastActivityAt || '',
        summary: data.summary || null,
        summaryUpdatedAt: data.summaryUpdatedAt?.toDate
          ? data.summaryUpdatedAt.toDate().toISOString()
          : data.summaryUpdatedAt || null,
        messageCount: data.messageCount || 0,
        schemaVersion: data.schemaVersion || 1,
      };
    });

    if (filters?.tag) {
      sessions = sessions.filter((s) => s.tags.includes(filters.tag!));
    }
    if (filters?.startDate) {
      const startMs = new Date(filters.startDate).getTime();
      sessions = sessions.filter((s) => new Date(s.lastActivityAt).getTime() >= startMs);
    }
    if (filters?.endDate) {
      const endMs = new Date(filters.endDate).getTime();
      sessions = sessions.filter((s) => new Date(s.lastActivityAt).getTime() <= endMs);
    }

    return sessions;
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      let sessions: SessionRecord[] = [];
      for (const [key, sess] of localFallbackStore.sessions.entries()) {
        if (key.startsWith(`${uid}:`)) {
          sessions.push(sess);
        }
      }
      sessions.sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
      if (filters?.tag) {
        sessions = sessions.filter((s) => s.tags.includes(filters.tag!));
      }
      if (filters?.startDate) {
        const startMs = new Date(filters.startDate).getTime();
        sessions = sessions.filter((s) => new Date(s.lastActivityAt).getTime() >= startMs);
      }
      if (filters?.endDate) {
        const endMs = new Date(filters.endDate).getTime();
        sessions = sessions.filter((s) => new Date(s.lastActivityAt).getTime() <= endMs);
      }
      return sessions;
    }
    throw err;
  }
}

export async function getSession(uid: string, sessionId: string): Promise<SessionRecord | null> {
  if (firestoreUnavailable) {
    return localFallbackStore.sessions.get(`${uid}:${sessionId}`) || null;
  }

  try {
    const db = getAdminDb();
    const docSnap = await db
      .collection('users')
      .doc(uid)
      .collection('sessions')
      .doc(sessionId)
      .get();

    if (!docSnap.exists) return null;
    const data = docSnap.data()!;
    return {
      id: docSnap.id,
      title: data.title || 'Untitled Reflection',
      tags: data.tags || [],
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
      updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
      lastActivityAt: data.lastActivityAt?.toDate
        ? data.lastActivityAt.toDate().toISOString()
        : data.lastActivityAt || '',
      summary: data.summary || null,
      summaryUpdatedAt: data.summaryUpdatedAt?.toDate
        ? data.summaryUpdatedAt.toDate().toISOString()
        : data.summaryUpdatedAt || null,
      messageCount: data.messageCount || 0,
      schemaVersion: data.schemaVersion || 1,
    };
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      return localFallbackStore.sessions.get(`${uid}:${sessionId}`) || null;
    }
    throw err;
  }
}

export async function updateSession(
  uid: string,
  sessionId: string,
  updates: { title?: string; tags?: string[] }
): Promise<SessionRecord | null> {
  if (firestoreUnavailable) {
    const sess = localFallbackStore.sessions.get(`${uid}:${sessionId}`);
    if (!sess) return null;
    if (updates.title !== undefined) sess.title = updates.title.trim();
    if (updates.tags !== undefined) sess.tags = updates.tags;
    sess.updatedAt = new Date().toISOString();
    persistLocalStore();
    return sess;
  }

  try {
    const db = getAdminDb();
    const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) return null;

    const payload: any = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (updates.title !== undefined) payload.title = updates.title.trim();
    if (updates.tags !== undefined) payload.tags = updates.tags;

    await sessionRef.update(sanitizePayload(payload));
    return await getSession(uid, sessionId);
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const sess = localFallbackStore.sessions.get(`${uid}:${sessionId}`);
      if (!sess) return null;
      if (updates.title !== undefined) sess.title = updates.title.trim();
      if (updates.tags !== undefined) sess.tags = updates.tags;
      sess.updatedAt = new Date().toISOString();
      persistLocalStore();
      return sess;
    }
    throw err;
  }
}

export async function deleteSession(uid: string, sessionId: string): Promise<boolean> {
  if (firestoreUnavailable) {
    const existed = localFallbackStore.sessions.delete(`${uid}:${sessionId}`);
    localFallbackStore.messages.delete(`${uid}:${sessionId}`);
    persistLocalStore();
    return existed;
  }

  try {
    const db = getAdminDb();
    const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) return false;

    // Delete subcollection messages
    const msgsSnap = await sessionRef.collection('messages').get();
    const batch = db.batch();
    for (const d of msgsSnap.docs) {
      batch.delete(d.ref);
    }
    batch.delete(sessionRef);
    await batch.commit();
    return true;
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const existed = localFallbackStore.sessions.delete(`${uid}:${sessionId}`);
      localFallbackStore.messages.delete(`${uid}:${sessionId}`);
      persistLocalStore();
      return existed;
    }
    throw err;
  }
}

// ==========================================
// MESSAGES OPERATIONS & SEQUENCING
// ==========================================

export interface MessageRecord {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: string | any;
  sequence: number;
}

export async function listMessages(uid: string, sessionId: string): Promise<MessageRecord[]> {
  if (firestoreUnavailable) {
    return localFallbackStore.messages.get(`${uid}:${sessionId}`) || [];
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('sessions')
      .doc(sessionId)
      .collection('messages')
      .orderBy('sequence', 'asc')
      .get();

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        role: data.role,
        text: data.text,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
        sequence: data.sequence,
      };
    });
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      return localFallbackStore.messages.get(`${uid}:${sessionId}`) || [];
    }
    throw err;
  }
}

/**
 * Append user message and model reply in a server-side transaction
 * Enforcing sequence counting and server timestamps.
 */
export async function appendTurn(
  uid: string,
  sessionId: string,
  userText: string,
  modelText: string
): Promise<{ userMessage: MessageRecord; modelMessage: MessageRecord }> {
  if (firestoreUnavailable) {
    const sess = localFallbackStore.sessions.get(`${uid}:${sessionId}`);
    if (!sess) throw new Error('NOT_FOUND');

    const msgs = localFallbackStore.messages.get(`${uid}:${sessionId}`) || [];
    const userSeq = msgs.length + 1;
    const modelSeq = msgs.length + 2;
    const nowIso = new Date().toISOString();

    const userMessage: MessageRecord = {
      id: `msg_u_${Date.now()}`,
      role: 'user',
      text: userText,
      createdAt: nowIso,
      sequence: userSeq,
    };
    const modelMessage: MessageRecord = {
      id: `msg_m_${Date.now()}`,
      role: 'model',
      text: modelText,
      createdAt: nowIso,
      sequence: modelSeq,
    };

    msgs.push(userMessage, modelMessage);
    localFallbackStore.messages.set(`${uid}:${sessionId}`, msgs);
    sess.messageCount = modelSeq;
    sess.lastActivityAt = nowIso;
    sess.updatedAt = nowIso;
    persistLocalStore();

    return { userMessage, modelMessage };
  }

  try {
    const db = getAdminDb();
    const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);

    const result = await db.runTransaction(async (transaction) => {
      const sessionDoc = await transaction.get(sessionRef);
      if (!sessionDoc.exists) {
        throw new Error('NOT_FOUND');
      }

      const currentCount = Number(sessionDoc.data()?.messageCount) || 0;
      const userSeq = currentCount + 1;
      const modelSeq = currentCount + 2;

      const userMsgRef = sessionRef.collection('messages').doc();
      const modelMsgRef = sessionRef.collection('messages').doc();
      const now = FieldValue.serverTimestamp();

      const userMsg = {
        role: 'user',
        text: userText,
        createdAt: now,
        sequence: userSeq,
      };

      const modelMsg = {
        role: 'model',
        text: modelText,
        createdAt: now,
        sequence: modelSeq,
      };

      transaction.set(userMsgRef, sanitizePayload(userMsg));
      transaction.set(modelMsgRef, sanitizePayload(modelMsg));

      transaction.update(sessionRef, {
        messageCount: modelSeq,
        lastActivityAt: now,
        updatedAt: now,
      });

      return {
        userMessage: {
          id: userMsgRef.id,
          role: 'user' as const,
          text: userText,
          createdAt: new Date().toISOString(),
          sequence: userSeq,
        },
        modelMessage: {
          id: modelMsgRef.id,
          role: 'model' as const,
          text: modelText,
          createdAt: new Date().toISOString(),
          sequence: modelSeq,
        },
      };
    });

    return result;
  } catch (err: any) {
    if (err.message === 'NOT_FOUND') {
      throw new Error('NOT_FOUND');
    }
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const sess = localFallbackStore.sessions.get(`${uid}:${sessionId}`);
      if (!sess) throw new Error('NOT_FOUND');

      const msgs = localFallbackStore.messages.get(`${uid}:${sessionId}`) || [];
      const userSeq = msgs.length + 1;
      const modelSeq = msgs.length + 2;
      const nowIso = new Date().toISOString();

      const userMessage: MessageRecord = {
        id: `msg_u_${Date.now()}`,
        role: 'user',
        text: userText,
        createdAt: nowIso,
        sequence: userSeq,
      };
      const modelMessage: MessageRecord = {
        id: `msg_m_${Date.now()}`,
        role: 'model',
        text: modelText,
        createdAt: nowIso,
        sequence: modelSeq,
      };

      msgs.push(userMessage, modelMessage);
      localFallbackStore.messages.set(`${uid}:${sessionId}`, msgs);
      sess.messageCount = modelSeq;
      sess.lastActivityAt = nowIso;
      sess.updatedAt = nowIso;
      persistLocalStore();

      return { userMessage, modelMessage };
    }
    throw err;
  }
}

export async function setSessionSummary(
  uid: string,
  sessionId: string,
  summaryText: string
): Promise<SessionRecord | null> {
  if (firestoreUnavailable) {
    const sess = localFallbackStore.sessions.get(`${uid}:${sessionId}`);
    if (!sess) return null;
    sess.summary = summaryText;
    sess.summaryUpdatedAt = new Date().toISOString();
    sess.updatedAt = new Date().toISOString();
    persistLocalStore();
    return sess;
  }

  try {
    const db = getAdminDb();
    const sessionRef = db.collection('users').doc(uid).collection('sessions').doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) return null;

    const now = FieldValue.serverTimestamp();
    await sessionRef.update({
      summary: summaryText,
      summaryUpdatedAt: now,
      updatedAt: now,
    });

    return await getSession(uid, sessionId);
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const sess = localFallbackStore.sessions.get(`${uid}:${sessionId}`);
      if (!sess) return null;
      sess.summary = summaryText;
      sess.summaryUpdatedAt = new Date().toISOString();
      sess.updatedAt = new Date().toISOString();
      persistLocalStore();
      return sess;
    }
    throw err;
  }
}

// ==========================================
// REFLECTION COMPASS REPORTS OPERATIONS
// ==========================================

export interface ReportRecord {
  id: string;
  title: string;
  periodStart: string | any;
  periodEnd: string | any;
  generatedAt: string | any;
  content: CompassContent;
  schemaVersion: number;
}

export async function createReport(
  uid: string,
  params: {
    title: string;
    periodStart: string;
    periodEnd: string;
    content: CompassContent;
  }
): Promise<ReportRecord> {
  if (firestoreUnavailable) {
    const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const report: ReportRecord = {
      id: reportId,
      title: params.title,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      generatedAt: new Date().toISOString(),
      content: params.content,
      schemaVersion: 1,
    };
    localFallbackStore.reports.set(`${uid}:${reportId}`, report);
    persistLocalStore();
    return report;
  }

  try {
    const db = getAdminDb();
    const reportRef = db.collection('users').doc(uid).collection('reports').doc();
    const now = FieldValue.serverTimestamp();

    const reportData = {
      title: params.title,
      periodStart: new Date(params.periodStart).toISOString(),
      periodEnd: new Date(params.periodEnd).toISOString(),
      generatedAt: now,
      content: params.content,
      schemaVersion: 1,
    };

    await reportRef.set(sanitizePayload(reportData));

    return {
      id: reportRef.id,
      title: params.title,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      generatedAt: new Date().toISOString(),
      content: params.content,
      schemaVersion: 1,
    };
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const reportId = `rep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const report: ReportRecord = {
        id: reportId,
        title: params.title,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        generatedAt: new Date().toISOString(),
        content: params.content,
        schemaVersion: 1,
      };
      localFallbackStore.reports.set(`${uid}:${reportId}`, report);
      persistLocalStore();
      return report;
    }
    throw err;
  }
}

export async function listReports(uid: string): Promise<ReportRecord[]> {
  if (firestoreUnavailable) {
    const reports: ReportRecord[] = [];
    for (const [key, rep] of localFallbackStore.reports.entries()) {
      if (key.startsWith(`${uid}:`)) {
        reports.push(rep);
      }
    }
    reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
    return reports;
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('reports')
      .orderBy('generatedAt', 'desc')
      .get();

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title || 'Reflection Compass',
        periodStart: data.periodStart?.toDate ? data.periodStart.toDate().toISOString() : data.periodStart,
        periodEnd: data.periodEnd?.toDate ? data.periodEnd.toDate().toISOString() : data.periodEnd,
        generatedAt: data.generatedAt?.toDate ? data.generatedAt.toDate().toISOString() : data.generatedAt,
        content: data.content,
        schemaVersion: data.schemaVersion || 1,
      };
    });
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const reports: ReportRecord[] = [];
      for (const [key, rep] of localFallbackStore.reports.entries()) {
        if (key.startsWith(`${uid}:`)) {
          reports.push(rep);
        }
      }
      reports.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
      return reports;
    }
    throw err;
  }
}

export async function getReport(uid: string, reportId: string): Promise<ReportRecord | null> {
  if (firestoreUnavailable) {
    return localFallbackStore.reports.get(`${uid}:${reportId}`) || null;
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection('users').doc(uid).collection('reports').doc(reportId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      id: snap.id,
      title: data.title || 'Reflection Compass',
      periodStart: data.periodStart?.toDate ? data.periodStart.toDate().toISOString() : data.periodStart,
      periodEnd: data.periodEnd?.toDate ? data.periodEnd.toDate().toISOString() : data.periodEnd,
      generatedAt: data.generatedAt?.toDate ? data.generatedAt.toDate().toISOString() : data.generatedAt,
      content: data.content,
      schemaVersion: data.schemaVersion || 1,
    };
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      return localFallbackStore.reports.get(`${uid}:${reportId}`) || null;
    }
    throw err;
  }
}

export async function deleteReport(uid: string, reportId: string): Promise<boolean> {
  if (firestoreUnavailable) {
    const deleted = localFallbackStore.reports.delete(`${uid}:${reportId}`);
    persistLocalStore();
    return deleted;
  }

  try {
    const db = getAdminDb();
    const reportRef = db.collection('users').doc(uid).collection('reports').doc(reportId);
    const snap = await reportRef.get();
    if (!snap.exists) return false;
    await reportRef.delete();
    return true;
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const deleted = localFallbackStore.reports.delete(`${uid}:${reportId}`);
      persistLocalStore();
      return deleted;
    }
    throw err;
  }
}
