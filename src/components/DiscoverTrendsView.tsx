import React, { useState, useEffect } from 'react';
import {
  Compass,
  Sparkles,
  BookOpen,
  FileText,
  User,
  Radio,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Search,
  Tag,
  Clock,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import type { DiscoveryRecord, DiscoveryRecommendation } from '../types';
import { apiGetLatestDiscovery, apiTriggerDiscovery, apiGetProgress } from '../lib/api';

interface DiscoverTrendsViewProps {
  onBackToDashboard: () => void;
}

export const DiscoverTrendsView: React.FC<DiscoverTrendsViewProps> = ({
  onBackToDashboard,
}) => {
  const [discoveryRecord, setDiscoveryRecord] = useState<DiscoveryRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedThemes, setSuggestedThemes] = useState<string[]>([]);
  const [customThemesInput, setCustomThemesInput] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [latest, progress] = await Promise.all([
        apiGetLatestDiscovery(),
        apiGetProgress(60).catch(() => null),
      ]);
      setDiscoveryRecord(latest);

      if (progress && progress.themeFrequency.length > 0) {
        setSuggestedThemes(progress.themeFrequency.slice(0, 5).map((t) => t.theme));
      } else {
        setSuggestedThemes(['Mindfulness & Clarity', 'Deep Work & Focus', 'Personal Resilience']);
      }
    } catch (err: any) {
      console.error('Failed to load discovery data:', err);
      setError(err?.message || 'Failed to load recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const handleTriggerDiscover = async (themesToUse?: string[]) => {
    setDiscovering(true);
    setError(null);
    try {
      let themes = themesToUse;
      if (!themes && customThemesInput.trim()) {
        themes = customThemesInput
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean);
      }
      const newRecord = await apiTriggerDiscovery(themes);
      setDiscoveryRecord(newRecord);
    } catch (err: any) {
      console.error('Error discovering content:', err);
      setError(err?.message || 'Failed to discover external resources. Please try again.');
    } finally {
      setDiscovering(false);
    }
  };

  const getIconForType = (type: DiscoveryRecommendation['type']) => {
    switch (type) {
      case 'book':
        return <BookOpen className="w-4 h-4 text-amber-600" />;
      case 'article':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'creator':
        return <User className="w-4 h-4 text-violet-600" />;
      case 'podcast':
        return <Radio className="w-4 h-4 text-emerald-600" />;
    }
  };

  const getBadgeForType = (type: DiscoveryRecommendation['type']) => {
    switch (type) {
      case 'book':
        return 'bg-amber-50 text-amber-800 border-amber-200/80';
      case 'article':
        return 'bg-blue-50 text-blue-800 border-blue-200/80';
      case 'creator':
        return 'bg-violet-50 text-violet-800 border-violet-200/80';
      case 'podcast':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200/80';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200/90">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Compass className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Trends &amp; Thought Leaders
            </h1>
            <p className="text-xs text-slate-500">
              Discover authoritative books, articles, creators, and podcasts matching your journal themes
            </p>
          </div>
        </div>

        <button
          id="btn-discover-resources"
          onClick={() => handleTriggerDiscover()}
          disabled={discovering}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-all cursor-pointer shadow-xs"
        >
          <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${discovering ? 'animate-spin' : ''}`} />
          <span>{discovering ? 'Searching Verified Sources...' : 'Discover Fresh Resources'}</span>
        </button>
      </div>

      {/* Privacy Guard Banner */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900">
              Privacy Protected Search Grounding
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              External discovery only queries high-level abstracted topic keywords using Google Search grounding. Your private journal text, session messages, and user identities are never transmitted outbound.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Suggested & Custom Themes Bar */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
            <Tag className="w-3.5 h-3.5 text-indigo-600" />
            <span>Target Reflection Themes</span>
          </div>
          <span className="text-[11px] text-slate-400">Extracted from your reflections</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {suggestedThemes.map((theme, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleTriggerDiscover([theme])}
              disabled={discovering}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200/80 hover:text-slate-900 transition-all cursor-pointer border border-slate-200/60"
            >
              <span>{theme}</span>
              <Search className="w-3 h-3 text-slate-400" />
            </button>
          ))}
        </div>

        <div className="pt-2 flex items-center gap-2">
          <input
            id="custom-themes-input"
            type="text"
            placeholder="Or enter custom topics, separated by commas (e.g. async leadership, mindfulness, stoicism)..."
            value={customThemesInput}
            onChange={(e) => setCustomThemesInput(e.target.value)}
            className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
          <button
            onClick={() => handleTriggerDiscover()}
            disabled={discovering || !customThemesInput.trim()}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 transition-all cursor-pointer"
          >
            Explore Topics
          </button>
        </div>
      </div>

      {/* Discovery Results */}
      {loading ? (
        <div className="p-16 text-center text-xs text-slate-400 bg-white rounded-2xl border border-slate-200">
          Loading curated resources...
        </div>
      ) : !discoveryRecord || !discoveryRecord.content || discoveryRecord.content.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Lightbulb className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              No External Recommendations Generated Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Click &ldquo;Discover Fresh Resources&rdquo; above to query Gemini with Google Search grounding and surface books, articles, podcasts, and thought leaders curated around your themes.
            </p>
          </div>
          <button
            id="empty-discover-btn"
            onClick={() => handleTriggerDiscover()}
            disabled={discovering}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Discover Resources Now</span>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Metadata banner */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Synthesized {new Date(discoveryRecord.generatedAt).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span>Grounding:</span>
              <span className="font-semibold text-slate-600">Google Search</span>
            </div>
          </div>

          {/* Grouped by Theme */}
          {discoveryRecord.content.map((themeGroup, groupIdx) => (
            <div key={groupIdx} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-200/90 pb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  {themeGroup.theme}
                </h3>
                <span className="text-[11px] text-slate-400 font-medium">
                  ({themeGroup.recommendations.length} recommendations)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {themeGroup.recommendations.map((rec, recIdx) => (
                  <div
                    key={recIdx}
                    className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between space-y-3 hover:border-slate-300 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getBadgeForType(
                            rec.type
                          )}`}
                        >
                          {getIconForType(rec.type)}
                          <span>{rec.type}</span>
                        </span>

                        {rec.sourceName && (
                          <span className="text-[11px] font-medium text-slate-500 truncate max-w-[140px]">
                            {rec.sourceName}
                          </span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                        {rec.title}
                      </h4>

                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                        {rec.description}
                      </p>
                    </div>

                    {rec.url ? (
                      <a
                        href={rec.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-between text-xs font-semibold text-indigo-600 hover:text-indigo-700 pt-2 border-t border-slate-100 group"
                      >
                        <span>Explore Resource</span>
                        <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </a>
                    ) : (
                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400 italic">
                        Verified reference
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
