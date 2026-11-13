import React, { useState } from 'react';
import { DemoUser } from '../types/bus';
import { Search, MoreVertical, RefreshCw, FileText, UserCheck, X, Sun, Moon } from 'lucide-react';

interface TopBarProps {
  currentUser: DemoUser;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onOpenSearch: () => void;
  onSwitchUser: () => void;
  onResetData: () => void;
  onToggleSimulator: () => void;
  onViewScheduleDoc: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentUser,
  theme,
  onToggleTheme,
  onOpenSearch,
  onSwitchUser,
  onResetData,
  onToggleSimulator,
  onViewScheduleDoc,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  return (
    <header className="px-3.5 py-2.5 bg-white/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between sticky top-10 z-20 transition-colors">
      {/* Brand & Search Action */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenSearch}
          className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
          title="Search stops or routes"
          aria-label="Search"
        >
          <Search className="w-3.5 h-3.5" />
        </button>

        <div className="leading-tight">
          <div className="text-xs sm:text-sm font-extrabold tracking-tight text-zinc-900 dark:text-white flex items-center gap-1.5">
            AP-BUS
            <span className="w-1.5 h-1.5 rounded-xs bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
            Smart Transit System
          </div>
        </div>
      </div>

      {/* Right Controls: Theme Toggle, Role indicator, More menu & Profile Avatar */}
      <div className="flex items-center gap-1.5 relative">
        {/* Sun/Moon Theme Toggle */}
        <button
          onClick={onToggleTheme}
          className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-emerald-600" />
          )}
        </button>

        {/* Clean Unboxed Role Indicator */}
        <span className="text-[10px] font-mono font-semibold uppercase px-1.5 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800">
          {currentUser.role}
        </span>

        {/* 3 Dots Menu */}
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 transition"
          title="More options"
          aria-label="More options"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>

        {/* User Profile Avatar with Sharp 6px Border */}
        <button
          onClick={onSwitchUser}
          className="relative group focus:outline-none"
          title={`Signed in as ${currentUser.name} (${currentUser.role}). Click to switch persona.`}
          aria-label="User profile picture"
        >
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-8 h-8 rounded-md object-cover ring-1 ring-emerald-500 hover:ring-emerald-400 transition"
          />
          <div
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-xs border border-white dark:border-zinc-950 ${
              currentUser.isNearStop ? 'bg-emerald-500' : 'bg-zinc-400'
            }`}
          />
        </button>

        {/* Dropdown Menu */}
        {showMoreMenu && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setShowMoreMenu(false)}
            />
            <div className="absolute right-0 top-10 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg py-1.5 z-40 text-xs text-zinc-800 dark:text-zinc-200">
              <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
                <p className="font-semibold text-zinc-900 dark:text-white truncate">{currentUser.name}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                  {currentUser.studentId} · {currentUser.email}
                </p>
                {(currentUser.role === 'Student' || currentUser.role === 'Lecturer' || currentUser.role === 'Staff') && (
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono mt-0.5">
                    Penalties: {currentUser.penaltyPoints}/6 pts ({currentUser.minorPenalties}m, {currentUser.majorPenalties}M)
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onSwitchUser();
                }}
                className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300 transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Switch Demo Persona</span>
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onToggleSimulator();
                }}
                className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300 transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                <span>Simulator & Clock Bar</span>
              </button>

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onViewScheduleDoc();
                }}
                className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300 transition"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>View APU Timetable PDF</span>
              </button>

              <div className="border-t border-zinc-200 dark:border-zinc-800 my-1" />

              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  onResetData();
                }}
                className="w-full px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Demo State (07:45 MYT)</span>
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
};
