import React, { useState } from 'react';
import { BusTrip, DemoUser } from '../types/bus';
import { formatTime12h, getMinutesUntilDeparture, isNormalBookingOpen } from '../utils/bookingRules';
import { X, Check, Info, ShieldCheck, ArrowRight, User, AlertTriangle } from 'lucide-react';

interface SeatPickerModalProps {
  trip: BusTrip;
  currentUser: DemoUser;
  currentTimeStr: string;
  hasActiveBookingLimit?: boolean;
  onConfirmSeat: (tripId: string, seatId: string) => void;
  onClose: () => void;
}

export const SeatPickerModal: React.FC<SeatPickerModalProps> = ({
  trip,
  currentUser,
  currentTimeStr,
  hasActiveBookingLimit = false,
  onConfirmSeat,
  onClose,
}) => {
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [step, setStep] = useState<'pick' | 'confirm'>('pick');

  const minsUntil = getMinutesUntilDeparture(currentTimeStr, trip.departureTime);
  const isTimePassed = minsUntil < 0;
  const isBookingAllowed = !isTimePassed && isNormalBookingOpen(currentTimeStr, trip.departureTime);

  const capacity = 40; // Full standard bus cabin layout (10 rows x 4 seats)
  const rows = Array.from({ length: 10 }, (_, i) => i + 1);

  const isSeatBooked = (seatId: string) => trip.bookedSeatIds.includes(seatId);

  const getSeatPositionName = (seatId: string) => {
    const col = seatId.slice(-1);
    const row = seatId.slice(0, -1);
    const type = col === 'A' || col === 'D' ? 'Window' : 'Aisle';
    const side = col === 'A' || col === 'B' ? 'Left' : 'Right';
    return `Row ${row} · ${type} (${side})`;
  };

  const handleSeatClick = (seatId: string) => {
    if (isSeatBooked(seatId) || !isBookingAllowed) return;
    setSelectedSeat(seatId);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl max-h-[90vh] flex flex-col overflow-hidden transition-colors">
        {/* Header */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/80">
          <div>
            <div className="flex items-center gap-1.5 font-mono text-[9px]">
              <span className="font-semibold px-1 py-0.2 rounded-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                {capacity} Seats
              </span>
              <span className="text-zinc-500">
                · {formatTime12h(trip.departureTime)} Departure
              </span>
            </div>
            <h3 className="font-bold text-zinc-900 dark:text-white text-xs mt-0.5 truncate max-w-xs">
              {trip.routeName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Schedule Passed / Booking Limit / Closed Warning */}
        {hasActiveBookingLimit ? (
          <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-zinc-500" />
            <span>You have reached the <strong>maximum limit of 2 active bookings</strong>. Cancel an existing reservation to book another seat.</span>
          </div>
        ) : isTimePassed ? (
          <div className="p-2.5 bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-zinc-500" />
            <span>This bus schedule has passed. Booking is closed and <strong>Not Available</strong>.</span>
          </div>
        ) : !isBookingAllowed ? (
          <div className="p-2 bg-zinc-100 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            <span>Normal booking closed at T−10m. Released seats can be claimed via FCFS Claim.</span>
          </div>
        ) : null}

        {step === 'pick' ? (
          <>
            {/* Bus Layout Body */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Legend: Sharp 4px */}
              <div className="flex items-center justify-around py-1.5 px-2 bg-zinc-50 dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-xs bg-emerald-600 border border-emerald-600 text-white flex items-center justify-center text-[8px] font-bold">
                    ✓
                  </div>
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-xs bg-zinc-200 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800" />
                  <span>Occupied</span>
                </div>
              </div>

              {/* The Bus Frame: Sharp 6px */}
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 p-3 max-w-xs mx-auto shadow-2xs relative">
                {/* Driver Area */}
                <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2 mb-2.5 flex items-center justify-between text-xs text-zinc-500 font-mono">
                  <div className="flex items-center gap-1 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded-xs border border-zinc-200 dark:border-zinc-800 text-[9px]">
                    <User className="w-3 h-3 text-zinc-500" />
                    <span>Driver Bay</span>
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Front Entrance ➔
                  </div>
                </div>

                {/* Rows of Seats: Full 40-Seat Bus Layout (10 rows x 4 seats) */}
                <div className="space-y-1.5">
                  {rows.map((row) => (
                    <div key={row} className="flex items-center justify-between gap-1">
                      {/* Left Side: A & B */}
                      <div className="flex items-center gap-1">
                        {['A', 'B'].map((col) => {
                          const seatId = `${row}${col}`;
                          const booked = isSeatBooked(seatId);
                          const isSelected = selectedSeat === seatId;
                          return (
                            <button
                              key={seatId}
                              disabled={booked || !isBookingAllowed}
                              onClick={() => handleSeatClick(seatId)}
                              className={`w-8 h-8 rounded-sm text-xs font-mono font-bold flex items-center justify-center transition border ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : booked
                                  ? 'bg-zinc-200/50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 opacity-60 cursor-not-allowed'
                                  : 'bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:border-emerald-500'
                              }`}
                            >
                              {seatId}
                            </button>
                          );
                        })}
                      </div>

                      {/* Center Aisle */}
                      <div className="w-5 text-center text-[9px] font-mono text-zinc-400 select-none">
                        {row}
                      </div>

                      {/* Right Side: C & D */}
                      <div className="flex items-center gap-1">
                        {['C', 'D'].map((col) => {
                          const seatId = `${row}${col}`;
                          const booked = isSeatBooked(seatId);
                          const isSelected = selectedSeat === seatId;
                          return (
                            <button
                              key={seatId}
                              disabled={booked || !isBookingAllowed}
                              onClick={() => handleSeatClick(seatId)}
                              className={`w-8 h-8 rounded-sm text-xs font-mono font-bold flex items-center justify-center transition border ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                                  : booked
                                  ? 'bg-zinc-200/50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 opacity-60 cursor-not-allowed'
                                  : 'bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:border-emerald-500'
                              }`}
                            >
                              {seatId}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-800 text-center text-[9px] text-zinc-400 uppercase tracking-widest font-mono">
                  [ 🚨 REAR EMERGENCY EXIT DOOR · 40 SEATS FULL CABIN ]
                </div>
              </div>
            </div>

            {/* Bottom Bar: Selection summary and next button */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between">
              <div>
                <span className="text-[9px] text-zinc-500 block uppercase font-mono">Selected Seat</span>
                {selectedSeat ? (
                  <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono flex items-center gap-1">
                    Seat {selectedSeat}{' '}
                    <span className="text-[10px] font-sans text-emerald-700 dark:text-emerald-400 font-normal">
                      ({getSeatPositionName(selectedSeat)})
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] text-zinc-400">Tap a seat to select</span>
                )}
              </div>

              <button
                disabled={!selectedSeat || !isBookingAllowed}
                onClick={() => setStep('confirm')}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-sm flex items-center gap-1 transition shadow-2xs"
              >
                {isTimePassed ? 'Not Available' : 'Continue'} {!isTimePassed && <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </>
        ) : (
          /* STEP 2: Confirmation Dialog */
          <div className="p-4 space-y-3">
            <div className="text-center space-y-0.5">
              <div className="w-10 h-10 rounded-sm bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto mb-1.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Confirm Shuttle Booking?</h4>
              <p className="text-[11px] text-zinc-500">
                Review your reservation details before holding your seat.
              </p>
            </div>

            {/* Summary card: Sharp 6px */}
            <div className="bg-zinc-50 dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 p-2.5 space-y-1.5 text-xs">
              <div className="flex justify-between py-0.5 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500">Route</span>
                <span className="font-semibold text-zinc-900 dark:text-white">{trip.routeName}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500">Departure</span>
                <span className="font-bold text-zinc-900 dark:text-white font-mono">
                  {formatTime12h(trip.departureTime)}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-zinc-200 dark:border-zinc-800">
                <span className="text-zinc-500">Seat</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                  Seat {selectedSeat} ({selectedSeat ? getSeatPositionName(selectedSeat) : ''})
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-zinc-500">Status</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono text-[10px]">RESERVED (No QR yet)</span>
              </div>
            </div>

            {/* Policy Reminders */}
            <div className="p-2.5 rounded-sm bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-[10px] text-zinc-700 dark:text-zinc-300 space-y-1 leading-relaxed">
              <div>
                <strong>Check-in & QR Policy:</strong> Proximity check-in opens at T−30m and closes strictly at <strong>T−10m</strong>. Single-use QR pass is generated upon check-in.
              </div>
              <div className="pt-1 border-t border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400">
                <strong>Cancellation:</strong> Canceling before check-in is <em>always free</em> (0 penalties). Canceling after check-in incurs 1 Minor penalty.
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => setStep('pick')}
                className="py-2 px-3 rounded-sm border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition"
              >
                Change Seat
              </button>
              <button
                disabled={isTimePassed || !selectedSeat}
                onClick={() => selectedSeat && !isTimePassed && onConfirmSeat(trip.id, selectedSeat)}
                className="py-2 px-3 rounded-sm bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-bold transition flex items-center justify-center gap-1 shadow-2xs"
              >
                {isTimePassed ? 'Not Available' : (
                  <>
                    <Check className="w-3.5 h-3.5" /> Confirm
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
