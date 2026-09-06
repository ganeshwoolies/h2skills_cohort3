import React from 'react';
import {
  X,
  Compass,
  Calendar,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { SharedReportView } from '../types';

interface SharedReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: SharedReportView | null;
}

export const SharedReportModal: React.FC<SharedReportModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  if (!isOpen || !report) return null;

  const { content } = report;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-slate-50 rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Top Header */}
        <div className="bg-white border-b border-slate-200/90 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                  {report.reportTitle}
                </h3>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3 text-indigo-600" />
                  Read-Only Share
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3 text-slate-400" />
                <span>Shared by <strong>{report.ownerDisplayName}</strong></span>
              </p>
            </div>
          </div>

          <button
            id="shared-report-close-btn"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Report Content */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
          {/* Headline Bento Card */}
          <div className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-400 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Period: {report.periodStart} to {report.periodEnd}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Generated {new Date(report.generatedAt).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                Core Synthesis
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 leading-snug">
                "{content.headline}"
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

              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed flex-1">
                {content.keyThemes?.map((theme, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>{theme}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Wins & Progress Card */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>Wins &amp; Progress Achieved</span>
              </div>

              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed flex-1">
                {content.winsAndProgress?.map((win, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>{win}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Recurring Challenges */}
          {content.recurringChallenges && content.recurringChallenges.length > 0 && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4">
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <span>Recurring Challenges &amp; Friction Points</span>
              </div>

              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                {content.recurringChallenges.map((ch, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span>{ch}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prioritized Next Actions */}
          {content.nextActions && content.nextActions.length > 0 && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <span>Prioritized Next Actions</span>
              </div>

              <div className="space-y-3">
                {content.nextActions.map((item, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs flex items-start gap-3"
                  >
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                      {item.priority || i + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900 leading-snug">
                        {item.action}
                      </p>
                      {item.rationale && (
                        <p className="text-slate-500 text-[11px] mt-1">
                          {item.rationale}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reflection Questions */}
          {content.reflectionQuestions && content.reflectionQuestions.length > 0 && (
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-4">
                <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <span>Reflection Questions</span>
              </div>

              <ul className="space-y-2 text-xs text-slate-700 leading-relaxed">
                {content.reflectionQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 italic">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                    <span>"{q}"</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
