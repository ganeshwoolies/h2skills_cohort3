import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Flame,
  Award,
  Calendar,
  Sparkles,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  RefreshCw,
  Layers,
  ArrowUpRight,
} from 'lucide-react';
import type { ProgressSnapshot } from '../types';
import { apiGetProgress } from '../lib/api';

interface ProgressTrendsViewProps {
  onBackToDashboard: () => void;
}

export const ProgressTrendsView: React.FC<ProgressTrendsViewProps> = ({
  onBackToDashboard,
}) => {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = async (days: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGetProgress(days);
      setSnapshot(data);
    } catch (err: any) {
      console.error('Failed to load progress trends:', err);
      setError(err?.message || 'Failed to calculate progress trends.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProgress(rangeDays);
  }, [rangeDays]);

  const streak = snapshot?.streak || { currentStreak: 0, longestStreak: 0, activeDays: [] };
  const maxThemeCount = snapshot?.themeFrequency?.[0]?.count || 1;
  const maxWeekCount = Math.max(...(snapshot?.activityByWeek?.map((w) => w.count) || [1]), 1);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Header & Range Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Progress &amp; Consistency Trends
            </h1>
            <p className="text-xs text-slate-500">
              Analytical synthesis of your journaling frequency, recurring themes, and challenges
            </p>
          </div>
        </div>

        {/* Range Buttons */}
        <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              id={`progress-range-${days}`}
              onClick={() => setRangeDays(days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                rangeDays === days
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Past {days} Days
            </button>
          ))}

          <button
            onClick={() => fetchProgress(rangeDays)}
            disabled={loading}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-lg transition-colors cursor-pointer ml-1"
            title="Refresh trends"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Top Level Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Streak */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Current Streak
            </span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {streak.currentStreak}{' '}
              <span className="text-sm font-semibold text-slate-400">days</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Consecutive days reflecting
            </p>
          </div>
        </div>

        {/* Longest Streak */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Best Streak
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {streak.longestStreak}{' '}
              <span className="text-sm font-semibold text-slate-400">days</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Personal all-time record
            </p>
          </div>
        </div>

        {/* Total Sessions */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Sessions
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {snapshot?.totalSessions || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              In the past {rangeDays} days
            </p>
          </div>
        </div>

        {/* Total Compass Syntheses */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Compass Syntheses
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              {snapshot?.totalReports || 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Deep periodic reviews
            </p>
          </div>
        </div>
      </div>

      {/* Grid: 2 Columns for Themes & Weekly Cadence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recurring Themes Distribution */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Top Thematic Focus Areas
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Frequency</span>
          </div>

          {!snapshot?.themeFrequency || snapshot.themeFrequency.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
              No themes tagged or synthesized yet in this window.
            </div>
          ) : (
            <div className="space-y-3">
              {snapshot.themeFrequency.slice(0, 7).map((item, idx) => {
                const percentage = Math.round((item.count / maxThemeCount) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{item.theme}</span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        {item.count} {item.count === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(percentage, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Weekly Activity Cadence */}
        <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Weekly Journal Cadence
              </h3>
            </div>

            {!snapshot?.activityByWeek || snapshot.activityByWeek.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No session activity recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {snapshot.activityByWeek.map((week, idx) => {
                  const percentage = Math.round((week.count / maxWeekCount) * 100);
                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-700 font-medium">{week.week}</span>
                        <span className="text-slate-900 font-bold">{week.count} sessions</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(percentage, week.count > 0 ? 10 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Aggregated across {rangeDays} days</span>
            <span className="font-semibold text-emerald-600">
              {streak.activeDays.length} active reflection days
            </span>
          </div>
        </div>
      </div>

      {/* Recurring Challenges & Growth Areas */}
      <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Synthesized Recurring Challenges &amp; Friction Points
          </h3>
        </div>

        {!snapshot?.recurringChallenges || snapshot.recurringChallenges.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            No recurring challenges flagged in your recent Reflection Compass reports. Keep reflecting!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {snapshot.recurringChallenges.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs flex items-start gap-2.5"
              >
                <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800 leading-snug">
                    {item.challenge}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Occurred in {item.occurrences} {item.occurrences === 1 ? 'report' : 'reports'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
