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
} from 'lucide-react';

const SPEED_OPTIONS = [0.25, 0.5, 1, 5, 10] as const;

function formatSpeed(speed: number): string {
  return speed === 0.5 ? '0.50x' : `${speed}x`;
}

function formatTickInterval(speed: number): string {
  const secs = 1 / speed;
  return Number.isInteger(secs) ? `1m / ${secs}s` : `1m / ${secs.toFixed(1)}s`;
}

interface SimulationBarProps {
  simulatedTimeStr: string;
  isAutoTickRunning: boolean;
  tickSpeed: number; // 0.25, 0.5, 1, 5, 10
  onToggleAutoTick: () => void;
  onSetTickSpeed: (speed: number) => void;
  onSetTime: (timeStr: string) => void;
  currentUser: DemoUser;
  onToggleUserLocation: () => void;
  onResetDemo: () => void;
  dayLabel?: string; // e.g. "Fri 13 Nov"
  onNextServiceDay?: () => void;
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
  onResetDemo,
  dayLabel,
  onNextServiceDay,
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
              RUNNING ({formatSpeed(tickSpeed)})
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
        </div>
      </div>

      {/* Auto-Tick Speed Selector (0.25x, 0.50x, 1x, 5x, 10x) */}
      <div className="flex items-center justify-between gap-2 font-mono">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mr-0.5">SPEED:</span>
          {SPEED_OPTIONS.map((speed) => {
            const active = tickSpeed === speed;
            return (
              <button
                key={speed}
                type="button"
                onClick={() => onSetTickSpeed(speed)}
                aria-pressed={active}
                className={`px-1.5 py-0.5 rounded-sm text-[10px] font-bold transition border ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/50'
                }`}
                title={`Set Auto-Tick speed to ${formatSpeed(speed)} (${formatTickInterval(speed)})`}
              >
                {formatSpeed(speed)}
              </button>
            );
          })}
        </div>
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
          {formatTickInterval(tickSpeed)}
        </span>
      </div>

      {/* Scenario 19.2 Milestone Quick-Jumps: Sharp 6px Rectangles */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
          <span>JUMP TO:</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-bold">{dayLabel ? `${dayLabel} · ` : ''}MYT {simulatedTimeStr}</span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
          {[
            { label: '07:50 (T-10)', value: '07:50', desc: 'Budi expires · Dimas rejected' },
            { label: '07:51 (Claim)', value: '07:51', desc: 'Citra claims the seat' },
            { label: '08:00 (Arrived)', value: '08:00', desc: 'QR scans · Fajar hits 6 pts' },
            { label: '08:02 (Depart)', value: '08:02', desc: 'Eka no-show · +2' },
            { label: '08:12 (08:10 left)', value: '08:12', desc: 'Manual boarding logged' },
            { label: '08:22 (Done)', value: '08:22', desc: 'All day-1 cases shown' },
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

      {/* Controls: Location, Reset & Next Service Day (Sharp 6px buttons) */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onToggleUserLocation}
          className={`col-span-2 px-2 py-1 rounded-sm border flex items-center justify-center gap-1 text-[10px] font-semibold transition ${
            currentUser.isNearStop
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
              : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
          }`}
          title="Toggle between in-range and out-of-range location"
        >
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{currentUser.isNearStop ? 'Location: At stop (30m)' : 'Location: Away (~11km)'}</span>
        </button>

        <button
          onClick={onResetDemo}
          className="px-2 py-1 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center gap-1 text-[10px] font-semibold transition"
          title="Reset scenario to 07:45 conditions"
        >
          <RotateCcw className="w-3 h-3 shrink-0" />
          <span>Reset Demo</span>
        </button>

        {onNextServiceDay && (
          <button
            onClick={onNextServiceDay}
            className="px-2 py-1 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1 text-[10px] font-bold transition"
            title="Start the next service day (Mon-Fri). Bookings start fresh, penalty points carry over, so a one-day restriction can be seen starting and ending."
          >
            <FastForward className="w-3 h-3 shrink-0" />
            <span>Next service day</span>
          </button>
        )}
      </div>
    </div>
  );
};
