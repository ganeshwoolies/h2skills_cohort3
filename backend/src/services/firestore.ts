import fs from 'fs';
import path from 'path';
import { getApps, initializeApp, getApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { config } from '../config';
import type { CompassContent, SessionSummary, DiscoveryContent } from '../schemas';

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
  trustedPeople: new Map<string, any>(), // key: `${ownerUid}:${personId}`
  shareGrants: new Map<string, any>(), // key: `${grantId}`
  discoveries: new Map<string, any>(), // key: `${uid}:${discoveryId}`
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
      if (data.trustedPeople && typeof data.trustedPeople === 'object') {
        for (const [k, v] of Object.entries(data.trustedPeople)) localFallbackStore.trustedPeople.set(k, v);
      }
      if (data.shareGrants && typeof data.shareGrants === 'object') {
        for (const [k, v] of Object.entries(data.shareGrants)) localFallbackStore.shareGrants.set(k, v);
      }
      if (data.discoveries && typeof data.discoveries === 'object') {
        for (const [k, v] of Object.entries(data.discoveries)) localFallbackStore.discoveries.set(k, v);
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
      trustedPeople: Object.fromEntries(localFallbackStore.trustedPeople.entries()),
      shareGrants: Object.fromEntries(localFallbackStore.shareGrants.entries()),
      discoveries: Object.fromEntries(localFallbackStore.discoveries.entries()),
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

// ==========================================
// FEATURE 1: TRUSTED PEOPLE & SHARE GRANTS
// ==========================================

export interface TrustedPersonRecord {
  id: string;
  email: string;
  displayName: string | null;
  status: 'invited' | 'active' | 'revoked';
  invitedAt: string;
  activatedAt: string | null;
  schemaVersion: 1;
}

export interface ShareGrantRecord {
  id: string;
  ownerUid: string;
  ownerDisplayName: string;
  viewerEmail: string;
  viewerUid: string | null;
  reportId: string;
  reportTitle: string;
  grantedAt: string;
  status: 'active' | 'revoked';
  schemaVersion: 1;
}

export interface SharedReportSummary {
  id: string;
  ownerDisplayName: string;
  reportId: string;
  reportTitle: string;
  grantedAt: string;
}

export async function createTrustedPerson(
  ownerUid: string,
  data: { email: string; displayName?: string | null }
): Promise<TrustedPersonRecord> {
  const normalizedEmail = data.email.trim().toLowerCase();
  const displayName = data.displayName?.trim() || null;
  const nowIso = new Date().toISOString();

  if (firestoreUnavailable) {
    const personId = `tp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const person: TrustedPersonRecord = {
      id: personId,
      email: normalizedEmail,
      displayName,
      status: 'invited',
      invitedAt: nowIso,
      activatedAt: null,
      schemaVersion: 1,
    };
    localFallbackStore.trustedPeople.set(`${ownerUid}:${personId}`, person);
    persistLocalStore();
    return person;
  }

  try {
    const db = getAdminDb();
    const ref = db.collection('users').doc(ownerUid).collection('trustedPeople').doc();
    const payload = {
      email: normalizedEmail,
      displayName,
      status: 'invited',
      invitedAt: FieldValue.serverTimestamp(),
      activatedAt: null,
      schemaVersion: 1,
    };
    await ref.set(sanitizePayload(payload));

    return {
      id: ref.id,
      email: normalizedEmail,
      displayName,
      status: 'invited',
      invitedAt: nowIso,
      activatedAt: null,
      schemaVersion: 1,
    };
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const personId = `tp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const person: TrustedPersonRecord = {
        id: personId,
        email: normalizedEmail,
        displayName,
        status: 'invited',
        invitedAt: nowIso,
        activatedAt: null,
        schemaVersion: 1,
      };
      localFallbackStore.trustedPeople.set(`${ownerUid}:${personId}`, person);
      persistLocalStore();
      return person;
    }
    throw err;
  }
}

export async function listTrustedPeople(ownerUid: string): Promise<TrustedPersonRecord[]> {
  if (firestoreUnavailable) {
    const people: TrustedPersonRecord[] = [];
    for (const [key, p] of localFallbackStore.trustedPeople.entries()) {
      if (key.startsWith(`${ownerUid}:`)) {
        people.push(p);
      }
    }
    people.sort((a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime());
    return people;
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('users')
      .doc(ownerUid)
      .collection('trustedPeople')
      .orderBy('invitedAt', 'desc')
      .get();

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        email: data.email,
        displayName: data.displayName || null,
        status: data.status || 'invited',
        invitedAt: data.invitedAt?.toDate ? data.invitedAt.toDate().toISOString() : data.invitedAt || '',
        activatedAt: data.activatedAt?.toDate ? data.activatedAt.toDate().toISOString() : data.activatedAt || null,
        schemaVersion: data.schemaVersion || 1,
      };
    });
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const people: TrustedPersonRecord[] = [];
      for (const [key, p] of localFallbackStore.trustedPeople.entries()) {
        if (key.startsWith(`${ownerUid}:`)) {
          people.push(p);
        }
      }
      people.sort((a, b) => new Date(b.invitedAt).getTime() - new Date(a.invitedAt).getTime());
      return people;
    }
    throw err;
  }
}

export async function getTrustedPerson(ownerUid: string, personId: string): Promise<TrustedPersonRecord | null> {
  if (firestoreUnavailable) {
    return localFallbackStore.trustedPeople.get(`${ownerUid}:${personId}`) || null;
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection('users').doc(ownerUid).collection('trustedPeople').doc(personId).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      id: snap.id,
      email: data.email,
      displayName: data.displayName || null,
      status: data.status || 'invited',
      invitedAt: data.invitedAt?.toDate ? data.invitedAt.toDate().toISOString() : data.invitedAt || '',
      activatedAt: data.activatedAt?.toDate ? data.activatedAt.toDate().toISOString() : data.activatedAt || null,
      schemaVersion: data.schemaVersion || 1,
    };
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      return localFallbackStore.trustedPeople.get(`${ownerUid}:${personId}`) || null;
    }
    throw err;
  }
}

export async function revokeTrustedPerson(ownerUid: string, personId: string): Promise<boolean> {
  if (firestoreUnavailable) {
    const person = localFallbackStore.trustedPeople.get(`${ownerUid}:${personId}`);
    if (!person) return false;
    person.status = 'revoked';

    // Cascade revoke active share grants
    for (const [grantId, grant] of localFallbackStore.shareGrants.entries()) {
      if (
        grant.ownerUid === ownerUid &&
        grant.viewerEmail.toLowerCase() === person.email.toLowerCase() &&
        grant.status === 'active'
      ) {
        grant.status = 'revoked';
      }
    }
    persistLocalStore();
    return true;
  }

  try {
    const db = getAdminDb();
    const personRef = db.collection('users').doc(ownerUid).collection('trustedPeople').doc(personId);
    const snap = await personRef.get();
    if (!snap.exists) return false;

    const personData = snap.data()!;
    await personRef.update({ status: 'revoked' });

    // Cascade revoke any active shareGrants
    const grantsSnap = await db
      .collection('shareGrants')
      .where('ownerUid', '==', ownerUid)
      .where('viewerEmail', '==', personData.email.toLowerCase())
      .where('status', '==', 'active')
      .get();

    const batch = db.batch();
    grantsSnap.docs.forEach((d) => {
      batch.update(d.ref, { status: 'revoked' });
    });
    if (!grantsSnap.empty) {
      await batch.commit();
    }

    return true;
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const person = localFallbackStore.trustedPeople.get(`${ownerUid}:${personId}`);
      if (!person) return false;
      person.status = 'revoked';
      for (const [_, grant] of localFallbackStore.shareGrants.entries()) {
        if (
          grant.ownerUid === ownerUid &&
          grant.viewerEmail.toLowerCase() === person.email.toLowerCase() &&
          grant.status === 'active'
        ) {
          grant.status = 'revoked';
        }
      }
      persistLocalStore();
      return true;
    }
    throw err;
  }
}

export async function createShareGrant(params: {
  ownerUid: string;
  ownerDisplayName: string;
  viewerEmail: string;
  reportId: string;
  reportTitle: string;
}): Promise<ShareGrantRecord> {
  const normalizedEmail = params.viewerEmail.trim().toLowerCase();
  const nowIso = new Date().toISOString();

  if (firestoreUnavailable) {
    const grantId = `gr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const grant: ShareGrantRecord = {
      id: grantId,
      ownerUid: params.ownerUid,
      ownerDisplayName: params.ownerDisplayName,
      viewerEmail: normalizedEmail,
      viewerUid: null,
      reportId: params.reportId,
      reportTitle: params.reportTitle,
      grantedAt: nowIso,
      status: 'active',
      schemaVersion: 1,
    };
    localFallbackStore.shareGrants.set(grantId, grant);
    persistLocalStore();
    return grant;
  }

  try {
    const db = getAdminDb();
    const grantRef = db.collection('shareGrants').doc();
    const payload = {
      ownerUid: params.ownerUid,
      ownerDisplayName: params.ownerDisplayName,
      viewerEmail: normalizedEmail,
      viewerUid: null,
      reportId: params.reportId,
      reportTitle: params.reportTitle,
      grantedAt: FieldValue.serverTimestamp(),
      status: 'active',
      schemaVersion: 1,
    };
    await grantRef.set(sanitizePayload(payload));

    return {
      id: grantRef.id,
      ownerUid: params.ownerUid,
      ownerDisplayName: params.ownerDisplayName,
      viewerEmail: normalizedEmail,
      viewerUid: null,
      reportId: params.reportId,
      reportTitle: params.reportTitle,
      grantedAt: nowIso,
      status: 'active',
      schemaVersion: 1,
    };
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const grantId = `gr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const grant: ShareGrantRecord = {
        id: grantId,
        ownerUid: params.ownerUid,
        ownerDisplayName: params.ownerDisplayName,
        viewerEmail: normalizedEmail,
        viewerUid: null,
        reportId: params.reportId,
        reportTitle: params.reportTitle,
        grantedAt: nowIso,
        status: 'active',
        schemaVersion: 1,
      };
      localFallbackStore.shareGrants.set(grantId, grant);
      persistLocalStore();
      return grant;
    }
    throw err;
  }
}

export async function listGrantsForReport(ownerUid: string, reportId: string): Promise<ShareGrantRecord[]> {
  if (firestoreUnavailable) {
    const grants: ShareGrantRecord[] = [];
    for (const [_, g] of localFallbackStore.shareGrants.entries()) {
      if (g.ownerUid === ownerUid && g.reportId === reportId && g.status === 'active') {
        grants.push(g);
      }
    }
    grants.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
    return grants;
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('shareGrants')
      .where('ownerUid', '==', ownerUid)
      .where('reportId', '==', reportId)
      .where('status', '==', 'active')
      .get();

    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        ownerUid: data.ownerUid,
        ownerDisplayName: data.ownerDisplayName,
        viewerEmail: data.viewerEmail,
        viewerUid: data.viewerUid || null,
        reportId: data.reportId,
        reportTitle: data.reportTitle,
        grantedAt: data.grantedAt?.toDate ? data.grantedAt.toDate().toISOString() : data.grantedAt || '',
        status: data.status,
        schemaVersion: data.schemaVersion || 1,
      };
    });
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const grants: ShareGrantRecord[] = [];
      for (const [_, g] of localFallbackStore.shareGrants.entries()) {
        if (g.ownerUid === ownerUid && g.reportId === reportId && g.status === 'active') {
          grants.push(g);
        }
      }
      grants.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
      return grants;
    }
    throw err;
  }
}

export async function revokeShareGrant(ownerUid: string, reportId: string, grantId: string): Promise<boolean> {
  if (firestoreUnavailable) {
    const grant = localFallbackStore.shareGrants.get(grantId);
    if (!grant || grant.ownerUid !== ownerUid || grant.reportId !== reportId) return false;
    grant.status = 'revoked';
    persistLocalStore();
    return true;
  }

  try {
    const db = getAdminDb();
    const grantRef = db.collection('shareGrants').doc(grantId);
    const snap = await grantRef.get();
    if (!snap.exists) return false;
    const data = snap.data()!;
    if (data.ownerUid !== ownerUid || data.reportId !== reportId) return false;
    await grantRef.update({ status: 'revoked' });
    return true;
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const grant = localFallbackStore.shareGrants.get(grantId);
      if (!grant || grant.ownerUid !== ownerUid || grant.reportId !== reportId) return false;
      grant.status = 'revoked';
      persistLocalStore();
      return true;
    }
    throw err;
  }
}

export async function listSharedWithMe(viewerEmail: string, viewerUid: string): Promise<SharedReportSummary[]> {
  const normalizedEmail = viewerEmail.trim().toLowerCase();

  if (firestoreUnavailable) {
    const results: SharedReportSummary[] = [];
    for (const [grantId, grant] of localFallbackStore.shareGrants.entries()) {
      if (
        grant.status === 'active' &&
        (grant.viewerEmail.toLowerCase() === normalizedEmail || grant.viewerUid === viewerUid)
      ) {
        if (!grant.viewerUid) {
          grant.viewerUid = viewerUid;
        }
        results.push({
          id: grantId,
          ownerDisplayName: grant.ownerDisplayName,
          reportId: grant.reportId,
          reportTitle: grant.reportTitle,
          grantedAt: grant.grantedAt,
        });

        // Activate invited trusted person record in owner's list
        for (const [_, tp] of localFallbackStore.trustedPeople.entries()) {
          if (tp.email.toLowerCase() === normalizedEmail && tp.status === 'invited') {
            tp.status = 'active';
            tp.activatedAt = new Date().toISOString();
          }
        }
      }
    }
    persistLocalStore();
    results.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
    return results;
  }

  try {
    const db = getAdminDb();
    // Query active grants by viewerEmail or viewerUid
    const emailSnap = await db
      .collection('shareGrants')
      .where('viewerEmail', '==', normalizedEmail)
      .where('status', '==', 'active')
      .get();

    const grantsMap = new Map<string, any>();
    emailSnap.docs.forEach((d) => grantsMap.set(d.id, { id: d.id, ...d.data(), ref: d.ref }));

    if (viewerUid) {
      const uidSnap = await db
        .collection('shareGrants')
        .where('viewerUid', '==', viewerUid)
        .where('status', '==', 'active')
        .get();
      uidSnap.docs.forEach((d) => {
        if (!grantsMap.has(d.id)) {
          grantsMap.set(d.id, { id: d.id, ...d.data(), ref: d.ref });
        }
      });
    }

    const batch = db.batch();
    let needsCommit = false;

    const summaries: SharedReportSummary[] = [];

    for (const [id, data] of grantsMap.entries()) {
      // Server-side backfilling: if viewerUid is null, set it to viewerUid
      if (!data.viewerUid && viewerUid) {
        batch.update(data.ref, { viewerUid });
        needsCommit = true;
      }

      summaries.push({
        id,
        ownerDisplayName: data.ownerDisplayName || 'Reflective Writer',
        reportId: data.reportId,
        reportTitle: data.reportTitle || 'Reflection Compass',
        grantedAt: data.grantedAt?.toDate ? data.grantedAt.toDate().toISOString() : data.grantedAt || '',
      });

      // Also attempt to activate invited trusted person record in owner's subcollection
      if (data.ownerUid) {
        try {
          const tpSnap = await db
            .collection('users')
            .doc(data.ownerUid)
            .collection('trustedPeople')
            .where('email', '==', normalizedEmail)
            .where('status', '==', 'invited')
            .get();

          tpSnap.docs.forEach((tpDoc) => {
            batch.update(tpDoc.ref, {
              status: 'active',
              activatedAt: FieldValue.serverTimestamp(),
            });
            needsCommit = true;
          });
        } catch {
          // Non-blocking if subcollection lookup fails
        }
      }
    }

    if (needsCommit) {
      await batch.commit().catch((e) => console.warn('Non-fatal error backfilling viewerUid/active status:', e));
    }

    summaries.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
    return summaries;
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const results: SharedReportSummary[] = [];
      for (const [grantId, grant] of localFallbackStore.shareGrants.entries()) {
        if (
          grant.status === 'active' &&
          (grant.viewerEmail.toLowerCase() === normalizedEmail || grant.viewerUid === viewerUid)
        ) {
          if (!grant.viewerUid) grant.viewerUid = viewerUid;
          results.push({
            id: grantId,
            ownerDisplayName: grant.ownerDisplayName,
            reportId: grant.reportId,
            reportTitle: grant.reportTitle,
            grantedAt: grant.grantedAt,
          });
        }
      }
      persistLocalStore();
      results.sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
      return results;
    }
    throw err;
  }
}

export async function getReportForSharedView(
  callerUid: string,
  callerEmail: string,
  grantId: string
): Promise<{
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  content: CompassContent;
  ownerDisplayName: string;
} | null> {
  const normalizedEmail = callerEmail.trim().toLowerCase();

  let grant: ShareGrantRecord | null = null;

  if (firestoreUnavailable) {
    grant = localFallbackStore.shareGrants.get(grantId) || null;
  } else {
    try {
      const db = getAdminDb();
      const snap = await db.collection('shareGrants').doc(grantId).get();
      if (snap.exists) {
        const data = snap.data()!;
        grant = {
          id: snap.id,
          ownerUid: data.ownerUid,
          ownerDisplayName: data.ownerDisplayName,
          viewerEmail: data.viewerEmail,
          viewerUid: data.viewerUid || null,
          reportId: data.reportId,
          reportTitle: data.reportTitle,
          grantedAt: data.grantedAt?.toDate ? data.grantedAt.toDate().toISOString() : data.grantedAt || '',
          status: data.status,
          schemaVersion: data.schemaVersion || 1,
        };
      }
    } catch (err: any) {
      if (isAdcOrPermissionError(err)) {
        firestoreUnavailable = true;
        grant = localFallbackStore.shareGrants.get(grantId) || null;
      } else {
        throw err;
      }
    }
  }

  if (!grant || grant.status !== 'active') return null;

  // Verify caller identity matches grant
  const isMatch =
    (grant.viewerUid && grant.viewerUid === callerUid) ||
    grant.viewerEmail.toLowerCase() === normalizedEmail;

  if (!isMatch) return null;

  // Fetch underlying report
  const report = await getReport(grant.ownerUid, grant.reportId);
  if (!report) return null;

  // Return ONLY CompassContent fields, strictly avoiding raw session or message data
  return {
    id: report.id,
    title: report.title,
    periodStart: report.periodStart,
    periodEnd: report.periodEnd,
    generatedAt: report.generatedAt,
    content: {
      headline: report.content.headline,
      keyThemes: report.content.keyThemes || [],
      winsAndProgress: report.content.winsAndProgress || [],
      recurringChallenges: report.content.recurringChallenges || [],
      nextActions: report.content.nextActions || [],
      reflectionQuestions: report.content.reflectionQuestions || [],
    },
    ownerDisplayName: grant.ownerDisplayName,
  };
}

// ==========================================
// FEATURE 2: PROGRESS TRENDS & AGGREGATION
// ==========================================

export interface ProgressSnapshot {
  streak: {
    currentStreak: number;
    longestStreak: number;
    activeDays: string[];
  };
  totalSessions: number;
  totalReports: number;
  themeFrequency: { theme: string; count: number }[];
  recurringChallenges: { challenge: string; occurrences: number }[];
  activityByWeek: { week: string; count: number; startDate: string }[];
  rangeDays: number;
}

/**
 * Pure aggregation helper: extract and count themes from sessions and reports
 * Exported standalone so Feature 3 (Content Discovery) can reuse it.
 */
export function computeThemeFrequency(
  sessions: SessionRecord[],
  reports: ReportRecord[]
): { theme: string; count: number }[] {
  const themeCounts = new Map<string, { count: number; canonical: string }>();

  function registerTheme(raw: string) {
    if (!raw || typeof raw !== 'string') return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    const existing = themeCounts.get(lower);
    if (existing) {
      existing.count += 1;
    } else {
      themeCounts.set(lower, { count: 1, canonical: trimmed });
    }
  }

  // 1. Extract coreThemes from session summaries
  for (const session of sessions) {
    if (!session.summary) continue;
    let summaryObj: any = session.summary;
    if (typeof summaryObj === 'string') {
      try {
        summaryObj = JSON.parse(summaryObj);
      } catch {
        // Not a JSON string
      }
    }
    if (summaryObj && typeof summaryObj === 'object') {
      const themes = summaryObj.coreThemes;
      if (Array.isArray(themes)) {
        themes.forEach((t) => registerTheme(t));
      }
    }
  }

  // 2. Extract keyThemes from reports
  for (const report of reports) {
    if (report.content && Array.isArray(report.content.keyThemes)) {
      report.content.keyThemes.forEach((t) => registerTheme(t));
    }
  }

  // Sort descending by count
  return Array.from(themeCounts.values())
    .map((item) => ({ theme: item.canonical, count: item.count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Computes streaks, activity buckets, challenges, and trends over a range of days
 */
export function computeProgressSnapshot(
  sessions: SessionRecord[],
  reports: ReportRecord[],
  rangeDays: number = 30
): ProgressSnapshot {
  const cutoffMs = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(cutoffMs);

  // Filter sessions and reports within range
  const inRangeSessions = sessions.filter((s) => {
    const act = s.lastActivityAt || s.createdAt;
    if (!act) return false;
    return new Date(act).getTime() >= cutoffMs;
  });

  const inRangeReports = reports.filter((r) => {
    if (!r.generatedAt) return false;
    return new Date(r.generatedAt).getTime() >= cutoffMs;
  });

  // Calculate unique active days from session activity (across all sessions in range)
  const activeDaysSet = new Set<string>();
  for (const s of inRangeSessions) {
    const act = s.lastActivityAt || s.createdAt;
    if (act) {
      const dayStr = new Date(act).toISOString().slice(0, 10);
      activeDaysSet.add(dayStr);
    }
  }
  const activeDays = Array.from(activeDaysSet).sort();

  // Streak calculations
  let currentStreak = 0;
  let longestStreak = 0;

  if (activeDays.length > 0) {
    // Determine longest streak
    let tempStreak = 1;
    longestStreak = 1;
    for (let i = 1; i < activeDays.length; i++) {
      const prevDate = new Date(activeDays[i - 1]);
      const currDate = new Date(activeDays[i]);
      const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays === 1) {
        tempStreak += 1;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }

    // Determine current streak up to today or yesterday
    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const activeSet = new Set(activeDays);
    let checkDate: Date | null = null;

    if (activeSet.has(todayStr)) {
      checkDate = new Date();
    } else if (activeSet.has(yesterdayStr)) {
      checkDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    }

    if (checkDate) {
      while (true) {
        const dStr = checkDate.toISOString().slice(0, 10);
        if (activeSet.has(dStr)) {
          currentStreak += 1;
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          break;
        }
      }
    }
  }

  // Top 10 theme frequency
  const themeFrequency = computeThemeFrequency(inRangeSessions, inRangeReports).slice(0, 10);

  // Recurring challenges appearing in >= 2 reports
  const challengeCounts = new Map<string, { count: number; canonical: string }>();
  for (const report of inRangeReports) {
    if (report.content && Array.isArray(report.content.recurringChallenges)) {
      const seenInReport = new Set<string>();
      for (const raw of report.content.recurringChallenges) {
        if (!raw || typeof raw !== 'string') continue;
        const trimmed = raw.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (seenInReport.has(lower)) continue;
        seenInReport.add(lower);

        const existing = challengeCounts.get(lower);
        if (existing) {
          existing.count += 1;
        } else {
          challengeCounts.set(lower, { count: 1, canonical: trimmed });
        }
      }
    }
  }

  const recurringChallenges = Array.from(challengeCounts.values())
    .filter((item) => item.count >= 2)
    .map((item) => ({ challenge: item.canonical, occurrences: item.count }))
    .sort((a, b) => b.occurrences - a.occurrences);

  // Activity by week: group sessions into weekly buckets
  const weekBuckets = new Map<string, { count: number; startDate: string }>();
  // Generate 7-day intervals from cutoff to now
  const bucketCount = Math.ceil(rangeDays / 7);
  for (let i = bucketCount - 1; i >= 0; i--) {
    const bStart = new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
    const label = `Week of ${bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    weekBuckets.set(label, { count: 0, startDate: bStart.toISOString().slice(0, 10) });
  }

  for (const session of inRangeSessions) {
    const act = session.lastActivityAt || session.createdAt;
    if (!act) continue;
    const sessionTime = new Date(act).getTime();
    const daysAgo = (Date.now() - sessionTime) / (24 * 60 * 60 * 1000);
    const bucketIdx = Math.floor(daysAgo / 7);
    if (bucketIdx >= 0 && bucketIdx < bucketCount) {
      const bStart = new Date(Date.now() - (bucketIdx + 1) * 7 * 24 * 60 * 60 * 1000);
      const label = `Week of ${bStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const current = weekBuckets.get(label);
      if (current) {
        current.count += 1;
      }
    }
  }

  const activityByWeek = Array.from(weekBuckets.entries()).map(([week, val]) => ({
    week,
    count: val.count,
    startDate: val.startDate,
  }));

  return {
    streak: {
      currentStreak,
      longestStreak,
      activeDays,
    },
    totalSessions: inRangeSessions.length,
    totalReports: inRangeReports.length,
    themeFrequency,
    recurringChallenges,
    activityByWeek,
    rangeDays,
  };
}

export async function getProgressSnapshot(uid: string, rangeDays: number = 30): Promise<ProgressSnapshot> {
  const [sessions, reports] = await Promise.all([listSessions(uid), listReports(uid)]);
  return computeProgressSnapshot(sessions, reports, rangeDays);
}

// ==========================================
// FEATURE 3: DISCOVERY RECORDS PERSISTENCE
// ==========================================

export interface DiscoveryRecord {
  id: string;
  themesUsed: string[];
  content: DiscoveryContent;
  generatedAt: string;
  schemaVersion: 1;
}

export async function getLatestDiscovery(uid: string): Promise<DiscoveryRecord | null> {
  if (firestoreUnavailable) {
    let latest: DiscoveryRecord | null = null;
    for (const [key, disc] of localFallbackStore.discoveries.entries()) {
      if (key.startsWith(`${uid}:`)) {
        if (!latest || new Date(disc.generatedAt).getTime() > new Date(latest.generatedAt).getTime()) {
          latest = disc;
        }
      }
    }
    return latest;
  }

  try {
    const db = getAdminDb();
    const snap = await db
      .collection('users')
      .doc(uid)
      .collection('discoveries')
      .orderBy('generatedAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) return null;
    const doc = snap.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      themesUsed: data.themesUsed || [],
      content: data.content || [],
      generatedAt: data.generatedAt?.toDate ? data.generatedAt.toDate().toISOString() : data.generatedAt || '',
      schemaVersion: data.schemaVersion || 1,
    };
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      let latest: DiscoveryRecord | null = null;
      for (const [key, disc] of localFallbackStore.discoveries.entries()) {
        if (key.startsWith(`${uid}:`)) {
          if (!latest || new Date(disc.generatedAt).getTime() > new Date(latest.generatedAt).getTime()) {
            latest = disc;
          }
        }
      }
      return latest;
    }
    throw err;
  }
}

export async function saveDiscovery(
  uid: string,
  data: { themesUsed: string[]; content: DiscoveryContent }
): Promise<DiscoveryRecord> {
  const nowIso = new Date().toISOString();

  if (firestoreUnavailable) {
    const id = `disc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record: DiscoveryRecord = {
      id,
      themesUsed: data.themesUsed,
      content: data.content,
      generatedAt: nowIso,
      schemaVersion: 1,
    };
    localFallbackStore.discoveries.set(`${uid}:${id}`, record);
    persistLocalStore();
    return record;
  }

  try {
    const db = getAdminDb();
    const ref = db.collection('users').doc(uid).collection('discoveries').doc();
    const payload = {
      themesUsed: data.themesUsed,
      content: data.content,
      generatedAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    };
    await ref.set(sanitizePayload(payload));

    return {
      id: ref.id,
      themesUsed: data.themesUsed,
      content: data.content,
      generatedAt: nowIso,
      schemaVersion: 1,
    };
  } catch (err: any) {
    if (isAdcOrPermissionError(err)) {
      firestoreUnavailable = true;
      const id = `disc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const record: DiscoveryRecord = {
        id,
        themesUsed: data.themesUsed,
        content: data.content,
        generatedAt: nowIso,
        schemaVersion: 1,
      };
      localFallbackStore.discoveries.set(`${uid}:${id}`, record);
      persistLocalStore();
      return record;
    }
    throw err;
  }
}

