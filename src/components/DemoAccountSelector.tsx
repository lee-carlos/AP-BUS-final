import React from 'react';
import { DEMO_ACCOUNTS } from '../data/apuRoutes';
import { DemoUser } from '../types/bus';
import { MapPin, ArrowRight, Bus, ShieldCheck } from 'lucide-react';

interface DemoAccountSelectorProps {
  onSelectAccount: (user: DemoUser) => void;
}

export const DemoAccountSelector: React.FC<DemoAccountSelectorProps> = ({ onSelectAccount }) => {
  return (
    <div className="flex-1 flex flex-col px-4 py-5 space-y-4 overflow-y-auto bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Brand Hero */}
      <div className="text-center space-y-1 pt-1">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-md bg-emerald-600 text-white shadow-2xs mb-1">
          <Bus className="w-5 h-5" />
        </div>
        <h1 className="text-base font-black tracking-tight text-zinc-900 dark:text-white">
          AP-BUS
        </h1>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
          Smart Shuttle Reservation, Geo Check-in & Self-Service QR Boarding
        </p>
      </div>

      {/* Demo Selector Prompt */}
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Select Demo Persona (Section 19.1)</span>
        </div>
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Select a persona to test the interactive scenario: <strong className="text-zinc-900 dark:text-white font-semibold">Rani</strong> (claims seat on Bus A), <strong className="text-zinc-900 dark:text-white font-semibold">Ryan</strong> (expires at 07:50), <strong className="text-zinc-900 dark:text-white font-semibold">Sarah</strong> (active QR), <strong className="text-rose-600 dark:text-rose-400 font-semibold">Marcus</strong> (6/6 penalties suspended), or <strong className="text-zinc-900 dark:text-white font-semibold">Daniel</strong> (Driver).
        </p>
      </div>

      {/* Account Cards - Sharp Rectangles (6px - 8px) */}
      <div className="space-y-2">
        {DEMO_ACCOUNTS.map((account) => {
          const isNear = account.isNearStop;

          return (
            <button
              key={account.id}
              onClick={() => onSelectAccount(account)}
              className="w-full text-left p-3 rounded-md border transition duration-150 relative group bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500/60 shadow-2xs"
            >
              <div className="flex items-start gap-2.5">
                {/* Avatar with Sharp 6px Corner */}
                <div className="relative shrink-0">
                  <img
                    src={account.avatar}
                    alt={account.name}
                    className="w-10 h-10 rounded-md object-cover ring-1 ring-zinc-300 dark:ring-zinc-700 group-hover:ring-emerald-500 transition"
                  />
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-xs border border-white dark:border-zinc-900 ${
                      isNear ? 'bg-emerald-500' : 'bg-zinc-400'
                    }`}
                  />
                </div>

                {/* Account Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 font-semibold uppercase tracking-wider block">
                        {account.role} · {account.studentId}
                      </span>
                      <h3 className="text-xs font-bold text-zinc-900 dark:text-white truncate">
                        {account.name}
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-xs">
                      {account.role === 'Student' ? `${account.penaltyPoints}/6 pts` : account.role}
                    </span>
                  </div>

                  {/* Physical Location */}
                  <div className="mt-1 flex items-center gap-1 text-[10px]">
                    <MapPin
                      className={`w-3 h-3 shrink-0 ${
                        isNear ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'
                      }`}
                    />
                    <span
                      className={`truncate ${
                        isNear ? 'text-emerald-700 dark:text-emerald-300 font-medium' : 'text-zinc-500'
                      }`}
                    >
                      {account.currentLocationName}
                    </span>
                  </div>

                  {/* Persona description */}
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                    {account.description}
                  </p>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px]">
                <span className="text-zinc-500 dark:text-zinc-400 font-mono">
                  {isNear ? '● GPS Verified (In Range)' : '○ GPS Outside Zone'}
                </span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  <span>Select Persona</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-center pt-1 pb-2">
        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
          Bookings open daily at 06:00 MYT · Check-in T−30m to T−10m · Expiry at T−10m
        </p>
      </div>
    </div>
  );
};
