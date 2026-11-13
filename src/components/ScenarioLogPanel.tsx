import React, { useState } from 'react';
import { DemoUser, ScenarioLogEntry } from '../types/bus';
import { formatServiceDay } from '../utils/bookingRules';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Play, Pause } from 'lucide-react';

interface ScenarioLogPanelProps {
  log: ScenarioLogEntry[];
  users: DemoUser[];
  dayLabel: string;
  timeStr: string;
  autoplay: boolean;
  onToggleAutoplay: () => void;
}

const KIND_STYLE: Record<ScenarioLogEntry['kind'], { label: string; box: string; text: string }> = {
  success: {
    label: 'Accepted',
    box: 'border-emerald-300 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  reject: {
    label: 'Rejected',
    box: 'border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
  },
  penalty: {
    label: 'Penalty',
    box: 'border-amber-300 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
  },
  info: {
    label: 'Info',
    box: 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900',
    text: 'text-zinc-500 dark:text-zinc-400',
  },
};

/**
 * Scenario log: every rule decision made by the engine, newest first.
 * It sits next to the phone so the cases can be followed while the clock runs.
 */
export const ScenarioLogPanel: React.FC<ScenarioLogPanelProps> = ({
  log,
  users,
  dayLabel,
  timeStr,
  autoplay,
  onToggleAutoplay,
}) => {
  const [showCases, setShowCases] = useState<boolean>(true);
  const personas = users.filter((u) => u.scenario);
  const entries = [...log].reverse();

  return (
    <aside className="w-full max-w-[420px] lg:max-w-md rounded-xl border border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 shadow-xl overflow-hidden flex flex-col text-zinc-900 dark:text-zinc-100" aria-label="Scenario log">
      <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-400 block">
            Scenario log
          </span>
          <span className="text-xs font-bold font-mono">
            {dayLabel} · {timeStr}
          </span>
        </div>
        <button
          onClick={onToggleAutoplay}
          className={`px-2 py-1 rounded-sm text-[10px] font-bold flex items-center gap-1 border transition ${
            autoplay
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
          }`}
          title="When ON, each persona performs its scripted action as the clock passes its time. When OFF, only the automatic deadlines run and you act for the personas yourself."
        >
          {autoplay ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          <span>Persona autoplay: {autoplay ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* Cases legend with live points */}
      <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setShowCases(!showCases)}
          className="w-full flex items-center justify-between text-[10px] font-mono uppercase font-bold text-zinc-500"
        >
          <span>Cases ({personas.length})</span>
          <span>{showCases ? 'Hide' : 'Show'}</span>
        </button>
        {showCases && (
          <ul className="mt-1.5 space-y-1">
            {personas.map((u) => (
              <li key={u.id} className="flex items-start justify-between gap-2 text-[11px] leading-snug">
                <span>
                  <strong className="text-zinc-900 dark:text-white">{u.name.replace(' (Driver)', '')}</strong>
                  <span className="text-zinc-500 dark:text-zinc-400"> · {u.scenario}</span>
                </span>
                {u.role !== 'Driver' && (
                  <span
                    className={`shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded-xs border ${
                      u.isRestricted
                        ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        : u.penaltyPoints > 0
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700'
                    }`}
                    title={u.restrictedOn ? `Restricted on ${formatServiceDay(u.restrictedOn)}` : 'No restriction'}
                  >
                    {u.isRestricted ? 'Restricted today' : `${u.penaltyPoints} pts`}
                    {!u.isRestricted && u.restrictedOn ? ` · restricted ${formatServiceDay(u.restrictedOn)}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Entries, newest first */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[420px] lg:max-h-[640px]">
        {entries.map((entry) => {
          const style = KIND_STYLE[entry.kind];
          return (
            <div key={entry.id} className={`p-2 rounded-sm border text-[11px] leading-snug ${style.box}`}>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className={`flex items-center gap-1 font-mono font-bold text-[10px] uppercase ${style.text}`}>
                  {entry.kind === 'success' && <CheckCircle2 className="w-3 h-3" />}
                  {entry.kind === 'reject' && <AlertTriangle className="w-3 h-3" />}
                  {entry.kind === 'penalty' && <ShieldAlert className="w-3 h-3" />}
                  {entry.kind === 'info' && <Clock className="w-3 h-3" />}
                  <span>
                    {entry.time} · {style.label}
                  </span>
                </span>
                <span className="font-mono text-[9px] text-zinc-400 truncate">{formatServiceDay(entry.day)}</span>
              </div>
              <p className="text-zinc-800 dark:text-zinc-200">
                <strong>{entry.actor}:</strong> {entry.text}
              </p>
              {entry.caseTag && <p className="mt-0.5 font-mono text-[9px] text-zinc-500 dark:text-zinc-400">{entry.caseTag}</p>}
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1.5 border-t border-zinc-200 dark:border-zinc-800 text-[9px] font-mono text-zinc-500 dark:text-zinc-400">
        Simulated clock and location. Rules are enforced by the same engine for scripted and manual actions.
      </div>
    </aside>
  );
};
