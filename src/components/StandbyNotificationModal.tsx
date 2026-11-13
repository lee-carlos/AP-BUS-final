import React from 'react';
import { BusTrip, Booking } from '../types/bus';
import { formatTime12h, getMinutesUntilDeparture } from '../utils/bookingRules';
import { BellRing, ShieldCheck, ArrowRight, Clock, CheckCircle } from 'lucide-react';

interface StandbyNotificationModalProps {
  trip: BusTrip;
  releasedSeatId: string;
  sourceBooking?: Booking | null;
  currentTimeStr: string;
  onAcceptSeat: (tripId: string, seatId: string) => void;
  onDecline: () => void;
}

export const StandbyNotificationModal: React.FC<StandbyNotificationModalProps> = ({
  trip,
  releasedSeatId,
  sourceBooking,
  currentTimeStr,
  onAcceptSeat,
  onDecline,
}) => {
  const minsUntil = getMinutesUntilDeparture(currentTimeStr, trip.departureTime);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-emerald-500/50 rounded-md p-4 shadow-xl space-y-3 transition-colors">
        {/* Animated Bell Badge: Sharp 6px */}
        <div className="w-10 h-10 rounded-sm bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
          <BellRing className="w-5 h-5 animate-pulse" />
        </div>

        <div className="text-center space-y-0.5">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded-xs border border-emerald-200 dark:border-emerald-800/40">
            Seat Alert · FCFS Claim
          </span>
          <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">Seat Available on Earlier Bus!</h3>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
            A seat was released on the <strong className="text-zinc-900 dark:text-white">{trip.departureTime}</strong> shuttle. You hold the schedule immediately after it, so you can claim this earlier shuttle. If the claim fails, your current booking stays valid.
          </p>
        </div>

        {/* Transfer Comparison Box: Sharp 6px */}
        <div className="bg-zinc-50 dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 p-2.5 space-y-2 text-xs">
          {sourceBooking && (
            <div className="p-2 rounded-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px]">
              <div>
                <span className="text-zinc-400 block text-[9px] font-mono uppercase">Current Bus</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {sourceBooking.departureTime} (Seat {sourceBooking.seatId})
                </span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mx-1.5" />
              <div className="text-right">
                <span className="text-emerald-700 dark:text-emerald-400 block text-[9px] font-mono uppercase font-bold">
                  New Earlier Bus
                </span>
                <span className="font-bold text-zinc-900 dark:text-white">
                  {trip.departureTime} (Seat {releasedSeatId})
                </span>
              </div>
            </div>
          )}

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Route</span>
            <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-[170px]">{trip.routeName}</span>
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-500">Claim Cutoff</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
              <Clock className="w-3 h-3" /> Closes at T−3 min ({Math.max(0, minsUntil - 3)}m left)
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-zinc-500 dark:text-zinc-400 pt-1 border-t border-zinc-200 dark:border-zinc-800">
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Your location is checked at the pickup point when you claim</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          <button
            onClick={onDecline}
            className="py-2 px-3 rounded-sm border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition"
          >
            Keep Current Bus
          </button>
          <button
            onClick={() => onAcceptSeat(trip.id, releasedSeatId)}
            className="py-2 px-3 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-2xs flex items-center justify-center gap-1"
          >
            <CheckCircle className="w-3.5 h-3.5" /> Claim Seat Now
          </button>
        </div>
      </div>
    </div>
  );
};
