import type { Booking, BookingStatus, BusLifecycleStatus, BusTrip, CheckInAssessmentStatus, LocationCoord, PenaltyRecord } from '../types/bus.ts';
import { isWithinBusStopRange } from './geo.ts';

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
 * Rule: normal booking closes at T-10 (the last valid minute is T-11).
 */
export function isNormalBookingOpen(currentTimeStr: string, departureTimeStr: string): boolean {
  const minsUntil = getMinutesUntilDeparture(currentTimeStr, departureTimeStr);
  return minsUntil > 10;
}

/**
 * Checks if the Claim window is open for a trip.
 * Rule: a Claim issues a boarding pass immediately, so it follows the check-in opening (T-30)
 * and it closes at T-3. It does NOT depend on the driver having opened boarding.
 */
export function isClaimWindowOpen(currentTimeStr: string, departureTimeStr: string): boolean {
  const minsUntil = getMinutesUntilDeparture(currentTimeStr, departureTimeStr);
  return minsUntil <= 30 && minsUntil >= 3;
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

  // At or after T-10 (Check-in window closed, unverified reservations expire at T-10)
  if (minutesUntil <= 10) {
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
    points: PENALTY_SYSTEM.POINTS_MAJOR, // 2 score penalty
    majorPoints: 1, // 1 Major penalty
    type: 'MAJOR',
    reason: 'Checked in but did not scan for depart before bus departed (2 score penalty).',
    message: 'Checked in but did not scan for depart before bus departed (2 score penalty).',
  };
}

/**
 * Computes the bus status with label "bus status".
 * User Specification:
 * - "Not Available Now": when it hasn't reach the time (e.g. >30 minutes before departure or cancelled)
 * - "On the Way": when it counts down the time (T-30m down to T-1m)
 * - "Arrived": when it reaches 0 countdown (0m)
 * - "Waiting": 2 minutes for waiting and depart (minute -1)
 * - "Depart": when waiting period completes and bus departs (minute -2)
 * - "Expired": when the bus section is done (minute -3 and beyond)
 */
export function getBusLifecycleStatus(
  currentTimeStr: string,
  departureTimeStr: string,
  options?: {
    isCancelled?: boolean;
    isCompleted?: boolean;
  }
): BusLifecycleStatus {
  if (options?.isCancelled) {
    return 'Not Available Now';
  }

  const minsUntil = getMinutesUntilDeparture(currentTimeStr, departureTimeStr);

  // When it hasn't reached the countdown period (> 30 mins)
  if (minsUntil > 30) {
    return 'Not Available Now';
  }

  // When counting down the time
  if (minsUntil > 0) {
    return 'On the Way';
  }

  // At 0 countdown
  if (minsUntil === 0) {
    return 'Arrived';
  }

  // 2 minutes for waiting and depart:
  // Minute 1: Waiting
  if (minsUntil === -1) {
    return 'Waiting';
  }

  // Minute 2: Depart (bus departs)
  if (minsUntil === -2) {
    return 'Depart';
  }

  // When the bus section is done
  return 'Expired';
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
  isRestricted?: boolean; // true only on the one restricted service day
  penaltyPoints?: number; // informational only (shown in the message)
}): { canBook: boolean; reason?: 'RESTRICTED' | 'MAX_LIMIT_REACHED' | 'DUPLICATE_ROUTE'; message?: string } {
  const { activeBookings, candidateFromStopName, candidateToStopName, isRestricted = false } = params;

  // Reaching 6 points restricts ONE service day (the next one). It is not a permanent block.
  if (isRestricted) {
    return {
      canBook: false,
      reason: 'RESTRICTED',
      message: `Booking is restricted today because your account reached ${PENALTY_SYSTEM.RESTRICTION_THRESHOLD} penalty points. Booking is available again on the next service day.`,
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
      message: `You already have ${MAX_ACTIVE_BOOKINGS_LIMIT} active bookings (the maximum). Cancel one to book another shuttle.`,
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
      message: `You already hold an active booking from ${candidateFromStopName} to ${candidateToStopName} today. Only one active booking per route (same pickup and destination) is allowed.`,
    };
  }

  return { canBook: true };
}

/**
 * The schedule immediately after `target` for the same pickup and destination
 * (cancelled trips are skipped). Returns undefined when `target` is the last one.
 */
export function getImmediatelyNextTrip(allTrips: BusTrip[], target: BusTrip): BusTrip | undefined {
  return allTrips
    .filter(
      (t) =>
        t.id !== target.id &&
        t.fromStopId === target.fromStopId &&
        t.toStopId === target.toStopId &&
        t.tripStatus !== 'CANCELLED' &&
        t.departureTime > target.departureTime
    )
    .sort((x, y) => x.departureTime.localeCompare(y.departureTime))[0];
}

/** First unoccupied seat on a trip (row by row), or null when the trip is full. */
export function getFirstFreeSeat(trip: BusTrip): string | null {
  const capacity = trip.seatedCapacity ?? trip.totalSeats ?? 40;
  if (trip.bookedSeatIds.length >= capacity) return null;
  for (let row = 1; row <= Math.ceil(capacity / 4); row++) {
    for (const col of ['A', 'B', 'C', 'D']) {
      const id = `${row}${col}`;
      if (!trip.bookedSeatIds.includes(id)) return id;
    }
  }
  return null;
}

/**
 * Claim eligibility (move to the earlier shuttle):
 * 1. The account is not restricted today.
 * 2. The Claim window of the target shuttle is open (T-30 to T-3) and it has not left.
 * 3. The user holds an active booking on the schedule IMMEDIATELY AFTER the target,
 *    same pickup and same destination. A booking two or more schedules later is not eligible.
 * 4. A seat is free on the target shuttle.
 * 5. The user is at the pickup point.
 * A failed Claim changes nothing: the original booking stays valid.
 */
export function validateClaimEligibility(params: {
  targetTrip: BusTrip;
  allTrips: BusTrip[];
  userBookings: Booking[];
  currentTimeStr: string;
  userCoord: LocationCoord;
  pickupCoord: LocationCoord;
  isRestricted?: boolean;
}): {
  eligible: boolean;
  sourceBooking?: Booking;
  nextTrip?: BusTrip;
  reason: string;
} {
  const { targetTrip, allTrips, userBookings, currentTimeStr, userCoord, pickupCoord, isRestricted = false } = params;

  if (isRestricted) {
    return { eligible: false, reason: 'Booking and Claim are restricted for this account today.' };
  }

  if (['DEPARTED', 'COMPLETED', 'CANCELLED', 'ON_THE_WAY'].includes(targetTrip.tripStatus)) {
    return { eligible: false, reason: 'This shuttle has already left or was cancelled.' };
  }

  if (!isClaimWindowOpen(currentTimeStr, targetTrip.departureTime)) {
    const minsUntil = getMinutesUntilDeparture(currentTimeStr, targetTrip.departureTime);
    return {
      eligible: false,
      reason:
        minsUntil > 30
          ? 'Claim opens 30 minutes before departure.'
          : 'Claim window has closed (it closes 3 minutes before departure).',
    };
  }

  const nextTrip = getImmediatelyNextTrip(allTrips, targetTrip);
  if (!nextTrip) {
    return { eligible: false, reason: 'There is no later schedule on this route, so there is nothing to claim from.' };
  }

  const isActive = (b: Booking) => b.status === 'RESERVED' || b.status === 'CHECKED_IN';
  const sourceBooking = userBookings.find((b) => b.tripId === nextTrip.id && isActive(b));
  if (!sourceBooking) {
    const other = userBookings.find((b) => {
      if (!isActive(b)) return false;
      const t = allTrips.find((x) => x.id === b.tripId);
      return (
        !!t &&
        t.fromStopId === targetTrip.fromStopId &&
        t.toStopId === targetTrip.toStopId &&
        t.departureTime > nextTrip.departureTime
      );
    });
    return {
      eligible: false,
      nextTrip,
      reason: other
        ? `Claim is only allowed from the schedule immediately after this one (${nextTrip.departureTime}). Your booking is on the ${other.departureTime} shuttle.`
        : `Claim requires an active booking on the schedule immediately after this one (${nextTrip.departureTime}).`,
    };
  }

  if (getFirstFreeSeat(targetTrip) === null) {
    return { eligible: false, sourceBooking, nextTrip, reason: 'No seat is free on this shuttle right now.' };
  }

  const { inRange, distanceMeters, thresholdMeters } = isWithinBusStopRange(userCoord, pickupCoord, targetTrip.fromStopId);
  if (!inRange) {
    return {
      eligible: false,
      sourceBooking,
      nextTrip,
      reason: `Location check failed: you are ${distanceMeters} m from the pickup point (must be within ${thresholdMeters} m to claim).`,
    };
  }

  return { eligible: true, sourceBooking, nextTrip, reason: 'Eligible to claim this earlier shuttle.' };
}

/* -------------------------------------------------------------------------- */
/* Service days and the penalty period                                        */
/* -------------------------------------------------------------------------- */

const DAY_MS = 86_400_000;
const toUtc = (isoDay: string) => Date.parse(`${isoDay}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function addDays(isoDay: string, days: number): string {
  return toIso(toUtc(isoDay) + days * DAY_MS);
}

export function daysBetween(fromIsoDay: string, toIsoDay: string): number {
  return Math.round((toUtc(toIsoDay) - toUtc(fromIsoDay)) / DAY_MS);
}

/** The shuttle runs Monday to Friday. */
export function isServiceDay(isoDay: string): boolean {
  const dow = new Date(toUtc(isoDay)).getUTCDay();
  return dow >= 1 && dow <= 5;
}

/** The first service day strictly after `isoDay` (Friday -> Monday). */
export function nextServiceDay(isoDay: string): string {
  let d = addDays(isoDay, 1);
  while (!isServiceDay(d)) d = addDays(d, 1);
  return d;
}

/** "18 Jan 2027" */
export function formatDateLong(isoDay: string): string {
  return new Date(toUtc(isoDay)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** "Mon 16 Nov" */
export function formatServiceDay(isoDay: string): string {
  return new Date(toUtc(isoDay)).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Penalty period (agreed rules):
 * - Minor = 1 point, Major = 2 points. Reversed (waived) penalties do not count.
 * - A period starts at the first violation and lasts 90 days, then points reset to 0.
 * - Every time the points of a period reach a multiple of 6, the account is restricted
 *   for ONE service day: the next service day after the day the threshold was reached.
 *   The restriction is never permanent.
 */
export function computePenaltyState(
  records: PenaltyRecord[],
  today: string
): {
  points: number;
  minors: number;
  majors: number;
  restrictedToday: boolean;
  upcomingRestriction: string | null;
  restrictedDays: string[];
  periodStart: string | null;
  resetsOn: string | null;
} {
  const active = records
    .filter((r) => !r.waived && r.day <= today)
    .sort((a, b) => a.day.localeCompare(b.day) || a.timestamp.localeCompare(b.timestamp));

  let periodStart: string | null = null;
  let points = 0;
  let minors = 0;
  let majors = 0;
  let threshold = PENALTY_SYSTEM.RESTRICTION_THRESHOLD;
  const restrictedDays: string[] = [];

  for (const r of active) {
    if (periodStart === null || daysBetween(periodStart, r.day) >= PENALTY_SYSTEM.RESET_DAYS) {
      periodStart = r.day;
      points = 0;
      minors = 0;
      majors = 0;
      threshold = PENALTY_SYSTEM.RESTRICTION_THRESHOLD;
    }
    points += r.points;
    if (r.type === 'MINOR') minors++;
    else majors++;
    while (points >= threshold) {
      const day = nextServiceDay(r.day);
      if (!restrictedDays.includes(day)) restrictedDays.push(day);
      threshold += PENALTY_SYSTEM.RESTRICTION_THRESHOLD;
    }
  }

  // The period is over: points are back to zero.
  if (periodStart !== null && daysBetween(periodStart, today) >= PENALTY_SYSTEM.RESET_DAYS) {
    periodStart = null;
    points = 0;
    minors = 0;
    majors = 0;
  }

  return {
    points,
    minors,
    majors,
    restrictedToday: restrictedDays.includes(today),
    upcomingRestriction: restrictedDays.find((d) => d > today) ?? null,
    restrictedDays,
    periodStart,
    resetsOn: periodStart ? addDays(periodStart, PENALTY_SYSTEM.RESET_DAYS) : null,
  };
}

/* -------------------------------------------------------------------------- */
/* Boarding pass tokens                                                       */
/* -------------------------------------------------------------------------- */

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randomChars(length: number): string {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += TOKEN_ALPHABET[b % TOKEN_ALPHABET.length];
  return out;
}

/**
 * Random single-use boarding token (60 bits). It contains no TP number, trip or seat,
 * so it cannot be guessed from public information. Only this token is accepted by the scanner.
 */
export function generateQrToken(): string {
  return `APB-${randomChars(4)}-${randomChars(4)}-${randomChars(4)}`;
}

/** Human-readable booking reference shown on the pass and to the driver. Not a credential. */
export function generateBookingRef(): string {
  return `BK-${randomChars(6)}`;
}

export function normalizeQrToken(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '');
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
