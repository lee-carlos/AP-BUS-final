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
          <span>Campus Persona Hub</span>
        </div>
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Students and <strong className="text-zinc-900 dark:text-white font-semibold">Lecturers</strong> can order and book bus seats with full parity. <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">Bus Drivers</strong> enter a dedicated operations console to select their bus (PIN: 1234), inspect live seating, and confirm passenger attendance.
        </p>
      </div>

      {/* Account Cards Grouped: Passengers (Students & Lecturers) vs Drivers */}
      <div className="space-y-3">
        {/* SECTION 1: Students & Lecturers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-zinc-500 font-bold px-0.5">
            <span>Passengers (Students & Campus Lecturers)</span>
            <span>Can Order Bus</span>
          </div>

          {DEMO_ACCOUNTS.filter((a) => a.role !== 'Driver').map((account) => {
            const isNear = account.isNearStop;

            return (
              <button
                key={account.id}
                onClick={() => onSelectAccount(account)}
                className="w-full text-left p-3 rounded-md border transition duration-150 relative group bg-white dark:bg-zinc-900/90 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500/60 shadow-2xs"
              >
                <div className="flex items-start gap-2.5">
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
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-xs ${
                        account.role === 'Lecturer'
                          ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                      }`}>
                        {account.role === 'Student' ? `${account.penaltyPoints}/6 pts` : account.role}
                      </span>
                    </div>

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

                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                      {account.description}
                    </p>
                  </div>
                </div>

                <div className="mt-2 pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 dark:text-zinc-400 font-mono">
                    {isNear ? '● GPS Verified (In Range)' : '○ GPS Outside Zone'}
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                    <span>Order Bus as {account.role}</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* SECTION 2: Bus Drivers */}
        <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-bold px-0.5">
            <span>Bus Drivers (Operations Portal)</span>
            <span>Assign Bus · PIN: 1234</span>
          </div>

          {DEMO_ACCOUNTS.filter((a) => a.role === 'Driver').map((driver) => (
            <button
              key={driver.id}
              onClick={() => onSelectAccount(driver)}
              className="w-full text-left p-3 rounded-md border transition duration-150 relative group bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80 hover:border-emerald-500 shadow-2xs"
            >
              <div className="flex items-start gap-2.5">
                <div className="relative shrink-0">
                  <img
                    src={driver.avatar}
                    alt={driver.name}
                    className="w-10 h-10 rounded-md object-cover ring-2 ring-emerald-500"
                  />
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-xs bg-emerald-500 border border-white dark:border-zinc-900" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[9px] font-mono text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider block">
                        Bus Driver · {driver.studentId}
                      </span>
                      <h3 className="text-xs font-black text-zinc-900 dark:text-white truncate">
                        {driver.name}
                      </h3>
                    </div>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-xs bg-emerald-600 text-white">
                      DRIVER
                    </span>
                  </div>

                  <p className="text-[10px] text-zinc-600 dark:text-zinc-300 line-clamp-1 mt-1">
                    {driver.description}
                  </p>
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between text-[10px]">
                <span className="text-emerald-700 dark:text-emerald-400 font-mono font-medium">
                  Select Bus & Enter PIN (1234)
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  <span>Enter Driver Console</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="text-center pt-1 pb-2">
        <p className="text-[9px] text-zinc-400 dark:text-zinc-500 font-mono">
          Bookings open daily at 06:00 MYT · Check-in T−30m to T−10m · Expiry at T−10m
        </p>
      </div>
    </div>
  );
};
