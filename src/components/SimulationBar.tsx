import React from 'react';
import { DemoUser } from '../types/bus';
import {
  Clock,
  Play,
  Pause,
  FastForward,
  MapPin,
  Zap,
  RotateCcw,
  Bus,
} from 'lucide-react';

interface SimulationBarProps {
  simulatedTimeStr: string;
  isAutoTickRunning: boolean;
  tickSpeed: number; // 1, 5, 10
  onToggleAutoTick: () => void;
  onSetTickSpeed: (speed: number) => void;
  onSetTime: (timeStr: string) => void;
  currentUser: DemoUser;
  onToggleUserLocation: () => void;
  onOpenDriverConsole?: () => void;
  onResetDemo: () => void;
}

export const SimulationBar: React.FC<SimulationBarProps> = ({
  simulatedTimeStr,
  isAutoTickRunning,
  tickSpeed,
  onToggleAutoTick,
  onSetTickSpeed,
  onSetTime,
  currentUser,
  onToggleUserLocation,
  onOpenDriverConsole,
  onResetDemo,
}) => {
  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 p-2.5 text-xs space-y-2 transition-colors">
      {/* Header: Auto-Tick Engine & Clock Controls */}
      <div className="flex items-center justify-between text-[11px] text-zinc-700 dark:text-zinc-300 font-semibold">
        <div className="flex items-center gap-1.5 font-mono">
          <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-zinc-900 dark:text-white uppercase tracking-wider text-[10px]">
            Auto-Tick Engine
          </span>
          {isAutoTickRunning && (
            <span className="inline-flex items-center gap-1 text-[9px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/40 px-1 py-0.2 rounded-xs">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              RUNNING ({tickSpeed}x)
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onToggleAutoTick}
            className={`px-2 py-0.5 rounded-sm text-[10px] font-bold flex items-center gap-1 transition ${
              isAutoTickRunning
                ? 'bg-zinc-800 dark:bg-zinc-800 text-white hover:bg-zinc-700'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
            title="Toggle Continuous Auto-Tick Timer"
          >
            {isAutoTickRunning ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            <span>{isAutoTickRunning ? 'Pause' : 'Auto-Tick'}</span>
          </button>

          {isAutoTickRunning && (
            <button
              onClick={() => onSetTickSpeed(tickSpeed === 1 ? 5 : tickSpeed === 5 ? 10 : 1)}
              className="px-1.5 py-0.5 rounded-sm bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[10px] font-mono font-bold flex items-center gap-0.5"
              title="Cycle Speed (1x, 5x, 10x)"
            >
              <FastForward className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" /> {tickSpeed}x
            </button>
          )}
        </div>
      </div>

      {/* Scenario 19.2 Milestone Quick-Jumps: Sharp 6px Rectangles */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
          <span>HACKATHON MILESTONES:</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-bold">MYT: {simulatedTimeStr}</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { label: '07:45 (Start)', value: '07:45', desc: 'Sarah Chk-In, Ryan Hold' },
            { label: '07:50 (T-10 Expiry)', value: '07:50', desc: 'Ryan Expired, Seat Freed' },
            { label: '07:57 (T-3 Cutoff)', value: '07:57', desc: 'FCFS Claim Closes' },
            { label: '08:00 (Boarding Close)', value: '08:00', desc: 'Departure & No-Show' },
            { label: '06:00 (Day Open)', value: '06:00', desc: 'Daily Window Opens' },
          ].map((milestone) => (
            <button
              key={milestone.value}
              onClick={() => onSetTime(milestone.value)}
              className={`px-2 py-1 rounded-sm text-[10px] font-mono whitespace-nowrap transition flex flex-col text-left border ${
                simulatedTimeStr === milestone.value
                  ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-2xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50'
              }`}
            >
              <span>{milestone.label}</span>
              <span className={`text-[8px] font-sans font-normal ${simulatedTimeStr === milestone.value ? 'text-emerald-100' : 'text-zinc-400'}`}>
                {milestone.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Controls: Location, Driver Console & Reset (Sharp 6px buttons) */}
      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onToggleUserLocation}
          className={`px-2 py-1 rounded-sm border flex items-center justify-center gap-1 text-[10px] font-semibold transition ${
            currentUser.isNearStop
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
              : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
          title="Toggle between in-range and out-of-range location"
        >
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{currentUser.isNearStop ? 'GPS: In Range (30m)' : 'GPS: Out (~9km)'}</span>
        </button>

        <button
          onClick={onOpenDriverConsole}
          className="px-2 py-1 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 text-zinc-800 dark:text-zinc-200 flex items-center justify-center gap-1 text-[10px] font-semibold transition"
          title="Open Bus Staff Driver Console"
        >
          <Bus className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Driver Console</span>
        </button>

        <button
          onClick={onResetDemo}
          className="px-2 py-1 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-1 text-[10px] font-semibold transition"
          title="Reset scenario to 07:45 conditions"
        >
          <RotateCcw className="w-3 h-3 shrink-0" />
          <span>Reset Demo</span>
        </button>
      </div>
    </div>
  );
};
