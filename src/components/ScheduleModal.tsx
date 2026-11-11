import React, { useState, useMemo } from 'react';
import { BusTrip, Booking } from '../types/bus';
import { formatTime12h, isBusFull, getMinutesUntilDeparture, getBusLifecycleStatus } from '../utils/bookingRules';
import { APU_STOPS } from '../data/apuRoutes';
import {
  X,
  Clock,
  Users,
  Bell,
  BellRing,
  Trash2,
  CheckCircle,
  Filter,
  AlertCircle,
  Search,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

interface ScheduleModalProps {
  trips: BusTrip[];
  currentBookings: Booking[];
  currentTimeStr: string;
  penaltyStrikes?: number;
  onBookTrip: (trip: BusTrip) => void;
  onRequestCancel: (booking: Booking) => void;
  onToggleWaitlist: (tripId: string) => void;
  waitlistTripIds: string[];
  isBookingOpen: boolean;
  onClose: () => void;
  initialRouteFilter?: string | null;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  trips,
  currentBookings,
  currentTimeStr,
  penaltyStrikes = 0,
  onBookTrip,
  onRequestCancel,
  onToggleWaitlist,
  waitlistTripIds,
  isBookingOpen,
  onClose,
  initialRouteFilter,
}) => {
  const [activeFilter, setActiveFilter] = useState<string>(initialRouteFilter || 'all');
  const [directionFilter, setDirectionFilter] = useState<'all' | 'to_apu' | 'from_apu'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Check active booking limit: 2 active bookings maximum
  const activeBookingsCount = currentBookings.filter(
    (b) => b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED'
  ).length;
  const isLimitReached = activeBookingsCount >= 2;

  const routes = [
    { id: 'all', label: 'All Stops' },
    { id: 'lrt', label: 'LRT Bukit Jalil' },
    { id: 'fortune-park', label: 'Fortune Park' },
    { id: 'city-of-green', label: 'City of Green' },
    { id: 'kingston', label: 'Kingston Hotel' },
    { id: 'bloomsvale', label: 'Bloomsvale' },
    { id: 'bayu-jalil', label: 'Bayu Jalil' },
    { id: 'kuchai-sentral', label: 'Kuchai Sentral' },
    { id: 'm-vertica', label: 'M Vertica' },
    { id: 'divo', label: "D'Ivo" },
    { id: 'maple', label: 'Maple' },
    { id: 'parkhill', label: 'Parkhill' },
    { id: 'mosque', label: 'Mosque (Fri)' },
  ];

  // Filter and sort trips:
  // 1. Filter by specific route, direction (to APU vs from APU), and search query
  // 2. Sequences: unavailable bus (time has passed) is placed at the BELOW of the list
  const filteredAndSortedTrips = useMemo(() => {
    const list = trips.filter((t) => {
      const matchesRoute = activeFilter === 'all' || t.routeId === activeFilter;
      const isToApu = t.toStopId === 'apu';
      const isFromApu = t.fromStopId === 'apu';

      const matchesDirection =
        directionFilter === 'all'
          ? true
          : directionFilter === 'to_apu'
          ? isToApu
          : isFromApu;

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.routeName.toLowerCase().includes(q) ||
        t.departureTime.includes(q) ||
        (t.notes && t.notes.toLowerCase().includes(q));

      return matchesRoute && matchesDirection && matchesSearch;
    });

    // Sequence sorting: Available buses first, unavailable buses (passed schedule) at the bottom
    return list.sort((a, b) => {
      const aPassed = getMinutesUntilDeparture(currentTimeStr, a.departureTime) < 0;
      const bPassed = getMinutesUntilDeparture(currentTimeStr, b.departureTime) < 0;

      if (aPassed && !bPassed) return 1; // a moves to bottom
      if (!aPassed && bPassed) return -1; // b moves to bottom
      return a.departureTime.localeCompare(b.departureTime);
    });
  }, [trips, activeFilter, directionFilter, searchQuery, currentTimeStr]);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl max-h-[88vh] flex flex-col overflow-hidden transition-colors">
        {/* Header */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/80">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-xs bg-emerald-500 animate-pulse" />
              <h2 className="text-sm font-extrabold text-zinc-900 dark:text-white">APU Bus Schedules</h2>
            </div>
            <p className="text-[10px] text-zinc-500">
              Daily assigned timetable · First-Come, First-Served (FCFS)
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 06:00 AM Booking Window Rule Banner */}
        {!isBookingOpen && (
          <div className="bg-zinc-100 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 text-zinc-500" />
            <span>
              <strong>Booking opens at 06:00 AM.</strong> Daily bookings unlocked at 06:00 MYT.
            </span>
          </div>
        )}

        {/* Limit Reached Banner if 2 Active Bookings */}
        {isLimitReached && (
          <div className="bg-zinc-100 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-center justify-between text-xs text-zinc-700 dark:text-zinc-300">
            <div className="flex items-center gap-1.5 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-zinc-500" />
              <span>
                <strong>Booking Limit Reached (2/2 Active):</strong> All other bookings turned gray. Cancel a seat to unlock new reservations.
              </span>
            </div>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
              LIMIT (2)
            </span>
          </div>
        )}

        {/* Search Bar matching Main Page */}
        <div className="p-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by stop, route, or time (e.g. LRT, M Vertica, 08:00)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Direction Filter Tabs: All, To APU, From APU */}
          <div className="flex items-center gap-1 bg-zinc-200/70 dark:bg-zinc-800/80 p-0.5 rounded-sm border border-zinc-300 dark:border-zinc-700 shrink-0">
            <button
              onClick={() => setDirectionFilter('all')}
              className={`px-2 py-1 rounded-xs text-[10px] font-semibold transition ${
                directionFilter === 'all'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              All Routes
            </button>
            <button
              onClick={() => setDirectionFilter('to_apu')}
              className={`px-2 py-1 rounded-xs text-[10px] font-semibold transition flex items-center gap-0.5 ${
                directionFilter === 'to_apu'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span>➔ APU</span>
            </button>
            <button
              onClick={() => setDirectionFilter('from_apu')}
              className={`px-2 py-1 rounded-xs text-[10px] font-semibold transition flex items-center gap-0.5 ${
                directionFilter === 'from_apu'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <span>APU ➔</span>
            </button>
          </div>
        </div>

        {/* Filter Chips Bar (Sharp 6px Tabs for Specific Stops) */}
        <div className="px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-1 overflow-x-auto no-scrollbar">
          <Filter className="w-3 h-3 text-zinc-400 shrink-0 mr-0.5" />
          {routes.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveFilter(r.id)}
              className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold whitespace-nowrap transition border ${
                activeFilter === r.id
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Vertical List of Schedules with Sequence: unavailable passed buses at the bottom */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredAndSortedTrips.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 text-xs">
              No bus schedules found matching this search or direction filter.
            </div>
          ) : (
            filteredAndSortedTrips.map((trip) => {
              const minsUntil = getMinutesUntilDeparture(currentTimeStr, trip.departureTime);
              const isTimePassed = minsUntil < 0;
              const full = isBusFull(trip);
              const existingBooking = currentBookings.find((b) => b.tripId === trip.id);
              const bookedByCurrentUser = Boolean(existingBooking);
              const seatsLeft = (trip.seatedCapacity ?? trip.totalSeats ?? 40) - trip.bookedSeatIds.length;
              const isWaitlisted = waitlistTripIds.includes(trip.id);

              // Check if user already holds an active booking from this departure to this destination today
              const fromStop = APU_STOPS.find((s) => s.id === trip.fromStopId);
              const toStop = APU_STOPS.find((s) => s.id === trip.toStopId);
              const normalize = (s: string) => s.trim().toLowerCase();
              const hasActiveRouteBooking = currentBookings.some(
                (b) =>
                  (b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED') &&
                  normalize(b.fromStopName) === normalize(fromStop?.name || '') &&
                  normalize(b.toStopName) === normalize(toStop?.name || '')
              );

              // Gray limit UI condition:
              // When user has 2 active bookings, all other unbooked trips turn gray as sign that booking is on limit!
              const isTurnedGrayByLimit = isLimitReached && !bookedByCurrentUser;
              const tripBusStatus = getBusLifecycleStatus(currentTimeStr, trip.departureTime);

              return (
                <div
                  key={trip.id}
                  className={`p-3 rounded-md border transition relative ${
                    isTimePassed
                      ? 'bg-zinc-100/60 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800/40 opacity-50 grayscale'
                      : bookedByCurrentUser
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-800/60 shadow-2xs'
                      : isTurnedGrayByLimit
                      ? 'bg-zinc-100 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-500 opacity-60 grayscale'
                      : full
                      ? 'bg-zinc-50/50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800/60 opacity-60'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-700 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* Left: Time and Route */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 font-mono flex-wrap">
                        <Clock className={`w-3 h-3 ${isTimePassed || isTurnedGrayByLimit ? 'text-zinc-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
                        <span className={`text-xs font-extrabold ${isTimePassed ? 'text-zinc-500 line-through' : isTurnedGrayByLimit ? 'text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
                          {formatTime12h(trip.departureTime)}
                        </span>
                        <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-1 py-0.2 rounded-xs font-mono text-zinc-600 dark:text-zinc-300">
                          bus status: {tripBusStatus}
                        </span>
                        {isTurnedGrayByLimit ? (
                          <span className="text-[9px] bg-zinc-200 dark:bg-zinc-800 text-zinc-500 px-1 py-0.2 rounded-xs font-mono uppercase">
                            Limit Reached (2/2)
                          </span>
                        ) : trip.notes ? (
                          <span className="text-[9px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1 py-0.2 rounded-xs truncate max-w-[120px]">
                            {trip.notes}
                          </span>
                        ) : null}
                      </div>

                      <h4 className={`text-xs font-bold mt-1 truncate ${isTurnedGrayByLimit ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                        {trip.routeName}
                      </h4>

                      {/* Capacity / Status Indicator */}
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
                        {isTimePassed ? (
                          <span className="text-zinc-500 font-semibold font-mono flex items-center gap-1">
                            ● Not Available (Schedule Passed)
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <strong className={full ? 'text-zinc-500' : isTurnedGrayByLimit ? 'text-zinc-500' : 'text-emerald-700 dark:text-emerald-400 font-mono'}>
                              {full ? 'FULL' : `${seatsLeft} seats left`}
                            </strong>
                          </span>
                        )}

                        {bookedByCurrentUser && existingBooking ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
                            <CheckCircle className="w-3 h-3" /> Booked (Seat {existingBooking.seatId})
                          </span>
                        ) : !isTimePassed && hasActiveRouteBooking ? (
                          <span className="text-amber-700 dark:text-amber-400 font-medium">
                            Active on Route Today
                          </span>
                        ) : isTurnedGrayByLimit ? (
                          <span className="text-zinc-500 font-mono">
                            Limit (2) Active
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Right Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0 self-center">
                      {!isTimePassed && !isTurnedGrayByLimit && (
                        <button
                          onClick={() => onToggleWaitlist(trip.id)}
                          className={`p-1.5 rounded-sm border transition ${
                            isWaitlisted
                              ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400'
                              : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                          }`}
                          title="Seat alert on FCFS claim basis"
                        >
                          {isWaitlisted ? (
                            <BellRing className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                          ) : (
                            <Bell className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}

                      {isTimePassed ? (
                        <button
                          disabled
                          className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                          title="This bus schedule has passed. Booking is closed."
                        >
                          Not Available
                        </button>
                      ) : bookedByCurrentUser && existingBooking ? (
                        <button
                          onClick={() => onRequestCancel(existingBooking)}
                          className="px-2.5 py-1 rounded-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3 h-3" /> Cancel
                        </button>
                      ) : isTurnedGrayByLimit ? (
                        <button
                          disabled
                          className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-300 dark:border-zinc-700 shadow-2xs"
                          title="You have reached the maximum 2 active bookings limit. Cancel an existing booking to book another bus."
                        >
                          Limit Reached
                        </button>
                      ) : hasActiveRouteBooking ? (
                        <button
                          disabled
                          className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-700 shadow-2xs"
                          title="You already have an active booked seat for this route today. Only 1 active seat per route is allowed in a day."
                        >
                          Route Booked
                        </button>
                      ) : (
                        <button
                          disabled={full || !isBookingOpen}
                          onClick={() => onBookTrip(trip)}
                          className={`px-3 py-1 rounded-sm text-xs font-bold transition shadow-2xs ${
                            full
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-200 dark:border-zinc-700'
                              : !isBookingOpen
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {full ? 'Full' : 'Book'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 text-center text-[10px] text-zinc-500 font-mono">
          FCFS allocation · Tap bell icon to subscribe to Seat Alerts
        </div>
      </div>
    </div>
  );
};
