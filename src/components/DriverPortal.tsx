import React, { useState, useMemo } from 'react';
import { BusTrip, Booking, DemoUser, LocationCoord } from '../types/bus';
import { formatTime12h, getMinutesUntilDeparture, getBusLifecycleStatus } from '../utils/bookingRules';
import { APU_STOPS, ROUTE_WAYPOINTS } from '../data/apuRoutes';
import {
  Bus,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Lock,
  KeyRound,
  AlertTriangle,
  Users,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Check,
  X,
  Radio,
  DoorOpen,
  ChevronDown,
  ChevronUp,
  User,
  ArrowRight,
  Navigation,
  ArrowLeftRight,
  ShieldAlert,
} from 'lucide-react';
import { DriverRouteMap } from './DriverRouteMap';

interface DriverPortalProps {
  currentDriver: DemoUser;
  trips: BusTrip[];
  allBookings: Booking[];
  users: DemoUser[];
  currentTimeStr: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onSwitchDriver: () => void;
  onManualConfirmBoarding: (bookingId: string) => void;
  onToggleBoarding: (tripId: string) => void;
  onManualSetTripStatus: (tripId: string, status: 'ARRIVED' | 'DEPARTED') => void;
  onResetDemo: () => void;
  apiKey?: string;
}

// 4-digit security authorization code per APU driver guidelines
const DRIVER_AUTH_CODE = '1234';


export const DriverPortal: React.FC<DriverPortalProps> = ({
  currentDriver,
  trips,
  allBookings,
  users,
  currentTimeStr,
  theme,
  onToggleTheme,
  onSwitchDriver,
  onManualConfirmBoarding,
  onToggleBoarding,
  onManualSetTripStatus,
  onResetDemo,
  apiKey,
}) => {
  // Determine driver's dedicated assigned route corridor
  // Each driver is assigned to one corridor: back-and-forth round trips only (no cross-route checking)
  const assignedCorridorId = useMemo<string>(() => {
    if (currentDriver.assignedRouteId) return currentDriver.assignedRouteId;
    if (currentDriver.id === 'driver-muthu') return 'fortune-park';
    return 'lrt'; // Captain Kamal default: LRT Bukit Jalil ⇄ APU Campus
  }, [currentDriver]);

  const assignedCorridorName = useMemo<string>(() => {
    if (currentDriver.assignedCorridorName) return currentDriver.assignedCorridorName;
    if (currentDriver.id === 'driver-muthu') return 'Fortune Park ⇄ APU Campus';
    return 'LRT Bukit Jalil ⇄ APU Campus';
  }, [currentDriver]);

  // STRICT SINGLE-CORRIDOR RESTRICTION:
  // Driver is ONLY allowed to see and drive schedules for their assigned corridor back and forth
  const driverAssignedTrips = useMemo(() => {
    return trips.filter((t) => t.routeId === assignedCorridorId);
  }, [trips, assignedCorridorId]);

  // Currently assigned / selected bus trip ID
  const [assignedTripId, setAssignedTripId] = useState<string | null>(null);

  // Direction filter for driver's assigned corridor (All Roundtrips, Outbound to APU, Inbound to Stop)
  const [directionFilter, setDirectionFilter] = useState<'all' | 'to_apu' | 'from_apu'>('all');

  // Filtered trips for Step 1 based strictly on assigned corridor
  const filteredCorridorTrips = useMemo(() => {
    return driverAssignedTrips.filter((t) => {
      if (directionFilter === 'to_apu' && t.toStopId !== 'apu') return false;
      if (directionFilter === 'from_apu' && t.fromStopId !== 'apu') return false;
      return true;
    });
  }, [driverAssignedTrips, directionFilter]);

  // Bus selection PIN verification modal state
  const [pendingTripToAssign, setPendingTripToAssign] = useState<BusTrip | null>(null);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Inspector trip (the trip the driver is inspecting seats/manifest for)
  const [selectedScheduleTripId, setSelectedScheduleTripId] = useState<string>(() => {
    const firstAvailable = driverAssignedTrips.find((t) => t.id === 'demo-a-0800') || driverAssignedTrips[0];
    return firstAvailable ? firstAvailable.id : 'demo-a-0800';
  });

  // Manual boarding QR fallback confirmation modal
  const [manualConfirmTarget, setManualConfirmTarget] = useState<{
    booking: Booking;
    user: DemoUser | undefined;
  } | null>(null);
  const [manualPinInput, setManualPinInput] = useState<string>('');
  const [manualPinError, setManualPinError] = useState<string | null>(null);

  // Manual Arrived / Departed action modal with PIN code confirmation
  const [pendingManualStatusAction, setPendingManualStatusAction] = useState<'ARRIVED' | 'DEPARTED' | null>(null);
  const [statusPinInput, setStatusPinInput] = useState<string>('');
  const [statusPinError, setStatusPinError] = useState<string | null>(null);

  // Driver Simulation Range State (like the student check-in range toggle)
  const [driverIsInRange, setDriverIsInRange] = useState<boolean>(true);

  // Collapsible toggle for expired/unavailable buses in bottom timetable
  const [isPassedExpanded, setIsPassedExpanded] = useState<boolean>(false);
  const [isSelectionUnavailableExpanded, setIsSelectionUnavailableExpanded] = useState<boolean>(false);

  // Success toast notice
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Google Maps bounding box restricted strictly to Kuala Lumpur & Bukit Jalil 57000 corridor
  const klMapBounds = useMemo(() => ({
    north: 3.140,
    south: 3.020,
    west: 101.650,
    east: 101.745,
  }), []);

  // Separate Available vs Expired/Unavailable trips for Step 1
  const { availableSelectionTrips, unavailableSelectionTrips } = useMemo(() => {
    const available: BusTrip[] = [];
    const unavailable: BusTrip[] = [];

    filteredCorridorTrips.forEach((t) => {
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

    return { availableSelectionTrips: available, unavailableSelectionTrips: unavailable };
  }, [filteredCorridorTrips, currentTimeStr]);

  // Sorted schedules for the bottom timetable on the driver page:
  // STRICTLY FILTERED to the assigned corridor (no cross-route checking permitted)
  const { runningAndUpcomingTrips, passedTrips } = useMemo(() => {
    const upcoming: BusTrip[] = [];
    const passed: BusTrip[] = [];

    driverAssignedTrips.forEach((t) => {
      const status = getBusLifecycleStatus(currentTimeStr, t.departureTime);
      const minsUntil = getMinutesUntilDeparture(currentTimeStr, t.departureTime);
      if (status === 'Expired' || minsUntil < 0) {
        passed.push(t);
      } else {
        upcoming.push(t);
      }
    });

    upcoming.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    passed.sort((a, b) => a.departureTime.localeCompare(b.departureTime));

    return { runningAndUpcomingTrips: upcoming, passedTrips: passed };
  }, [driverAssignedTrips, currentTimeStr]);

  // Current trip under driver inspection (must be within assigned corridor)
  const activeInspectionTrip = useMemo(() => {
    const match = driverAssignedTrips.find((t) => t.id === selectedScheduleTripId);
    return match || driverAssignedTrips[0] || trips[0];
  }, [driverAssignedTrips, selectedScheduleTripId, trips]);

  // Bookings for currently inspected trip
  const activeTripBookings = useMemo(() => {
    if (!activeInspectionTrip) return [];
    return allBookings.filter((b) => b.tripId === activeInspectionTrip.id);
  }, [allBookings, activeInspectionTrip]);

  // Seat metrics (Seat: 40, Booked: X, Check-in: Y, Inside: Z)
  const metrics = useMemo(() => {
    const totalSeats = activeInspectionTrip?.seatedCapacity ?? activeInspectionTrip?.totalSeats ?? 40;
    let bookedCount = 0;
    let checkInCount = 0;
    let insideCount = 0;

    activeTripBookings.forEach((b) => {
      if (b.status === 'RESERVED') {
        bookedCount++;
      } else if (b.status === 'CHECKED_IN') {
        bookedCount++;
        checkInCount++;
      } else if (b.status === 'BOARDED') {
        bookedCount++;
        checkInCount++;
        insideCount++;
      }
    });

    // Passengers who have completed GPS check-in but haven't entered the bus yet
    const waitingOutsideCount = Math.max(0, checkInCount - insideCount);

    return {
      totalSeats,
      bookedCount,
      checkInCount,
      insideCount,
      waitingOutsideCount,
    };
  }, [activeInspectionTrip, activeTripBookings]);

  // Seat mapping (Seat ID -> Booking & Status)
  const seatStatusMap = useMemo(() => {
    const map = new Map<string, { booking: Booking; user?: DemoUser }>();
    activeTripBookings.forEach((b) => {
      if (b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED') {
        const u = users.find((usr) => usr.id === b.userId);
        map.set(b.seatId, { booking: b, user: u });
      }
    });
    return map;
  }, [activeTripBookings, users]);

  // Waypoints for the driver's current active corridor in Bukit Jalil 57000
  const activeCorridorWaypoints = useMemo<LocationCoord[]>(() => {
    if (activeInspectionTrip.routeId && ROUTE_WAYPOINTS[activeInspectionTrip.routeId]) {
      const pts = ROUTE_WAYPOINTS[activeInspectionTrip.routeId];
      if (activeInspectionTrip.fromStopId === 'apu') {
        return [...pts].reverse();
      }
      return pts;
    }
    return ROUTE_WAYPOINTS['lrt'] || [];
  }, [activeInspectionTrip]);

  // Step 1 Handler: Driver selects a bus and is prompted for PIN 1234
  const handleSelectTripForPIN = (trip: BusTrip) => {
    setPendingTripToAssign(trip);
    setPinInput('');
    setPinError(null);
  };

  const handleConfirmPinAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput !== DRIVER_AUTH_CODE) {
      setPinError('Invalid 4-digit code. Please enter 1234.');
      return;
    }

    if (pendingTripToAssign) {
      setAssignedTripId(pendingTripToAssign.id);
      setSelectedScheduleTripId(pendingTripToAssign.id);
      showToast(`Bus Assigned: ${pendingTripToAssign.routeName} (${pendingTripToAssign.departureTime})`);
    }
    setPendingTripToAssign(null);
    setPinInput('');
    setPinError(null);
  };

  // Step 2: Manual Boarding QR Confirmation
  const handleInitiateManualBoarding = (booking: Booking, user?: DemoUser) => {
    setManualConfirmTarget({ booking, user });
    setManualPinInput('');
    setManualPinError(null);
  };

  const handleConfirmManualBoarding = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPinInput !== DRIVER_AUTH_CODE) {
      setManualPinError('Invalid security code. Enter 1234 to verify conscious driver confirmation.');
      return;
    }

    if (manualConfirmTarget) {
      onManualConfirmBoarding(manualConfirmTarget.booking.id);
      showToast(`Attendance Confirmed: ${manualConfirmTarget.user?.name || 'Passenger'} (Seat ${manualConfirmTarget.booking.seatId}) is now Inside.`);
    }

    setManualConfirmTarget(null);
    setManualPinInput('');
    setManualPinError(null);
  };

  // Manual Status Change Handler (Mark Arrived / Mark Departed) with Range Check & PIN
  const handleInitiateStatusAction = (action: 'ARRIVED' | 'DEPARTED') => {
    if (!driverIsInRange) {
      showToast('Action Blocked: Driver is Out of Range (Must be within bus bay radius).');
      return;
    }
    setPendingManualStatusAction(action);
    setStatusPinInput('');
    setStatusPinError(null);
  };

  const handleConfirmStatusAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (statusPinInput !== DRIVER_AUTH_CODE) {
      setStatusPinError('Invalid security code. Enter 1234 to verify conscious driver confirmation.');
      return;
    }

    if (pendingManualStatusAction && assignedTripId) {
      onManualSetTripStatus(assignedTripId, pendingManualStatusAction);
      if (pendingManualStatusAction === 'ARRIVED') {
        showToast('Bus Arrived: 2-minute departure countdown started! Passengers can scan to depart.');
      } else {
        showToast('Bus Departed: Passengers checked-in who did not scan to depart penalized 2 scores.');
      }
    }

    setPendingManualStatusAction(null);
    setStatusPinInput('');
    setStatusPinError(null);
  };

  const mapsKey = apiKey || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

  // ==========================================
  // VIEW 1: Bus & Schedule Selection (BEFORE PIN)
  // Dedicated to assigned corridor (No cross-route checking)
  // ==========================================
  if (!assignedTripId) {
    return (
      <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-3 sm:p-4 overflow-y-auto transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-emerald-600 flex items-center justify-center text-white">
              <Bus className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-mono text-[9px] text-emerald-700 dark:text-emerald-400 font-bold uppercase">
                <span>Driver Operations Portal</span>
                <span>· {currentDriver.studentId}</span>
              </div>
              <h2 className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white">{currentDriver.name}</h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme Toggle for Driver */}
            <button
              onClick={onToggleTheme}
              className="w-7 h-7 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-emerald-400" /> : <Moon className="w-3.5 h-3.5 text-emerald-600" />}
            </button>

            <button
              onClick={onSwitchDriver}
              className="px-2 py-1 text-xs font-mono rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1"
            >
              <LogOut className="w-3 h-3" />
              <span>Switch User</span>
            </button>
          </div>
        </div>

        {/* Dedicated Route Corridor Policy Notice */}
        <div className="my-3 p-3 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800/80 shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
              <ArrowLeftRight className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Assigned Corridor: {assignedCorridorName}</span>
            </div>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-600 text-white uppercase">
              Route Locked
            </span>
          </div>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed font-mono">
            <strong>Single Corridor Policy:</strong> Each APU shuttle driver is assigned strictly to their designated route corridor and operates back-and-forth round trips between depart and destination (Bukit Jalil 57000). Cross-checking other routes or multi-destination driving is restricted.
          </p>
        </div>

        {/* Corridor Round-Trip Filter Chips (Back-and-Forth Only) */}
        <div className="mb-3 space-y-1.5">
          <label className="text-[10px] font-mono uppercase font-bold text-zinc-500 tracking-wider block">
            Corridor Round-Trip Schedule Filter:
          </label>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar font-mono text-xs">
            <button
              onClick={() => setDirectionFilter('all')}
              className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition border ${
                directionFilter === 'all'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
              }`}
            >
              All Round Trips ({driverAssignedTrips.length})
            </button>
            <button
              onClick={() => setDirectionFilter('to_apu')}
              className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition border ${
                directionFilter === 'to_apu'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
              }`}
            >
              ➔ APU Campus (Outbound)
            </button>
            <button
              onClick={() => setDirectionFilter('from_apu')}
              className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition border ${
                directionFilter === 'from_apu'
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                  : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
              }`}
            >
              APU ➔ (Return)
            </button>
          </div>
        </div>

        {/* Timetable List: Strictly for Assigned Corridor */}
        <div className="flex-1 space-y-4">
          {/* SECTION 1: Available Buses for Assigned Corridor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider px-0.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Available Bus Schedules ({availableSelectionTrips.length})</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Running & Upcoming</span>
            </div>

            {availableSelectionTrips.length === 0 ? (
              <div className="p-3 text-center text-xs text-zinc-500 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 font-mono">
                No active operating buses on {assignedCorridorName} right now. See past or upcoming schedules below.
              </div>
            ) : (
              availableSelectionTrips.map((trip) => {
                const tripBusStatus = getBusLifecycleStatus(currentTimeStr, trip.departureTime);
                const isReturn = trip.fromStopId === 'apu';

                return (
                  <button
                    key={trip.id}
                    onClick={() => handleSelectTripForPIN(trip)}
                    className="w-full text-left p-3 rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500/80 transition shadow-2xs group flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col items-center justify-center shrink-0">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[10px] font-mono font-bold text-zinc-800 dark:text-zinc-200">{trip.departureTime}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">{formatTime12h(trip.departureTime)}</span>
                          <span className="text-zinc-500">· Cap: {trip.seatedCapacity ?? trip.totalSeats ?? 40} Seats</span>
                          <span className={`text-[8px] font-bold px-1 rounded uppercase ${
                            isReturn ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                          }`}>
                            {isReturn ? 'Return' : 'Outbound'}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-zinc-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                          {trip.routeName}
                        </h4>
                        <div className="text-[10px] font-mono text-zinc-500">
                          Status: <strong className="text-emerald-700 dark:text-emerald-400">{tripBusStatus}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform">
                      <span>Select & Drive</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* SECTION 2: Expired & Unavailable Buses (Gray Section) */}
          {unavailableSelectionTrips.length > 0 && (
            <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider px-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600" />
                  <span>Past & Inactive {assignedCorridorName} Schedules ({unavailableSelectionTrips.length})</span>
                </div>
                <button
                  onClick={() => setIsSelectionUnavailableExpanded(!isSelectionUnavailableExpanded)}
                  className="text-[10px] font-mono text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 underline"
                >
                  {isSelectionUnavailableExpanded ? 'Collapse' : 'Expand'}
                </button>
              </div>

              {isSelectionUnavailableExpanded && (
                <div className="space-y-2">
                  {unavailableSelectionTrips.map((trip) => {
                    const tripBusStatus = getBusLifecycleStatus(currentTimeStr, trip.departureTime);
                    return (
                      <button
                        key={trip.id}
                        onClick={() => handleSelectTripForPIN(trip)}
                        className="w-full text-left p-2.5 rounded-md bg-zinc-100/70 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800/60 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded bg-zinc-200 dark:bg-zinc-800 flex flex-col items-center justify-center shrink-0">
                            <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">{trip.departureTime}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {formatTime12h(trip.departureTime)} · Cap: {trip.seatedCapacity ?? trip.totalSeats ?? 40}
                            </div>
                            <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
                              {trip.routeName}
                            </h4>
                            <div className="text-[9px] font-mono text-zinc-500">
                              Status: {tripBusStatus}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-[10px] font-mono text-zinc-500">
                          Inspect & Drive
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal: Enter 4-Digit Code to unlock bus (1234) */}
        {pendingTripToAssign && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <div>
                  <span className="text-[9px] uppercase font-mono font-bold text-emerald-700 dark:text-emerald-400 block">
                    Driver Authentication Required
                  </span>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white">Unlock {pendingTripToAssign.routeName}</h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">Departure: {formatTime12h(pendingTripToAssign.departureTime)}</p>
                </div>
                <button
                  onClick={() => setPendingTripToAssign(null)}
                  className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleConfirmPinAssign} className="space-y-3">
                <div>
                  <label className="text-[10px] uppercase font-mono text-zinc-600 dark:text-zinc-400 block mb-1">
                    Enter 4-Digit Bus Code (Default: 1234)
                  </label>
                  <input
                    type="password"
                    maxLength={4}
                    autoFocus
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setPinError(null);
                    }}
                    placeholder="••••"
                    className="w-full text-center text-lg tracking-widest font-mono py-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500"
                  />
                  {pinError && (
                    <p className="text-[10px] text-rose-500 font-mono mt-1">{pinError}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPinInput('1234');
                      setPinError(null);
                    }}
                    className="flex-1 py-2 rounded text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200"
                  >
                    Auto-Fill 1234
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded text-xs font-mono font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xs"
                  >
                    Confirm & Enter Bus
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // VIEW 2: Active Driver Operations Page
  // Dedicated to assigned corridor round trips only
  // ==========================================
  const assignedTrip = trips.find((t) => t.id === assignedTripId) || driverAssignedTrips[0] || trips[0];
  const tripBusLifecycleStatus = getBusLifecycleStatus(currentTimeStr, activeInspectionTrip.departureTime);

  // Generate rows for vertical layout:
  // Every APU shuttle bus standard cabin always displays the full 40 seats (10 rows x 4 seats: A, B | aisle | C, D)
  const capacity = 40;
  const cabinRows = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-y-auto transition-colors">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="sticky top-0 z-50 px-3 py-2 bg-emerald-900 border-b border-emerald-700 text-emerald-100 text-xs font-mono flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-[10px] uppercase font-bold text-emerald-300">
            Dismiss
          </button>
        </div>
      )}

      {/* Driver Operations Top Navigation */}
      <div className="p-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded bg-emerald-600 flex items-center justify-center text-white shrink-0">
            <Bus className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-mono text-[9px]">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold uppercase truncate">{currentDriver.name}</span>
              <span className="text-zinc-400">· {currentDriver.studentId}</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-zinc-900 dark:text-white truncate">
              <span>Driving:</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-mono truncate">{assignedTrip.routeName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Driver Theme Toggle */}
          <button
            onClick={onToggleTheme}
            className="w-7 h-7 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5 text-emerald-400" /> : <Moon className="w-3.5 h-3.5 text-emerald-600" />}
          </button>

          <button
            onClick={() => setAssignedTripId(null)}
            className="px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:border-emerald-500 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-[10px] font-mono font-semibold transition"
            title="Change schedule within your assigned route corridor"
          >
            Switch Bus
          </button>
          <button
            onClick={onSwitchDriver}
            className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            title="Switch User Account"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Corridor Restriction Indicator */}
      <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] font-mono">
        <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
          <ArrowLeftRight className="w-3 h-3" />
          <span>Assigned: {assignedCorridorName} (Back-and-Forth Only)</span>
        </div>
        <span className="text-zinc-500 text-[9px]">Bukit Jalil 57000 Corridor</span>
      </div>

      {/* Route Transit Map (Clean Maps + Route + Vehicle Graphic) */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
        <DriverRouteMap
          trip={activeInspectionTrip}
          busStatus={tripBusLifecycleStatus}
          theme={theme}
        />
      </div>

      {/* ========================================================================= */}
      {/* SECTION DIRECTLY ABOVE PASSENGER CAPACITY: MANUAL ARRIVED & DEPART BUTTONS */}
      {/* ========================================================================= */}
      <div className="p-3 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Driver Transit Signal Controls
            </span>
          </div>

          {/* Bus Status Indicator */}
          <span
            className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-sm uppercase tracking-wider ${
              tripBusLifecycleStatus === 'Arrived'
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 animate-pulse'
                : tripBusLifecycleStatus === 'Waiting'
                ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
                : tripBusLifecycleStatus === 'On the Way'
                ? 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                : tripBusLifecycleStatus === 'Depart'
                ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-700'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700'
            }`}
          >
            Bus Status: {tripBusLifecycleStatus}
          </span>
        </div>

        {/* Driver GPS Proximity & Simulation Range Switch */}
        <div className="flex items-center justify-between text-[11px] p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${driverIsInRange ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="text-zinc-700 dark:text-zinc-300">
              Proximity:{' '}
              <strong className={driverIsInRange ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-500'}>
                {driverIsInRange ? 'In Range (Bus Stop Bay · 25m)' : 'Out of Range (5.2km away)'}
              </strong>
            </span>
          </div>

          <button
            onClick={() => {
              setDriverIsInRange(!driverIsInRange);
              showToast(driverIsInRange ? 'Driver GPS Simulated: Out of Range' : 'Driver GPS Simulated: In Range (Bus Bay)');
            }}
            className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            Toggle Range
          </button>
        </div>

        {/* Manual Arrived and Depart Action Buttons (Requires PIN 1234) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleInitiateStatusAction('ARRIVED')}
            className={`py-2 px-3 rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition border ${
              driverIsInRange
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-600 shadow-2xs active:scale-[0.98]'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
            }`}
            title="Signal bus has arrived. Starts 2-minute departure window for passengers to scan & board."
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Mark Arrived (PIN)</span>
          </button>

          <button
            onClick={() => handleInitiateStatusAction('DEPARTED')}
            className={`py-2 px-3 rounded text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition border ${
              driverIsInRange
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-600 shadow-2xs active:scale-[0.98]'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 border-zinc-200 dark:border-zinc-700 cursor-not-allowed opacity-60'
            }`}
            title="Signal bus has departed. Passengers who checked in but did not scan to depart will receive 2-score penalty."
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Mark Departed (PIN)</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PASSENGER CAPACITY & ATTENDANCE MANIFEST                                 */}
      {/* ========================================================================= */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-mono uppercase font-bold text-zinc-500">
            Passenger Capacity & Attendance Manifest
          </span>
          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">
            {activeInspectionTrip.departureTime} Departure
          </span>
        </div>

        {/* Top Info Bar: Seat: 40 | Booked: [number] | Check-in: [number] | Inside: [number] */}
        <div className="grid grid-cols-4 gap-1.5 text-center font-mono">
          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <span className="block text-[9px] uppercase text-zinc-500 font-bold">Seat</span>
            <span className="text-sm font-black text-zinc-900 dark:text-white">{metrics.totalSeats}</span>
          </div>
          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <span className="block text-[9px] uppercase text-zinc-500 font-bold">Booked</span>
            <span className="text-sm font-black text-zinc-900 dark:text-white">{metrics.bookedCount}</span>
          </div>
          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <span className="block text-[9px] uppercase text-zinc-500 font-bold">Check-in</span>
            <span className="text-sm font-black text-blue-600 dark:text-blue-400">{metrics.checkInCount}</span>
          </div>
          <div className="p-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
            <span className="block text-[9px] uppercase text-zinc-500 font-bold">Inside</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{metrics.insideCount}</span>
          </div>
        </div>

        {/* Notification on Passengers Who Haven't Got In */}
        <div className="mt-2">
          {metrics.waitingOutsideCount > 0 ? (
            <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 font-mono">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 animate-bounce" />
                <span>
                  <strong>{metrics.waitingOutsideCount}</strong> passenger(s) checked in but haven't entered the bus!
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">Attention</span>
            </div>
          ) : (
            <div className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-center text-xs text-emerald-800 dark:text-emerald-300 font-mono">
              All checked-in passengers are safely inside the bus.
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BUS CABIN SEATING: VERTICAL FRONT-TO-BACK LAYOUT MATCHING USER SEAT PICKER */}
      {/* ========================================================================= */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 space-y-3 bg-zinc-50/50 dark:bg-zinc-950/30">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
              Bus Cabin Seating ({capacity} Seats)
            </h3>
            <p className="text-[10px] text-zinc-500">
              Vertical layout: tap any seat to inspect passenger or confirm boarding attendance.
            </p>
          </div>

          <button
            onClick={() => onToggleBoarding(activeInspectionTrip.id)}
            className={`px-2 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1 transition ${
              activeInspectionTrip.boardingOpen
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            <DoorOpen className="w-3 h-3" />
            <span>{activeInspectionTrip.boardingOpen ? 'Close Doors' : 'Open Doors'}</span>
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-around py-1.5 px-2 bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-xs bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700" />
            <span className="text-zinc-600 dark:text-zinc-400">Empty</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-xs bg-emerald-600 text-white flex items-center justify-center text-[7px] font-bold">✓</div>
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">Green = Inside</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-xs bg-rose-600 text-white flex items-center justify-center text-[7px] font-bold">!</div>
            <span className="text-rose-700 dark:text-rose-400 font-bold">Red = Checked-in (Not In)</span>
          </div>
        </div>

        {/* The Bus Frame: Vertical Front-to-Back Layout */}
        <div className="bg-white dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 p-3 max-w-xs mx-auto shadow-sm relative">
          {/* VEHICLE FRONT: DRIVER CABIN (LEFT) & EXIT/ENTRANCE DOOR (RIGHT) */}
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2.5 mb-2.5 flex items-center justify-between text-xs font-mono">
            {/* Driver Bay with Steering/User icon */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-[10px] font-bold text-zinc-800 dark:text-zinc-200">
              <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>[ 💺 DRIVER SEAT ]</span>
            </div>

            {/* Front Entrance / Exit Door */}
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              <DoorOpen className="w-3.5 h-3.5" />
              <span>[ 🚪 ENTRANCE / EXIT DOOR ]</span>
            </div>
          </div>

          {/* Seat Rows: Vertical Front to Back with Center Aisle (Full 40-Seat Bus Layout) */}
          <div className="space-y-1.5">
            {cabinRows.map((row) => (
              <div key={row} className="flex items-center justify-between gap-1">
                {/* Left Column: A & B */}
                <div className="flex items-center gap-1">
                  {['A', 'B'].map((col) => {
                    const seatId = `${row}${col}`;
                    const seatData = seatStatusMap.get(seatId);
                    const isCheckedIn = seatData?.booking.status === 'CHECKED_IN';
                    const isBoarded = seatData?.booking.status === 'BOARDED';
                    const isReserved = seatData?.booking.status === 'RESERVED';

                    return (
                      <button
                        key={seatId}
                        onClick={() =>
                          seatData
                            ? handleInitiateManualBoarding(seatData.booking, seatData.user)
                            : showToast(`Seat ${seatId} is Empty & Available`)
                        }
                        className={`w-8 h-8 rounded text-xs font-mono font-bold flex items-center justify-center transition border ${
                          isBoarded
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : isCheckedIn
                            ? 'bg-rose-600 text-white border-rose-600 animate-pulse shadow-xs'
                            : isReserved
                            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                            : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                        }`}
                        title={
                          seatData
                            ? `Seat ${seatId}: ${seatData.user?.name || 'Passenger'} (${seatData.booking.status})`
                            : `Seat ${seatId}: Available / Empty`
                        }
                      >
                        {seatId}
                      </button>
                    );
                  })}
                </div>

                {/* Center Aisle with Row Number */}
                <div className="w-5 text-center text-[9px] font-mono text-zinc-400 select-none">
                  {row}
                </div>

                {/* Right Column: C & D */}
                <div className="flex items-center gap-1">
                  {['C', 'D'].map((col) => {
                    const seatId = `${row}${col}`;
                    const seatData = seatStatusMap.get(seatId);
                    const isCheckedIn = seatData?.booking.status === 'CHECKED_IN';
                    const isBoarded = seatData?.booking.status === 'BOARDED';
                    const isReserved = seatData?.booking.status === 'RESERVED';

                    return (
                      <button
                        key={seatId}
                        onClick={() =>
                          seatData
                            ? handleInitiateManualBoarding(seatData.booking, seatData.user)
                            : showToast(`Seat ${seatId} is Empty & Available`)
                        }
                        className={`w-8 h-8 rounded text-xs font-mono font-bold flex items-center justify-center transition border ${
                          isBoarded
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : isCheckedIn
                            ? 'bg-rose-600 text-white border-rose-600 animate-pulse shadow-xs'
                            : isReserved
                            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700'
                            : 'bg-zinc-50 dark:bg-zinc-900 text-zinc-400 dark:text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
                        }`}
                        title={
                          seatData
                            ? `Seat ${seatId}: ${seatData.user?.name || 'Passenger'} (${seatData.booking.status})`
                            : `Seat ${seatId}: Available / Empty`
                        }
                      >
                        {seatId}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* VEHICLE REAR: EMERGENCY EXIT DOOR */}
          <div className="mt-2.5 pt-2 border-t border-zinc-200 dark:border-zinc-800 text-center text-[9px] text-zinc-400 uppercase tracking-widest font-mono flex items-center justify-center gap-1">
            <DoorOpen className="w-3 h-3 text-zinc-400" />
            <span>[ 🚨 REAR EMERGENCY EXIT DOOR ]</span>
          </div>
        </div>

        {/* Passenger Manifest Table */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 block">
            Inspected Passenger Manifest ({activeTripBookings.length})
          </span>
          {activeTripBookings.length === 0 ? (
            <div className="p-3 text-center text-xs text-zinc-500 font-mono bg-white dark:bg-zinc-900 rounded border border-zinc-200 dark:border-zinc-800">
              No passenger bookings recorded for this schedule.
            </div>
          ) : (
            <div className="space-y-1">
              {activeTripBookings.map((b) => {
                const u = users.find((usr) => usr.id === b.userId);
                return (
                  <div
                    key={b.id}
                    className="p-2 rounded bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 font-mono font-bold flex items-center justify-center text-[10px]">
                        {b.seatId}
                      </span>
                      {u?.avatar && (
                        <img src={u.avatar} alt={u.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                      )}
                      <div>
                        <div className="font-bold text-zinc-900 dark:text-white leading-tight">{u?.name || 'Passenger'}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {u?.studentId} · {b.status}
                        </div>
                      </div>
                    </div>

                    <div>
                      {b.status === 'CHECKED_IN' ? (
                        <button
                          onClick={() => handleInitiateManualBoarding(b, u)}
                          className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-mono font-bold shadow-2xs animate-pulse"
                          title="QR code not working? Manually confirm attendance with driver PIN (1234)."
                        >
                          Confirm Inside (Enter 1234)
                        </button>
                      ) : b.status === 'BOARDED' ? (
                        <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800">
                          Inside
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800">
                          Reserved
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CORRIDOR TIMETABLE BELOW MAP: RESTRICTED TO ASSIGNED ROUTE ONLY           */}
      {/* ========================================================================= */}
      <div className="p-3 space-y-3 bg-white dark:bg-zinc-900/40">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 block">
              {assignedCorridorName} Timetable
            </span>
            <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-mono">
              Dedicated Corridor (Back & Forth Only)
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400">Current: {currentTimeStr} MYT</span>
        </div>

        {/* SECTION 1: Active & Upcoming Trips for Assigned Corridor */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 font-bold uppercase block">
            ● Active & Upcoming Corridor Trips ({runningAndUpcomingTrips.length})
          </span>
          <div className="space-y-1">
            {runningAndUpcomingTrips.map((trip) => {
              const tripBusStatus = getBusLifecycleStatus(currentTimeStr, trip.departureTime);
              const isSelected = activeInspectionTrip.id === trip.id;
              const isMyBus = assignedTripId === trip.id;
              const isReturn = trip.fromStopId === 'apu';

              return (
                <button
                  key={trip.id}
                  onClick={() => setSelectedScheduleTripId(trip.id)}
                  className={`w-full text-left p-2 rounded transition flex items-center justify-between text-xs border ${
                    isSelected
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-zinc-900 dark:text-white'
                      : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-900 dark:text-white">{trip.departureTime}</span>
                    <div>
                      <div className="flex items-center gap-1 font-semibold leading-tight">
                        <span>{trip.routeName}</span>
                        <span className={`text-[8px] font-bold px-1 rounded uppercase ${
                          isReturn ? 'bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300' : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        }`}>
                          {isReturn ? 'Return' : 'Outbound'}
                        </span>
                        {isMyBus && (
                          <span className="text-[9px] px-1 rounded bg-emerald-600 text-white font-mono">
                            Your Bus
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] font-mono text-zinc-500">
                        Status: <strong className="text-emerald-700 dark:text-emerald-400">{tripBusStatus}</strong> · Cap: {trip.seatedCapacity ?? trip.totalSeats ?? 40}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400">
                    {isSelected ? 'Viewing' : 'Inspect'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: Expired & Passed Schedules in Separate Gray Below Section */}
        {passedTrips.length > 0 && (
          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-1.5">
            <button
              onClick={() => setIsPassedExpanded(!isPassedExpanded)}
              className="w-full flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400 uppercase py-1"
            >
              <span>Past {assignedCorridorName} Schedules ({passedTrips.length} completed) - Gray Section</span>
              <span className="underline">{isPassedExpanded ? 'Collapse' : 'Expand'}</span>
            </button>

            {isPassedExpanded && (
              <div className="space-y-1">
                {passedTrips.map((trip) => {
                  const isSelected = activeInspectionTrip.id === trip.id;
                  const tripBusStatus = getBusLifecycleStatus(currentTimeStr, trip.departureTime);

                  return (
                    <button
                      key={trip.id}
                      onClick={() => setSelectedScheduleTripId(trip.id)}
                      className={`w-full text-left p-2 rounded transition flex items-center justify-between text-xs border bg-zinc-100/60 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800/60 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 ${
                        isSelected ? 'border-zinc-400 text-zinc-900 dark:text-white' : 'text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-zinc-500 line-through">{trip.departureTime}</span>
                        <div>
                          <div className="font-semibold text-zinc-600 dark:text-zinc-400 leading-tight">
                            {trip.routeName}
                          </div>
                          <div className="text-[9px] font-mono text-zinc-500">
                            Status: {tripBusStatus} · Cap: {trip.seatedCapacity ?? trip.totalSeats ?? 40}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono text-zinc-500">
                        {isSelected ? 'Viewing' : 'Inspect'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL: MANUAL BOARDING QR FALLBACK AUTHORIZATION (1234)                   */}
      {/* ========================================================================= */}
      {manualConfirmTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div>
                <span className="text-[9px] uppercase font-mono font-bold text-rose-600 dark:text-rose-400 block">
                  Manual QR Override · Driver Authorization
                </span>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">Confirm Passenger Inside Bus</h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                  {manualConfirmTarget.user?.name || 'Passenger'} · Seat {manualConfirmTarget.booking.seatId}
                </p>
              </div>
              <button
                onClick={() => setManualConfirmTarget(null)}
                className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs font-mono">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Student ID:</span>
                <span className="font-bold text-zinc-900 dark:text-white">{manualConfirmTarget.user?.studentId}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Trip:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{manualConfirmTarget.booking.routeName}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Reason:</span>
                <span className="text-amber-600 dark:text-amber-400">QR code not scanning / manual verification</span>
              </div>
            </div>

            <form onSubmit={handleConfirmManualBoarding} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-mono text-zinc-600 dark:text-zinc-400 block mb-1">
                  Re-enter 4-Digit Code (1234) to confirm conscious action
                </label>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={manualPinInput}
                  onChange={(e) => {
                    setManualPinInput(e.target.value);
                    setManualPinError(null);
                  }}
                  placeholder="••••"
                  className="w-full text-center text-lg tracking-widest font-mono py-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-rose-500"
                />
                {manualPinError && (
                  <p className="text-[10px] text-rose-500 font-mono mt-1">{manualPinError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setManualPinInput('1234');
                    setManualPinError(null);
                  }}
                  className="flex-1 py-2 rounded text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                >
                  Auto-Fill 1234
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded text-xs font-mono font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-2xs"
                >
                  Confirm Passenger Inside
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL ARRIVED / DEPARTED STATUS ACTION AUTHORIZATION (1234)       */}
      {/* ========================================================================= */}
      {pendingManualStatusAction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
              <div>
                <span className="text-[9px] uppercase font-mono font-bold text-emerald-700 dark:text-emerald-400 block">
                  Driver Signal Authorization
                </span>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                  Confirm Mark {pendingManualStatusAction === 'ARRIVED' ? 'Arrived' : 'Departed'}
                </h3>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                  {assignedTrip.routeName} ({assignedTrip.departureTime})
                </p>
              </div>
              <button
                onClick={() => setPendingManualStatusAction(null)}
                className="w-6 h-6 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-2.5 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1 text-xs font-mono">
              <div className="text-zinc-700 dark:text-zinc-300">
                {pendingManualStatusAction === 'ARRIVED' ? (
                  <span>
                    🚌 Marking <strong>ARRIVED</strong> notifies all waiting passengers and initiates the 2-minute departure boarding countdown.
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                    ⚠️ Marking <strong>DEPARTED</strong> will immediately apply a <strong>2-score penalty</strong> to any checked-in passengers who have not scanned for depart!
                  </span>
                )}
              </div>
            </div>

            <form onSubmit={handleConfirmStatusAction} className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-mono text-zinc-600 dark:text-zinc-400 block mb-1">
                  Enter 4-Digit Code (1234) to confirm
                </label>
                <input
                  type="password"
                  maxLength={4}
                  autoFocus
                  value={statusPinInput}
                  onChange={(e) => {
                    setStatusPinInput(e.target.value);
                    setStatusPinError(null);
                  }}
                  placeholder="••••"
                  className="w-full text-center text-lg tracking-widest font-mono py-2 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-emerald-500"
                />
                {statusPinError && (
                  <p className="text-[10px] text-rose-500 font-mono mt-1">{statusPinError}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatusPinInput('1234');
                    setStatusPinError(null);
                  }}
                  className="flex-1 py-2 rounded text-xs font-mono font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700"
                >
                  Auto-Fill 1234
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded text-xs font-mono font-bold text-white shadow-2xs ${
                    pendingManualStatusAction === 'ARRIVED'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  Confirm {pendingManualStatusAction === 'ARRIVED' ? 'Arrived' : 'Departed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
