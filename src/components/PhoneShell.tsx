import React, { useState, useEffect } from 'react';
import { Wifi, BatteryMedium, Signal, Smartphone, Monitor, Sun, Moon } from 'lucide-react';

interface PhoneShellProps {
  children: React.ReactNode;
  simulatedTimeStr?: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  sidePanel?: React.ReactNode; // rendered beside the phone on wide screens, below it on narrow ones
}

export const PhoneShell: React.FC<PhoneShellProps> = ({
  children,
  simulatedTimeStr,
  theme,
  onToggleTheme,
  sidePanel,
}) => {
  const [realTime, setRealTime] = useState<string>('');
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);

  // Real-time ticking clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setRealTime(
        now.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'dark' : ''} bg-zinc-100 dark:bg-zinc-950 flex flex-col items-center justify-start sm:p-4 text-zinc-900 dark:text-zinc-100 font-sans selection:bg-emerald-600 selection:text-white transition-colors duration-200`}>
      {/* Top Device View Toggle & Quick Bar */}
      <header className="w-full max-w-md md:max-w-xl flex items-center justify-between px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800/80 mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-xs bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-200 tracking-wide">AP-BUS Live</span>
          <span className="text-[10px] bg-zinc-200/80 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-sm border border-zinc-300 dark:border-zinc-800">
            APU Campus Transit
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Theme Toggle in Shell Header */}
          <button
            onClick={onToggleTheme}
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-800 text-[11px] font-medium transition shadow-xs"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle Color Theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {/* Device Frame Toggle */}
          <button
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="flex items-center gap-1.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-md border border-zinc-300 dark:border-zinc-800 text-[11px] font-medium transition shadow-xs"
            title="Toggle Mobile Frame / Expanded Desktop View"
          >
            {isPhoneFrame ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Expanded</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Phone</span>
              </>
            )}
          </button>
        </div>
      </header>

      <div className="w-full flex flex-col items-center lg:flex-row lg:items-start lg:justify-center gap-4">
      {/* Main Container - Sharp Precision Technical Shell */}
      <div
        className={`w-full transition-all duration-300 ${
          isPhoneFrame
            ? 'max-w-[420px] rounded-xl border border-zinc-300 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-950 relative overflow-hidden flex flex-col my-auto'
            : 'max-w-2xl rounded-lg border border-zinc-300 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg overflow-hidden'
        }`}
        style={{ minHeight: isPhoneFrame ? '844px' : 'auto' }}
      >
        {/* Device Status Bar with Real-Time Clock */}
        <div className="bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800/80 px-4 pt-2.5 pb-2 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 select-none z-30 sticky top-0">
          {/* Clock */}
          <div className="flex items-center gap-1.5 font-mono font-semibold tracking-tight text-zinc-900 dark:text-white text-[12px]">
            <span>{simulatedTimeStr || realTime || '07:30:00 AM'}</span>
            {simulatedTimeStr && (
              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-1 py-0.2 rounded-xs border border-emerald-300 dark:border-emerald-800/40 font-mono uppercase">
                Sim
              </span>
            )}
          </div>

          {/* Minimalist Center Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-200/80 dark:bg-zinc-950 px-2.5 py-0.5 rounded-sm border border-zinc-300 dark:border-zinc-800 text-[10px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-700 dark:text-zinc-300 font-bold">AP-BUS</span>
          </div>

          {/* Mobile Status Indicators */}
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
            <Signal className="w-3.5 h-3.5" />
            <Wifi className="w-3.5 h-3.5" />
            <div className="flex items-center gap-1 text-[11px] font-mono text-zinc-700 dark:text-zinc-300">
              <span>98%</span>
              <BatteryMedium className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative pb-4 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
          {children}
        </div>

        {/* Home Indicator */}
        {isPhoneFrame && (
          <div className="w-full flex justify-center py-2 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-100 dark:border-zinc-900">
            <div className="w-28 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
          </div>
        )}
      </div>
      {sidePanel}
      </div>
    </div>
  );
};
