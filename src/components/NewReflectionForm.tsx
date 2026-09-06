import React, { useState } from 'react';
import {
  Sparkles,
  FileText,
  Lightbulb,
  Compass,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Quote,
} from 'lucide-react';
import type { ReflectionMode } from '../types';

interface NewReflectionFormProps {
  onSubmit: (title: string, entryText: string, mode: ReflectionMode) => Promise<void>;
  isGenerating: boolean;
  error: string | null;
  onClearError: () => void;
}

const PROMPT_SUGGESTIONS = [
  'What moment or decision stood out the most to me today, and why?',
  'What is currently consuming my mental energy that I need clarity on?',
  'A project or challenge I am tackling, and the hypotheses I want to pressure-test...',
  'What is an unexpected emotion I felt recently, and what might be the trigger?',
];

export const NewReflectionForm: React.FC<NewReflectionFormProps> = ({
  onSubmit,
  isGenerating,
  error,
  onClearError,
}) => {
  const [title, setTitle] = useState('');
  const [entryText, setEntryText] = useState('');
  const [mode, setMode] = useState<ReflectionMode>('reflect');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryText.trim() || isGenerating) return;
    onClearError();
    await onSubmit(title.trim(), entryText.trim(), mode);
    // Note: Do not clear entryText if submission or persistence fails!
    // Parent clears or transitions to active reflection view only upon confirmed success.
  };

  const wordCount = entryText.trim() ? entryText.trim().split(/\s+/).length : 0;

  return (
    <div className="max-w-4xl mx-auto py-6 sm:py-8 px-4 sm:px-8">
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-700 mb-2.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Gemini-Powered Inquiry &amp; Synthesis</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Write a Journal Reflection
        </h2>
        <p className="text-sm text-slate-600 mt-1">
          Capture your unfiltered thoughts. Gemini will review them, synthesize patterns, and provide mindful reflections.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 mt-0.5" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-rose-900">Unable to complete reflection</p>
            <p className="mt-0.5">{error}</p>
            <button
              onClick={handleSubmit}
              disabled={isGenerating}
              className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-rose-800 text-white rounded-lg text-xs font-semibold hover:bg-rose-900 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Retry Reflection
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Bento Mode Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
            Select Reflection Style
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Reflect */}
            <button
              type="button"
              onClick={() => setMode('reflect')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                mode === 'reflect'
                  ? 'border-slate-900 bg-slate-900 text-white shadow-sm ring-1 ring-slate-900/10'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  mode === 'reflect' ? 'bg-slate-800 text-amber-300' : 'bg-slate-100 text-slate-700'
                }`}>
                  <Compass className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">Reflective Inquiry</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${mode === 'reflect' ? 'text-slate-300' : 'text-slate-500'}`}>
                Empathetic review, subtle pattern spotting, and deep inquiry questions.
              </p>
            </button>

            {/* Summarize */}
            <button
              type="button"
              onClick={() => setMode('summarize')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                mode === 'summarize'
                  ? 'border-sky-900 bg-sky-950 text-white shadow-sm ring-1 ring-sky-900/10'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  mode === 'summarize' ? 'bg-sky-900 text-sky-300' : 'bg-slate-100 text-slate-700'
                }`}>
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">Smart Summary</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${mode === 'summarize' ? 'text-sky-200' : 'text-slate-500'}`}>
                Distills core themes, actionable takeaways, and clear perspective.
              </p>
            </button>

            {/* Brainstorm */}
            <button
              type="button"
              onClick={() => setMode('brainstorm')}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                mode === 'brainstorm'
                  ? 'border-amber-900 bg-amber-950 text-amber-50 shadow-sm ring-1 ring-amber-900/10'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 text-slate-800 hover:bg-slate-50/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  mode === 'brainstorm' ? 'bg-amber-900 text-amber-300' : 'bg-slate-100 text-slate-700'
                }`}>
                  <Lightbulb className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold">Brainstorm &amp; Ideate</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${mode === 'brainstorm' ? 'text-amber-200' : 'text-slate-500'}`}>
                Explores creative possibilities, unconsidered angles, and next steps.
              </p>
            </button>
          </div>
        </div>

        {/* Title input */}
        <div>
          <label htmlFor="reflection-title-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Entry Title <span className="text-slate-400 font-normal lowercase">(optional)</span>
          </label>
          <input
            id="reflection-title-input"
            type="text"
            placeholder="E.g., Morning Thoughts on Next Quarter Goals..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isGenerating}
            className="w-full px-3.5 py-2.5 bg-slate-50/60 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-300 focus:border-slate-300 transition-all"
          />
        </div>

        {/* Text Area */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="reflection-entry-textarea" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Journal Content
            </label>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600">
              {wordCount} words &bull; {entryText.length} chars
            </span>
          </div>
          <div className="relative">
            <textarea
              id="reflection-entry-textarea"
              rows={9}
              placeholder="Start typing your reflection or what's on your mind today... (No thoughts are too small or messy)"
              value={entryText}
              onChange={(e) => setEntryText(e.target.value)}
              disabled={isGenerating}
              className="w-full p-4 bg-slate-50/40 border border-slate-200 rounded-2xl text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-300 focus:border-slate-300 font-serif leading-relaxed shadow-2xs resize-y transition-all"
            />
          </div>
        </div>

        {/* Prompt inspirations Bento grid */}
        <div>
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Quote className="w-3.5 h-3.5 text-slate-400" />
            Prompt Starters
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {PROMPT_SUGGESTIONS.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setEntryText((prev) => (prev ? `${prev}\n\n${prompt}` : prompt));
                }}
                className="text-left text-xs text-slate-700 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 transition-all cursor-pointer leading-relaxed hover:border-slate-300"
              >
                &ldquo;{prompt}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            id="submit-reflection-btn"
            type="submit"
            disabled={!entryText.trim() || isGenerating}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-xs cursor-pointer ${
              !entryText.trim() || isGenerating
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-slate-900 hover:bg-slate-800 text-white hover:shadow-sm'
            }`}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                Reflecting with Gemini...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                Save &amp; Converse with Gemini
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
