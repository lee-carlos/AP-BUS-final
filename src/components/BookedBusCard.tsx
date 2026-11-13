import React, { useState } from 'react';
import { Booking } from '../types/bus';
import { formatTime12h, getMinutesUntilDeparture, getBusLifecycleStatus } from '../utils/bookingRules';
import {
  Bus,
  Bell,
  BellOff,
  QrCode,
  AlertCircle,
  CheckCircle,
  MapPin,
  Clock,
  ShieldCheck,
  Trash2,
  ShieldAlert,
  ArrowRightCircle,
} from 'lucide-react';

interface BookedBusCardProps {
  bookings: Booking[];
  minorPenalties: number;
  majorPenalties: number;
  penaltyPoints: number;
  isRestricted?: boolean; // true only on the one restricted service day
  restrictedOnLabel?: string | null; // e.g. "Mon 16 Nov" (today's or the upcoming restricted day)
  currentTimeStr: string;
  userCoords: { lat: number; lng: number };
  onToggleNotify30: (bookingId: string) => void;
  onCheckInNow: (bookingId: string) => void;
  onOpenBoardingPass: (booking: Booking) => void;
  onRequestCancel: (booking: Booking) => void;
  onScanForDepart?: (bookingId: string) => void;
}

export const BookedBusCard: React.FC<BookedBusCardProps> = ({
  bookings,
  minorPenalties,
  majorPenalties,
  penaltyPoints,
  isRestricted = false,
  restrictedOnLabel = null,
  currentTimeStr,
  onToggleNotify30,
  onCheckInNow,
  onOpenBoardingPass,
  onRequestCancel,
  onScanForDepart,
}) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  const isSuspended = isRestricted;

  if (bookings.length === 0) {
    return (
      <div className="px-3.5 py-2.5">
        <div className="flex items-center justify-between mb-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-xs bg-zinc-400" />
            <span>Active Reservations (0)</span>
          </div>
          <span className="font-mono text-[10px] text-zinc-500">
            {isRestricted
              ? `Restricted today · ${penaltyPoints} pts`
              : `Penalties: ${penaltyPoints}/6 pts${restrictedOnLabel ? ` · restricted ${restrictedOnLabel}` : ''}`}
          </span>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-4 text-center">
          <Bus className="w-5 h-5 text-zinc-400 mx-auto mb-1.5" />
          <h3 className="text-xs font-bold text-zinc-900 dark:text-white">No Active Bus Bookings</h3>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 max-w-xs mx-auto">
            Bookings open daily at 06:00 MYT. Maximum 2 active reservations per student.
          </p>
        </div>
      </div>
    );
  }

  const currentIdx = activeTab >= bookings.length ? 0 : activeTab;
  const booking = bookings[currentIdx];
  const minutesUntilDeparture = getMinutesUntilDeparture(currentTimeStr, booking.departureTime);
  const busStatus = getBusLifecycleStatus(currentTimeStr, booking.departureTime);

  const isCheckedIn = booking.status === 'CHECKED_IN';
  const isBoarded = booking.status === 'BOARDED';
  const isReserved = booking.status === 'RESERVED';
  const isTransferred = booking.status === 'TRANSFERRED';
  const isExpired = booking.status === 'EXPIRED';
  const isNoShow = booking.status === 'NO_SHOW';

  // Check-in assessment: window opens T-30, closes T-10
  const isWithinCheckInWindow = minutesUntilDeparture <= 30 && minutesUntilDeparture > 10;
  const isBeforeCheckInWindow = minutesUntilDeparture > 30;

  // Waiting & Depart 2-minute window active
  const isWaitingOrDepartWindow = busStatus === 'Arrived' || busStatus === 'Waiting' || busStatus === 'Depart';

  return (
    <div className="px-3.5 py-2.5">
      {/* Header with Anti-Trolling Status */}
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-xs bg-emerald-500 animate-pulse" />
          <h2 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 tracking-wider uppercase font-mono">
            Active Bookings ({bookings.length})
          </h2>
        </div>

        {/* Clean unboxed penalty indicator */}
        <div className="text-[10px] font-mono">
          {isSuspended ? (
            <span className="text-zinc-900 dark:text-white font-bold flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Restricted today ({penaltyPoints} pts)
            </span>
          ) : penaltyPoints > 0 ? (
            <span className="text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Penalties: {penaltyPoints}/6 pts
              {restrictedOnLabel ? ` · restricted ${restrictedOnLabel}` : ''}
            </span>
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-medium">
              <ShieldCheck className="w-3 h-3" /> Clean Record (0 pts)
            </span>
          )}
        </div>
      </div>

      {/* Multiple Bookings Switcher Tabs */}
      {bookings.length > 1 && (
        <div className="flex items-center gap-1 mb-2 overflow-x-auto no-scrollbar">
          {bookings.map((b, idx) => (
            <button
              key={b.id}
              onClick={() => setActiveTab(idx)}
              className={`px-2.5 py-1 rounded-sm text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                idx === currentIdx
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Bus className="w-3 h-3" />
              <span>{formatTime12h(b.departureTime)}</span>
              <span className="text-[9px] font-mono px-1 rounded-xs bg-black/20">
                {b.status}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Main Booking Card: Sharp Rectangle (6px - 8px) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3.5 shadow-2xs relative overflow-hidden transition-colors">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />

        {/* Route & Seat Header */}
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[9px] font-mono font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
              {booking.fromStopName.split(' ')[0]} ➔ {booking.toStopName.split(' ')[0]}
            </span>
            <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">{booking.routeName}</h3>
          </div>

          {/* Seat Number Box */}
          <div className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-1 rounded-sm text-center">
            <span className="text-[8px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold block">
              Seat
            </span>
            <span className="text-xs font-black text-zinc-900 dark:text-white font-mono">{booking.seatId}</span>
          </div>
        </div>

        {/* Departure & Countdown Grid */}
        <div className="grid grid-cols-2 gap-2 mt-2.5 p-2 rounded-sm bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800/80 text-xs">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase font-mono">Departure</span>
              <span className="text-xs font-bold text-zinc-900 dark:text-white font-mono">
                {formatTime12h(booking.departureTime)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase font-mono">Countdown</span>
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                {minutesUntilDeparture > 10
                  ? `${minutesUntilDeparture - 10}m to cutoff`
                  : minutesUntilDeparture > 0
                  ? `${minutesUntilDeparture}m to departure`
                  : minutesUntilDeparture === 0
                  ? '0m (Arrived)'
                  : minutesUntilDeparture >= -2
                  ? `+${Math.abs(minutesUntilDeparture)}m (Waiting)`
                  : 'Departed'}
              </span>
            </div>
          </div>
        </div>

        {/* Bus Status Row - Displayed below Countdown with label "bus status" */}
        <div className="mt-2 p-2 rounded-sm bg-zinc-50 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5">
            <Bus className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase font-mono">bus status</span>
              <span className="text-xs font-extrabold font-mono tracking-tight text-zinc-900 dark:text-white">
                {busStatus}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-xs font-bold border inline-flex items-center gap-1 ${
                busStatus === 'On the Way'
                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/40'
                  : busStatus === 'Arrived'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 animate-pulse'
                  : busStatus === 'Waiting'
                  ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                  : busStatus === 'Depart'
                  ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800'
                  : busStatus === 'Expired'
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {busStatus === 'On the Way' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
              {busStatus === 'Arrived' && <CheckCircle className="w-3 h-3 text-emerald-600" />}
              {busStatus === 'Waiting' && <Clock className="w-3 h-3 text-amber-600" />}
              <span>{busStatus}</span>
            </span>
          </div>
        </div>

        {/* During 2-Minute Waiting & Depart Window: Acknowledge scan for depart vs check-in only */}
        {isWaitingOrDepartWindow && isCheckedIn && (
          <div className="mt-2 p-2.5 rounded-sm bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/50 text-xs space-y-1.5">
            <div className="flex items-start justify-between gap-1.5">
              <div>
                <span className="font-bold text-amber-900 dark:text-amber-200 block text-[11px]">
                  {busStatus === 'Arrived' ? 'Bus Arrived · 2m Departure Window Open' : 'Bus Waiting at Bay (2m Departure Window)'}
                </span>
                <p className="text-[10px] text-amber-800 dark:text-amber-300">
                  Show your QR pass at the door scanner now. A checked-in passenger who is not scanned before departure is marked No-show (+2 points).
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => (onScanForDepart ? onScanForDepart(booking.id) : onOpenBoardingPass(booking))}
                className="flex-1 py-1 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-sm shadow-2xs flex items-center justify-center gap-1.5 transition"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Simulate door scan
              </button>
              <button
                onClick={() => onOpenBoardingPass(booking)}
                className="py-1 px-2.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-semibold text-xs rounded-sm transition"
              >
                Pass Info
              </button>
            </div>
          </div>
        )}

        {/* Check-In & Ticket Lifecycle Status Section */}
        <div className="mt-2.5">
          {isCheckedIn ? (
            <div className="flex items-center justify-between p-2 rounded-sm bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300 text-xs">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold block">Checked-In (Proximity Verified)</span>
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400/80">Valid single-use QR pass ready</span>
                </div>
              </div>
              <button
                onClick={() => onOpenBoardingPass(booking)}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded-sm text-xs font-bold transition shadow-2xs"
              >
                <QrCode className="w-3.5 h-3.5" /> View Pass
              </button>
            </div>
          ) : isBoarded ? (
            <div className="flex items-center justify-between p-2 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bold">Boarded Onboard · Safe travels!</span>
              </div>
              <button
                onClick={() => onOpenBoardingPass(booking)}
                className="flex items-center gap-1 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-900 dark:text-white px-2 py-0.5 rounded-sm text-xs font-semibold transition"
              >
                Pass Info
              </button>
            </div>
          ) : isTransferred ? (
            <div className="p-2 rounded-sm bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 text-xs">
              <ArrowRightCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Transferred via FCFS Claim to earlier bus. Prior pass revoked.</span>
            </div>
          ) : isExpired ? (
            <div className="p-2 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>Expired at T−10: Check-in missed. Seat released (+1 Minor point).</span>
            </div>
          ) : isNoShow ? (
            <div className="p-2 rounded-sm bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-center gap-1.5 text-xs">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <span>No-show: checked in but the QR pass was not scanned before departure (+2 points).</span>
            </div>
          ) : isWithinCheckInWindow ? (
            /* Inside T-30 to T-10 Window */
            <div className="p-2 rounded-sm bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/50 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-emerald-900 dark:text-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 animate-pulse" />
                <div>
                  <p className="font-bold">Check-in Window Open (T−30m to T−10m)</p>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                    Closes in {minutesUntilDeparture - 10}m. Tap to verify you are at the pickup point.
                  </p>
                </div>
              </div>
              <button
                onClick={() => onCheckInNow(booking.id)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1 rounded-sm shadow-2xs transition"
              >
                Check In
              </button>
            </div>
          ) : isBeforeCheckInWindow ? (
            <div className="p-2 rounded-sm bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="text-[11px]">
                Reserved. Check-in window opens {minutesUntilDeparture - 30}m from now (at T−30).
              </span>
            </div>
          ) : (
            <div className="p-2 rounded-sm bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
              <AlertCircle className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="text-[11px]">Normal check-in closed at T−10 minutes.</span>
            </div>
          )}
        </div>

        {/* Actions Line */}
        <div className="mt-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
          {/* 30m Reminder Toggle */}
          <button
            onClick={() => onToggleNotify30(booking.id)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-sm border text-[10px] font-medium transition ${
              booking.notify30Min
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400'
                : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {booking.notify30Min ? (
              <>
                <Bell className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>30m Alert On</span>
              </>
            ) : (
              <>
                <BellOff className="w-3 h-3" />
                <span>30m Alert Off</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onOpenBoardingPass(booking)}
              className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white px-1.5 py-0.5 rounded-sm text-[10px] font-medium"
            >
              Ticket Details
            </button>

            {/* Cancel Button */}
            {(isReserved || isCheckedIn) && (
              <button
                onClick={() => onRequestCancel(booking)}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white px-1.5 py-0.5 rounded-sm text-[10px] transition"
              >
                <Trash2 className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
