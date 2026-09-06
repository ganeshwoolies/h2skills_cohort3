import React, { useState } from 'react';
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Compass,
  ArrowRight,
  AlertCircle,
  BookOpen,
  FileCheck2,
  Cpu,
} from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => Promise<void>;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignIn }) => {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleSignInClick = async () => {
    try {
      setIsSigningIn(true);
      setAuthError(null);
      await onSignIn();
    } catch (err: any) {
      console.error('Sign-in error:', err);
      if (err?.code === 'auth/popup-blocked') {
        setAuthError('Sign-in popup was blocked by your browser. Please allow popups for this site and try again.');
      } else if (err?.code === 'auth/popup-closed-by-user') {
        setAuthError('Sign-in popup was closed before completing authentication.');
      } else {
        setAuthError(err?.message || 'Failed to authenticate with Google. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-slate-900 flex flex-col justify-between">
      {/* Navigation / Header */}
      <header className="border-b border-slate-200/80 px-6 py-3.5 bg-white/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
              Personal Gemini Journal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="landing-signin-nav-btn"
              onClick={handleSignInClick}
              disabled={isSigningIn}
              className="px-4 py-2 text-xs font-semibold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200/80 rounded-xl transition-all border border-slate-200 cursor-pointer"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 md:py-16 flex flex-col items-center text-center justify-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium mb-6">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Cloud Run &bull; Owner-Bound Firestore &bull; Gemini 3.6 Flash</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 max-w-3xl leading-[1.15]">
          A private sanctuary for deep reflection and mindful conversation.
        </h1>

        <p className="mt-5 text-slate-600 text-sm sm:text-base md:text-lg max-w-2xl font-normal leading-relaxed">
          Hold multi-turn reflective conversations with Gemini, generate instant structured summaries, and synthesize weekly milestones into your personal <strong>Reflection Compass</strong>.
        </p>

        {/* Mandatory One-line Security Statement */}
        <div className="mt-4 px-4 py-2 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs text-slate-600 max-w-xl flex items-center gap-2 text-left">
          <Lock className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
          <span>
            <strong>Privacy Guarantee:</strong> Journal content is strictly isolated to your private account, and Gemini API keys never reach the browser.
          </span>
        </div>

        {/* Authentication Callout & Button */}
        <div className="mt-7 flex flex-col items-center gap-3 w-full max-w-md">
          {authError && (
            <div className="w-full p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs text-left flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Authentication Notice</p>
                <p className="mt-0.5">{authError}</p>
              </div>
            </div>
          )}

          <button
            id="google-signin-primary-btn"
            onClick={handleSignInClick}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-2xl text-sm font-semibold text-slate-900 bg-white hover:bg-slate-50 border border-slate-300/90 transition-all shadow-xs hover:shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-slate-800 border-t-transparent rounded-full animate-spin" />
                <span>Connecting with Google...</span>
              </div>
            ) : (
              <>
                {/* Google Icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.35 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </>
            )}
          </button>

          <p className="text-xs text-slate-500">
            Google Sign-In only &bull; No passwords stored or handled
          </p>
        </div>

        {/* Bento Feature Grid */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 text-left w-full">
          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-sm transition-all">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 mb-3.5">
              <BookOpen className="w-4 h-4 text-slate-700" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Multi-Turn Journal Conversations
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Express complex thoughts in a calm interface. Converse with Gemini to explore perspectives, refine priorities, and uncover blind spots with context continuity.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-sm transition-all">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 mb-3.5">
              <Compass className="w-4 h-4 text-slate-700" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Weekly Reflection Compass
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Synthesize past journal sessions over any date window into clear weekly themes, recognized milestones, recurring challenges, and prioritized next actions.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:shadow-sm transition-all">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-800 mb-3.5">
              <FileCheck2 className="w-4 h-4 text-slate-700" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              Server-Authoritative Security
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Direct client writes are locked in Firestore rules (<code className="text-[11px] font-mono bg-slate-100 px-1 py-0.5 rounded">allow write: if false;</code>). All writes use server timestamps and sequence transactions.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-5 px-6 text-center text-xs text-slate-500 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>&copy; {new Date().getFullYear()} Personal Gemini Journal. All rights reserved.</span>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Lock className="w-3 h-3 text-slate-400" />
            Zero-Client-Secrets Architecture
          </span>
        </div>
      </footer>
    </div>
  );
};
