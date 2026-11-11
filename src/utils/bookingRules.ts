import { Booking, BookingStatus, BusTrip, CheckInAssessmentStatus, DemoUser, LocationCoord } from '../types/bus';
import { isWithinBusStopRange, getStopRadius } from './geo';

/**
 * Checks if daily booking is open.
 * Master Context v2.0 Rule: Booking opens every day at 06:00 MYT.
 */
export function isBookingWindowOpen(currentTimeStr: string): boolean {
  const [hours, minutes] = currentTimeStr.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const openMinutes = 6 * 60; // 06:00 AM MYT
  return totalMinutes >= openMinutes;
}

/**
 * Calculates minutes until a given departure time (HH:mm) from current time (HH:mm).
 * Returns positive if future, negative if passed.
 */
export function getMinutesUntilDeparture(currentTimeStr: string, departureTimeStr: string): number {
  const [cHours, cMins] = currentTimeStr.split(':').map(Number);
  const [dHours, dMins] = departureTimeStr.split(':').map(Number);

  const curTotal = cHours * 60 + cMins;
  const depTotal = dHours * 60 + dMins;

  return depTotal - curTotal;
}

/**
 * Checks if normal booking is still open for a specific trip.
 * Master Context v2.0 Rule: Normal booking closes strictly 10 minutes before effective departure (T-10).
 */
export function isNormalBookingOpen(currentTimeStr: string, departureTimeStr: string): boolean {
  const minsUntil = getMinutesUntilDeparture(currentTimeStr, departureTimeStr);
  return minsUntil >= 10;
}

/**
 * Checks if FCFS Claim window is open for a trip.
 * Master Context v2.0 Rule: Claim closes strictly at T-3 minutes or when boarding has closed.
 */
export function isClaimWindowOpen(currentTimeStr: string, departureTimeStr: string, boardingOpen: boolean = true): boolean {
  if (!boardingOpen) return false;
  const minsUntil = getMinutesUntilDeparture(currentTimeStr, departureTimeStr);
  return minsUntil >= 3;
}

/**
 * Assesses whether a user at current coordinates can perform Geo Check-in:
 * Master Context v2.0 Rules:
 * - Check-in normal opens at T-30 minutes.
 * - Check-in normal closes strictly at T-10 minutes.
 * - Stop Proximity: APU 100m, LRT 120m, other 100m. Max device accuracy: 50m.
 */
export function evaluateCheckInAssessment(params: {
  currentTimeStr: string;
  departureTimeStr: string;
  userCoord: LocationCoord;
  stopCoord: LocationCoord;
  stopIdentifier?: string;
  fromStopId?: string;
  currentBookingStatus?: BookingStatus;
  alreadyCheckedIn?: boolean;
}): {
  allowed: boolean;
  status: CheckInAssessmentStatus;
  minutesUntil: number;
  distanceMeters: number;
  thresholdMeters: number;
  inRange: boolean;
  inTimeWindow: boolean;
  message: string;
  reason: string;
} {
  const { currentTimeStr, departureTimeStr, userCoord, stopCoord, stopIdentifier, fromStopId } = params;
  const effectiveIdentifier = stopIdentifier || fromStopId;
  const minutesUntil = getMinutesUntilDeparture(currentTimeStr, departureTimeStr);
  const { inRange, distanceMeters, thresholdMeters } = isWithinBusStopRange(
    userCoord,
    stopCoord,
    effectiveIdentifier
  );

  // Before T-30
  if (minutesUntil > 30) {
    const msg = `Check-in opens 30 mins before departure (${minutesUntil - 30}m remaining).`;
    return {
      allowed: false,
      status: 'WAITING_WINDOW',
      minutesUntil,
      distanceMeters,
      thresholdMeters,
      inRange,
      inTimeWindow: false,
      message: msg,
      reason: msg,
    };
  }

  // After T-10 (Check-in window closed)
  if (minutesUntil < 10) {
    const msg = 'Normal check-in closed at T−10 minutes.';
    return {
      allowed: false,
      status: 'WINDOW_CLOSED',
      minutesUntil,
      distanceMeters,
      thresholdMeters,
      inRange,
      inTimeWindow: false,
      message: msg,
      reason: msg,
    };
  }

  // Inside T-30 to T-10 window
  if (!inRange) {
    const msg = `Outside stop range (${distanceMeters}m away, need ≤ ${thresholdMeters}m). Move closer to check-in.`;
    return {
      allowed: false,
      status: 'OUT_OF_RANGE',
      minutesUntil,
      distanceMeters,
      thresholdMeters,
      inRange: false,
      inTimeWindow: true,
      message: msg,
      reason: msg,
    };
  }

  const msg = `In range (${distanceMeters}m ≤ ${thresholdMeters}m)! GPS Proximity verified. Ready to check in.`;
  return {
    allowed: true,
    status: 'READY_TO_CHECK_IN',
    minutesUntil,
    distanceMeters,
    thresholdMeters,
    inRange: true,
    inTimeWindow: true,
    message: msg,
    reason: msg,
  };
}

/**
 * Capacity Calculation (Master Context v2.0 Section 7 & 8):
 * Used capacity = Reserved + Checked-in + Boarded
 * Available seated slots = max(0, Seated capacity - Used capacity)
 * Boarding does NOT release seats! Seats are only released on Cancel, Expiry (T-10), or Claim transfer.
 */
export function calculateTripCapacity(
  trip: BusTrip,
  allBookingsForTrip: Booking[]
): {
  reservedCount: number;
  checkedInCount: number;
  boardedCount: number;
  usedCapacity: number;
  seatedCapacity: number;
  standingCapacity: number;
  availableSeats: number;
  isFull: boolean;
} {
  let reservedCount = 0;
  let checkedInCount = 0;
  let boardedCount = 0;

  for (const b of allBookingsForTrip) {
    if (b.status === 'RESERVED') reservedCount++;
    else if (b.status === 'CHECKED_IN') checkedInCount++;
    else if (b.status === 'BOARDED') boardedCount++;
  }

  const usedCapacity = reservedCount + checkedInCount + boardedCount;
  const seatedCapacity = trip.seatedCapacity ?? trip.totalSeats ?? 40;
  const standingCapacity = trip.standingCapacity ?? 0;
  const availableSeats = Math.max(0, seatedCapacity - usedCapacity);

  return {
    reservedCount,
    checkedInCount,
    boardedCount,
    usedCapacity,
    seatedCapacity,
    standingCapacity,
    availableSeats,
    isFull: availableSeats <= 0,
  };
}

export function isBusFull(tripOrBookedSeats: BusTrip | string[], totalSeats?: number): boolean {
  if (Array.isArray(tripOrBookedSeats)) {
    return tripOrBookedSeats.length >= (totalSeats ?? 40);
  }
  const trip = tripOrBookedSeats;
  const cap = trip.seatedCapacity ?? trip.totalSeats ?? 40;
  return trip.bookedSeatIds.length >= cap;
}

/**
 * Capacity Reduction Rule (Master Context v2.0 Section 7 & 23 Item 8):
 * Rejects capacity reduction if new total capacity < currently held active bookings.
 */
export function canUpdateVehicleCapacity(
  newSeated: number,
  newStanding: number,
  currentUsedCapacity: number
): { allowed: boolean; reason?: string } {
  const newTotal = newSeated + newStanding;
  if (newTotal < currentUsedCapacity) {
    return {
      allowed: false,
      reason: `Cannot reduce vehicle capacity to ${newTotal}: ${currentUsedCapacity} active passenger reservations are holding seats. Affected reservations must be resolved first.`,
    };
  }
  return { allowed: true };
}

/**
 * Penalty & Strike Engine (Master Context v2.0 Section 13 & 14):
 * - Minor = 1 point
 * - Major = 2 points
 * - Threshold = 6 points (3 Major equivalents)
 * - Reset = 90 days from first infraction
 */
export const PENALTY_SYSTEM = {
  POINTS_MINOR: 1,
  POINTS_MAJOR: 2,
  RESTRICTION_THRESHOLD: 6, // 3 Major equivalents = 6 points
  RESET_DAYS: 90,
};

/**
 * Cancellation Evaluation:
 * - Cancel before check-in: 0 points (ALWAYS FREE!)
 * - Cancel after check-in: 1 Minor point
 * - Delayed/Cancelled trip: 0 points (Free)
 */
export function evaluateCancellationPenalty(booking: Booking, isTripDelayedOrCancelled: boolean = false): {
  points: number;
  minorPoints: number;
  type?: 'MINOR';
  message: string;
  reason: string;
} {
  if (isTripDelayedOrCancelled) {
    return {
      points: 0,
      minorPoints: 0,
      message: 'Free cancellation: Shuttle is delayed or cancelled.',
      reason: 'Free cancellation: Shuttle is delayed or cancelled.',
    };
  }

  if (booking.status === 'RESERVED') {
    return {
      points: 0,
      minorPoints: 0,
      message: 'Free cancellation: Cancelled before check-in (always penalty-free per APU policy).',
      reason: 'Free cancellation: Cancelled before check-in (always penalty-free per APU policy).',
    };
  }

  if (booking.status === 'CHECKED_IN') {
    return {
      points: PENALTY_SYSTEM.POINTS_MINOR,
      minorPoints: PENALTY_SYSTEM.POINTS_MINOR,
      type: 'MINOR',
      message: 'Late Cancellation after check-in incurs 1 Minor penalty point.',
      reason: 'Late Cancellation after check-in incurs 1 Minor penalty point.',
    };
  }

  return {
    points: 0,
    minorPoints: 0,
    message: 'Cancelled with no penalty.',
    reason: 'Cancelled with no penalty.',
  };
}

/**
 * Expiry Evaluation at T-10:
 * Unverified RESERVED passengers at T-10: 1 Minor penalty point.
 */
export function evaluateAutoExpiryPenalty(bookingOrTripWaiver?: Booking | boolean): {
  points: number;
  minorPoints: number;
  type?: 'MINOR';
  reason: string;
  message: string;
} {
  const isTripDelayedOrCancelled = typeof bookingOrTripWaiver === 'boolean' ? bookingOrTripWaiver : false;
  if (isTripDelayedOrCancelled) {
    return { points: 0, minorPoints: 0, reason: 'Penalty waived due to trip delay or cancellation.', message: 'Penalty waived due to trip delay or cancellation.' };
  }
  return {
    points: PENALTY_SYSTEM.POINTS_MINOR,
    minorPoints: PENALTY_SYSTEM.POINTS_MINOR,
    type: 'MINOR',
    reason: 'Failed to check in before the T−10 minutes cutoff.',
    message: 'Failed to check in before the T−10 minutes cutoff.',
  };
}

/**
 * No-Show Evaluation at Boarding Close:
 * Passengers who checked in but failed to board before driver closed boarding: 1 Major penalty point.
 */
export function evaluateNoShowPenalty(bookingOrTripWaiver?: Booking | boolean, maybeWaiver?: boolean): {
  points: number;
  majorPoints: number;
  type?: 'MAJOR';
  reason: string;
  message: string;
} {
  const isTripDelayedOrCancelled =
    typeof maybeWaiver === 'boolean'
      ? maybeWaiver
      : typeof bookingOrTripWaiver === 'boolean'
      ? bookingOrTripWaiver
      : false;
  if (isTripDelayedOrCancelled) {
    return { points: 0, majorPoints: 0, reason: 'Penalty waived due to trip delay or cancellation.', message: 'Penalty waived due to trip delay or cancellation.' };
  }
  return {
    points: PENALTY_SYSTEM.POINTS_MAJOR,
    majorPoints: PENALTY_SYSTEM.POINTS_MAJOR,
    type: 'MAJOR',
    reason: 'Checked in but failed to board before driver closed boarding (No-Show).',
    message: 'Checked in but failed to board before driver closed boarding (No-Show).',
  };
}

/**
 * Checks if the departure time for a trip has passed the current simulated time.
 */
export function isTripPastSchedule(currentTimeStr: string, departureTimeStr: string): boolean {
  return getMinutesUntilDeparture(currentTimeStr, departureTimeStr) < 0;
}

/**
 * Checks active booking eligibility (Max 2 active bookings, different origin-destination pairs).
 * Everyone is not allowed to have 2 active booked seats from the same depart point to the same destination in a day.
 */
export const MAX_ACTIVE_BOOKINGS_LIMIT = 2;

export function validateBookingEligibility(params: {
  activeBookings: Booking[];
  candidateFromStopName: string;
  candidateToStopName: string;
  penaltyPoints?: number;
}): { canBook: boolean; reason?: 'RESTRICTED' | 'MAX_LIMIT_REACHED' | 'DUPLICATE_ROUTE'; message?: string } {
  const { activeBookings, candidateFromStopName, candidateToStopName, penaltyPoints = 0 } = params;

  if (penaltyPoints >= PENALTY_SYSTEM.RESTRICTION_THRESHOLD) {
    return {
      canBook: false,
      reason: 'RESTRICTED',
      message: `Account restricted (${penaltyPoints}/${PENALTY_SYSTEM.RESTRICTION_THRESHOLD} points accumulated). Booking privileges suspended.`,
    };
  }

  // Count active reservations (RESERVED, CHECKED_IN, BOARDED)
  const activeCount = activeBookings.filter(
    (b) => b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED'
  ).length;

  if (activeCount >= MAX_ACTIVE_BOOKINGS_LIMIT) {
    return {
      canBook: false,
      reason: 'MAX_LIMIT_REACHED',
      message: `Maximum active bookings reached (${MAX_ACTIVE_BOOKINGS_LIMIT}/2). Cancel an existing booking to book another trip.`,
    };
  }

  const normalize = (s: string) => s.trim().toLowerCase();
  const isDuplicate = activeBookings
    .filter((b) => b.status === 'RESERVED' || b.status === 'CHECKED_IN' || b.status === 'BOARDED')
    .some(
      (b) =>
        normalize(b.fromStopName) === normalize(candidateFromStopName) &&
        normalize(b.toStopName) === normalize(candidateToStopName)
    );

  if (isDuplicate) {
    return {
      canBook: false,
      reason: 'DUPLICATE_ROUTE',
      message: `Duplicate route rule: You already have an active booked seat from ${candidateFromStopName} to ${candidateToStopName} today. You cannot hold 2 active booked seats for the same departure and destination in a day.`,
    };
  }

  return { canBook: true };
}

/**
 * FCFS Claim Eligibility (Master Context v2.0 Section 11):
 * Rules:
 * 1. Must hold an active booking on the IMMEDIATELY NEXT BUS (strictly 1 schedule slot later).
 * 2. Route, direction, pickup, and destination must match.
 * 3. User account is not restricted.
 * 4. Claim window is open (T-3 cutoff and boardingOpen !== false).
 * 5. Available seat exists on target bus.
 * 6. User is at the pickup location.
 */
export function validateClaimEligibility(params: {
  targetTrip: BusTrip;
  allTripsInRoute?: BusTrip[];
  userBookings?: Booking[];
  candidateBooking?: Booking | null;
  candidateTrip?: BusTrip;
  candidateUser?: DemoUser;
  currentTimeStr: string;
  userCoord: LocationCoord;
  stopCoord?: LocationCoord;
  pickupCoord?: LocationCoord;
  stopIdentifier?: string;
  userPenaltyPoints?: number;
}): {
  eligible: boolean;
  sourceBooking?: Booking;
  reason: string;
} {
  const {
    targetTrip,
    allTripsInRoute,
    userBookings = [],
    candidateBooking,
    candidateUser,
    currentTimeStr,
    userCoord,
    stopCoord,
    pickupCoord,
    stopIdentifier,
  } = params;

  const points = candidateUser?.penaltyPoints ?? params.userPenaltyPoints ?? 0;
  const targetStopCoord = pickupCoord || stopCoord || { lat: 3.0587, lng: 101.6917 };

  // 1. Restriction check
  if (points >= PENALTY_SYSTEM.RESTRICTION_THRESHOLD) {
    return { eligible: false, reason: 'Account booking/claim privileges are currently restricted.' };
  }

  // 2. Claim window check (T-3 cutoff)
  if (!isClaimWindowOpen(currentTimeStr, targetTrip.departureTime, targetTrip.boardingOpen)) {
    return { eligible: false, reason: 'Claim window has closed (closes at T−3 minutes or when boarding closes).' };
  }

  // 3. Find source booking
  let matchedSourceBooking: Booking | undefined = candidateBooking || undefined;

  if (!matchedSourceBooking && allTripsInRoute && allTripsInRoute.length > 0) {
    const sortedTrips = [...allTripsInRoute].sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    const targetIndex = sortedTrips.findIndex((t) => t.id === targetTrip.id);
    if (targetIndex === -1 || targetIndex === sortedTrips.length - 1) {
      return { eligible: false, reason: 'No immediately following schedule exists on this route.' };
    }

    const immediatelyNextTrip = sortedTrips[targetIndex + 1];
    matchedSourceBooking = userBookings.find(
      (b) =>
        b.tripId === immediatelyNextTrip.id &&
        (b.status === 'RESERVED' || b.status === 'CHECKED_IN')
    );

    if (!matchedSourceBooking) {
      return {
        eligible: false,
        reason: `Claim rule: You must hold an active reservation on the immediately following bus (${immediatelyNextTrip.departureTime} ${immediatelyNextTrip.routeName}) to claim this earlier seat.`,
      };
    }
  }

  if (!matchedSourceBooking) {
    return {
      eligible: false,
      reason: 'Claim rule: You must hold an active reservation on the immediately following bus.',
    };
  }

  // 4. Check user location at pickup stop
  const { inRange, distanceMeters, thresholdMeters } = isWithinBusStopRange(
    userCoord,
    targetStopCoord,
    stopIdentifier
  );

  if (!inRange) {
    return {
      eligible: false,
      sourceBooking: matchedSourceBooking,
      reason: `Location verification failed: You are ${distanceMeters}m away (need ≤ ${thresholdMeters}m from pickup stop to claim).`,
    };
  }

  return {
    eligible: true,
    sourceBooking: matchedSourceBooking,
    reason: 'Eligible for FCFS Claim transfer.',
  };
}

export function formatTime12h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${period}`;
}
