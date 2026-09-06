import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  FileText,
  Sparkles,
  X,
  Search,
  Check,
  RefreshCw,
  Clock,
  Users,
  Video,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  FolderOpen,
} from 'lucide-react';
import type { CalendarMeeting, DriveDoc } from '../types';
import {
  fetchRecentAndUpcomingMeetings,
  fetchMeetingNotesDocs,
  fetchGoogleDocContent,
  buildReflectionPrompt,
} from '../lib/workspace';
import {
  ensureWorkspaceAccessToken,
  getCachedWorkspaceToken,
} from '../lib/firebase';

interface ImportMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMeeting?: CalendarMeeting | null;
  initialDoc?: DriveDoc | null;
  onImportComplete: (payload: {
    title: string;
    tags: string[];
    initialMessage: string;
  }) => Promise<void>;
}

export const ImportMeetingModal: React.FC<ImportMeetingModalProps> = ({
  isOpen,
  onClose,
  initialMeeting,
  initialDoc,
  onImportComplete,
}) => {
  // Wizard active step
  const [activeStep, setActiveStep] = useState<'calendar' | 'docs' | 'review'>('calendar');

  // Auth & Token State
  const [hasToken, setHasToken] = useState<boolean>(!!getCachedWorkspaceToken());
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Calendar State
  const [meetings, setMeetings] = useState<CalendarMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingsError, setMeetingsError] = useState<string | null>(null);
  const [meetingFilter, setMeetingFilter] = useState<'all' | 'recent' | 'upcoming'>('all');
  const [meetingSearch, setMeetingSearch] = useState('');
  const [selectedMeeting, setSelectedMeeting] = useState<CalendarMeeting | null>(null);

  // Google Docs State
  const [docs, setDocs] = useState<DriveDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docSearch, setDocSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DriveDoc | null>(null);
  const [selectedDocContent, setSelectedDocContent] = useState<{ title: string; text: string } | null>(null);
  const [isFetchingDocText, setIsFetchingDocText] = useState(false);

  // Review & Finalization State
  const [customTitle, setCustomTitle] = useState('');
  const [customTags, setCustomTags] = useState<string[]>(['meeting']);
  const [tagInput, setTagInput] = useState('');
  const [personalNotes, setPersonalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check token and initialize with any pre-selected items on open
  useEffect(() => {
    if (isOpen) {
      const token = getCachedWorkspaceToken();
      setHasToken(!!token);

      if (initialMeeting) {
        setSelectedMeeting(initialMeeting);
      }
      if (initialDoc) {
        setSelectedDoc(initialDoc);
        if (token) {
          setIsFetchingDocText(true);
          fetchGoogleDocContent(token, initialDoc.id)
            .then((content) => setSelectedDocContent(content))
            .catch((e) => console.warn('Failed to pre-fetch doc text', e))
            .finally(() => setIsFetchingDocText(false));
        }
      }

      if (initialMeeting || initialDoc) {
        setActiveStep('review');
      } else {
        setActiveStep('calendar');
      }

      if (token) {
        loadCalendarData(token);
        loadDocsData(token);
      }
    }
  }, [isOpen, initialMeeting, initialDoc]);

  // Connect Google Workspace
  const handleConnectWorkspace = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const token = await ensureWorkspaceAccessToken();
      setHasToken(true);
      await Promise.all([loadCalendarData(token), loadDocsData(token)]);
    } catch (err: any) {
      console.error('Failed to authenticate with Google Workspace:', err);
      setAuthError(err?.message || 'Failed to grant Workspace permissions.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Load calendar meetings
  const loadCalendarData = async (tokenOverride?: string) => {
    const token = tokenOverride || getCachedWorkspaceToken();
    if (!token) return;

    setMeetingsLoading(true);
    setMeetingsError(null);
    try {
      const events = await fetchRecentAndUpcomingMeetings(token, 4, 7);
      setMeetings(events);
    } catch (err: any) {
      console.error('Calendar load error:', err);
      if (err.message === 'AUTH_EXPIRED') {
        setHasToken(false);
        setMeetingsError('Access expired. Please re-connect Google Calendar.');
      } else {
        setMeetingsError(err.message || 'Could not load calendar events.');
      }
    } finally {
      setMeetingsLoading(false);
    }
  };

  // Load Google Docs
  const loadDocsData = async (tokenOverride?: string, query?: string) => {
    const token = tokenOverride || getCachedWorkspaceToken();
    if (!token) return;

    setDocsLoading(true);
    setDocsError(null);
    try {
      const fetchedDocs = await fetchMeetingNotesDocs(token, query);
      setDocs(fetchedDocs);
    } catch (err: any) {
      console.error('Docs load error:', err);
      if (err.message === 'AUTH_EXPIRED') {
        setHasToken(false);
        setDocsError('Access expired. Please re-connect Google Drive.');
      } else {
        setDocsError(err.message || 'Could not load Google Docs.');
      }
    } finally {
      setDocsLoading(false);
    }
  };

  // Handle selecting a Google Doc and loading its content
  const handleSelectDoc = async (doc: DriveDoc) => {
    const token = getCachedWorkspaceToken();
    if (!token) return;

    if (selectedDoc?.id === doc.id) {
      // Toggle off
      setSelectedDoc(null);
      setSelectedDocContent(null);
      return;
    }

    setSelectedDoc(doc);
    setIsFetchingDocText(true);
    try {
      const content = await fetchGoogleDocContent(token, doc.id);
      setSelectedDocContent(content);
    } catch (err: any) {
      console.error('Failed to load doc text:', err);
      setSelectedDocContent({ title: doc.name, text: '' });
    } finally {
      setIsFetchingDocText(false);
    }
  };

  // Filtered meetings
  const filteredMeetings = useMemo(() => {
    const nowMs = Date.now();
    return meetings.filter((m) => {
      // Time filter
      if (m.startTime) {
        const startMs = new Date(m.startTime).getTime();
        if (meetingFilter === 'recent' && startMs > nowMs) return false;
        if (meetingFilter === 'upcoming' && startMs < nowMs) return false;
      }

      // Search filter
      if (meetingSearch.trim()) {
        const q = meetingSearch.toLowerCase();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesAttendee = m.attendees?.some(
          (a) => a.displayName?.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesAttendee) return false;
      }

      return true;
    });
  }, [meetings, meetingFilter, meetingSearch]);

  // Update default title & tags whenever meeting or doc selection changes
  useEffect(() => {
    if (selectedMeeting) {
      setCustomTitle(`Debrief: ${selectedMeeting.title}`);
      const baseTags = ['meeting', 'calendar'];
      if (selectedDoc) baseTags.push('notes');
      setCustomTags(baseTags);
    } else if (selectedDoc) {
      setCustomTitle(`Notes: ${selectedDoc.name}`);
      setCustomTags(['meeting', 'notes']);
    }
  }, [selectedMeeting, selectedDoc]);

  // Add custom tag
  const handleAddTag = () => {
    const clean = tagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (clean && !customTags.includes(clean)) {
      setCustomTags([...customTags, clean]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (t: string) => {
    setCustomTags(customTags.filter((tag) => tag !== t));
  };

  // Submit and create reflection session
  const handleSubmit = async () => {
    if (!selectedMeeting && !selectedDoc && !personalNotes.trim()) {
      return;
    }

    try {
      setIsSubmitting(true);
      const { initialUserMessage, defaultTitle, tags } = buildReflectionPrompt({
        meeting: selectedMeeting,
        docContent: selectedDocContent,
        personalNotes,
      });

      await onImportComplete({
        title: customTitle.trim() || defaultTitle,
        tags: customTags.length > 0 ? customTags : tags,
        initialMessage: initialUserMessage,
      });

      onClose();
    } catch (err) {
      console.error('Failed to import meeting session:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">Import Meeting Notes & Calendar</h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100/70 text-blue-700 rounded-full">
                  Workspace
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Turn your meetings and Google Docs into structured, guided debriefs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Wizard Step Navigation */}
        <div className="px-6 py-2.5 bg-white border-b border-slate-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveStep('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeStep === 'calendar'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>1. Calendar Meeting</span>
              {selectedMeeting && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                  ✓
                </span>
              )}
            </button>

            <span className="text-slate-300">/</span>

            <button
              onClick={() => setActiveStep('docs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeStep === 'docs'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>2. Google Docs</span>
              {selectedDoc && (
                <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">
                  ✓
                </span>
              )}
            </button>

            <span className="text-slate-300">/</span>

            <button
              onClick={() => setActiveStep('review')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeStep === 'review'
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>3. Review & Launch</span>
            </button>
          </div>

          {hasToken && (
            <button
              onClick={() => {
                loadCalendarData();
                loadDocsData();
              }}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
              title="Refresh Workspace Data"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Sync</span>
            </button>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Permission Connection Banner if no access token yet */}
          {!hasToken ? (
            <div className="p-6 bg-blue-50/60 rounded-2xl border border-blue-100 flex flex-col items-center text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white shadow-xs border border-blue-100 flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="max-w-md space-y-1">
                <h4 className="text-sm font-bold text-slate-900">
                  Connect Google Calendar & Google Docs
                </h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Grant permission to securely import your calendar meeting metadata and Google Docs
                  meeting notes into private reflection sessions.
                </p>
              </div>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                onClick={handleConnectWorkspace}
                disabled={isAuthenticating}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                {isAuthenticating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Connecting Google Workspace...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                    <span>Connect Google Calendar & Docs</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <>
              {/* STEP 1: CALENDAR VIEW */}
              {activeStep === 'calendar' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Search box */}
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search meetings by title or attendee..."
                        value={meetingSearch}
                        onChange={(e) => setMeetingSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>

                    {/* Time filter pills */}
                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl self-start">
                      <button
                        onClick={() => setMeetingFilter('all')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                          meetingFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        All
                      </button>
                      <button
                        onClick={() => setMeetingFilter('recent')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                          meetingFilter === 'recent'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Past Days
                      </button>
                      <button
                        onClick={() => setMeetingFilter('upcoming')}
                        className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors cursor-pointer ${
                          meetingFilter === 'upcoming'
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Upcoming
                      </button>
                    </div>
                  </div>

                  {meetingsError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                      <span>{meetingsError}</span>
                      <button
                        onClick={() => loadCalendarData()}
                        className="underline font-semibold cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {meetingsLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      <p className="text-xs">Fetching calendar events...</p>
                    </div>
                  ) : filteredMeetings.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 space-y-1">
                      <Calendar className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                      <p className="text-xs font-medium text-slate-600">No matching meetings found</p>
                      <p className="text-[11px] text-slate-400">
                        Check back later or adjust your search filter
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                      {filteredMeetings.map((m) => {
                        const isSelected = selectedMeeting?.id === m.id;
                        const start = m.startTime ? new Date(m.startTime) : null;
                        const formattedDate = start
                          ? start.toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '';
                        const formattedTime = start
                          ? start.toLocaleTimeString(undefined, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'All Day';

                        return (
                          <div
                            key={m.id}
                            onClick={() => setSelectedMeeting(isSelected ? null : m)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                              isSelected
                                ? 'bg-blue-50/70 border-blue-400 shadow-xs'
                                : 'bg-white hover:bg-slate-50 border-slate-200/90'
                            }`}
                          >
                            <div className="space-y-1.5 flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-semibold text-slate-900 truncate">
                                  {m.title}
                                </h4>
                                {m.meetUrl && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700">
                                    <Video className="w-2.5 h-2.5" />
                                    <span>Meet</span>
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>
                                    {formattedDate}, {formattedTime}
                                  </span>
                                </span>

                                {m.attendees && m.attendees.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Users className="w-3 h-3 text-slate-400" />
                                    <span>{m.attendees.length} participants</span>
                                  </span>
                                )}
                              </div>

                              {m.description && (
                                <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                                  {m.description}
                                </p>
                              )}
                            </div>

                            <div className="pt-0.5">
                              <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-3 h-3" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <p className="text-[11px] text-slate-500">
                      {selectedMeeting ? `Selected: ${selectedMeeting.title}` : 'No meeting selected yet (optional)'}
                    </p>
                    <button
                      onClick={() => setActiveStep('docs')}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Next: Attach Notes</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: GOOGLE DOCS VIEW */}
              {activeStep === 'docs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search Google Docs by document name..."
                        value={docSearch}
                        onChange={(e) => {
                          setDocSearch(e.target.value);
                          loadDocsData(undefined, e.target.value);
                        }}
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                    </div>
                  </div>

                  {docsError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between">
                      <span>{docsError}</span>
                      <button
                        onClick={() => loadDocsData()}
                        className="underline font-semibold cursor-pointer"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {docsLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-2 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                      <p className="text-xs">Searching Google Drive for docs...</p>
                    </div>
                  ) : docs.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 space-y-1">
                      <FolderOpen className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                      <p className="text-xs font-medium text-slate-600">No Google Docs found</p>
                      <p className="text-[11px] text-slate-400">
                        Create meeting notes in Google Docs or search another keyword
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                      {docs.map((d) => {
                        const isSelected = selectedDoc?.id === d.id;
                        const modDate = new Date(d.modifiedTime).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        });

                        return (
                          <div
                            key={d.id}
                            onClick={() => handleSelectDoc(d)}
                            className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                              isSelected
                                ? 'bg-blue-50/70 border-blue-400 shadow-xs'
                                : 'bg-white hover:bg-slate-50 border-slate-200/90'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                <h5 className="text-xs font-semibold text-slate-900 truncate">
                                  {d.name}
                                </h5>
                              </div>
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  isSelected
                                    ? 'bg-blue-600 border-blue-600 text-white'
                                    : 'border-slate-300 bg-white'
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span>Modified {modDate}</span>
                              {d.webViewLink && (
                                <a
                                  href={d.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-600 hover:underline flex items-center gap-0.5"
                                >
                                  <span>Open</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Preview of selected doc text */}
                  {selectedDoc && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          <span>Notes Preview: {selectedDoc.name}</span>
                        </span>
                        {isFetchingDocText && (
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Loading text...
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 line-clamp-3 font-mono bg-white p-2 rounded-lg border border-slate-100">
                        {selectedDocContent?.text || '(Loading document contents...)'}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setActiveStep('calendar')}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      ← Back to Calendar
                    </button>
                    <button
                      onClick={() => setActiveStep('review')}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <span>Review & Launch</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: REVIEW & LAUNCH */}
              {activeStep === 'review' && (
                <div className="space-y-4">
                  {/* Summary card of attached workspace items */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <h5 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Selected Workspace Sources
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {selectedMeeting ? selectedMeeting.title : 'No Meeting Attached'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {selectedMeeting
                                ? `${selectedMeeting.attendees?.length || 0} participants`
                                : 'Calendar metadata skipped'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveStep('calendar')}
                          className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                        >
                          Change
                        </button>
                      </div>

                      <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 truncate">
                              {selectedDoc ? selectedDoc.name : 'No Doc Attached'}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {selectedDoc ? 'Notes text extracted' : 'Docs text skipped'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setActiveStep('docs')}
                          className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                        >
                          Change
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Title input */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Reflection Session Title
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g. Debrief: Product Strategy Review"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                    />
                  </div>

                  {/* Tags */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Tags</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Add tag (e.g. strategy, 1on1, retro)"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddTag();
                          }
                        }}
                        className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                      />
                      <button
                        type="button"
                        onClick={handleAddTag}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {customTags.map((t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700"
                        >
                          #{t}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(t)}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Personal Opening Observation */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Opening Reflection or Personal Notes{' '}
                      <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      value={personalNotes}
                      onChange={(e) => setPersonalNotes(e.target.value)}
                      placeholder="Add any specific thoughts or questions you want to reflect on (e.g., 'I felt we agreed on deadlines, but team capacity might be tight...')"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none"
                    />
                  </div>

                  {/* Submission buttons */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                    <button
                      onClick={() => setActiveStep('docs')}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting || (!selectedMeeting && !selectedDoc && !personalNotes.trim())}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-xs cursor-pointer transition-all disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Creating Session...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Launch Guided Reflection</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
