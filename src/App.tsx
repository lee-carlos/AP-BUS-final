import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BusStop, BusTrip, Booking, ScanResult } from './types/bus';
import { APU_STOPS } from './data/apuRoutes';
import { isBookingWindowOpen, formatServiceDay } from './utils/bookingRules';
import type { SimState, ActionResult } from './utils/simEngine';
import {
  createInitialState,
  advanceTo,
  book,
  cancel,
  checkIn,
  claim,
  scanPass,
  manualBoard,
  setBoarding,
  setTripStatus,
  setUserLocation,
  toggleNotify,
  toggleSeatAlert,
  setAutoplay,
  startNextServiceDay,
  findClaimOffer,
  shortName,
} from './utils/simEngine';
import { PhoneShell } from './components/PhoneShell';
import { DemoAccountSelector } from './components/DemoAccountSelector';
import { TopBar } from './components/TopBar';
import { RouteFilter } from './components/RouteFilter';
import { BusMap } from './components/BusMap';
import { BookedBusCard } from './components/BookedBusCard';
import { ScheduleModal } from './components/ScheduleModal';
import { SeatPickerModal } from './components/SeatPickerModal';
import { CancelConfirmModal } from './components/CancelConfirmModal';
import { BoardingPassModal } from './components/BoardingPassModal';
import { SimulationBar } from './components/SimulationBar';
import { StandbyNotificationModal } from './components/StandbyNotificationModal';
import { SearchModal } from './components/SearchModal';
import { ScheduleDocModal } from './components/ScheduleDocModal';
import { DriverConsoleModal } from './components/DriverConsoleModal';
import { DriverPortal } from './components/DriverPortal';
import { ScenarioLogPanel } from './components/ScenarioLogPanel';
import { Bus, BellRing, CheckCircle2, AlertTriangle } from 'lucide-react';

type NoticeType = 'info' | 'success' | 'warning' | 'alert';

export default function App() {
  // The whole simulation (users, trips, bookings, penalties, scenario log) lives in ONE state
  // object. Every rule is applied by the pure functions in utils/simEngine.ts.
  const [sim, setSim] = useState<SimState>(() => createInitialState());
  const { users, trips } = sim;
  const simulatedTimeStr = sim.time;

  // Active persona (null = initial persona selection screen)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Theme state: Pure Monochrome + Emerald Mint Depth
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ap_bus_theme') || localStorage.getItem('shuttlemate_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    localStorage.setItem('ap_bus_theme', theme);
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Route Filter state
  const [selectedFrom, setSelectedFrom] = useState<BusStop | null>(APU_STOPS[1]); // LRT Bukit Jalil
  const [selectedTo, setSelectedTo] = useState<BusStop | null>(APU_STOPS[0]); // APU Campus

  // Continuous Auto-Tick Clock Engine
  const [isAutoTickRunning, setIsAutoTickRunning] = useState<boolean>(false);
  const [tickSpeed, setTickSpeed] = useState<number>(1); // 0.25x, 0.50x, 1x, 5x, 10x

  // Modals & Active selections
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [seatPickerTrip, setSeatPickerTrip] = useState<BusTrip | null>(null);
  const [cancelingBooking, setCancelingBooking] = useState<Booking | null>(null);
  const [passBookingId, setPassBookingId] = useState<string | null>(null);
  const [isBoardingPassOpen, setIsBoardingPassOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isDriverConsoleOpen, setIsDriverConsoleOpen] = useState(false);
  const [driverTripId, setDriverTripId] = useState<string>('demo-a-0800');
  const [showSimulator, setShowSimulator] = useState(true);

  // Seat Alert offers the current user chose to ignore ("Keep Current Bus")
  const [dismissedOffers, setDismissedOffers] = useState<string[]>([]);

  // System Live Toast / Banner
  const [bannerNotice, setBannerNotice] = useState<{
    id: string;
    title: string;
    message: string;
    type: NoticeType;
  } | null>(null);

  // Google Maps Quota handling
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Current active user object
  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return users.find((u) => u.id === currentUserId) || null;
  }, [currentUserId, users]);

  // Current user's bookings (cancelled ones are hidden, expired / no-show stay visible)
  const currentUserBookings = useMemo(() => {
    if (!currentUser) return [];
    const rank = (b: Booking) => (b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED' ? 0 : 1);
    // Active bookings first (earliest departure first), then expired / transferred / no-show ones
    return sim.bookings
      .filter((b) => b.userId === currentUser.id && b.status !== 'CANCELLED')
      .sort((a, b) => rank(a) - rank(b) || a.departureTime.localeCompare(b.departureTime));
  }, [currentUser, sim.bookings]);

  // All bookings (for Driver manifest and capacity)
  const allBookingsFlat = useMemo(() => sim.bookings.filter((b) => b.status !== 'CANCELLED'), [sim.bookings]);

  // The pass shown in the boarding pass modal always reflects the live booking
  const selectedBookingForPass = useMemo(
    () => (passBookingId ? sim.bookings.find((b) => b.id === passBookingId) || null : null),
    [passBookingId, sim.bookings]
  );

  // Trips where the current user has a Seat Alert
  const myAlertTripIds = useMemo(() => {
    if (!currentUser) return [];
    return Object.entries(sim.seatAlerts)
      .filter(([, ids]) => ids.includes(currentUser.id))
      .map(([tripId]) => tripId);
  }, [currentUser, sim.seatAlerts]);

  // Seat Alert offer: a subscribed shuttle has a free seat AND the user holds the next schedule
  const standbyOffer = useMemo(() => {
    if (!currentUser || currentUser.role === 'Driver') return null;
    return findClaimOffer(sim, currentUser.id, dismissedOffers);
  }, [sim, currentUser, dismissedOffers]);

  // Booking window open status (06:00 MYT)
  const isBookingOpen = useMemo(() => isBookingWindowOpen(simulatedTimeStr), [simulatedTimeStr]);

  const serviceDayLabel = formatServiceDay(sim.day);
  const actorName = currentUser?.role === 'Driver' ? shortName(currentUser) : 'Door scanner';

  // Show banner notice helper
  const showNotice = (title: string, message: string, type: NoticeType = 'info') => {
    setBannerNotice({ id: String(Date.now()), title, message, type });
    setTimeout(() => {
      setBannerNotice((prev) => (prev?.title === title ? null : prev));
    }, 6000);
  };

  // Log entries already announced in the banner. Manual actions announce their own result,
  // clock-driven events (expiry, departure, scripted persona actions) are announced below.
  const announcedLogLen = useRef(sim.log.length);

  const commit = (next: SimState) => {
    announcedLogLen.current = next.log.length;
    setSim(next);
  };

  const apply = (result: ActionResult): ActionResult => {
    commit(result.state);
    showNotice(result.title, result.message, result.ok ? 'success' : 'alert');
    return result;
  };

  useEffect(() => {
    if (sim.log.length < announcedLogLen.current) {
      announcedLogLen.current = sim.log.length; // demo was reset
      return;
    }
    if (sim.log.length === announcedLogLen.current) return;
    const fresh = sim.log.slice(announcedLogLen.current);
    announcedLogLen.current = sim.log.length;
    const pick = [...fresh].reverse().find((l) => l.kind !== 'info') || fresh[fresh.length - 1];
    const type: NoticeType = pick.kind === 'reject' ? 'alert' : pick.kind === 'penalty' ? 'warning' : pick.kind === 'success' ? 'success' : 'info';
    showNotice(`${pick.time} · ${pick.actor}`, pick.text, type);
  }, [sim.log]);

  // Continuous Auto-Tick Timer (1 simulated minute per 1000/tickSpeed ms). Each minute runs the
  // automatic deadlines (T-10 expiry, arrival, departure) and the scripted persona actions.
  useEffect(() => {
    if (!isAutoTickRunning) return;

    const interval = setInterval(() => {
      setSim((prev) => {
        if (prev.time === '23:59') return prev;
        const [h, m] = prev.time.split(':').map(Number);
        const total = h * 60 + m + 1;
        const next = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
        return advanceTo(prev, next);
      });
    }, Math.round(1000 / tickSpeed));

    return () => clearInterval(interval);
  }, [isAutoTickRunning, tickSpeed]);

  useEffect(() => {
    if (simulatedTimeStr === '23:59' && isAutoTickRunning) setIsAutoTickRunning(false);
  }, [simulatedTimeStr, isAutoTickRunning]);

  // Quick-jump: going forward processes every minute in between
  const handleSetTime = (timeStr: string) => {
    setSim((prev) => advanceTo(prev, timeStr));
  };

  // Handle route reversal (swap button)
  const handleSwapStops = useCallback(() => {
    setSelectedFrom((prevFrom) => {
      setSelectedTo(prevFrom);
      return selectedTo;
    });
  }, [selectedTo]);

  // Toggle 30m Notification
  const handleToggleNotify30 = (bookingId: string) => {
    commit(toggleNotify(sim, bookingId));
  };

  // Check-in: time window T-30 to before T-10, and the user must be at the pickup point.
  // The single-use QR pass is issued only here (or by a successful Claim).
  const handleCheckInNow = (bookingId: string) => {
    if (!currentUser) return;
    const result = apply(checkIn(sim, currentUser.id, bookingId));
    if (result.ok && result.booking) {
      setPassBookingId(result.booking.id);
      setIsBoardingPassOpen(true);
    }
  };

  // Demo stand-in for the door scanner reading this passenger's QR. It goes through the SAME
  // validation as the driver scanner: right shuttle, boarding open, pass not used before.
  const handleScanForDepart = (bookingId: string) => {
    const booking = sim.bookings.find((b) => b.id === bookingId);
    if (!booking || !booking.qrCodeToken) {
      showNotice('No QR Pass', 'A QR pass is issued only after check-in.', 'alert');
      return;
    }
    const { state, result } = scanPass(sim, booking.tripId, booking.qrCodeToken, 'Door scanner');
    commit(state);
    showNotice(result.success ? 'Boarding Verified' : 'Scan Rejected', result.message, result.success ? 'success' : 'alert');
  };

  const handleBoardBus = () => {
    if (!selectedBookingForPass) return;
    handleScanForDepart(selectedBookingForPass.id);
  };

  // Standard Seat Booking (all rules are checked in the engine)
  const handleConfirmSeat = (tripId: string, seatId: string) => {
    if (!currentUser) return;
    const result = apply(book(sim, currentUser.id, tripId, seatId));
    if (!result.ok) return;
    const trip = trips.find((t) => t.id === tripId);
    if (trip) {
      setSelectedFrom(APU_STOPS.find((s) => s.id === trip.fromStopId) || APU_STOPS[0]);
      setSelectedTo(APU_STOPS.find((s) => s.id === trip.toStopId) || APU_STOPS[1]);
    }
    setSeatPickerTrip(null);
    setIsScheduleOpen(false);
  };

  // Cancellation: free before check-in, 1 minor point after check-in
  const handleConfirmCancel = (bookingId: string) => {
    if (!currentUser) return;
    apply(cancel(sim, currentUser.id, bookingId));
    setCancelingBooking(null);
  };

  // Claim the earlier shuttle (only from the schedule immediately after it)
  const handleAcceptClaimSeat = (tripId: string, _seatId: string) => {
    if (!currentUser) return;
    const result = apply(claim(sim, currentUser.id, tripId));
    if (result.ok && result.booking) {
      setPassBookingId(result.booking.id);
      setIsBoardingPassOpen(true);
    } else {
      setDismissedOffers((prev) => [...prev, tripId]);
    }
  };

  // Toggle user simulated location (at the pickup point vs ~11 km away)
  const handleToggleUserLocation = () => {
    if (!currentUser) return;
    const next = setUserLocation(sim, currentUser.id, !currentUser.isNearStop);
    commit(next);
    const moved = next.users.find((u) => u.id === currentUser.id);
    showNotice('Simulated Location Updated', moved?.currentLocationName || '', 'info');
  };

  // Driver: open / close boarding
  const handleDriverToggleBoarding = (tripId: string) => {
    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;
    apply(setBoarding(sim, tripId, !trip.boardingOpen, actorName));
  };

  // Driver: scan a QR pass. Only the QR token is accepted; the result shows who the pass belongs to.
  const handleDriverScanPass = (tripId: string, token: string): ScanResult => {
    const { state, result } = scanPass(sim, tripId, token, actorName);
    commit(state);
    return result;
  };

  // Driver: board without a scan. Needs a written reason and is always logged.
  const handleDriverManualConfirmBoarding = (bookingId: string, reason: string): { ok: boolean; message: string } => {
    const result = apply(manualBoard(sim, bookingId, reason, actorName));
    return { ok: result.ok, message: result.message };
  };

  // Driver: mark Arrived / Departed (departure is refused before the scheduled time)
  const handleDriverManualSetTripStatus = (tripId: string, status: 'ARRIVED' | 'DEPARTED'): { ok: boolean; message: string } => {
    const result = apply(setTripStatus(sim, tripId, status, actorName));
    return { ok: result.ok, message: result.message };
  };

  // Reset Demo to the 07:45 scenario start
  const handleResetDemo = () => {
    commit(createInitialState());
    setIsAutoTickRunning(false);
    setDismissedOffers([]);
    setPassBookingId(null);
    setIsBoardingPassOpen(false);
    showNotice('Demo Reset', 'Back to Fri 13 Nov, 07:45. Press Auto-Tick to replay every case.', 'info');
  };

  // Start the next service day: bookings start fresh, penalty points carry over
  const handleNextServiceDay = () => {
    const next = startNextServiceDay(sim);
    commit(next);
    setIsAutoTickRunning(false);
    setDismissedOffers([]);
    setPassBookingId(null);
    setIsBoardingPassOpen(false);
    setSeatPickerTrip(null);
    setCancelingBooking(null);
    showNotice('New Service Day', `${formatServiceDay(next.day)}, ${next.time}. Bookings start fresh; penalty points carry over.`, 'info');
  };

  // Toggle Seat Alert for a trip
  const handleToggleSeatAlert = (tripId: string) => {
    if (!currentUser) return;
    commit(toggleSeatAlert(sim, currentUser.id, tripId));
    setDismissedOffers((prev) => prev.filter((id) => id !== tripId));
  };

  const activeBookingCount = currentUserBookings.filter(
    (b) => b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED'
  ).length;

  const scenarioPanel = (
    <ScenarioLogPanel
      log={sim.log}
      users={users}
      dayLabel={serviceDayLabel}
      timeStr={simulatedTimeStr}
      autoplay={sim.autoplay}
      onToggleAutoplay={() => commit(setAutoplay(sim, !sim.autoplay))}
    />
  );

  return (
    <PhoneShell
      simulatedTimeStr={simulatedTimeStr}
      theme={theme}
      onToggleTheme={handleToggleTheme}
      sidePanel={scenarioPanel}
    >
      {/* Client-Side Quota Defense Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Real-time System Banner Notice */}
      {bannerNotice && (
        <div
          className={`px-3 py-2 text-xs flex items-center justify-between gap-2 border-b sticky top-0 z-50 transition-colors ${
            bannerNotice.type === 'alert'
              ? 'bg-rose-950 text-rose-200 border-rose-900'
              : bannerNotice.type === 'warning'
              ? 'bg-zinc-900 text-amber-300 border-amber-900/60'
              : bannerNotice.type === 'success'
              ? 'bg-zinc-900 text-emerald-300 border-emerald-900/60'
              : 'bg-zinc-900 text-zinc-200 border-zinc-800'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {bannerNotice.type === 'alert' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            ) : bannerNotice.type === 'warning' ? (
              <BellRing className="w-4 h-4 shrink-0 text-amber-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            )}
            <span className="truncate">
              <strong>{bannerNotice.title}:</strong> {bannerNotice.message}
            </span>
          </div>
          <button
            onClick={() => setBannerNotice(null)}
            className="text-[10px] uppercase font-bold opacity-75 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Screen 1: Official Demo Persona Selector (Section 19.1) */}
      {!currentUser ? (
        <DemoAccountSelector
          accounts={users}
          dayLabel={serviceDayLabel}
          onSelectAccount={(user) => {
            setCurrentUserId(user.id);
            setDismissedOffers([]);
            setSelectedFrom(APU_STOPS[1]);
            setSelectedTo(APU_STOPS[0]);
          }}
        />
      ) : currentUser.role === 'Driver' ? (
        /* Screen 2B: Dedicated Bus Driver Operations Portal */
        <DriverPortal
          currentDriver={currentUser}
          trips={trips}
          allBookings={allBookingsFlat}
          users={users}
          currentTimeStr={simulatedTimeStr}
          theme={theme}
          onToggleTheme={handleToggleTheme}
          onSwitchDriver={() => setCurrentUserId(null)}
          onManualConfirmBoarding={handleDriverManualConfirmBoarding}
          onScanPass={handleDriverScanPass}
          onToggleBoarding={handleDriverToggleBoarding}
          onManualSetTripStatus={handleDriverManualSetTripStatus}
          onResetDemo={handleResetDemo}
          apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
        />
      ) : (
        /* Screen 2A: Main AP-BUS Mobile Experience (Students, Lecturers & Campus Staff) */
        <div className="flex-1 flex flex-col">
          {/* Top Bar with Search, Dropdown & Persona Info */}
          <TopBar
            currentUser={currentUser}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onOpenSearch={() => setIsSearchOpen(true)}
            onSwitchUser={() => setCurrentUserId(null)}
            onResetData={handleResetDemo}
            onToggleSimulator={() => setShowSimulator(!showSimulator)}
            onViewScheduleDoc={() => setIsPdfModalOpen(true)}
            onOpenDriverConsole={() => {
              setDriverTripId('demo-a-0800');
              setIsDriverConsoleOpen(true);
            }}
          />

          {/* 2 Search Bars (From & To) with Reversed Swap Button */}
          <RouteFilter
            selectedFrom={selectedFrom}
            selectedTo={selectedTo}
            onSelectFrom={setSelectedFrom}
            onSelectTo={setSelectedTo}
            onSwap={handleSwapStops}
          />

          {/* Interactive Map with Route Tracking, Road Geometry & Proximity Radius */}
          <BusMap
            currentUser={currentUser}
            selectedFrom={selectedFrom}
            selectedTo={selectedTo}
            bookings={currentUserBookings}
            trips={trips}
            currentTimeStr={simulatedTimeStr}
            apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
          />

          {/* Booked Buses Cards with Penalty Status, Check-In & Boarding Pass */}
          <BookedBusCard
            bookings={currentUserBookings}
            minorPenalties={currentUser.minorPenalties}
            majorPenalties={currentUser.majorPenalties}
            penaltyPoints={currentUser.penaltyPoints}
            isRestricted={currentUser.isRestricted}
            restrictedOnLabel={currentUser.restrictedOn ? formatServiceDay(currentUser.restrictedOn) : null}
            currentTimeStr={simulatedTimeStr}
            userCoords={currentUser.coords}
            onToggleNotify30={handleToggleNotify30}
            onCheckInNow={handleCheckInNow}
            onOpenBoardingPass={(b) => {
              setPassBookingId(b.id);
              setIsBoardingPassOpen(true);
            }}
            onRequestCancel={(b) => setCancelingBooking(b)}
            onScanForDepart={handleScanForDepart}
          />

          {/* Primary Action Button: Open Shuttle Schedule & Booking */}
          <div className="px-3 py-2.5">
            {activeBookingCount >= 2 ? (
              <button
                onClick={() => setIsScheduleOpen(true)}
                className="w-full py-2.5 px-4 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-all tracking-wide"
                title="2 active bookings limit reached. View schedules (all new bookings locked in gray)."
              >
                <Bus className="w-4 h-4 shrink-0 text-zinc-500" />
                <span>BOOKING ON LIMIT (2/2 ACTIVE)</span>
                <span className="text-[10px] bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-xs font-mono uppercase tracking-wider ml-1">
                  VIEW TIMETABLE
                </span>
              </button>
            ) : currentUser.isRestricted ? (
              <button
                onClick={() => setIsScheduleOpen(true)}
                className="w-full py-2.5 px-4 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-all tracking-wide"
                title="Booking is restricted for this one service day after reaching 6 penalty points."
              >
                <Bus className="w-4 h-4 shrink-0 text-zinc-400" />
                <span>BOOKING RESTRICTED TODAY ({serviceDayLabel})</span>
                <span className="text-[10px] bg-zinc-300 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded-xs font-mono uppercase tracking-wider ml-1">
                  VIEW ONLY
                </span>
              </button>
            ) : (
              <button
                onClick={() => setIsScheduleOpen(true)}
                className="w-full py-2.5 px-4 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-2xs active:scale-[0.99] transition-all tracking-wide"
              >
                <Bus className="w-4 h-4 shrink-0" />
                <span>BOOK A SHUTTLE SEAT</span>
                <span className="text-[10px] bg-emerald-700/90 text-emerald-100 px-1.5 py-0.5 rounded-xs font-mono uppercase tracking-wider ml-1">
                  Timetable
                </span>
              </button>
            )}
          </div>

          {/* Floating / Docked Simulator Bar */}
          {showSimulator && (
            <div className="mt-auto">
              <SimulationBar
                simulatedTimeStr={simulatedTimeStr}
                isAutoTickRunning={isAutoTickRunning}
                tickSpeed={tickSpeed}
                onToggleAutoTick={() => setIsAutoTickRunning(!isAutoTickRunning)}
                onSetTickSpeed={setTickSpeed}
                onSetTime={handleSetTime}
                dayLabel={serviceDayLabel}
                onNextServiceDay={handleNextServiceDay}
                currentUser={currentUser}
                onToggleUserLocation={handleToggleUserLocation}
                onOpenDriverConsole={() => {
                  setDriverTripId('demo-a-0800');
                  setIsDriverConsoleOpen(true);
                }}
                onResetDemo={handleResetDemo}
              />
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Schedule Drawer & Seat Alert Subscriptions */}
      {isScheduleOpen && currentUser && (
        <ScheduleModal
          trips={trips}
          currentBookings={currentUserBookings}
          currentTimeStr={simulatedTimeStr}
          penaltyStrikes={currentUser.penaltyStrikes}
          onBookTrip={(trip) => {
            setSeatPickerTrip(trip);
            setIsScheduleOpen(false);
          }}
          onRequestCancel={(b) => {
            setIsScheduleOpen(false);
            setCancelingBooking(b);
          }}
          onToggleWaitlist={handleToggleSeatAlert}
          waitlistTripIds={myAlertTripIds}
          isBookingOpen={isBookingOpen}
          onClose={() => setIsScheduleOpen(false)}
          initialRouteFilter={selectedFrom?.id}
        />
      )}

      {/* MODAL 2: Interactive Bus Seat Picker */}
      {seatPickerTrip && currentUser && (
        <SeatPickerModal
          trip={seatPickerTrip}
          currentUser={currentUser}
          currentTimeStr={simulatedTimeStr}
          hasActiveBookingLimit={activeBookingCount >= 2}
          onConfirmSeat={handleConfirmSeat}
          onClose={() => setSeatPickerTrip(null)}
        />
      )}

      {/* MODAL 3: Cancel Booking Confirmation with Late Cancellation Penalty */}
      {cancelingBooking && (
        <CancelConfirmModal
          booking={cancelingBooking}
          onConfirmCancel={handleConfirmCancel}
          onClose={() => setCancelingBooking(null)}
        />
      )}

      {/* MODAL 4: Digital Boarding Pass with QR Code */}
      {isBoardingPassOpen && selectedBookingForPass && currentUser && (
        <BoardingPassModal
          booking={selectedBookingForPass}
          user={currentUser}
          onBoardBus={handleBoardBus}
          onClose={() => setIsBoardingPassOpen(false)}
        />
      )}

      {/* MODAL 5: Search Modal */}
      {isSearchOpen && (
        <SearchModal
          onSelectRoute={(from, to) => {
            setSelectedFrom(from);
            setSelectedTo(to);
          }}
          onOpenBooking={() => setIsScheduleOpen(true)}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {/* MODAL 6: Official PDF Schedule Modal */}
      {isPdfModalOpen && <ScheduleDocModal onClose={() => setIsPdfModalOpen(false)} />}

      {/* MODAL 7: FCFS Claim Seat Alert Modal (Section 11) */}
      {standbyOffer && (
        <StandbyNotificationModal
          trip={standbyOffer.trip}
          releasedSeatId={standbyOffer.seatId}
          sourceBooking={standbyOffer.sourceBooking}
          currentTimeStr={simulatedTimeStr}
          onAcceptSeat={handleAcceptClaimSeat}
          onDecline={() => setDismissedOffers((prev) => [...prev, standbyOffer.trip.id])}
        />
      )}

      {/* MODAL 8: Driver / Staff Boarding Console (Section 13) */}
      {isDriverConsoleOpen && (
        <DriverConsoleModal
          trip={trips.find((t) => t.id === driverTripId) || trips[0]}
          allBookings={allBookingsFlat}
          users={users}
          onToggleBoarding={handleDriverToggleBoarding}
          onScanPass={(token) => handleDriverScanPass(driverTripId, token)}
          onClose={() => setIsDriverConsoleOpen(false)}
        />
      )}
    </PhoneShell>
  );
}
