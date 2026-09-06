import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Calendar,
  FileText,
  RefreshCw,
  ArrowRight,
  X,
  Clock,
  Users,
  CheckCircle2,
  Sliders,
  Bell,
  AlertCircle,
} from 'lucide-react';
import type { AutoScanRecommendation, AutoScanResult, CalendarMeeting, DriveDoc } from '../types';
import {
  autoScanRecentNotesAndMeetings,
  fetchGoogleDocContent,
  buildReflectionPrompt,
} from '../lib/workspace';
import {
  getCachedWorkspaceToken,
  ensureWorkspaceAccessToken,
} from '../lib/firebase';

interface AutoScanPromptCardProps {
  existingSessionTitles: string[];
  onImportComplete: (payload: {
    title: string;
    tags: string[];
    initialMessage: string;
  }) => Promise<void>;
  onOpenCustomizer: (meeting: CalendarMeeting | null, doc: DriveDoc | null) => void;
}

export const AutoScanPromptCard: React.FC<AutoScanPromptCardProps> = ({
  existingSessionTitles,
  onImportComplete,
  onOpenCustomizer,
}) => {
  const [hasToken, setHasToken] = useState<boolean>(!!getCachedWorkspaceToken());
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<AutoScanResult | null>(null);
  const [lastScannedTime, setLastScannedTime] = useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isDismissedAll, setIsDismissedAll] = useState(false);
  const [quickDebriefingId, setQuickDebriefingId] = useState<string | null>(null);

  // Scan function
  const runAutoScan = useCallback(async (tokenOverride?: string) => {
    const token = tokenOverride || getCachedWorkspaceToken();
    if (!token) return;

    setIsScanning(true);
    setConnectError(null);
    try {
      const result = await autoScanRecentNotesAndMeetings({
        accessToken: token,
        existingSessionTitles,
        maxRecommendations: 4,
      });

      setScanResult(result);
      setLastScannedTime(new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
    } catch (err: any) {
      console.error('AutoScan execution failed:', err);
      if (err.message === 'AUTH_EXPIRED') {
        setHasToken(false);
        setConnectError('Google Workspace access expired. Reconnect to scan.');
      }
    } finally {
      setIsScanning(false);
    }
  }, [existingSessionTitles]);

  // Trigger auto-scan on mount if token is already present
  useEffect(() => {
    const token = getCachedWorkspaceToken();
    setHasToken(!!token);
    if (token) {
      runAutoScan(token);
    }
  }, [runAutoScan]);

  // Connect Google Workspace
  const handleConnectAndScan = async () => {
    setIsConnecting(true);
    setConnectError(null);
    try {
      const token = await ensureWorkspaceAccessToken();
      setHasToken(true);
      await runAutoScan(token);
    } catch (err: any) {
      console.error('Connect & scan error:', err);
      setConnectError(err?.message || 'Failed to authenticate Google Workspace.');
    } finally {
      setIsConnecting(false);
    }
  };

  // 1-Click Quick Debrief
  const handleQuickDebrief = async (rec: AutoScanRecommendation) => {
    const token = getCachedWorkspaceToken();
    if (!token) return;

    setQuickDebriefingId(rec.id);
    try {
      let docContent: { title: string; text: string } | null = null;
      if (rec.doc) {
        try {
          docContent = await fetchGoogleDocContent(token, rec.doc.id);
        } catch (e) {
          console.warn('Quick debrief doc text load error:', e);
          docContent = { title: rec.doc.name, text: '' };
        }
      }

      const { initialUserMessage, defaultTitle, tags } = buildReflectionPrompt({
        meeting: rec.meeting || null,
        docContent,
      });

      await onImportComplete({
        title: defaultTitle,
        tags,
        initialMessage: initialUserMessage,
      });
    } catch (err) {
      console.error('Failed to run quick debrief:', err);
    } finally {
      setQuickDebriefingId(null);
    }
  };

  // Dismiss item
  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const updated = new Set(prev);
      updated.add(id);
      return updated;
    });
  };

  // Visible recommendations
  const activeRecommendations = (scanResult?.recommendations || []).filter(
    (rec) => !dismissedIds.has(rec.id)
  );

  // CASE 1: Not connected to Google Workspace yet
  if (!hasToken) {
    return (
      <div
        id="autoscan-connect-banner"
        className="p-4 sm:p-5 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-white rounded-2xl border border-blue-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Bell className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900">
                Proactive Meeting & Notes Scanner
              </h4>
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-800 rounded-full">
                Workspace
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-xl leading-relaxed">
              Auto-detect recent meetings and newly edited Google Docs so you never forget to debrief key decisions and next steps.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {connectError && (
            <span className="text-[11px] text-rose-600 truncate max-w-xs">{connectError}</span>
          )}
          <button
            id="autoscan-enable-btn"
            onClick={handleConnectAndScan}
            disabled={isConnecting}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Enable Auto-Scan</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // CASE 2: Dismissed all active recommendations
  if (isDismissedAll) {
    return (
      <div className="px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Auto-Scan is active in the background.</span>
        </span>
        <button
          onClick={() => {
            setIsDismissedAll(false);
            setDismissedIds(new Set());
            runAutoScan();
          }}
          className="text-blue-600 hover:underline font-medium cursor-pointer"
        >
          Check Again
        </button>
      </div>
    );
  }

  // CASE 3: Has token, active scanning in progress
  if (isScanning && !scanResult) {
    return (
      <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl flex items-center justify-between text-xs text-slate-600 animate-pulse">
        <div className="flex items-center gap-2.5">
          <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
          <span>Scanning Google Calendar & Docs for recent activities...</span>
        </div>
      </div>
    );
  }

  // CASE 4: Scanned, but no recent unreviewed meetings/docs found
  if (activeRecommendations.length === 0) {
    return (
      <div className="px-4 py-3 bg-slate-50/80 border border-slate-200/90 rounded-2xl flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-slate-800">All caught up!</span>{' '}
            <span className="text-slate-500 text-[11px]">
              No un-debriefed meetings or notes found in the last 48 hours.
            </span>
          </div>
        </div>

        <button
          onClick={() => runAutoScan()}
          disabled={isScanning}
          className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
          title="Scan now"
        >
          <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
          <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
        </button>
      </div>
    );
  }

  // CASE 5: Found unreviewed meetings / notes! Show action prompt card
  return (
    <div
      id="autoscan-recommendations-card"
      className="p-4 sm:p-5 bg-gradient-to-br from-amber-50/60 via-blue-50/40 to-white rounded-2xl border border-blue-200/90 shadow-sm space-y-3.5 transition-all"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-blue-100/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-2xs">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900">
                Recent Meeting & Notes Ready for Debrief
              </h4>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 rounded-full">
                {activeRecommendations.length} Detected
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Auto-scanned from your Google Workspace{' '}
              {lastScannedTime && `(Scanned at ${lastScannedTime})`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => runAutoScan()}
            disabled={isScanning}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
            title="Re-scan Google Workspace"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsDismissedAll(true)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-white rounded-lg transition-colors cursor-pointer"
            title="Dismiss suggestions"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recommendation Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {activeRecommendations.map((rec) => {
          const isDebriefingThis = quickDebriefingId === rec.id;

          return (
            <div
              key={rec.id}
              className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-3 hover:border-blue-300 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="mt-0.5 w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                    {rec.type === 'doc' ? (
                      <FileText className="w-3.5 h-3.5" />
                    ) : (
                      <Calendar className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <h5 className="text-xs font-semibold text-slate-900 truncate">
                      {rec.title}
                    </h5>
                    <p className="text-[11px] text-slate-500 truncate">{rec.subtitle}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleDismiss(rec.id)}
                  className="text-slate-300 hover:text-slate-500 p-1 rounded-md transition-colors cursor-pointer shrink-0"
                  title="Dismiss this item"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onOpenCustomizer(rec.meeting || null, rec.doc || null)}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <Sliders className="w-3 h-3 text-slate-400" />
                  <span>Customize</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickDebrief(rec)}
                  disabled={isDebriefingThis}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDebriefingThis ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Debriefing...</span>
                    </>
                  ) : (
                    <>
                      <span>Quick Debrief</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
