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
  const [isUnavailableExpanded, setIsUnavailableExpanded] = useState<boolean>(true);

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

  // Filter trips by route, direction, search
  const filteredTrips = useMemo(() => {
    return trips.filter((t) => {
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
  }, [trips, activeFilter, directionFilter, searchQuery]);

  // Separate Available buses from Expired and Unavailable buses per prompt requirements
  const { availableTrips, unavailableTrips } = useMemo(() => {
    const available: BusTrip[] = [];
    const unavailable: BusTrip[] = [];

    filteredTrips.forEach((t) => {
      const status = getBusLifecycleStatus(currentTimeStr, t.departureTime);
      const minsUntil = getMinutesUntilDeparture(currentTimeStr, t.departureTime);
      if (status === 'Expired' || status === 'Not Available Now' || minsUntil < 0) {
        unavailable.push(t);
      } else {
        available.push(t);
      }
    });

    available.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    unavailable.sort((a, b) => a.departureTime.localeCompare(b.departureTime));

    return { availableTrips: available, unavailableTrips: unavailable };
  }, [filteredTrips, currentTimeStr]);

  const renderTripCard = (trip: BusTrip, isUnavailableSection = false) => {
    const minsUntil = getMinutesUntilDeparture(currentTimeStr, trip.departureTime);
    const isTimePassed = minsUntil < 0;
    const full = isBusFull(trip);
    const existingBooking = currentBookings.find((b) => b.tripId === trip.id);
    const bookedByCurrentUser = Boolean(existingBooking);
    const seatsLeft = (trip.seatedCapacity ?? trip.totalSeats ?? 40) - trip.bookedSeatIds.length;
    const isWaitlisted = waitlistTripIds.includes(trip.id);

    const fromStop = APU_STOPS.find((s) => s.id === trip.fromStopId);
    const toStop = APU_STOPS.find((s) => s.id === trip.toStopId);
    const normalize = (s: string) => s.trim().toLowerCase();
    const hasActiveRouteBooking = currentBookings.some(
      (b) =>
        (b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED') &&
        normalize(b.fromStopName) === normalize(fromStop?.name || '') &&
        normalize(b.toStopName) === normalize(toStop?.name || '')
    );

    const isTurnedGrayByLimit = isLimitReached && !bookedByCurrentUser;
    const tripBusStatus = getBusLifecycleStatus(currentTimeStr, trip.departureTime);

    return (
      <div
        key={trip.id}
        className={`p-3 rounded-md border transition relative ${
          isUnavailableSection
            ? 'bg-zinc-100/70 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800/60 opacity-60 grayscale'
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
              <Clock className={`w-3 h-3 ${isUnavailableSection || isTurnedGrayByLimit ? 'text-zinc-400' : 'text-emerald-600 dark:text-emerald-400'}`} />
              <span className={`text-xs font-extrabold ${isUnavailableSection ? 'text-zinc-500 line-through' : isTurnedGrayByLimit ? 'text-zinc-500' : 'text-zinc-900 dark:text-white'}`}>
                {formatTime12h(trip.departureTime)}
              </span>
              <span className="text-[10px] text-zinc-400">({trip.departureTime})</span>

              {/* BUS STATUS INDICATOR */}
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-xs font-mono font-bold uppercase tracking-wider ${
                  tripBusStatus === 'Arrived'
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 animate-pulse'
                    : tripBusStatus === 'Waiting'
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                    : tripBusStatus === 'On the Way'
                    ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                    : tripBusStatus === 'Depart'
                    ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700'
                }`}
              >
                bus status: {tripBusStatus}
              </span>

              {bookedByCurrentUser && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-xs bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                  <CheckCircle className="w-2.5 h-2.5" />
                  Booked
                </span>
              )}
              {isTurnedGrayByLimit && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-xs bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                  Limit 2/2 Reached
                </span>
              )}
              {hasActiveRouteBooking && !bookedByCurrentUser && !isTurnedGrayByLimit && !isUnavailableSection && (
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-xs bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Route Booked (1/day)
                </span>
              )}
            </div>

            <h4 className={`text-xs font-bold mt-1 truncate ${isUnavailableSection ? 'text-zinc-500' : isTurnedGrayByLimit ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
              {trip.routeName}
            </h4>

            {/* Capacity / Status Indicator */}
            <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500">
              {isUnavailableSection ? (
                <span className="text-zinc-500 font-semibold font-mono flex items-center gap-1">
                  ● {isTimePassed ? 'Schedule Passed' : 'Not Available Now'}
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
              ) : !isUnavailableSection && hasActiveRouteBooking ? (
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
            {!isUnavailableSection && !isTurnedGrayByLimit && (
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

            {bookedByCurrentUser ? (
              <button
                onClick={() => existingBooking && onRequestCancel(existingBooking)}
                className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 transition flex items-center gap-1"
                title="Cancel this booking (free before check-in, 1 minor penalty after check-in)"
              >
                <Trash2 className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            ) : isUnavailableSection ? (
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider py-1 px-2 rounded-xs bg-zinc-200/50 dark:bg-zinc-800/40">
                {isTimePassed ? 'Passed' : 'Unavailable'}
              </span>
            ) : isTurnedGrayByLimit ? (
              <button
                disabled
                className="px-2.5 py-1 rounded-sm text-xs font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed border border-zinc-300 dark:border-zinc-700 shadow-2xs"
                title="You already have 2 active bookings. Cancel one reservation to book another seat."
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
  };

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

        {/* Search & Direction Toggle Bar */}
        <div className="p-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search route or time..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-sm focus:outline-none focus:border-emerald-500 text-zinc-900 dark:text-white placeholder-zinc-400"
            />
          </div>

          <div className="flex items-center rounded-sm bg-zinc-200 dark:bg-zinc-800 p-0.5 border border-zinc-300 dark:border-zinc-700 shrink-0">
            <button
              onClick={() => setDirectionFilter('all')}
              className={`px-2 py-1 rounded-xs text-[10px] font-semibold transition ${
                directionFilter === 'all'
                  ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              All
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

        {/* Vertical List of Schedules: Available buses first, expired and unavailable buses in separate below section */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {availableTrips.length === 0 && unavailableTrips.length === 0 ? (
            <div className="text-center py-10 text-zinc-400 text-xs">
              No bus schedules found matching this search or direction filter.
            </div>
          ) : (
            <>
              {/* SECTION 1: Available Buses */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider px-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Available Buses ({availableTrips.length})</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Running & Upcoming</span>
                </div>

                {availableTrips.length === 0 ? (
                  <div className="p-3 text-center text-xs text-zinc-500 bg-zinc-50 dark:bg-zinc-950/40 rounded border border-zinc-200 dark:border-zinc-800">
                    No operating buses currently in this window. See upcoming or expired trips below.
                  </div>
                ) : (
                  availableTrips.map((trip) => renderTripCard(trip, false))
                )}
              </div>

              {/* SECTION 2: Expired & Unavailable Buses (Distinct Below Section) */}
              {unavailableTrips.length > 0 && (
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                      <span>Expired & Unavailable Buses ({unavailableTrips.length})</span>
                    </div>
                    <button
                      onClick={() => setIsUnavailableExpanded(!isUnavailableExpanded)}
                      className="text-[10px] font-mono text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 underline"
                    >
                      {isUnavailableExpanded ? 'Collapse' : 'Expand'}
                    </button>
                  </div>

                  {isUnavailableExpanded && (
                    <div className="space-y-2">
                      {unavailableTrips.map((trip) => renderTripCard(trip, true))}
                    </div>
                  )}
                </div>
              )}
            </>
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
