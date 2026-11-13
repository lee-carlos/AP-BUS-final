import React from 'react';
import { Booking, DemoUser } from '../types/bus';
import { formatTime12h } from '../utils/bookingRules';
import { qrMatrix } from '../utils/qr';
import { X, ShieldCheck, Bus, AlertTriangle, ArrowRightCircle, CheckCircle2, QrCode } from 'lucide-react';

interface BoardingPassModalProps {
  booking: Booking;
  user: DemoUser;
  onBoardBus: () => void;
  onClose: () => void;
}

export const BoardingPassModal: React.FC<BoardingPassModalProps> = ({
  booking,
  user,
  onBoardBus,
  onClose,
}) => {
  const isCheckedIn = booking.status === 'CHECKED_IN';
  const isBoarded = booking.status === 'BOARDED';
  const isReserved = booking.status === 'RESERVED';
  const isTransferred = booking.status === 'TRANSFERRED';
  const isExpired = booking.status === 'EXPIRED';
  const isNoShow = booking.status === 'NO_SHOW';

  // Real, scannable QR code of the random single-use token (no TP number inside the code).
  let qrPath = '';
  let qrSize = 0;
  if (booking.qrCodeToken) {
    try {
      const matrix: boolean[][] = qrMatrix(booking.qrCodeToken);
      qrSize = matrix.length + 8; // 4-module quiet zone on each side
      matrix.forEach((row, y) =>
        row.forEach((dark, x) => {
          if (dark) qrPath += `M${x + 4} ${y + 4}h1v1h-1z`;
        })
      );
    } catch {
      qrPath = '';
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-4 shadow-xl relative overflow-hidden transition-colors">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* Pass Header */}
        <div className="text-center space-y-1 mb-3">
          <div className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-xs border border-emerald-200 dark:border-emerald-800/40">
            {isCheckedIn && <ShieldCheck className="w-3 h-3" />}
            {isReserved && <QrCode className="w-3 h-3" />}
            {isBoarded && <CheckCircle2 className="w-3 h-3" />}
            <span>
              {isCheckedIn
                ? 'Checked in · QR Pass Active'
                : isReserved
                ? 'Reserved · Check-in Required'
                : isBoarded
                ? 'Boarded · Pass Redeemed'
                : isTransferred
                ? 'Transferred · Pass Revoked'
                : 'Invalidated'}
            </span>
          </div>

          <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">
            BOARDING PASS
          </h3>
          <p className="text-[10px] text-zinc-500 font-mono">Asia Pacific University · Shuttle Services</p>
        </div>

        {/* Boarding Pass Ticket Body: Sharp 6px Rectangle */}
        <div className="bg-zinc-50 dark:bg-zinc-950 rounded-sm border border-zinc-200 dark:border-zinc-800 p-3 space-y-3 relative">
          {/* Passenger Info */}
          <div className="flex items-center gap-2.5 pb-2.5 border-b border-zinc-200 dark:border-zinc-800">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-10 h-10 rounded-sm object-cover ring-1 ring-emerald-500"
            />
            <div className="flex-1 min-w-0">
              <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider block">
                Passenger
              </span>
              <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate">{user.name}</h4>
              <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">{user.studentId}</p>
              <p className="text-[9px] font-mono text-zinc-500">Booking ID: {booking.id}</p>
            </div>
            <div className="text-right">
              <span className="text-[8px] uppercase font-mono text-zinc-500 block">Seat</span>
              <span className="text-sm font-black text-zinc-900 dark:text-white font-mono">{booking.seatId}</span>
            </div>
          </div>

          {/* Route & Times */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase font-mono">From</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] truncate block">
                {booking.fromStopName}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase font-mono">To</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-[11px] truncate block">
                {booking.toStopName}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase font-mono">Departure</span>
              <span className="font-bold text-zinc-900 dark:text-white font-mono text-xs">
                {formatTime12h(booking.departureTime)}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-zinc-500 block uppercase font-mono">Status</span>
              <span className="font-mono font-bold text-[10px] text-emerald-700 dark:text-emerald-400">
                {booking.status}
              </span>
            </div>
          </div>

          {/* QR Code Section or Pending Notice (Master Context Rule 9.1) */}
          <div className="pt-1 text-center">
            {isReserved ? (
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-3 text-center space-y-1">
                <QrCode className="w-5 h-5 text-zinc-400 mx-auto" />
                <h5 className="text-[11px] font-bold text-zinc-900 dark:text-white">QR Unlocked After Check-in</h5>
                <p className="text-[10px] text-zinc-500 leading-relaxed">
                  The QR boarding pass is issued when you check in at the pickup point (from T−30 until before T−10).
                </p>
              </div>
            ) : isTransferred ? (
              <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-3 text-center">
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 font-semibold">
                  This reservation was transferred to an earlier bus. The previous pass has been revoked.
                </p>
              </div>
            ) : isExpired || isNoShow ? (
              <div className="bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm p-3 text-center">
                <p className="text-[11px] text-zinc-700 dark:text-zinc-300 font-semibold">
                  {isExpired
                    ? 'Seat released due to missed T−10 check-in deadline.'
                    : 'Boarding window closed. Ticket invalidated.'}
                </p>
              </div>
            ) : (
              /* Verified QR Code */
              <div>
                <div className="w-32 h-32 bg-white p-2 rounded-sm mx-auto border border-zinc-300 dark:border-zinc-700 relative flex items-center justify-center">
                  {qrPath ? (
                    <svg
                      className="w-full h-full"
                      viewBox={`0 0 ${qrSize} ${qrSize}`}
                      shapeRendering="crispEdges"
                      role="img"
                      aria-label="Boarding pass QR code"
                    >
                      <rect width={qrSize} height={qrSize} fill="#ffffff" />
                      <path d={qrPath} fill={isBoarded ? '#a1a1aa' : '#000000'} />
                    </svg>
                  ) : (
                    <QrCode className="w-10 h-10 text-zinc-400" />
                  )}
                </div>
                <div className="mt-2 space-y-0.5">
                  <p className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold truncate">
                    {booking.qrCodeToken || 'No pass issued'}
                  </p>
                  <p className="text-[9px] font-mono text-zinc-400">
                    {isBoarded
                      ? `Used at ${booking.boardedAt || 'boarding'}${booking.manualBoardingReason ? ' (manual boarding)' : ''} · cannot be scanned again`
                      : 'Single-use QR · works once, on this shuttle only'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-3">
          {isCheckedIn && (
            <button
              onClick={onBoardBus}
              className="w-full py-2 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-2xs"
            >
              <Bus className="w-3.5 h-3.5" /> Simulate door scan of this QR
            </button>
          )}
          {isBoarded && (
            <div className="text-center py-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 rounded-sm border border-emerald-200 dark:border-emerald-800/40">
              ✓ Passenger successfully boarded. Single-use QR closed.
            </div>
          )}
          {isReserved && (
            <button
              onClick={onClose}
              className="w-full py-2 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 font-semibold text-xs transition"
            >
              Done (Check in when in range)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
