import React from 'react';
import {
  Sparkles,
  LogOut,
  ShieldCheck,
  User,
  Compass,
  LayoutDashboard,
  Plus,
  Calendar,
} from 'lucide-react';
import type { AuthUserProfile, ActiveAppView } from '../types';

interface HeaderProps {
  user: AuthUserProfile;
  activeView: ActiveAppView;
  onNavigate: (view: ActiveAppView) => void;
  onSignOut: () => void;
  onNewSession: () => void;
  onImportMeeting?: () => void;
  activeSessionTitle?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  activeView,
  onNavigate,
  onSignOut,
  onNewSession,
  onImportMeeting,
  activeSessionTitle,
}) => {
  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-2.5">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <button
            id="brand-home-btn"
            onClick={() => onNavigate('dashboard')}
            className="flex items-center gap-2.5 text-left cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <Sparkles className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base sm:text-lg text-slate-900 tracking-tight">
                  Personal Gemini Journal
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Isolated
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Private Reflection Workspace &bull; Cloud Run &amp; Firestore
              </p>
            </div>
          </button>
        </div>

        {/* View Switcher Tabs */}
        <nav className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80">
          <button
            id="nav-dashboard-tab"
            onClick={() => onNavigate('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeView === 'dashboard'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          {activeSessionTitle && (
            <button
              id="nav-session-tab"
              onClick={() => onNavigate('session')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer max-w-[160px] truncate ${
                activeView === 'session'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="truncate">{activeSessionTitle}</span>
            </button>
          )}

          <button
            id="nav-compass-tab"
            onClick={() => onNavigate('compass')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeView === 'compass'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-indigo-600" />
            <span>Reflection Compass</span>
          </button>
        </nav>

        {/* Primary Action & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {onImportMeeting && (
            <button
              id="header-import-meeting-btn"
              onClick={onImportMeeting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 transition-all shadow-xs cursor-pointer"
              title="Import Meeting & Notes from Google Calendar/Docs"
            >
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Import Meeting</span>
            </button>
          )}

          <button
            id="header-new-session-btn"
            onClick={onNewSession}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Journal Session</span>
            <span className="sm:hidden">New</span>
          </button>

          {/* User badge */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-8 h-8 rounded-full border border-slate-200 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">
                <User className="w-4 h-4" />
              </div>
            )}
            <div className="hidden xl:block text-left text-xs">
              <p className="font-semibold text-slate-800 leading-tight">
                {user.displayName || 'Journaler'}
              </p>
              <p className="text-slate-400 text-[11px] truncate max-w-[120px]">
                {user.email || ''}
              </p>
            </div>

            <button
              id="header-signout-btn"
              onClick={onSignOut}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="sr-only">Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
