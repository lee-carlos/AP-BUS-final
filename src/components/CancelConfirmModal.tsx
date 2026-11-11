import React from 'react';
import { Booking } from '../types/bus';
import { formatTime12h, evaluateCancellationPenalty } from '../utils/bookingRules';
import { Trash2, ShieldCheck, ShieldAlert } from 'lucide-react';

interface CancelConfirmModalProps {
  booking: Booking;
  isTripDelayedOrCancelled?: boolean;
  onConfirmCancel: (bookingId: string) => void;
  onClose: () => void;
}

export const CancelConfirmModal: React.FC<CancelConfirmModalProps> = ({
  booking,
  isTripDelayedOrCancelled = false,
  onConfirmCancel,
  onClose,
}) => {
  const penaltyCheck = evaluateCancellationPenalty(booking, isTripDelayedOrCancelled);
  const isMinorPenalty = penaltyCheck.points > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-4 shadow-xl space-y-3 transition-colors">
        {/* Header Icon */}
        <div
          className={`w-10 h-10 rounded-sm flex items-center justify-center mx-auto ${
            isMinorPenalty
              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
          }`}
        >
          {isMinorPenalty ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
        </div>

        <div className="text-center space-y-0.5">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Cancel Bus Reservation?</h3>
          <p className="text-[11px] text-zinc-500">
            Releasing your seat allows students on the subsequent bus to claim it via FCFS Claim.
          </p>
        </div>

        {/* Booking details card: Sharp 6px */}
        <div className="bg-zinc-50 dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 p-2.5 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">Route</span>
            <span className="font-semibold text-zinc-900 dark:text-white">{booking.routeName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Departure</span>
            <span className="font-bold text-zinc-900 dark:text-white font-mono">
              {formatTime12h(booking.departureTime)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Seat Number</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">Seat {booking.seatId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Status</span>
            <span className="font-mono text-zinc-700 dark:text-zinc-300 uppercase text-[10px]">{booking.status}</span>
          </div>
        </div>

        {/* Policy Penalty Notice */}
        <div
          className={`p-2 rounded-sm border text-[11px] flex items-start gap-1.5 ${
            isMinorPenalty
              ? 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <span>{penaltyCheck.message}</span>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            onClick={onClose}
            className="py-2 px-3 rounded-sm border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition"
          >
            Keep My Seat
          </button>
          <button
            onClick={() => onConfirmCancel(booking.id)}
            className="py-2 px-3 rounded-sm bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-900 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" /> Confirm Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
