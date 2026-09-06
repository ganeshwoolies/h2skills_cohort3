import React, { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth, signInWithGoogle, logOut } from './lib/firebase';
import {
  apiFetchSessions,
  apiCreateSession,
  apiGetSession,
  apiUpdateSession,
  apiDeleteSession,
  apiSendMessage,
  apiSummarizeSession,
  apiFetchReports,
  apiGetReport,
  apiGenerateCompass,
  apiDeleteReport,
} from './lib/api';
import type {
  AuthUserProfile,
  JournalSession,
  SessionMessage,
  ReflectionCompassReport,
  ActiveAppView,
  CalendarMeeting,
  DriveDoc,
} from './types';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { ActiveReflectionView } from './components/ActiveReflectionView';
import { ReflectionCompassView } from './components/ReflectionCompassView';
import { NewSessionModal } from './components/NewSessionModal';
import { ImportMeetingModal } from './components/ImportMeetingModal';
import { LandingPage } from './components/LandingPage';
import { Sparkles, Clock, AlertCircle } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // App Navigation View
  const [activeView, setActiveView] = useState<ActiveAppView>('dashboard');

  // Sessions & Reports Data State
  const [sessions, setSessions] = useState<JournalSession[]>([]);
  const [reports, setReports] = useState<ReflectionCompassReport[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Active Session State
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<JournalSession | null>(null);
  const [activeMessages, setActiveMessages] = useState<SessionMessage[]>([]);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Active Report State
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  // Operation Indicators & Error handling
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isGeneratingCompass, setIsGeneratingCompass] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [compassError, setCompassError] = useState<string | null>(null);

  // Modals
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [customizerMeeting, setCustomizerMeeting] = useState<CalendarMeeting | null>(null);
  const [customizerDoc, setCustomizerDoc] = useState<DriveDoc | null>(null);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
      } else {
        setCurrentUser(null);
        setSessions([]);
        setReports([]);
        setActiveSessionId(null);
        setActiveSession(null);
        setActiveMessages([]);
        setActiveReportId(null);
        setActiveView('dashboard');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch all sessions and reports when user logs in
  const loadUserData = useCallback(async () => {
    if (!currentUser) return;
    setDataLoading(true);
    setGlobalError(null);

    try {
      const [fetchedSessions, fetchedReports] = await Promise.all([
        apiFetchSessions(),
        apiFetchReports(),
      ]);
      setSessions(fetchedSessions);
      setReports(fetchedReports);
    } catch (err: any) {
      console.error('Failed to load user data:', err);
      setGlobalError(err?.message || 'Could not load your journal data.');
    } finally {
      setDataLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      loadUserData();
    }
  }, [currentUser, loadUserData]);

  // Load active session and its messages when activeSessionId changes
  const loadSessionDetails = useCallback(async (sessionId: string) => {
    setSessionLoading(true);
    setSessionError(null);
    try {
      const { session, messages } = await apiGetSession(sessionId);
      setActiveSession(session);
      setActiveMessages(messages);
      setActiveView('session');
    } catch (err: any) {
      console.error('Failed to load session:', err);
      setSessionError(err?.message || 'Unable to load session.');
    } finally {
      setSessionLoading(false);
    }
  }, []);

  // Handlers
  const handleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleSignOut = async () => {
    await logOut();
  };

  const handleCreateSession = async (params: { title?: string; tags?: string[] }) => {
    try {
      const newSession = await apiCreateSession(params);
      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setActiveSession(newSession);
      setActiveMessages([]);
      setActiveView('session');
    } catch (err: any) {
      console.error('Failed to create session:', err);
      alert(err?.message || 'Failed to create new journal session.');
    }
  };

  const handleImportMeetingComplete = async (payload: {
    title: string;
    tags: string[];
    initialMessage: string;
  }) => {
    try {
      setDataLoading(true);
      // 1. Create new session with meeting title & tags
      const newSession = await apiCreateSession({
        title: payload.title,
        tags: payload.tags,
      });

      setSessions((prev) => [newSession, ...prev]);
      setActiveSessionId(newSession.id);
      setActiveSession(newSession);
      setActiveView('session');
      setIsNewSessionModalOpen(false);
      setIsImportModalOpen(false);

      // 2. Dispatch initial meeting metadata & notes to Gemini
      setIsSendingMessage(true);
      const { userMessage, modelMessage } = await apiSendMessage(
        newSession.id,
        payload.initialMessage
      );

      setActiveMessages([userMessage, modelMessage]);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === newSession.id
            ? {
                ...s,
                lastActivityAt: new Date().toISOString(),
                messageCount: 2,
              }
            : s
        )
      );
    } catch (err: any) {
      console.error('Failed to import meeting session:', err);
      setGlobalError(err?.message || 'Failed to initialize meeting reflection session.');
    } finally {
      setIsSendingMessage(false);
      setDataLoading(false);
    }
  };

  const handleOpenCustomizer = (meeting: CalendarMeeting | null, doc: DriveDoc | null) => {
    setCustomizerMeeting(meeting);
    setCustomizerDoc(doc);
    setIsImportModalOpen(true);
  };

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    loadSessionDetails(sessionId);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await apiDeleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        setActiveSessionId(null);
        setActiveSession(null);
        setActiveMessages([]);
        setActiveView('dashboard');
      }
    } catch (err: any) {
      console.error('Failed to delete session:', err);
      alert(err?.message || 'Failed to delete session.');
    }
  };

  const handleUpdateSession = async (updates: { title?: string; tags?: string[] }) => {
    if (!activeSession) return;
    try {
      const updated = await apiUpdateSession(activeSession.id, updates);
      setActiveSession(updated);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err: any) {
      console.error('Failed to update session:', err);
      setSessionError(err?.message || 'Failed to update session.');
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!activeSession) return;
    setIsSendingMessage(true);
    setSessionError(null);

    try {
      const { userMessage, modelMessage } = await apiSendMessage(
        activeSession.id,
        text
      );
      setActiveMessages((prev) => [...prev, userMessage, modelMessage]);

      // Update session activity and message count in local list
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSession.id
            ? {
                ...s,
                lastActivityAt: new Date().toISOString(),
                messageCount: (s.messageCount || 0) + 2,
              }
            : s
        )
      );
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setSessionError(
        err?.message || 'Failed to deliver message to Gemini. Please try again.'
      );
      throw err; // Allow child component to retain input on failure
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSummarizeSession = async () => {
    if (!activeSession) return;
    setIsSummarizing(true);
    setSessionError(null);

    try {
      const { session: updatedSession } = await apiSummarizeSession(activeSession.id);
      setActiveSession(updatedSession);
      setSessions((prev) =>
        prev.map((s) => (s.id === updatedSession.id ? updatedSession : s))
      );
    } catch (err: any) {
      console.error('Failed to summarize session:', err);
      setSessionError(
        err?.message || 'Gemini encountered an issue generating the summary.'
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  // Compass handlers
  const handleGenerateCompass = async (params: {
    title: string;
    periodStart: string;
    periodEnd: string;
  }) => {
    setIsGeneratingCompass(true);
    setCompassError(null);

    try {
      const newReport = await apiGenerateCompass(params);
      setReports((prev) => [newReport, ...prev]);
      setActiveReportId(newReport.id);
      setActiveView('compass');
    } catch (err: any) {
      console.error('Failed to generate Reflection Compass:', err);
      setCompassError(
        err?.message || 'Failed to synthesize Reflection Compass report.'
      );
    } finally {
      setIsGeneratingCompass(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await apiDeleteReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      if (activeReportId === reportId) {
        setActiveReportId(null);
      }
    } catch (err: any) {
      console.error('Failed to delete report:', err);
      alert(err?.message || 'Failed to delete report.');
    }
  };

  const handleSelectReport = (reportId: string) => {
    setActiveReportId(reportId);
    setActiveView('compass');
  };

  // Active report computation
  const activeReport = reports.find((r) => r.id === activeReportId) || null;

  // Auth Loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col items-center justify-center text-slate-700 p-4">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-sm flex flex-col items-center max-w-xs w-full text-center">
          <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-3.5 shadow-xs">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <p className="font-bold text-slate-900 text-base tracking-tight">
            Personal Gemini Journal
          </p>
          <p className="text-xs text-slate-500 mt-1.5 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 animate-spin text-slate-400" />
            Verifying authentication credentials...
          </p>
        </div>
      </div>
    );
  }

  // Unauthenticated: Show Landing Page
  if (!currentUser) {
    return <LandingPage onSignIn={handleSignIn} />;
  }

  // Authenticated: Bento Grid Shell
  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col">
      {/* Top Header */}
      <Header
        user={currentUser}
        activeView={activeView}
        onNavigate={(view) => setActiveView(view)}
        onSignOut={handleSignOut}
        onNewSession={() => setIsNewSessionModalOpen(true)}
        onImportMeeting={() => setIsImportModalOpen(true)}
        activeSessionTitle={activeSession?.title}
      />

      {/* Global Error Banner */}
      {globalError && (
        <div className="px-6 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{globalError}</span>
          </div>
          <button
            onClick={() => setGlobalError(null)}
            className="text-xs font-semibold text-rose-900 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main View Area */}
      <main className="flex-1 overflow-y-auto">
        {activeView === 'dashboard' && (
          <DashboardView
            user={currentUser}
            sessions={sessions}
            reports={reports}
            loading={dataLoading}
            onNewSession={() => setIsNewSessionModalOpen(true)}
            onImportMeeting={() => {
              setCustomizerMeeting(null);
              setCustomizerDoc(null);
              setIsImportModalOpen(true);
            }}
            onImportComplete={handleImportMeetingComplete}
            onOpenCustomizer={handleOpenCustomizer}
            onSelectSession={handleSelectSession}
            onDeleteSession={handleDeleteSession}
            onSelectReport={handleSelectReport}
            onDeleteReport={handleDeleteReport}
            onNavigateToCompass={() => setActiveView('compass')}
          />
        )}

        {activeView === 'session' && activeSession && (
          <ActiveReflectionView
            session={activeSession}
            messages={activeMessages}
            isSending={isSendingMessage}
            isSummarizing={isSummarizing}
            error={sessionError}
            onClearError={() => setSessionError(null)}
            onSendMessage={handleSendMessage}
            onSummarize={handleSummarizeSession}
            onUpdateSession={handleUpdateSession}
            onSaveAndExit={() => setActiveView('dashboard')}
          />
        )}

        {activeView === 'compass' && (
          <ReflectionCompassView
            reports={reports}
            sessions={sessions}
            activeReport={activeReport}
            onSelectReport={(id) => setActiveReportId(id)}
            onGenerateReport={handleGenerateCompass}
            onDeleteReport={handleDeleteReport}
            isGenerating={isGeneratingCompass}
            error={compassError}
            onClearError={() => setCompassError(null)}
            onBackToDashboard={() => setActiveView('dashboard')}
          />
        )}
      </main>

      {/* New Session Modal */}
      <NewSessionModal
        isOpen={isNewSessionModalOpen}
        onClose={() => setIsNewSessionModalOpen(false)}
        onCreateSession={handleCreateSession}
        onSwitchToImport={() => setIsImportModalOpen(true)}
      />

      {/* Google Workspace Import Meeting & Notes Modal */}
      <ImportMeetingModal
        isOpen={isImportModalOpen}
        initialMeeting={customizerMeeting}
        initialDoc={customizerDoc}
        onClose={() => {
          setIsImportModalOpen(false);
          setCustomizerMeeting(null);
          setCustomizerDoc(null);
        }}
        onImportComplete={handleImportMeetingComplete}
      />
    </div>
  );
}
