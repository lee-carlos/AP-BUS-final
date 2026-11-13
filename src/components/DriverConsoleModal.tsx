import React, { useState } from 'react';
import { BusTrip, Booking, DemoUser, ScanResult } from '../types/bus';
import { formatTime12h, calculateTripCapacity } from '../utils/bookingRules';
import {
  X,
  Bus,
  Search,
  Check,
  Ban,
  DoorOpen,
  DoorClosed,
} from 'lucide-react';

interface DriverConsoleModalProps {
  trip: BusTrip;
  allBookings: Booking[];
  users: DemoUser[];
  onToggleBoarding: (tripId: string) => void;
  onScanPass: (qrToken: string) => ScanResult; // only the QR token is accepted
  onClose: () => void;
}

export const DriverConsoleModal: React.FC<DriverConsoleModalProps> = ({
  trip,
  allBookings,
  users,
  onToggleBoarding,
  onScanPass,
  onClose,
}) => {
  const [inputCode, setInputCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);

  const tripBookings = allBookings.filter((b) => b.tripId === trip.id);
  const cap = calculateTripCapacity(trip, tripBookings);

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;
    const res = onScanPass(inputCode.trim());
    setScanResult(res);
    if (res.success) setInputCode('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl overflow-hidden flex flex-col max-h-[85vh] transition-colors">
        {/* Header: Sharp 6px */}
        <div className="p-3 bg-zinc-50 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-sm bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
              <Bus className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[9px]">
                <span className="font-bold text-emerald-700 dark:text-emerald-400 uppercase">
                  Driver Console
                </span>
                <span className="text-zinc-500">
                  · {formatTime12h(trip.departureTime)} Departure
                </span>
              </div>
              <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white truncate max-w-xs">{trip.routeName}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Boarding Controls & Manifest Statistics */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[9px] text-zinc-500 uppercase font-mono block">Boarding Status</span>
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-xs inline-flex items-center gap-1 border ${
                  trip.boardingOpen
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {trip.boardingOpen ? (
                  <>
                    <DoorOpen className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Open
                  </>
                ) : (
                  <>
                    <DoorClosed className="w-3 h-3" /> Closed
                  </>
                )}
              </span>
            </div>

            <button
              onClick={() => onToggleBoarding(trip.id)}
              className={`px-3 py-1.5 rounded-sm text-xs font-bold transition flex items-center gap-1 shadow-2xs ${
                trip.boardingOpen
                  ? 'bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {trip.boardingOpen ? 'Close Boarding' : 'Open Boarding'}
            </button>
          </div>

          {/* Capacity Buckets (Section 7): Sharp 6px */}
          <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
            <div className="bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800">
              <span className="text-[8px] text-zinc-400 block font-mono uppercase">Cap</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white text-xs">{cap.seatedCapacity}</span>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800">
              <span className="text-[8px] text-zinc-500 block font-mono uppercase">Reserved</span>
              <span className="font-mono font-bold text-zinc-700 dark:text-zinc-300 text-xs">{cap.reservedCount}</span>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800">
              <span className="text-[8px] text-emerald-700 dark:text-emerald-400 block font-mono uppercase">Checked In</span>
              <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-xs">{cap.checkedInCount}</span>
            </div>
            <div className="bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-sm border border-zinc-200 dark:border-zinc-800">
              <span className="text-[8px] text-zinc-500 block font-mono uppercase">Boarded</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white text-xs">{cap.boardedCount}</span>
            </div>
          </div>
        </div>

        {/* QR / Token Scanner & Pass Input */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60">
          <form onSubmit={handleManualScan} className="flex gap-1.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="QR token, e.g. APB-K7M2-9QXA-4TBC"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-sm transition flex items-center gap-1 shrink-0"
            >
              Validate
            </button>
          </form>

          {/* Scan result alert */}
          {scanResult && (
            <div
              className={`mt-2 p-2 rounded-sm text-xs flex items-center gap-1.5 ${
                scanResult.success
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300'
                  : 'bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200'
              }`}
            >
              {scanResult.success ? (
                <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Ban className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              )}
              <div className="min-w-0">
                <span className="block">{scanResult.message}</span>
                {scanResult.passenger && (
                  <span className="block font-mono text-[10px] mt-0.5 opacity-90">
                    {scanResult.passenger.name} · {scanResult.passenger.studentId} · {scanResult.passenger.bookingId} · Seat {scanResult.passenger.seatId} · {scanResult.passenger.departureTime}
                  </span>
                )}
              </div>
            </div>
          )}
          <p className="mt-1.5 text-[9px] font-mono text-zinc-500">
            Only the QR token boards a passenger. A TP number or booking ID is shown for identity, never accepted as a pass.
          </p>
        </div>

        {/* Passenger Manifest List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-zinc-500 pb-1 font-mono uppercase">
            <span>Passenger Manifest ({tripBookings.length})</span>
            <span>Seat · Status</span>
          </div>

          {tripBookings.length === 0 ? (
            <div className="text-center py-6 text-xs text-zinc-400">
              No passengers registered for this trip yet.
            </div>
          ) : (
            tripBookings.map((b) => {
              const u = users.find((usr) => usr.id === b.userId);
              return (
                <div
                  key={b.id}
                  className="p-2 bg-white dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 text-xs shadow-2xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white font-mono font-bold flex items-center justify-center shrink-0 text-xs">
                      {b.seatId}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-zinc-900 dark:text-white truncate text-xs">{u?.name || b.userId}</div>
                      <div className="text-[9px] text-zinc-500 font-mono">
                        {u?.studentId || 'STUDENT'} · {b.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-xs font-semibold ${
                        b.status === 'BOARDED'
                          ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          : b.status === 'CHECKED_IN'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      {b.status}
                    </span>

                    {/* Quick board button */}
                    {(b.status === 'CHECKED_IN' || b.status === 'BOARDED') && b.qrCodeToken && (
                      <button
                        onClick={() => {
                          const res = onScanPass(b.qrCodeToken || '');
                          setScanResult(res);
                        }}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xs text-[10px] font-bold transition"
                        title="Demo: simulates the camera reading this passenger's QR pass"
                      >
                        Scan QR
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
