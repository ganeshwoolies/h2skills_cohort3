import React, { useState } from 'react';
import {
  Compass,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ListTodo,
  HelpCircle,
  Clock,
  RefreshCw,
  Trash2,
  ChevronLeft,
  Share2,
} from 'lucide-react';
import type { ReflectionCompassReport, JournalSession } from '../types';

interface ReflectionCompassViewProps {
  reports: ReflectionCompassReport[];
  sessions: JournalSession[];
  activeReport: ReflectionCompassReport | null;
  onSelectReport: (reportId: string) => void;
  onGenerateReport: (params: {
    title: string;
    periodStart: string;
    periodEnd: string;
  }) => Promise<void>;
  onDeleteReport: (reportId: string) => Promise<void>;
  isGenerating: boolean;
  error: string | null;
  onClearError: () => void;
  onBackToDashboard: () => void;
}

export const ReflectionCompassView: React.FC<ReflectionCompassViewProps> = ({
  reports,
  sessions,
  activeReport,
  onSelectReport,
  onGenerateReport,
  onDeleteReport,
  isGenerating,
  error,
  onClearError,
  onBackToDashboard,
}) => {
  // Date range defaults: past 7 days to today
  const defaultEnd = new Date().toISOString().split('T')[0];
  const defaultStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  const [periodStart, setPeriodStart] = useState(defaultStart);
  const [periodEnd, setPeriodEnd] = useState(defaultEnd);
  const [reportTitle, setReportTitle] = useState('Weekly Reflection Compass');
  const [showGenerateModal, setShowGenerateModal] = useState(!activeReport && reports.length === 0);

  const handlePresetSelect = (days: number) => {
    const end = new Date().toISOString().split('T')[0];
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    setPeriodStart(start);
    setPeriodEnd(end);
    setReportTitle(`${days}-Day Reflection Compass`);
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    onClearError();
    await onGenerateReport({
      title: reportTitle.trim() || 'Weekly Reflection Compass',
      periodStart,
      periodEnd,
    });
    setShowGenerateModal(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this Reflection Compass report?')) {
      await onDeleteReport(id);
    }
  };

  const selectedReport = activeReport || (reports.length > 0 ? reports[0] : null);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="flex items-center gap-3">
          <button
            id="compass-back-btn"
            onClick={onBackToDashboard}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Reflection Compass
              </h1>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                <Compass className="w-3 h-3 text-indigo-600" />
                AI Synthesis
              </span>
            </div>
            <p className="text-xs text-slate-500">
              High-level strategic synthesis across your multi-turn journal conversations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="open-generate-compass-modal-btn"
            onClick={() => setShowGenerateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Generate New Compass</span>
          </button>
        </div>
      </div>

      {/* Generation Panel Modal / Drawer */}
      {showGenerateModal && (
        <div className="p-6 rounded-2xl bg-white border border-indigo-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Compass className="w-4 h-4 text-indigo-600" />
              <span>Configure Reflection Compass Date Window</span>
            </div>
            <button
              onClick={() => setShowGenerateModal(false)}
              className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleGenerateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Report Title
                </label>
                <input
                  id="compass-title-input"
                  type="text"
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date
                </label>
                <input
                  id="compass-start-date-input"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date
                </label>
                <input
                  id="compass-end-date-input"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>
            </div>

            {/* Quick date presets */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 font-medium">Presets:</span>
              <button
                type="button"
                onClick={() => handlePresetSelect(7)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Past 7 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(14)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Past 14 Days
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(30)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                Past 30 Days
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {error}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                id="generate-compass-submit-btn"
                type="submit"
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Gemini is synthesizing sessions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Synthesize Reflection Compass</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column: History of Reports */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Past Reports ({reports.length})
          </h3>

          {reports.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
              No Compass reports generated yet. Click above to synthesize your entries.
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((rep) => {
                const isSelected = selectedReport?.id === rep.id;
                return (
                  <div
                    key={rep.id}
                    id={`compass-list-item-${rep.id}`}
                    onClick={() => onSelectReport(rep.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group ${
                      isSelected
                        ? 'bg-white border-indigo-400 shadow-xs ring-1 ring-indigo-400'
                        : 'bg-white border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                        {rep.title}
                      </h4>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(rep.id);
                        }}
                        className="text-slate-300 hover:text-rose-600 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete report"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                      <span>
                        {new Date(rep.generatedAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                      <span className="text-indigo-600 font-medium">
                        {new Date(rep.periodStart).toLocaleDateString(undefined, {
                          month: 'numeric',
                          day: 'numeric',
                        })}
                        {' - '}
                        {new Date(rep.periodEnd).toLocaleDateString(undefined, {
                          month: 'numeric',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 3 Columns: Active Selected Report (Bento Layout) */}
        <div className="lg:col-span-3 space-y-6">
          {!selectedReport ? (
            <div className="p-16 text-center bg-white rounded-2xl border border-slate-200/90 shadow-xs">
              <Compass className="w-12 h-12 text-indigo-200 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">
                Generate your first Reflection Compass
              </h3>
              <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Gemini reviews your recent sessions across your selected timeframe and synthesizes key themes, accomplishments, challenges, and prioritized next steps.
              </p>
              <button
                id="empty-compass-generate-btn"
                onClick={() => setShowGenerateModal(true)}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Configure &amp; Generate</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Headline Bento Card */}
              <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400 pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Window: {selectedReport.periodStart} to {selectedReport.periodEnd}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      Synthesized on {new Date(selectedReport.generatedAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                    Core Synthesis
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                    "{selectedReport.content?.headline}"
                  </h2>
                </div>
              </div>

              {/* Bento Grid: 2 Columns for Themes & Wins */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Key Themes Card */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <span>Key Themes Identified</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed flex-1">
                    {selectedReport.content?.keyThemes?.map((theme, idx) => (
                      <li
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 font-medium"
                      >
                        {theme}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Wins and Progress Card */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span>Wins &amp; Meaningful Progress</span>
                  </div>

                  <ul className="space-y-2.5 text-xs text-slate-700 leading-relaxed flex-1">
                    {selectedReport.content?.winsAndProgress?.map((win, idx) => (
                      <li
                        key={idx}
                        className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/60 font-medium text-emerald-950"
                      >
                        &bull; {win}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Recurring Challenges Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <span>Recurring Challenges &amp; Tensions</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
                  {selectedReport.content?.recurringChallenges?.map((ch, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-amber-50/40 border border-amber-200/60 text-amber-950 leading-relaxed"
                    >
                      {ch}
                    </div>
                  ))}
                </div>
              </div>

              {/* Prioritized Next Actions Card */}
              <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <ListTodo className="w-4 h-4" />
                  </div>
                  <span>Prioritized Next Actions</span>
                </div>

                <div className="space-y-3">
                  {selectedReport.content?.nextActions?.map((actionItem, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-3.5"
                    >
                      <span className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {actionItem.priority || idx + 1}
                      </span>
                      <div className="text-xs space-y-1">
                        <p className="font-bold text-slate-900 text-sm">{actionItem.action}</p>
                        <p className="text-slate-600 leading-relaxed">{actionItem.rationale}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reflection Questions Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xs">
                <div className="flex items-center gap-2 text-sm font-bold mb-4">
                  <HelpCircle className="w-4 h-4 text-amber-300" />
                  <span>Guiding Questions for Your Next Reflection</span>
                </div>

                <ul className="space-y-2.5 text-xs text-slate-200 leading-relaxed">
                  {selectedReport.content?.reflectionQuestions?.map((q, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl bg-white/10 border border-white/10 font-medium"
                    >
                      &ldquo;{q}&rdquo;
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
