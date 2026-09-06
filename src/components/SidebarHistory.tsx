import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Trash2,
  Calendar,
  Sparkles,
  Layers,
  Lightbulb,
  FileText,
  Clock,
} from 'lucide-react';
import type { JournalEntry, ReflectionMode } from '../types';

interface SidebarHistoryProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
  onDeleteEntry: (id: string, e: React.MouseEvent) => void;
  onNewReflection: () => void;
  isLoading: boolean;
}

export const SidebarHistory: React.FC<SidebarHistoryProps> = ({
  entries,
  activeEntryId,
  onSelectEntry,
  onDeleteEntry,
  onNewReflection,
  isLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | ReflectionMode>('all');
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchesMode = filterMode === 'all' || entry.mode === filterMode;
      const term = searchTerm.toLowerCase().trim();
      if (!term) return matchesMode;

      const titleMatch = entry.title?.toLowerCase().includes(term);
      const contentMatch = entry.entryText?.toLowerCase().includes(term);
      const conversationMatch = entry.conversation?.some((m) =>
        m.content.toLowerCase().includes(term)
      );

      return matchesMode && (titleMatch || contentMatch || conversationMatch);
    });
  }, [entries, filterMode, searchTerm]);

  const getModeBadge = (mode: ReflectionMode) => {
    switch (mode) {
      case 'summarize':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200/80">
            <FileText className="w-3 h-3 text-sky-600" />
            Summary
          </span>
        );
      case 'brainstorm':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80">
            <Lightbulb className="w-3 h-3 text-amber-600" />
            Brainstorm
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
            <Sparkles className="w-3 h-3 text-slate-500" />
            Reflect
          </span>
        );
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return 'Recently';
    }
  };

  return (
    <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 flex flex-col md:h-[calc(100vh-85px)] border border-slate-200/90 bg-white md:rounded-2xl shadow-xs overflow-hidden">
      {/* Top action & Search */}
      <div className="p-3.5 border-b border-slate-200/80 space-y-2.5 bg-white flex-shrink-0">
        <button
          id="sidebar-new-entry-btn"
          onClick={onNewReflection}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          Draft New Reflection
        </button>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="history-search-input"
            type="text"
            placeholder="Search past reflections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8.5 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition-all"
          />
        </div>

        {/* Bento Segmented Filter Chips */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-xs">
          {(['all', 'reflect', 'summarize', 'brainstorm'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`py-1 px-1.5 rounded-lg text-[11px] font-medium text-center capitalize transition-all cursor-pointer ${
                filterMode === mode
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {mode === 'brainstorm' ? 'Idea' : mode}
            </button>
          ))}
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2 bg-[#FAFAFA]/50">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 text-xs">
            <Clock className="w-5 h-5 animate-spin mb-2 text-slate-400" />
            Loading reflections from Firestore...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-center px-4">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
              <BookOpen className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-slate-700">No reflections found</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
              {searchTerm
                ? 'Try a different search keyword or filter.'
                : 'Write your thoughts to begin exploring reflections with Gemini.'}
            </p>
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isActive = activeEntryId === entry.id;
            const turnCount = entry.conversation?.length || 0;
            const isDeleting = entryToDelete === entry.id;

            return (
              <div
                key={entry.id}
                id={`entry-card-${entry.id}`}
                onClick={() => onSelectEntry(entry)}
                className={`group relative p-3 rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white border-slate-900 shadow-xs ring-1 ring-slate-900/10'
                    : 'bg-white hover:bg-white border-slate-200/90 hover:border-slate-300 shadow-2xs hover:shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-xs font-semibold text-slate-900 line-clamp-1 leading-snug">
                    {entry.title || 'Untitled Reflection'}
                  </h3>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {getModeBadge(entry.mode)}
                    <button
                      id={`delete-entry-btn-${entry.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isDeleting) {
                          onDeleteEntry(entry.id, e);
                          setEntryToDelete(null);
                        } else {
                          setEntryToDelete(entry.id);
                        }
                      }}
                      title={isDeleting ? 'Click again to confirm delete' : 'Delete reflection'}
                      className={`p-1 rounded-md transition-colors ${
                        isDeleting
                          ? 'bg-rose-100 text-rose-700'
                          : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {isDeleting && (
                  <div className="mb-2 p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-center justify-between">
                    <span>Delete permanently?</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEntryToDelete(null);
                      }}
                      className="underline font-semibold ml-2 text-rose-800"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed mb-2 font-serif">
                  {entry.entryText}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-100 pt-2 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {formatDate(entry.updatedAt || entry.createdAt)}
                  </span>
                  <span className="flex items-center gap-1 font-mono text-slate-500">
                    <Layers className="w-3 h-3 text-slate-400" />
                    {turnCount} turn{turnCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer / Database stats Bento pill */}
      <div className="p-3 border-t border-slate-200 text-[11px] text-slate-500 bg-white flex items-center justify-between flex-shrink-0">
        <span className="font-medium text-slate-700">{entries.length} Saved Reflections</span>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600">
          Cloud Firestore
        </span>
      </div>
    </aside>
  );
};
