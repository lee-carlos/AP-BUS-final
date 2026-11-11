import React, { useState } from 'react';
import { APU_STOPS } from '../data/apuRoutes';
import { BusStop } from '../types/bus';
import { ArrowUpDown, MapPin, Navigation, X, Check, Search } from 'lucide-react';

interface RouteFilterProps {
  selectedFrom: BusStop | null;
  selectedTo: BusStop | null;
  onSelectFrom: (stop: BusStop | null) => void;
  onSelectTo: (stop: BusStop | null) => void;
  onSwap: () => void;
}

export const RouteFilter: React.FC<RouteFilterProps> = ({
  selectedFrom,
  selectedTo,
  onSelectFrom,
  onSelectTo,
  onSwap,
}) => {
  const [openSelect, setOpenSelect] = useState<'from' | 'to' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStops = APU_STOPS.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.shortCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (stop: BusStop) => {
    if (openSelect === 'from') {
      onSelectFrom(stop);
      if (!selectedTo && stop.id !== 'apu') {
        const apu = APU_STOPS.find((s) => s.id === 'apu') || null;
        onSelectTo(apu);
      }
    } else if (openSelect === 'to') {
      onSelectTo(stop);
    }
    setOpenSelect(null);
    setSearchQuery('');
  };

  const isFiltered = Boolean(selectedFrom && selectedTo);

  return (
    <div className="px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 transition-colors">
      <div className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-2.5 shadow-2xs">
        {/* FROM INPUT */}
        <div className="relative flex items-center">
          <div className="w-7 h-7 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/60 flex items-center justify-center text-zinc-600 dark:text-zinc-400 shrink-0">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <button
            type="button"
            onClick={() => {
              setOpenSelect(openSelect === 'from' ? null : 'from');
              setSearchQuery('');
            }}
            className="flex-1 text-left px-2.5 py-1 text-xs truncate focus:outline-none"
          >
            <span className="block text-[9px] uppercase font-mono text-zinc-500 dark:text-zinc-400 font-semibold tracking-wider">
              From (Departure)
            </span>
            <span
              className={`block font-medium truncate text-xs ${
                selectedFrom ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {selectedFrom ? selectedFrom.name : 'Select departure point...'}
            </span>
          </button>
          {selectedFrom && (
            <button
              onClick={() => onSelectFrom(null)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="Clear From"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* SWAP DIVIDER & BUTTON */}
        <div className="relative flex items-center justify-center my-1 z-10">
          <div className="absolute left-3 right-3 h-px bg-zinc-200 dark:bg-zinc-800" />
          <button
            type="button"
            onClick={onSwap}
            disabled={!selectedFrom && !selectedTo}
            className="relative z-10 w-6 h-6 rounded-md bg-white dark:bg-zinc-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center transition shadow-2xs active:scale-95 disabled:opacity-40"
            title="Swap departure and destination"
            aria-label="Reverse location searched"
          >
            <ArrowUpDown className="w-3 h-3" />
          </button>
        </div>

        {/* TO INPUT */}
        <div className="relative flex items-center">
          <div className="w-7 h-7 rounded-sm bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Navigation className="w-3.5 h-3.5" />
          </div>
          <button
            type="button"
            onClick={() => {
              setOpenSelect(openSelect === 'to' ? null : 'to');
              setSearchQuery('');
            }}
            className="flex-1 text-left px-2.5 py-1 text-xs truncate focus:outline-none"
          >
            <span className="block text-[9px] uppercase font-mono text-zinc-500 dark:text-zinc-400 font-semibold tracking-wider">
              To (Destination)
            </span>
            <span
              className={`block font-medium truncate text-xs ${
                selectedTo ? 'text-zinc-900 dark:text-white' : 'text-zinc-400 dark:text-zinc-500'
              }`}
            >
              {selectedTo ? selectedTo.name : 'Select destination...'}
            </span>
          </button>
          {selectedTo && (
            <button
              onClick={() => onSelectTo(null)}
              className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-sm text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="Clear To"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Status Line */}
        <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px]">
          <span>
            {isFiltered ? (
              <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                <Check className="w-3 h-3" /> Live GPS tracking active
              </span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">
                Choose route to filter schedules & tracking
              </span>
            )}
          </span>
          {isFiltered && (
            <button
              onClick={() => {
                onSelectFrom(null);
                onSelectTo(null);
              }}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white underline"
            >
              Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Modal for Stop Selection */}
      {openSelect && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl max-h-[80vh] flex flex-col overflow-hidden">
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white text-xs">
                  Select {openSelect === 'from' ? 'Departure Location' : 'Destination'}
                </h3>
                <p className="text-[10px] text-zinc-500">14 official APU transit stops</p>
              </div>
              <button
                onClick={() => setOpenSelect(null)}
                className="w-7 h-7 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick search */}
            <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Type stop name (e.g. LRT, M Vertica)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Stops list */}
            <div className="flex-1 overflow-y-auto p-1 divide-y divide-zinc-100 dark:divide-zinc-800/60 text-xs">
              {filteredStops.map((stop) => {
                const isCurrent =
                  (openSelect === 'from' && selectedFrom?.id === stop.id) ||
                  (openSelect === 'to' && selectedTo?.id === stop.id);
                return (
                  <button
                    key={stop.id}
                    onClick={() => handleSelect(stop)}
                    className={`w-full text-left p-2.5 rounded-sm flex items-center justify-between hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition ${
                      isCurrent
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-semibold'
                        : 'text-zinc-700 dark:text-zinc-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{stop.name}</span>
                        <span className="text-[9px] font-mono px-1 rounded-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                          {stop.shortCode}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400 truncate max-w-xs">{stop.address}</p>
                    </div>
                    {isCurrent && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
