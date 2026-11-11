import React, { useState } from 'react';
import { APU_STOPS } from '../data/apuRoutes';
import { BusStop } from '../types/bus';
import { Search, MapPin, X, ArrowRight, Bus } from 'lucide-react';

interface SearchModalProps {
  onSelectRoute: (fromStop: BusStop, toStop: BusStop) => void;
  onOpenBooking: () => void;
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({
  onSelectRoute,
  onOpenBooking,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const apuStop = APU_STOPS.find((s) => s.id === 'apu') || APU_STOPS[0];

  const matchedStops = APU_STOPS.filter(
    (s) =>
      s.name.toLowerCase().includes(query.toLowerCase()) ||
      s.shortCode.toLowerCase().includes(query.toLowerCase()) ||
      s.address.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-3 pt-14 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl overflow-hidden flex flex-col max-h-[80vh] transition-colors">
        {/* Search Input Bar */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950/70">
          <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ml-1" />
          <input
            type="text"
            placeholder="Search stops, routes, residences (e.g. LRT, Fortune Park, M Vertica)..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="flex-1 bg-transparent border-none text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex items-center justify-between text-xs">
          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Quick Actions:</span>
          <button
            onClick={() => {
              onClose();
              onOpenBooking();
            }}
            className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 text-[11px]"
          >
            <Bus className="w-3.5 h-3.5" /> View Full Timetable
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-2 divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {matchedStops.map((stop) => (
            <div
              key={stop.id}
              className="p-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 rounded-md transition flex items-center justify-between group"
            >
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-600 dark:text-zinc-300 shrink-0 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-zinc-900 dark:text-white">{stop.name}</span>
                    <span className="text-[9px] font-mono px-1 py-0.5 rounded-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                      {stop.shortCode}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate max-w-xs">{stop.address}</p>
                </div>
              </div>

              {stop.id !== 'apu' && (
                <button
                  onClick={() => {
                    onSelectRoute(stop, apuStop);
                    onClose();
                  }}
                  className="px-2.5 py-1 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition flex items-center gap-1 shrink-0 shadow-2xs"
                >
                  <span>Route to APU</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
