import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BusStop, BusTrip, Booking, DemoUser } from './types/bus';
import { APU_STOPS, INITIAL_TRIPS, DEMO_ACCOUNTS } from './data/apuRoutes';
import {
  evaluateCheckInAssessment,
  isBookingWindowOpen,
  isNormalBookingOpen,
  isClaimWindowOpen,
  getMinutesUntilDeparture,
  validateClaimEligibility,
  validateBookingEligibility,
  calculateTripCapacity,
  evaluateCancellationPenalty,
  evaluateAutoExpiryPenalty,
  evaluateNoShowPenalty,
  PENALTY_SYSTEM,
} from './utils/bookingRules';
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
import { Bus, BellRing, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function App() {
  // All personas in system (allows live mutation of penalties & coordinates across switches)
  const [users, setUsers] = useState<DemoUser[]>(DEMO_ACCOUNTS);

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

  // Trips with live status and capacity
  const [trips, setTrips] = useState<BusTrip[]>(INITIAL_TRIPS);

  // Section 19.2 Initial State:
  // - Bus A (08:00, cap 2): Sarah Tan (1A, CHECKED_IN), Ryan Lim (1B, RESERVED, no QR)
  // - Bus B (08:10, cap 40): Rani Pratama (1A, RESERVED), Amir Hakim (1B, RESERVED)
  const [userBookings, setUserBookings] = useState<Record<string, Booking[]>>({
    'user-sarah': [
      {
        id: 'bk-sarah-demo-a',
        userId: 'user-sarah',
        tripId: 'demo-a-0800',
        seatId: '1A',
        routeId: 'lrt',
        routeName: 'LRT Bukit Jalil ➔ APU (Bus A)',
        fromStopName: 'LRT Bukit Jalil',
        toStopName: 'Asia Pacific University (APU Campus)',
        departureTime: '08:00',
        notify30Min: true,
        status: 'CHECKED_IN',
        checkedInAt: '07:42',
        bookedAt: '07:30',
        qrCodeToken: 'APU-PASS-TP068412-DEMOA-1A',
      },
    ],
    'user-ryan': [
      {
        id: 'bk-ryan-demo-a',
        userId: 'user-ryan',
        tripId: 'demo-a-0800',
        seatId: '1B',
        routeId: 'lrt',
        routeName: 'LRT Bukit Jalil ➔ APU (Bus A)',
        fromStopName: 'LRT Bukit Jalil',
        toStopName: 'Asia Pacific University (APU Campus)',
        departureTime: '08:00',
        notify30Min: true,
        status: 'RESERVED', // Rule 9.1: No QR issued before check-in!
        bookedAt: '07:32',
      },
    ],
    'user-rani': [
      {
        id: 'bk-rani-demo-b',
        userId: 'user-rani',
        tripId: 'demo-b-0810',
        seatId: '1A',
        routeId: 'lrt',
        routeName: 'LRT Bukit Jalil ➔ APU (Bus B)',
        fromStopName: 'LRT Bukit Jalil',
        toStopName: 'Asia Pacific University (APU Campus)',
        departureTime: '08:10',
        notify30Min: true,
        status: 'RESERVED',
        bookedAt: '07:34',
      },
    ],
    'user-amir': [
      {
        id: 'bk-amir-demo-b',
        userId: 'user-amir',
        tripId: 'demo-b-0810',
        seatId: '1B',
        routeId: 'lrt',
        routeName: 'LRT Bukit Jalil ➔ APU (Bus B)',
        fromStopName: 'LRT Bukit Jalil',
        toStopName: 'Asia Pacific University (APU Campus)',
        departureTime: '08:10',
        notify30Min: true,
        status: 'RESERVED',
        bookedAt: '07:35',
      },
    ],
  });

  // Seat Alert Subscriptions (User IDs subscribed to Trip IDs)
  const [seatAlerts, setSeatAlerts] = useState<Record<string, string[]>>({
    'demo-a-0800': ['user-rani', 'user-amir'],
  });

  // Route Filter state
  const [selectedFrom, setSelectedFrom] = useState<BusStop | null>(APU_STOPS[1]); // LRT Bukit Jalil
  const [selectedTo, setSelectedTo] = useState<BusStop | null>(APU_STOPS[0]); // APU Campus

  // Simulated Time (HH:mm) - Initialized at 07:45 MYT (Section 19.2 Start)
  const [simulatedTimeStr, setSimulatedTimeStr] = useState<string>('07:45');

  // Continuous Auto-Tick Clock Engine
  const [isAutoTickRunning, setIsAutoTickRunning] = useState<boolean>(false);
  const [tickSpeed, setTickSpeed] = useState<number>(1); // 1x, 5x, 10x

  // Modals & Active selections
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [seatPickerTrip, setSeatPickerTrip] = useState<BusTrip | null>(null);
  const [cancelingBooking, setCancelingBooking] = useState<Booking | null>(null);
  const [selectedBookingForPass, setSelectedBookingForPass] = useState<Booking | null>(null);
  const [isBoardingPassOpen, setIsBoardingPassOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isDriverConsoleOpen, setIsDriverConsoleOpen] = useState(false);
  const [driverTripId, setDriverTripId] = useState<string>('demo-a-0800');
  const [showSimulator, setShowSimulator] = useState(true);

  // System Live Toast / Banner
  const [bannerNotice, setBannerNotice] = useState<{
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'alert';
  } | null>(null);

  // FCFS Claim Offer Modal state
  const [standbyOffer, setStandbyOffer] = useState<{
    trip: BusTrip;
    seatId: string;
    sourceBooking: Booking | null;
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

  // Current user's bookings
  const currentUserBookings = useMemo(() => {
    if (!currentUser) return [];
    return userBookings[currentUser.id] || [];
  }, [currentUser, userBookings]);

  // All bookings flattened (for Driver manifest and capacity)
  const allBookingsFlat = useMemo(() => {
    return Object.values(userBookings).flat();
  }, [userBookings]);

  // Booking window open status (06:00 MYT Master Context)
  const isBookingOpen = useMemo(() => {
    return isBookingWindowOpen(simulatedTimeStr);
  }, [simulatedTimeStr]);

  // Show banner notice helper
  const showNotice = (
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'alert' = 'info'
  ) => {
    setBannerNotice({ id: String(Date.now()), title, message, type });
    setTimeout(() => {
      setBannerNotice((prev) => (prev?.title === title ? null : prev));
    }, 6000);
  };

  // Automated Deadline Processing (Server Auto-Tick Logic)
  // Evaluates every time the simulated clock updates
  const processAutomatedDeadlines = useCallback(
    (currentTime: string) => {
      // 1. Check all trips for T-10 check-in deadline expiration
      trips.forEach((trip) => {
        const minsUntil = getMinutesUntilDeparture(currentTime, trip.departureTime);

        // If at or past T-10, expire any un-checked-in RESERVED bookings
        if (minsUntil <= 10 && minsUntil >= -30) {
          Object.entries(userBookings).forEach(([userId, bList]) => {
            bList.forEach((b) => {
              if (b.tripId === trip.id && b.status === 'RESERVED') {
                // Auto-expire booking
                setUserBookings((prev) => ({
                  ...prev,
                  [userId]: (prev[userId] || []).map((item) =>
                    item.id === b.id
                      ? { ...item, status: 'EXPIRED' as const, expiredAt: currentTime }
                      : item
                  ),
                }));

                // Release seat from trip
                setTrips((prevTrips) =>
                  prevTrips.map((t) =>
                    t.id === trip.id
                      ? { ...t, bookedSeatIds: t.bookedSeatIds.filter((s) => s !== b.seatId) }
                      : t
                  )
                );

                // Add 1 Minor penalty point to user (Section 8.1 & 8.2)
                const penaltyEval = evaluateAutoExpiryPenalty(b);
                setUsers((prevUsers) =>
                  prevUsers.map((u) => {
                    if (u.id === userId) {
                      const newMinors = u.minorPenalties + penaltyEval.minorPoints;
                      const newTotal = u.penaltyPoints + penaltyEval.points;
                      return {
                        ...u,
                        minorPenalties: newMinors,
                        penaltyPoints: newTotal,
                        penaltyStrikes: Math.floor(newTotal / 2),
                        isRestricted: newTotal >= PENALTY_SYSTEM.RESTRICTION_THRESHOLD,
                      };
                    }
                    return u;
                  })
                );

                // Notify with banner
                const targetUser = users.find((u) => u.id === userId);
                showNotice(
                  'T-10 Expiry Auto-Tick',
                  `${targetUser?.name || 'Passenger'} (Seat ${b.seatId}) failed to check in by T-10 (${trip.departureTime}). Seat released! 1 Minor penalty issued.`,
                  'warning'
                );

                // Trigger Seat Alert for eligible subscribers (FCFS Claim)
                const subscribers = seatAlerts[trip.id] || [];
                if (subscribers.length > 0) {
                  // If current logged-in user is an eligible subscriber, trigger FCFS Claim modal
                  if (currentUser && subscribers.includes(currentUser.id)) {
                    // Find user's subsequent booking
                    const userSubsequentBooking = (userBookings[currentUser.id] || []).find(
                      (ub) => ub.routeId === trip.routeId && ub.status === 'RESERVED'
                    );

                    setStandbyOffer({
                      trip,
                      seatId: b.seatId,
                      sourceBooking: userSubsequentBooking || null,
                    });
                  }
                }
              }
            });
          });
        }

        // 2. Bus Arrival, Waiting (2m) & Departure / 2 Score Penalty:
        // When countdown reaches 0: Bus has Arrived at stop
        if (minsUntil === 0 && trip.tripStatus !== 'ARRIVED' && trip.tripStatus !== 'DEPARTED' && trip.tripStatus !== 'CANCELLED') {
          setTrips((prevTrips) =>
            prevTrips.map((t) =>
              t.id === trip.id ? { ...t, tripStatus: 'ARRIVED' as const, boardingOpen: true } : t
            )
          );
          showNotice(
            'Bus Arrived 🚌',
            `${trip.routeName} has arrived! 2-minute departure window open. Scan for depart to board now.`,
            'info'
          );
        }

        // When minsUntil === -1: Bus is Waiting at bay (minute 1 of 2m waiting)
        if (minsUntil === -1 && trip.tripStatus !== 'WAITING' && trip.tripStatus !== 'DEPARTED' && trip.tripStatus !== 'CANCELLED') {
          setTrips((prevTrips) =>
            prevTrips.map((t) =>
              t.id === trip.id ? { ...t, tripStatus: 'WAITING' as const, boardingOpen: true } : t
            )
          );
        }

        // When minsUntil <= -2: 2 minutes for waiting have elapsed -> Bus DEPARTS!
        // Any student who just checked in but did not scan for depart receives the 2 score penalty!
        if (minsUntil <= -2 && trip.tripStatus !== 'DEPARTED' && trip.tripStatus !== 'COMPLETED' && trip.tripStatus !== 'CANCELLED') {
          // Update trip status to DEPARTED
          setTrips((prevTrips) =>
            prevTrips.map((t) =>
              t.id === trip.id ? { ...t, tripStatus: 'DEPARTED' as const, boardingOpen: false } : t
            )
          );

          // Check for checked-in passengers who did not scan for depart
          Object.entries(userBookings).forEach(([userId, bList]) => {
            bList.forEach((b) => {
              if (b.tripId === trip.id && b.status === 'CHECKED_IN') {
                // Transition to NO_SHOW
                setUserBookings((prev) => ({
                  ...prev,
                  [userId]: (prev[userId] || []).map((item) =>
                    item.id === b.id ? { ...item, status: 'NO_SHOW' as const } : item
                  ),
                }));

                // Apply 2-score penalty (1 Major = 2 pts)
                const penaltyEval = evaluateNoShowPenalty(b, trip.tripStatus === 'DELAYED');
                if (penaltyEval.points > 0) {
                  setUsers((prevUsers) =>
                    prevUsers.map((u) => {
                      if (u.id === userId) {
                        const newMajors = u.majorPenalties + penaltyEval.majorPoints;
                        const newTotal = u.penaltyPoints + penaltyEval.points; // +2 score penalty
                        return {
                          ...u,
                          majorPenalties: newMajors,
                          penaltyPoints: newTotal,
                          penaltyStrikes: Math.floor(newTotal / 2),
                          isRestricted: newTotal >= PENALTY_SYSTEM.RESTRICTION_THRESHOLD,
                        };
                      }
                      return u;
                    })
                  );

                  const targetUser = users.find((u) => u.id === userId);
                  showNotice(
                    'Bus Departed · 2 Score Penalty',
                    `${targetUser?.name || 'Passenger'} checked in but did not scan for depart before bus departed. 2 score penalty applied!`,
                    'alert'
                  );
                }
              }
            });
          });
        }
      });
    },
    [trips, userBookings, users, currentUser, seatAlerts]
  );

  // Continuous Auto-Tick Timer Hook (1 minute simulated per 1000/tickSpeed ms)
  useEffect(() => {
    if (!isAutoTickRunning) return;

    const interval = setInterval(() => {
      setSimulatedTimeStr((prevTime) => {
        const [h, m] = prevTime.split(':').map(Number);
        const totalMins = h * 60 + m + 1;
        const nextH = Math.floor(totalMins / 60) % 24;
        const nextM = totalMins % 60;
        const formatted = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
        return formatted;
      });
    }, 1000 / tickSpeed);

    return () => clearInterval(interval);
  }, [isAutoTickRunning, tickSpeed]);

  // Run automated deadline check whenever simulatedTimeStr changes
  useEffect(() => {
    processAutomatedDeadlines(simulatedTimeStr);
  }, [simulatedTimeStr, processAutomatedDeadlines]);

  // Handle route reversal (swap button)
  const handleSwapStops = useCallback(() => {
    setSelectedFrom((prevFrom) => {
      setSelectedTo(prevFrom);
      return selectedTo;
    });
  }, [selectedTo]);

  // Toggle 30m Notification
  const handleToggleNotify30 = (bookingId: string) => {
    if (!currentUser) return;
    setUserBookings((prev) => ({
      ...prev,
      [currentUser.id]: (prev[currentUser.id] || []).map((b) =>
        b.id === bookingId ? { ...b, notify30Min: !b.notify30Min } : b
      ),
    }));
  };

  // Check-In Now via GPS Assessment (T-30 to T-10 & Physical Proximity)
  const handleCheckInNow = (bookingId: string) => {
    if (!currentUser) return;

    const booking = currentUserBookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const fromStop = APU_STOPS.find((s) => s.name === booking.fromStopName) || APU_STOPS[1];
    const assessment = evaluateCheckInAssessment({
      currentTimeStr: simulatedTimeStr,
      departureTimeStr: booking.departureTime,
      userCoord: currentUser.coords,
      stopCoord: fromStop.coords,
      fromStopId: fromStop.id,
      alreadyCheckedIn: booking.status === 'CHECKED_IN' || booking.status === 'BOARDED',
    });

    if (!assessment.allowed) {
      showNotice('Check-in Rejected', assessment.reason, 'alert');
      return;
    }

    // Success! Generate secure digital QR token and update status to CHECKED_IN
    const qrToken = `APU-PASS-${currentUser.studentId}-${booking.tripId}-${booking.seatId}`;
    let updatedBooking: Booking | null = null;

    setUserBookings((prev) => ({
      ...prev,
      [currentUser.id]: (prev[currentUser.id] || []).map((b) => {
        if (b.id === bookingId) {
          const updated: Booking = {
            ...b,
            status: 'CHECKED_IN',
            checkedInAt: simulatedTimeStr,
            qrCodeToken: qrToken,
          };
          updatedBooking = updated;
          return updated;
        }
        return b;
      }),
    }));

    showNotice(
      'Check-in Verified!',
      `GPS proximity confirmed within ${fromStop.name} radius. Boarding pass QR code unlocked.`,
      'success'
    );

    if (updatedBooking) {
      setSelectedBookingForPass(updatedBooking);
      setIsBoardingPassOpen(true);
    }
  };

  // Acknowledge student scan for depart (transitions CHECKED_IN to BOARDED, avoiding 2 score penalty)
  const handleScanForDepart = (bookingId: string) => {
    let studentName = '';

    setUserBookings((prev) => {
      const next: Record<string, Booking[]> = {};
      Object.keys(prev).forEach((uid) => {
        next[uid] = (prev[uid] || []).map((b) => {
          if (b.id === bookingId) {
            const u = users.find((usr) => usr.id === uid);
            if (u) studentName = u.name;
            return {
              ...b,
              status: 'BOARDED' as const,
              boardedAt: simulatedTimeStr,
            };
          }
          return b;
        });
      });
      return next;
    });

    setSelectedBookingForPass((prev) =>
      prev && prev.id === bookingId ? { ...prev, status: 'BOARDED' as const, boardedAt: simulatedTimeStr } : prev
    );

    showNotice(
      'Depart Scan Acknowledged',
      `${studentName || 'Student'} scanned for depart and boarded bus safely. 0 penalty applied.`,
      'success'
    );
  };

  // Self Boarding Pass action
  const handleBoardBus = () => {
    if (!currentUser || !selectedBookingForPass) return;
    handleScanForDepart(selectedBookingForPass.id);
  };

  // Standard Seat Booking
  const handleConfirmSeat = (tripId: string, seatId: string) => {
    if (!currentUser) return;

    if (currentUser.isRestricted || currentUser.penaltyPoints >= PENALTY_SYSTEM.RESTRICTION_THRESHOLD) {
      showNotice(
        'Privileges Suspended',
        `Account reached ${currentUser.penaltyPoints}/6 penalty points. Booking is temporarily blocked.`,
        'alert'
      );
      return;
    }

    const trip = trips.find((t) => t.id === tripId);
    if (!trip) return;

    // Check if trip schedule has already passed
    if (getMinutesUntilDeparture(simulatedTimeStr, trip.departureTime) < 0) {
      showNotice(
        'Not Available',
        'The scheduled departure time for this bus has passed. Booking is closed and Not Available.',
        'alert'
      );
      return;
    }

    // Check normal booking window (closes at T-10)
    if (!isNormalBookingOpen(simulatedTimeStr, trip.departureTime)) {
      showNotice(
        'Booking Closed',
        'Normal reservation closes strictly at T-10 minutes prior to departure.',
        'alert'
      );
      return;
    }

    const fromStop = APU_STOPS.find((s) => s.id === trip.fromStopId) || APU_STOPS[0];
    const toStop = APU_STOPS.find((s) => s.id === trip.toStopId) || APU_STOPS[1];

    // Enforce 1 active seat per route in a day (no 2 active bookings for same departure & destination)
    const eligibility = validateBookingEligibility({
      activeBookings: currentUserBookings,
      candidateFromStopName: fromStop.name,
      candidateToStopName: toStop.name,
      penaltyPoints: currentUser.penaltyPoints,
    });

    if (!eligibility.canBook) {
      showNotice(
        eligibility.reason === 'DUPLICATE_ROUTE' ? 'Duplicate Route Blocked' : 'Booking Ineligible',
        eligibility.message || 'You cannot book this seat.',
        'alert'
      );
      return;
    }

    // Add seat to trip
    setTrips((prevTrips) =>
      prevTrips.map((t) =>
        t.id === tripId ? { ...t, bookedSeatIds: [...t.bookedSeatIds, seatId] } : t
      )
    );

    const newBooking: Booking = {
      id: `bk-${Date.now()}`,
      userId: currentUser.id,
      tripId: trip.id,
      seatId,
      routeId: trip.routeId,
      routeName: trip.routeName,
      fromStopName: fromStop.name,
      toStopName: toStop.name,
      departureTime: trip.departureTime,
      notify30Min: true,
      status: 'RESERVED', // Rule 9.1: No QR code in RESERVED status!
      bookedAt: simulatedTimeStr,
    };

    setUserBookings((prev) => ({
      ...prev,
      [currentUser.id]: [...(prev[currentUser.id] || []), newBooking],
    }));

    setSelectedFrom(fromStop);
    setSelectedTo(toStop);
    setSeatPickerTrip(null);
    setIsScheduleOpen(false);

    showNotice(
      'Seat Reserved',
      `Seat ${seatId} held for ${trip.departureTime}. Check in between T-30 and T-10 at ${fromStop.name} to receive your QR pass.`,
      'success'
    );
  };

  // Cancellation with Master Penalty Rules (Free before check-in, 1 Minor after check-in)
  const handleConfirmCancel = (bookingId: string) => {
    if (!currentUser) return;

    const booking = currentUserBookings.find((b) => b.id === bookingId);
    if (!booking) return;

    const trip = trips.find((t) => t.id === booking.tripId);
    const isWaiver = trip?.tripStatus === 'DELAYED' || trip?.tripStatus === 'CANCELLED';
    const penaltyEval = evaluateCancellationPenalty(booking, isWaiver);

    // Free the seat in trip
    setTrips((prevTrips) =>
      prevTrips.map((t) =>
        t.id === booking.tripId
          ? { ...t, bookedSeatIds: t.bookedSeatIds.filter((s) => s !== booking.seatId) }
          : t
      )
    );

    // Remove or cancel booking
    setUserBookings((prev) => ({
      ...prev,
      [currentUser.id]: (prev[currentUser.id] || []).filter((b) => b.id !== bookingId),
    }));

    // Apply penalties if evaluated
    if (penaltyEval.points > 0) {
      setUsers((prevUsers) =>
        prevUsers.map((u) => {
          if (u.id === currentUser.id) {
            const newMinors = u.minorPenalties + penaltyEval.minorPoints;
            const newTotal = u.penaltyPoints + penaltyEval.points;
            return {
              ...u,
              minorPenalties: newMinors,
              penaltyPoints: newTotal,
              penaltyStrikes: Math.floor(newTotal / 2),
              isRestricted: newTotal >= PENALTY_SYSTEM.RESTRICTION_THRESHOLD,
            };
          }
          return u;
        })
      );
      showNotice(
        'Cancellation Processed (1 Minor Penalty)',
        `Canceled after check-in. 1 Minor point applied (${currentUser.penaltyPoints + 1}/6 pts).`,
        'warning'
      );
    } else {
      showNotice('Reservation Cancelled', 'Free cancellation before check-in. 0 penalty points applied.', 'info');
    }

    setCancelingBooking(null);
  };

  // Atomic FCFS Claim Handler (Section 11)
  const handleAcceptClaimSeat = (tripId: string, seatId: string) => {
    if (!currentUser) return;

    const targetTrip = trips.find((t) => t.id === tripId);
    if (!targetTrip) return;

    // Find passenger's booking on immediately following bus
    const sourceBooking = currentUserBookings.find(
      (b) =>
        b.routeId === targetTrip.routeId &&
        (b.status === 'RESERVED' || b.status === 'CHECKED_IN') &&
        b.tripId !== targetTrip.id
    );

    // Validate eligibility using strict PDF rules
    const eligibility = validateClaimEligibility({
      candidateUser: currentUser,
      candidateBooking: sourceBooking,
      candidateTrip: sourceBooking ? trips.find((t) => t.id === sourceBooking.tripId) : undefined,
      targetTrip,
      currentTimeStr: simulatedTimeStr,
      userCoord: currentUser.coords,
      pickupCoord: APU_STOPS[1].coords, // LRT Bukit Jalil
    });

    if (!eligibility.eligible) {
      showNotice('Claim Failed', eligibility.reason, 'alert');
      setStandbyOffer(null);
      return;
    }

    // Atomic Transfer:
    // 1. Release seat on source trip
    if (sourceBooking) {
      setTrips((prevTrips) =>
        prevTrips.map((t) =>
          t.id === sourceBooking.tripId
            ? { ...t, bookedSeatIds: t.bookedSeatIds.filter((s) => s !== sourceBooking.seatId) }
            : t
        )
      );
    }

    // 2. Reserve seat on target trip
    setTrips((prevTrips) =>
      prevTrips.map((t) =>
        t.id === targetTrip.id ? { ...t, bookedSeatIds: [...t.bookedSeatIds, seatId] } : t
      )
    );

    // 3. Mark old booking as TRANSFERRED and create new active booking with status CHECKED_IN
    const qrToken = `APU-PASS-${currentUser.studentId}-${targetTrip.id}-${seatId}`;
    const newClaimBooking: Booking = {
      id: `bk-claim-${Date.now()}`,
      userId: currentUser.id,
      tripId: targetTrip.id,
      seatId,
      routeId: targetTrip.routeId,
      routeName: targetTrip.routeName,
      fromStopName: 'LRT Bukit Jalil',
      toStopName: 'Asia Pacific University (APU Campus)',
      departureTime: targetTrip.departureTime,
      notify30Min: true,
      status: 'CHECKED_IN', // Automatically checked-in upon successful claim!
      checkedInAt: simulatedTimeStr,
      bookedAt: simulatedTimeStr,
      qrCodeToken: qrToken,
    };

    setUserBookings((prev) => ({
      ...prev,
      [currentUser.id]: [
        ...(prev[currentUser.id] || []).map((b) =>
          b.id === sourceBooking?.id ? { ...b, status: 'TRANSFERRED' as const } : b
        ),
        newClaimBooking,
      ],
    }));

    setStandbyOffer(null);
    setSelectedBookingForPass(newClaimBooking);
    setIsBoardingPassOpen(true);

    showNotice(
      'FCFS Claim Successful! 🎉',
      `Transferred to earlier Bus A (${targetTrip.departureTime}, Seat ${seatId}). Boarding QR code generated!`,
      'success'
    );
  };

  // Toggle user simulated location (In range vs Out of range)
  const handleToggleUserLocation = () => {
    if (!currentUser) return;
    const isNowNear = !currentUser.isNearStop;
    const updatedCoords = isNowNear
      ? { lat: 3.0585, lng: 101.6919 } // LRT Bukit Jalil Waiting Bay (<50m, in 120m zone)
      : { lat: 3.1205, lng: 101.7275 }; // Cheras / M Vertica (~9km away)

    setUsers((prev) =>
      prev.map((u) =>
        u.id === currentUser.id
          ? {
              ...u,
              isNearStop: isNowNear,
              coords: updatedCoords,
              currentLocationName: isNowNear
                ? 'LRT Bukit Jalil Bus Bay (In Range, 30m)'
                : 'M Vertica, Cheras (~9km away, Out of Range)',
            }
          : u
      )
    );

    showNotice(
      'GPS Location Updated',
      isNowNear
        ? 'Location moved to LRT Bukit Jalil Bus Bay (Inside 120m Proximity Circle)'
        : 'Location moved to Cheras (~9km away, Outside Proximity Circle)',
      'info'
    );
  };

  // Driver Console: Toggle Boarding Open / Close & Issue No-Shows
  const handleDriverToggleBoarding = (tripId: string) => {
    const targetTrip = trips.find((t) => t.id === tripId);
    if (!targetTrip) return;

    const willBeOpen = !targetTrip.boardingOpen;

    setTrips((prev) =>
      prev.map((t) => (t.id === tripId ? { ...t, boardingOpen: willBeOpen } : t))
    );

    // If closing boarding, all checked-in passengers who have not boarded receive No-Show penalty (2 points / 1 Major)
    if (!willBeOpen) {
      const isTripCancelledOrDelayed =
        targetTrip.tripStatus === 'CANCELLED' || targetTrip.tripStatus === 'DELAYED';

      // Transition trip status to DEPARTED upon closing boarding
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, tripStatus: 'DEPARTED' as const } : t))
      );

      Object.entries(userBookings).forEach(([userId, bList]) => {
        bList.forEach((b) => {
          if (b.tripId === tripId && b.status === 'CHECKED_IN') {
            // Transition to NO_SHOW (passenger checked in but did not scan QR to depart)
            setUserBookings((prev) => ({
              ...prev,
              [userId]: (prev[userId] || []).map((item) =>
                item.id === b.id ? { ...item, status: 'NO_SHOW' as const } : item
              ),
            }));

            // Evaluate penalty of 2 score (1 Major penalty) per rule:
            // "whenever the bus depart, but the person only check in and not scan the qr for depart it will count as penalty of 2 score"
            const penaltyEval = evaluateNoShowPenalty(b, isTripCancelledOrDelayed);
            if (penaltyEval.points > 0) {
              setUsers((prevUsers) =>
                prevUsers.map((u) => {
                  if (u.id === userId) {
                    const newMajors = u.majorPenalties + penaltyEval.majorPoints;
                    const newTotal = u.penaltyPoints + penaltyEval.points; // +2 score
                    return {
                      ...u,
                      majorPenalties: newMajors,
                      penaltyPoints: newTotal,
                      penaltyStrikes: Math.floor(newTotal / 2),
                      isRestricted: newTotal >= PENALTY_SYSTEM.RESTRICTION_THRESHOLD,
                    };
                  }
                  return u;
                })
              );
            }
          }
        });
      });

      showNotice(
        'Bus Departed - 2 Penalty Score Issued',
        `Bus ${targetTrip.routeName} has departed. Checked-in passengers who did not scan QR to depart received a 2-score penalty.`,
        'alert'
      );
    } else {
      // Set to BOARDING
      setTrips((prev) =>
        prev.map((t) => (t.id === tripId ? { ...t, tripStatus: 'BOARDING' as const } : t))
      );
      showNotice('Boarding Open', `Boarding is now open for ${targetTrip.routeName}. Ready to scan passes.`, 'info');
    }
  };

  // Driver Console: Scan Pass / Student ID
  const handleDriverScanPass = (tokenOrCode: string) => {
    const tripBookings = allBookingsFlat.filter((b) => b.tripId === driverTripId);

    // Find matching booking by QR code token or student ID
    const matchedBooking = tripBookings.find((b) => {
      const u = users.find((usr) => usr.id === b.userId);
      return (
        b.qrCodeToken === tokenOrCode ||
        u?.studentId?.toUpperCase() === tokenOrCode.toUpperCase() ||
        b.id === tokenOrCode
      );
    });

    if (!matchedBooking) {
      return { success: false, message: 'Invalid Boarding Pass: No booking found for this trip.' };
    }

    if (matchedBooking.status === 'RESERVED') {
      return {
        success: false,
        message: 'Invalid Pass: Passenger did not complete GPS check-in (Status: RESERVED).',
      };
    }

    if (matchedBooking.status === 'EXPIRED') {
      return {
        success: false,
        message: 'Pass Expired: Reservation expired at T-10 due to missing check-in.',
      };
    }

    if (matchedBooking.status === 'BOARDED') {
      return { success: false, message: 'Pass Already Scanned: Passenger already boarded.' };
    }

    if (matchedBooking.status === 'CHECKED_IN') {
      setUserBookings((prev) => ({
        ...prev,
        [matchedBooking.userId]: (prev[matchedBooking.userId] || []).map((b) =>
          b.id === matchedBooking.id ? { ...b, status: 'BOARDED' as const } : b
        ),
      }));
      const u = users.find((usr) => usr.id === matchedBooking.userId);
      return {
        success: true,
        message: `Boarding Verified: Welcome ${u?.name || 'Passenger'} (Seat ${matchedBooking.seatId})!`,
      };
    }

    return { success: false, message: `Pass has status: ${matchedBooking.status}` };
  };

  // Reset Demo to 07:45 Initial Conditions (Section 19.2)
  const handleResetDemo = () => {
    setSimulatedTimeStr('07:45');
    setIsAutoTickRunning(false);
    setTrips(INITIAL_TRIPS);
    setUsers(DEMO_ACCOUNTS);
    setUserBookings({
      'user-sarah': [
        {
          id: 'bk-sarah-demo-a',
          userId: 'user-sarah',
          tripId: 'demo-a-0800',
          seatId: '1A',
          routeId: 'lrt',
          routeName: 'LRT Bukit Jalil ➔ APU (Bus A)',
          fromStopName: 'LRT Bukit Jalil',
          toStopName: 'Asia Pacific University (APU Campus)',
          departureTime: '08:00',
          notify30Min: true,
          status: 'CHECKED_IN',
          checkedInAt: '07:42',
          bookedAt: '07:30',
          qrCodeToken: 'APU-PASS-TP068412-DEMOA-1A',
        },
      ],
      'user-ryan': [
        {
          id: 'bk-ryan-demo-a',
          userId: 'user-ryan',
          tripId: 'demo-a-0800',
          seatId: '1B',
          routeId: 'lrt',
          routeName: 'LRT Bukit Jalil ➔ APU (Bus A)',
          fromStopName: 'LRT Bukit Jalil',
          toStopName: 'Asia Pacific University (APU Campus)',
          departureTime: '08:00',
          notify30Min: true,
          status: 'RESERVED',
          bookedAt: '07:32',
        },
      ],
      'user-rani': [
        {
          id: 'bk-rani-demo-b',
          userId: 'user-rani',
          tripId: 'demo-b-0810',
          seatId: '1A',
          routeId: 'lrt',
          routeName: 'LRT Bukit Jalil ➔ APU (Bus B)',
          fromStopName: 'LRT Bukit Jalil',
          toStopName: 'Asia Pacific University (APU Campus)',
          departureTime: '08:10',
          notify30Min: true,
          status: 'RESERVED',
          bookedAt: '07:34',
        },
      ],
      'user-amir': [
        {
          id: 'bk-amir-demo-b',
          userId: 'user-amir',
          tripId: 'demo-b-0810',
          seatId: '1B',
          routeId: 'lrt',
          routeName: 'LRT Bukit Jalil ➔ APU (Bus B)',
          fromStopName: 'LRT Bukit Jalil',
          toStopName: 'Asia Pacific University (APU Campus)',
          departureTime: '08:10',
          notify30Min: true,
          status: 'RESERVED',
          bookedAt: '07:35',
        },
      ],
    });
    setStandbyOffer(null);
    showNotice('Demo Reset', 'Reset to 07:45 initial Hackathon demo scenario conditions.', 'info');
  };

  // Toggle Seat Alert for a trip
  const handleToggleSeatAlert = (tripId: string) => {
    if (!currentUser) return;
    setSeatAlerts((prev) => {
      const currentList = prev[tripId] || [];
      const updated = currentList.includes(currentUser.id)
        ? currentList.filter((id) => id !== currentUser.id)
        : [...currentList, currentUser.id];
      return { ...prev, [tripId]: updated };
    });
  };

  const isUserSubscribedToAlert = (tripId: string) => {
    if (!currentUser) return false;
    return (seatAlerts[tripId] || []).includes(currentUser.id);
  };

  return (
    <PhoneShell
      simulatedTimeStr={simulatedTimeStr}
      theme={theme}
      onToggleTheme={handleToggleTheme}
    >
      {/* Client-Side Quota Defense Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 dark:bg-amber-950/80 border-b border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 px-3 py-2 text-xs text-center sticky top-0 z-50">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-100"
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
          onSelectAccount={(user) => {
            setCurrentUserId(user.id);
            if (user.id === 'user-rani' || user.id === 'user-amir' || user.id === 'user-sarah') {
              setSelectedFrom(APU_STOPS[1]);
              setSelectedTo(APU_STOPS[0]);
            }
          }}
        />
      ) : (
        /* Screen 2: Main AP-BUS Mobile Experience */
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
          />

          {/* Booked Buses Cards with Penalty Status, Check-In & Boarding Pass */}
          <BookedBusCard
            bookings={currentUserBookings}
            minorPenalties={currentUser.minorPenalties}
            majorPenalties={currentUser.majorPenalties}
            penaltyPoints={currentUser.penaltyPoints}
            currentTimeStr={simulatedTimeStr}
            userCoords={currentUser.coords}
            onToggleNotify30={handleToggleNotify30}
            onCheckInNow={handleCheckInNow}
            onOpenBoardingPass={(b) => {
              setSelectedBookingForPass(b);
              setIsBoardingPassOpen(true);
            }}
            onRequestCancel={(b) => setCancelingBooking(b)}
            onScanForDepart={handleScanForDepart}
          />

          {/* Primary Action Button: Open Shuttle Schedule & Booking */}
          <div className="px-3 py-2.5">
            {currentUserBookings.filter((b) => b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED').length >= 2 ? (
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
            ) : currentUser.penaltyPoints >= PENALTY_SYSTEM.RESTRICTION_THRESHOLD ? (
              <button
                onClick={() => setIsScheduleOpen(true)}
                className="w-full py-2.5 px-4 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs transition-all tracking-wide"
                title="Account suspended due to 6/6 penalty points."
              >
                <Bus className="w-4 h-4 shrink-0 text-zinc-400" />
                <span>BOOKING SUSPENDED (6/6 PENALTIES)</span>
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
                onSetTime={setSimulatedTimeStr}
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
          waitlistTripIds={seatAlerts['demo-a-0800'] || []}
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
          hasActiveBookingLimit={currentUserBookings.filter((b) => b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED').length >= 2}
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
          onDecline={() => setStandbyOffer(null)}
        />
      )}

      {/* MODAL 8: Driver / Staff Boarding Console (Section 13) */}
      {isDriverConsoleOpen && (
        <DriverConsoleModal
          trip={trips.find((t) => t.id === driverTripId) || trips[0]}
          allBookings={allBookingsFlat}
          users={users}
          onToggleBoarding={handleDriverToggleBoarding}
          onScanPass={handleDriverScanPass}
          onClose={() => setIsDriverConsoleOpen(false)}
        />
      )}
    </PhoneShell>
  );
}
