import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Compass,
  Calendar,
  Tag,
  Search,
  MessageSquare,
  ArrowRight,
  FileCheck,
  Trash2,
  Filter,
  CheckCircle2,
  TrendingUp,
  Users,
} from 'lucide-react';
import type {
  AuthUserProfile,
  JournalSession,
  ReflectionCompassReport,
  CalendarMeeting,
  DriveDoc,
} from '../types';
import { AutoScanPromptCard } from './AutoScanPromptCard';

interface DashboardViewProps {
  user: AuthUserProfile;
  sessions: JournalSession[];
  reports: ReflectionCompassReport[];
  loading: boolean;
  onNewSession: () => void;
  onImportMeeting?: () => void;
  onImportComplete?: (payload: {
    title: string;
    tags: string[];
    initialMessage: string;
  }) => Promise<void>;
  onOpenCustomizer?: (meeting: CalendarMeeting | null, doc: DriveDoc | null) => void;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  onSelectReport: (reportId: string) => void;
  onDeleteReport: (reportId: string) => Promise<void>;
  onNavigateToCompass: () => void;
  onNavigateToProgress?: () => void;
  onNavigateToDiscover?: () => void;
  onNavigateToTrusted?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  sessions,
  reports,
  loading,
  onNewSession,
  onImportMeeting,
  onImportComplete,
  onOpenCustomizer,
  onSelectSession,
  onDeleteSession,
  onSelectReport,
  onDeleteReport,
  onNavigateToCompass,
  onNavigateToProgress,
  onNavigateToDiscover,
  onNavigateToTrusted,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | '7d' | '30d'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Extract all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => s.tags?.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [sessions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = s.title.toLowerCase().includes(q);
        const matchesTags = s.tags?.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesTags) return false;
      }

      // Tag filter
      if (selectedTag && !s.tags?.includes(selectedTag)) {
        return false;
      }

      // Date range filter
      if (dateFilter === '7d') {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (new Date(s.lastActivityAt || s.createdAt).getTime() < cutoff) return false;
      } else if (dateFilter === '30d') {
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (new Date(s.lastActivityAt || s.createdAt).getTime() < cutoff) return false;
      }

      return true;
    });
  }, [sessions, searchQuery, selectedTag, dateFilter]);

  const handleDeleteSessionClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this journal session and its messages?')) {
      setDeletingId(id);
      try {
        await onDeleteSession(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleDeleteReportClick = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this Reflection Compass report?')) {
      setDeletingId(id);
      try {
        await onDeleteReport(id);
      } finally {
        setDeletingId(null);
      }
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Auto-Scan Proactive Workspace Meeting & Notes Scanner */}
      {onImportComplete && onOpenCustomizer && (
        <AutoScanPromptCard
          existingSessionTitles={sessions.map((s) => s.title)}
          onImportComplete={onImportComplete}
          onOpenCustomizer={onOpenCustomizer}
        />
      )}

      {/* Bento Top Header: Welcome & Quick Action Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Welcome Card */}
        <div className="lg:col-span-2 p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Private Reflection Sanctuary</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Welcome back, {user.displayName ? user.displayName.split(' ')[0] : 'Journaler'}
            </h1>
            <p className="mt-2 text-sm text-slate-600 max-w-xl leading-relaxed">
              Capture your unfiltered thoughts, converse with Gemini to gain fresh clarity, and discover hidden patterns through your personalized weekly Reflection Compass.
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-xs text-slate-500">
              <div>
                <span className="font-bold text-base text-slate-900 block">{sessions.length}</span>
                <span>Total Sessions</span>
              </div>
              <div>
                <span className="font-bold text-base text-slate-900 block">
                  {sessions.filter((s) => s.summary).length}
                </span>
                <span>Summarized</span>
              </div>
              <div>
                <span className="font-bold text-base text-slate-900 block">{reports.length}</span>
                <span>Compass Reports</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onImportMeeting && (
                <button
                  id="dashboard-import-meeting-cta-btn"
                  onClick={onImportMeeting}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition-all shadow-xs cursor-pointer"
                >
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span>Import Meeting & Notes</span>
                </button>
              )}

              <button
                id="dashboard-new-session-cta-btn"
                onClick={onNewSession}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Journal Session</span>
              </button>
            </div>
          </div>
        </div>

        {/* Compass Prompt Card */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center mb-4">
              <Compass className="w-5 h-5 text-amber-300" />
            </div>
            <h2 className="text-lg font-bold tracking-tight">Reflection Compass</h2>
            <p className="mt-2 text-xs text-slate-300 leading-relaxed">
              Transform your recent multi-turn entries into overarching themes, recognized wins, and concrete next actions for the upcoming week.
            </p>
          </div>

          <div className="mt-6">
            <button
              id="dashboard-open-compass-btn"
              onClick={onNavigateToCompass}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 transition-all cursor-pointer"
            >
              <span>Explore My Compass</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Feature Quick Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {onNavigateToProgress && (
          <div
            onClick={onNavigateToProgress}
            className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Progress Trends</h3>
                <p className="text-[11px] text-slate-500">Streaks, cadence &amp; themes</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}

        {onNavigateToDiscover && (
          <div
            onClick={onNavigateToDiscover}
            className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Trends &amp; Influencers</h3>
                <p className="text-[11px] text-slate-500">Search grounded recommendations</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}

        {onNavigateToTrusted && (
          <div
            onClick={onNavigateToTrusted}
            className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all cursor-pointer flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Trusted People</h3>
                <p className="text-[11px] text-slate-500">Read-only sharing controls</p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </div>
        )}
      </div>

      {/* Main Grid: Sessions & Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Session History */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Journal Sessions</h2>
              <p className="text-xs text-slate-500">
                Your private conversational threads with Gemini
              </p>
            </div>

            {/* Date filter pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs">
              <button
                id="filter-all-btn"
                onClick={() => setDateFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                  dateFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Time
              </button>
              <button
                id="filter-7d-btn"
                onClick={() => setDateFilter('7d')}
                className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                  dateFilter === '7d'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Past 7 Days
              </button>
              <button
                id="filter-30d-btn"
                onClick={() => setDateFilter('30d')}
                className={`px-2.5 py-1 rounded-lg font-medium cursor-pointer transition-colors ${
                  dateFilter === '30d'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Past 30 Days
              </button>
            </div>
          </div>

          {/* Search & Tag Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="session-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search sessions by title or tag..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
            </div>

            {allTags.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer border ${
                    selectedTag === null
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  All
                </button>
                {allTags.slice(0, 5).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                    className={`px-2.5 py-1 rounded-lg text-xs cursor-pointer border whitespace-nowrap ${
                      selectedTag === tag
                        ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sessions List */}
          {loading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/90">
              <div className="w-6 h-6 border-2 border-slate-800 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="mt-3 text-xs text-slate-500">Loading your private journal entries...</p>
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/90">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-slate-400" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">No journal sessions found</h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                {searchQuery || selectedTag || dateFilter !== 'all'
                  ? 'No sessions match your filter criteria. Try resetting your search.'
                  : 'You have not created any journal sessions yet. Start your first reflective conversation!'}
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                {onImportMeeting && (
                  <button
                    id="empty-state-import-meeting-btn"
                    onClick={onImportMeeting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-all cursor-pointer"
                  >
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Import from Calendar & Docs</span>
                  </button>
                )}
                <button
                  id="empty-state-new-session-btn"
                  onClick={onNewSession}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Begin First Reflection</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredSessions.map((session) => (
                <div
                  key={session.id}
                  id={`session-card-${session.id}`}
                  onClick={() => onSelectSession(session.id)}
                  className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-slate-800 transition-colors line-clamp-1">
                        {session.title || 'Untitled Reflection'}
                      </h3>
                      <button
                        onClick={(e) => handleDeleteSessionClick(e, session.id)}
                        disabled={deletingId === session.id}
                        title="Delete Session"
                        className="p-1 text-slate-300 hover:text-rose-600 rounded-md transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                      {session.summary
                        ? `Summary: ${
                            typeof session.summary === 'string' && session.summary.startsWith('{')
                              ? JSON.parse(session.summary)?.headline || session.summary
                              : session.summary
                          }`
                        : 'Active conversation in progress. Click to continue writing reflections.'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>
                        {new Date(session.lastActivityAt || session.createdAt).toLocaleDateString(
                          undefined,
                          { month: 'short', day: 'numeric' }
                        )}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {session.summary && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Summarized
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-slate-500">
                        <MessageSquare className="w-3 h-3" />
                        {session.messageCount || 0}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 1 Col: Recent Reflection Compass Reports */}
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Reflection Compass</h2>
              <p className="text-xs text-slate-500">Synthesized weekly growth reports</p>
            </div>

            <button
              id="dashboard-new-compass-cta-btn"
              onClick={onNavigateToCompass}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              + Generate
            </button>
          </div>

          {reports.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200/90">
              <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No Compass Reports yet</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Synthesize your journal sessions to uncover weekly themes and next steps.
              </p>
              <button
                id="generate-first-compass-btn"
                onClick={onNavigateToCompass}
                className="mt-3 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              >
                Create Compass
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.slice(0, 4).map((rep) => (
                <div
                  key={rep.id}
                  id={`report-card-${rep.id}`}
                  onClick={() => onSelectReport(rep.id)}
                  className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-sm hover:border-indigo-200 transition-all cursor-pointer flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <Compass className="w-3.5 h-3.5" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
                        {rep.title}
                      </h4>
                    </div>

                    <button
                      onClick={(e) => handleDeleteReportClick(e, rep.id)}
                      disabled={deletingId === rep.id}
                      title="Delete Report"
                      className="p-1 text-slate-300 hover:text-rose-600 rounded transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-slate-600 line-clamp-2 leading-relaxed italic">
                    "{rep.content?.headline || 'Weekly reflection insights'}"
                  </p>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {new Date(rep.generatedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="text-indigo-600 font-medium group-hover:underline">
                      View report &rarr;
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
