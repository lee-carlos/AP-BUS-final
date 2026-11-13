/**
 * AP-BUS simulation engine.
 *
 * All rules run here as pure functions: (state, action) -> new state. The React app only
 * renders the state and calls these functions, and the tests call them directly.
 * Every decision (accepted, rejected, penalty) is appended to `state.log` (the Scenario log).
 */
import type {
  Booking,
  BusStop,
  BusTrip,
  DemoUser,
  PenaltyRecord,
  ScanResult,
  ScenarioLogEntry,
  ScenarioLogKind,
} from '../types/bus.ts';
import { APU_STOPS, DEMO_ACCOUNTS, FAR_AWAY, buildTripsForDay } from '../data/apuRoutes.ts';
import {
  SCENARIO_DRIVER_NAME,
  SCENARIO_SCRIPT,
  SCENARIO_SEAT_ALERTS,
  SCENARIO_START_DAY,
  SCENARIO_START_TIME,
  createScenarioBookings,
} from '../data/scenario.ts';
import type { ScenarioStep } from '../data/scenario.ts';
import {
  PENALTY_SYSTEM,
  computePenaltyState,
  evaluateCheckInAssessment,
  formatDateLong,
  formatServiceDay,
  generateBookingRef,
  generateQrToken,
  getFirstFreeSeat,
  getImmediatelyNextTrip,
  getMinutesUntilDeparture,
  isBookingWindowOpen,
  isNormalBookingOpen,
  nextServiceDay,
  normalizeQrToken,
  validateBookingEligibility,
  validateClaimEligibility,
} from './bookingRules.ts';

export interface SimState {
  day: string; // ISO date of the current service day
  dayIndex: number; // 1 = first day of the demo
  time: string; // HH:mm
  autoplay: boolean; // play the scripted persona actions when the clock passes their time
  users: DemoUser[];
  trips: BusTrip[];
  bookings: Booking[];
  seatAlerts: Record<string, string[]>; // tripId -> userIds
  log: ScenarioLogEntry[];
  doneSteps: string[]; // ids of scripted steps already played
  seq: number; // counter for ids
}

export interface ActionResult {
  state: SimState;
  ok: boolean;
  title: string;
  message: string;
  booking?: Booking;
}

/* ------------------------------- helpers ---------------------------------- */

const clone = (s: SimState): SimState => structuredClone(s);
const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const ACTIVE = ['RESERVED', 'CHECKED_IN', 'BOARDED'];
const isActive = (b: Booking) => ACTIVE.includes(b.status);
const stopById = (id: string): BusStop => APU_STOPS.find((s) => s.id === id) || APU_STOPS[0];
export const shortName = (u?: DemoUser) => (u ? u.name.replace(' (Driver)', '').split(' ').slice(0, u.role === 'Driver' ? 2 : 1).join(' ') : 'Passenger');
const tripLabel = (t: BusTrip) => `${t.departureTime} ${t.routeName}`;

function addLog(s: SimState, kind: ScenarioLogKind, actor: string, text: string, user?: DemoUser) {
  s.seq += 1;
  s.log.push({ id: `log-${s.seq}`, day: s.day, time: s.time, kind, actor, text, caseTag: user?.scenario });
}

/** Recompute the displayed penalty fields of every user from their penalty records. */
function refreshPenalties(s: SimState) {
  for (const u of s.users) {
    const st = computePenaltyState(u.penaltyRecords || [], s.day);
    u.penaltyPoints = st.points;
    u.minorPenalties = st.minors;
    u.majorPenalties = st.majors;
    u.penaltyStrikes = Math.floor(st.points / 2);
    u.isRestricted = st.restrictedToday;
    u.restrictedOn = st.restrictedToday ? s.day : st.upcomingRestriction;
    u.penaltyResetOn = st.resetsOn;
  }
}

function addPenalty(s: SimState, user: DemoUser, booking: Booking, type: 'MINOR' | 'MAJOR', reason: string) {
  const before = computePenaltyState(user.penaltyRecords || [], s.day);
  s.seq += 1;
  const record: PenaltyRecord = {
    id: `pen-${s.seq}`,
    userId: user.id,
    tripId: booking.tripId,
    bookingId: booking.id,
    type,
    points: type === 'MINOR' ? PENALTY_SYSTEM.POINTS_MINOR : PENALTY_SYSTEM.POINTS_MAJOR,
    reason,
    day: s.day,
    timestamp: s.time,
    waived: false,
  };
  user.penaltyRecords = [...(user.penaltyRecords || []), record];
  refreshPenalties(s);
  const after = computePenaltyState(user.penaltyRecords, s.day);
  addLog(
    s,
    'penalty',
    shortName(user),
    `${reason} +${record.points} point${record.points > 1 ? 's' : ''} (${type === 'MINOR' ? 'minor' : 'major'}). Total ${after.points}/${PENALTY_SYSTEM.RESTRICTION_THRESHOLD}.`,
    user
  );
  if (after.upcomingRestriction && after.upcomingRestriction !== before.upcomingRestriction) {
    addLog(
      s,
      'penalty',
      shortName(user),
      `Reached ${PENALTY_SYSTEM.RESTRICTION_THRESHOLD} points: booking will be restricted on ${formatServiceDay(after.upcomingRestriction)} (one service day only). Points reset on ${formatDateLong(after.resetsOn || s.day)}.`,
      user
    );
  }
}

/** Free a seat and tell Seat Alert subscribers. They still have to pass the Claim rules. */
function releaseSeat(s: SimState, trip: BusTrip, seatId: string) {
  trip.bookedSeatIds = trip.bookedSeatIds.filter((x) => x !== seatId);
  const subscribers = (s.seatAlerts[trip.id] || []).map((id) => s.users.find((u) => u.id === id)).filter(Boolean) as DemoUser[];
  if (subscribers.length > 0 && getMinutesUntilDeparture(s.time, trip.departureTime) >= 3) {
    addLog(s, 'info', 'System', `Seat ${seatId} on the ${tripLabel(trip)} shuttle is free. Seat Alert sent to ${subscribers.map(shortName).join(', ')}.`);
  }
}

const fail = (s: SimState, title: string, message: string): ActionResult => ({ state: s, ok: false, title, message });

/* ------------------------------ initial state ----------------------------- */

export function createInitialState(): SimState {
  const s: SimState = {
    day: SCENARIO_START_DAY,
    dayIndex: 1,
    time: SCENARIO_START_TIME,
    autoplay: true,
    users: structuredClone(DEMO_ACCOUNTS),
    trips: buildTripsForDay(1),
    bookings: createScenarioBookings(generateQrToken()),
    seatAlerts: structuredClone(SCENARIO_SEAT_ALERTS),
    log: [],
    doneSteps: [],
    seq: 0,
  };
  refreshPenalties(s);
  addLog(s, 'info', 'System', `Scenario start: ${formatServiceDay(s.day)}, ${s.time}. The 08:00 shuttle is full. Press Auto-Tick to watch every case.`);
  processDeadlines(s, true);
  return s;
}

/* -------------------------------- booking --------------------------------- */

export function book(state: SimState, userId: string, tripId: string, seatId?: string): ActionResult {
  const s = clone(state);
  const user = s.users.find((u) => u.id === userId);
  const trip = s.trips.find((t) => t.id === tripId);
  if (!user || !trip) return fail(s, 'Booking failed', 'Account or shuttle not found.');
  const from = stopById(trip.fromStopId);
  const to = stopById(trip.toStopId);
  const reject = (message: string) => {
    addLog(s, 'reject', shortName(user), `Booking ${tripLabel(trip)} rejected: ${message}`, user);
    return fail(s, 'Booking rejected', message);
  };

  if (!isBookingWindowOpen(s.time)) return reject('Same-day booking opens at 06:00.');
  const eligibility = validateBookingEligibility({
    activeBookings: s.bookings.filter((b) => b.userId === userId),
    candidateFromStopName: from.name,
    candidateToStopName: to.name,
    isRestricted: user.isRestricted,
  });
  if (!eligibility.canBook) return reject(eligibility.message || 'Not eligible.');
  if (['DEPARTED', 'COMPLETED', 'CANCELLED'].includes(trip.tripStatus) || getMinutesUntilDeparture(s.time, trip.departureTime) < 0) {
    return reject('This shuttle has already left.');
  }
  if (!isNormalBookingOpen(s.time, trip.departureTime)) return reject('Booking closes 10 minutes before departure.');
  const seat = seatId || getFirstFreeSeat(trip);
  if (!seat || getFirstFreeSeat(trip) === null) return reject('This shuttle is full. Turn on Seat Alert to be told when a seat is released.');
  if (trip.bookedSeatIds.includes(seat)) return reject(`Seat ${seat} was just taken. Pick another seat.`);

  trip.bookedSeatIds.push(seat);
  const booking: Booking = {
    id: generateBookingRef(),
    userId,
    tripId,
    seatId: seat,
    routeId: trip.routeId,
    routeName: trip.routeName,
    fromStopName: from.name,
    toStopName: to.name,
    departureTime: trip.departureTime,
    notify30Min: true,
    status: 'RESERVED',
    bookedAt: s.time,
  };
  s.bookings.push(booking);
  const activeCount = s.bookings.filter((b) => b.userId === userId && isActive(b)).length;
  addLog(s, 'success', shortName(user), `Booked seat ${seat} on the ${tripLabel(trip)} shuttle (${activeCount}/2 active bookings). No QR yet: it is issued at check-in.`, user);
  return {
    state: s,
    ok: true,
    title: 'Seat Reserved',
    message: `Seat ${seat} held for ${trip.departureTime}. Check in at ${from.name} between T-30 and T-10 to get your QR pass.`,
    booking,
  };
}

export function cancel(state: SimState, userId: string, bookingId: string): ActionResult {
  const s = clone(state);
  const user = s.users.find((u) => u.id === userId);
  const booking = s.bookings.find((b) => b.id === bookingId && b.userId === userId);
  if (!user || !booking) return fail(s, 'Cancel failed', 'Booking not found.');
  if (booking.status !== 'RESERVED' && booking.status !== 'CHECKED_IN') {
    return fail(s, 'Cannot cancel', `This booking is already ${booking.status}.`);
  }
  const trip = s.trips.find((t) => t.id === booking.tripId);
  const waived = trip?.tripStatus === 'DELAYED' || trip?.tripStatus === 'CANCELLED' || trip?.isDelayPenaltiesWaived;
  const wasCheckedIn = booking.status === 'CHECKED_IN';
  booking.status = 'CANCELLED';
  addLog(s, 'info', shortName(user), `Cancelled the ${booking.departureTime} booking ${wasCheckedIn ? 'after' : 'before'} check-in.`, user);
  if (wasCheckedIn && !waived) addPenalty(s, user, booking, 'MINOR', 'Cancelled after check-in.');
  if (trip) releaseSeat(s, trip, booking.seatId);
  return {
    state: s,
    ok: true,
    title: wasCheckedIn && !waived ? 'Cancelled (1 Minor Penalty)' : 'Reservation Cancelled',
    message: wasCheckedIn && !waived ? 'Cancelled after check-in: 1 minor point applied.' : 'Free cancellation. 0 penalty points.',
  };
}

/* -------------------------------- check-in -------------------------------- */

export function checkIn(state: SimState, userId: string, bookingId: string): ActionResult {
  const s = clone(state);
  const user = s.users.find((u) => u.id === userId);
  const booking = s.bookings.find((b) => b.id === bookingId && b.userId === userId);
  if (!user || !booking) return fail(s, 'Check-in failed', 'Booking not found.');
  const trip = s.trips.find((t) => t.id === booking.tripId);
  if (!trip) return fail(s, 'Check-in failed', 'Shuttle not found.');
  if (booking.status !== 'RESERVED') {
    return fail(s, 'Check-in not needed', `This booking is already ${booking.status}.`);
  }
  const stop = stopById(trip.fromStopId);
  const assessment = evaluateCheckInAssessment({
    currentTimeStr: s.time,
    departureTimeStr: trip.departureTime,
    userCoord: user.coords,
    stopCoord: stop.coords,
    fromStopId: stop.id,
  });
  if (!assessment.allowed) {
    addLog(s, 'reject', shortName(user), `Check-in for the ${trip.departureTime} shuttle rejected: ${assessment.reason}`, user);
    return fail(s, 'Check-in Rejected', assessment.reason);
  }
  booking.status = 'CHECKED_IN';
  booking.checkedInAt = s.time;
  booking.qrCodeToken = generateQrToken();
  addLog(
    s,
    'success',
    shortName(user),
    `Checked in for the ${trip.departureTime} shuttle at ${stop.name} (${assessment.distanceMeters} m, limit ${assessment.thresholdMeters} m). Single-use QR pass issued.`,
    user
  );
  return { state: s, ok: true, title: 'Check-in Verified', message: `You are at ${stop.name}. Your single-use QR boarding pass is ready.`, booking };
}

/* ---------------------------------- claim --------------------------------- */

export function claim(state: SimState, userId: string, targetTripId: string): ActionResult {
  const s = clone(state);
  const user = s.users.find((u) => u.id === userId);
  const target = s.trips.find((t) => t.id === targetTripId);
  if (!user || !target) return fail(s, 'Claim failed', 'Account or shuttle not found.');
  const check = validateClaimEligibility({
    targetTrip: target,
    allTrips: s.trips,
    userBookings: s.bookings.filter((b) => b.userId === userId),
    currentTimeStr: s.time,
    userCoord: user.coords,
    pickupCoord: stopById(target.fromStopId).coords,
    isRestricted: user.isRestricted,
  });
  if (!check.eligible || !check.sourceBooking) {
    addLog(s, 'reject', shortName(user), `Claim on the ${target.departureTime} shuttle rejected: ${check.reason} The original booking is unchanged.`, user);
    return fail(s, 'Claim Rejected', check.reason);
  }
  const seat = getFirstFreeSeat(target) as string;
  const source = check.sourceBooking;
  const sourceTrip = s.trips.find((t) => t.id === source.tripId);

  // Atomic transfer: take the earlier seat, revoke the old booking, release the later seat.
  target.bookedSeatIds.push(seat);
  source.status = 'TRANSFERRED';
  source.transferredToTripId = target.id;
  const booking: Booking = {
    id: generateBookingRef(),
    userId,
    tripId: target.id,
    seatId: seat,
    routeId: target.routeId,
    routeName: target.routeName,
    fromStopName: stopById(target.fromStopId).name,
    toStopName: stopById(target.toStopId).name,
    departureTime: target.departureTime,
    notify30Min: true,
    status: 'CHECKED_IN', // location was verified as part of the Claim
    bookedAt: s.time,
    checkedInAt: s.time,
    qrCodeToken: generateQrToken(),
  };
  s.bookings.push(booking);
  s.seatAlerts[target.id] = (s.seatAlerts[target.id] || []).filter((id) => id !== userId);
  addLog(
    s,
    'success',
    shortName(user),
    `Claim accepted: moved from the ${source.departureTime} shuttle to the ${target.departureTime} shuttle (seat ${seat}). New QR pass issued, old booking revoked.`,
    user
  );
  if (sourceTrip) releaseSeat(s, sourceTrip, source.seatId);
  return {
    state: s,
    ok: true,
    title: 'Claim Successful',
    message: `You are now on the ${target.departureTime} shuttle, seat ${seat}. Your new QR pass is ready.`,
    booking,
  };
}

export function toggleSeatAlert(state: SimState, userId: string, tripId: string): SimState {
  const s = clone(state);
  const list = s.seatAlerts[tripId] || [];
  s.seatAlerts[tripId] = list.includes(userId) ? list.filter((id) => id !== userId) : [...list, userId];
  return s;
}

/* ----------------------------- boarding (driver) -------------------------- */

/**
 * Scan a QR pass at the door of `tripId`. ONLY the random token is accepted: a TP number or a
 * booking reference never boards anyone. The result carries the passenger identity so the
 * driver can compare it with the person in front of them.
 */
export function scanPass(state: SimState, tripId: string, tokenInput: string, actor = 'Driver'): { state: SimState; result: ScanResult } {
  const s = clone(state);
  const trip = s.trips.find((t) => t.id === tripId);
  const token = normalizeQrToken(tokenInput);
  const booking = token ? s.bookings.find((b) => b.qrCodeToken === token) : undefined;
  const user = booking ? s.users.find((u) => u.id === booking.userId) : undefined;
  const passenger =
    booking && user
      ? { name: user.name, studentId: user.studentId, bookingId: booking.id, seatId: booking.seatId, departureTime: booking.departureTime, avatar: user.avatar }
      : undefined;
  const who = passenger ? `${passenger.name} (${passenger.studentId}, ${passenger.bookingId}, seat ${passenger.seatId})` : '';
  const reject = (message: string) => {
    addLog(s, 'reject', actor, `Scan rejected${who ? ` for ${who}` : ''}: ${message}`, user);
    return { state: s, result: { success: false, message, passenger } };
  };

  if (!trip) return reject('Shuttle not found.');
  if (!booking || !user) return reject('QR code not recognised. Only the QR pass issued at check-in is accepted.');
  if (booking.tripId !== trip.id) return reject(`Wrong shuttle: this pass is for the ${booking.departureTime} shuttle, not ${trip.departureTime}.`);
  if (booking.status === 'BOARDED') return reject(`Pass already used at ${booking.boardedAt || 'boarding'}. Each QR pass works once.`);
  if (booking.status === 'TRANSFERRED') return reject('Pass revoked: this booking was moved to another shuttle.');
  if (booking.status === 'NO_SHOW') return reject('Pass expired: the shuttle departed without this passenger.');
  if (booking.status !== 'CHECKED_IN') return reject(`Pass is not valid (booking is ${booking.status}).`);
  if (!trip.boardingOpen) return reject('Boarding is not open for this shuttle yet.');

  booking.status = 'BOARDED';
  booking.boardedAt = s.time;
  addLog(s, 'success', actor, `QR scanned: ${who} boarded the ${trip.departureTime} shuttle. Pass is now used.`, user);
  return { state: s, result: { success: true, message: `Boarding verified. Seat ${booking.seatId}.`, passenger } };
}

/**
 * Staff exception when a QR cannot be scanned. Needs a written reason and is always logged.
 * If the passenger was already marked No-show, the major penalty is reversed.
 */
export function manualBoard(state: SimState, bookingId: string, reason: string, actor = 'Driver'): ActionResult {
  const s = clone(state);
  const booking = s.bookings.find((b) => b.id === bookingId);
  const user = booking ? s.users.find((u) => u.id === booking.userId) : undefined;
  if (!booking || !user) return fail(s, 'Manual boarding failed', 'Booking not found.');
  const cleanReason = reason.trim();
  if (cleanReason.length < 5) return fail(s, 'Reason required', 'Write a short reason (at least 5 characters) for boarding without a QR scan.');
  if (!['RESERVED', 'CHECKED_IN', 'NO_SHOW'].includes(booking.status)) {
    return fail(s, 'Manual boarding not allowed', `This booking is ${booking.status}.`);
  }
  const who = `${user.name} (${user.studentId}, ${booking.id}, seat ${booking.seatId})`;
  const wasNoShow = booking.status === 'NO_SHOW';
  const wasReserved = booking.status === 'RESERVED';
  booking.status = 'BOARDED';
  booking.boardedAt = s.time;
  booking.checkedInAt = booking.checkedInAt || s.time;
  booking.manualBoardingReason = cleanReason;
  addLog(s, 'info', actor, `Manual boarding${wasReserved ? ' with assisted check-in' : ''}: ${who} on the ${booking.departureTime} shuttle. Reason: "${cleanReason}".`, user);
  if (wasNoShow) {
    const record = (user.penaltyRecords || []).find((r) => r.bookingId === booking.id && r.type === 'MAJOR' && !r.waived);
    if (record) {
      record.waived = true;
      refreshPenalties(s);
      addLog(s, 'info', actor, `No-show penalty reversed for ${user.name} (-${record.points} points). Total ${user.penaltyPoints}/${PENALTY_SYSTEM.RESTRICTION_THRESHOLD}.`, user);
    }
  }
  return { state: s, ok: true, title: 'Boarding Confirmed', message: `${user.name} boarded manually. Reason recorded in the log.`, booking };
}

function depart(s: SimState, trip: BusTrip, actor: string) {
  trip.tripStatus = 'DEPARTED';
  trip.boardingOpen = false;
  const tripBookings = s.bookings.filter((b) => b.tripId === trip.id);
  const waived = trip.isDelayPenaltiesWaived === true;
  for (const b of tripBookings) {
    if (b.status !== 'CHECKED_IN') continue;
    b.status = 'NO_SHOW';
    const user = s.users.find((u) => u.id === b.userId);
    if (user && !waived) addPenalty(s, user, b, 'MAJOR', `Checked in for the ${trip.departureTime} shuttle but did not scan to board.`);
  }
  if (tripBookings.length > 0) {
    const boarded = tripBookings.filter((b) => b.status === 'BOARDED').length;
    addLog(s, 'info', actor, `The ${tripLabel(trip)} shuttle departed. ${boarded} demo passenger${boarded === 1 ? '' : 's'} on board.`);
  }
}

export function setBoarding(state: SimState, tripId: string, open: boolean, actor = 'Driver'): ActionResult {
  const s = clone(state);
  const trip = s.trips.find((t) => t.id === tripId);
  if (!trip) return fail(s, 'Not found', 'Shuttle not found.');
  if (['DEPARTED', 'COMPLETED', 'CANCELLED'].includes(trip.tripStatus)) {
    return fail(s, 'Boarding closed', 'This shuttle has already left.');
  }
  if (open) {
    trip.boardingOpen = true;
    if (trip.tripStatus === 'SCHEDULED') trip.tripStatus = 'BOARDING';
    addLog(s, 'info', actor, `Boarding opened for the ${tripLabel(trip)} shuttle.`);
    return { state: s, ok: true, title: 'Boarding Open', message: `Ready to scan passes for ${trip.departureTime}.` };
  }
  if (getMinutesUntilDeparture(s.time, trip.departureTime) > 0) {
    // Before the scheduled time the driver can only pause boarding. Nobody is penalised early.
    trip.boardingOpen = false;
    if (trip.tripStatus === 'BOARDING') trip.tripStatus = 'SCHEDULED';
    addLog(s, 'info', actor, `Boarding paused for the ${tripLabel(trip)} shuttle (it has not reached its departure time).`);
    return { state: s, ok: true, title: 'Boarding Paused', message: 'Doors closed. No-shows are only recorded at departure.' };
  }
  depart(s, trip, actor);
  return { state: s, ok: true, title: 'Shuttle Departed', message: 'Boarding closed. Checked-in passengers who did not scan are marked No-show.' };
}

export function setTripStatus(state: SimState, tripId: string, status: 'ARRIVED' | 'DEPARTED', actor = 'Driver'): ActionResult {
  const s = clone(state);
  const trip = s.trips.find((t) => t.id === tripId);
  if (!trip) return fail(s, 'Not found', 'Shuttle not found.');
  if (['DEPARTED', 'COMPLETED', 'CANCELLED'].includes(trip.tripStatus)) {
    return fail(s, 'Already departed', 'This shuttle has already left.');
  }
  if (status === 'ARRIVED') {
    trip.tripStatus = 'ARRIVED';
    trip.boardingOpen = true;
    addLog(s, 'info', actor, `The ${tripLabel(trip)} shuttle arrived at the pickup point. Boarding is open.`);
    return { state: s, ok: true, title: 'Shuttle Arrived', message: 'Boarding is open. Passengers can scan their QR pass.' };
  }
  if (getMinutesUntilDeparture(s.time, trip.departureTime) > 0) {
    return fail(s, 'Too early to depart', `This shuttle cannot depart before its scheduled time (${trip.departureTime}), so nobody is marked No-show early.`);
  }
  depart(s, trip, actor);
  return { state: s, ok: true, title: 'Shuttle Departed', message: 'Checked-in passengers who did not scan are marked No-show (+2 points).' };
}

/* --------------------------- small user actions --------------------------- */

/** Demo only: place the user at their pickup point or far away (the prototype does not read real GPS). */
export function setUserLocation(state: SimState, userId: string, near: boolean): SimState {
  const s = clone(state);
  const user = s.users.find((u) => u.id === userId);
  if (!user) return s;
  if (!near) {
    user.coords = { ...FAR_AWAY };
    user.isNearStop = false;
    user.currentLocationName = 'Away from the stop (~11 km)';
    return s;
  }
  const mine = s.bookings
    .filter((b) => b.userId === userId && (b.status === 'RESERVED' || b.status === 'CHECKED_IN'))
    .sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  const next = mine.find((b) => b.status === 'RESERVED') || mine[0];
  const trip = next ? s.trips.find((t) => t.id === next.tripId) : undefined;
  const stop = stopById(trip?.fromStopId || 'lrt');
  user.coords = { lat: stop.coords.lat - 0.0002, lng: stop.coords.lng + 0.0002 }; // ~30 m from the stop
  user.isNearStop = true;
  user.currentLocationName = `${stop.name} pickup point (in range, ~30 m)`;
  return s;
}

export function toggleNotify(state: SimState, bookingId: string): SimState {
  const s = clone(state);
  const b = s.bookings.find((x) => x.id === bookingId);
  if (b) b.notify30Min = !b.notify30Min;
  return s;
}

export function setAutoplay(state: SimState, autoplay: boolean): SimState {
  const s = clone(state);
  s.autoplay = autoplay;
  return s;
}

/* ------------------------------ clock & days ------------------------------ */

/** Automatic deadlines of the current minute. `silent` skips arrival lines (used at start of day). */
function processDeadlines(s: SimState, silent = false) {
  const trips = [...s.trips].sort((a, b) => a.departureTime.localeCompare(b.departureTime));
  for (const trip of trips) {
    if (['DEPARTED', 'COMPLETED', 'CANCELLED'].includes(trip.tripStatus)) continue;
    const minsUntil = getMinutesUntilDeparture(s.time, trip.departureTime);

    // T-10: a booking that was never checked in expires and its seat is released.
    if (minsUntil <= 10) {
      for (const b of s.bookings) {
        if (b.tripId !== trip.id || b.status !== 'RESERVED') continue;
        b.status = 'EXPIRED';
        const user = s.users.find((u) => u.id === b.userId);
        if (user && !trip.isDelayPenaltiesWaived) addPenalty(s, user, b, 'MINOR', `Did not check in for the ${trip.departureTime} shuttle before T-10. Booking expired.`);
        releaseSeat(s, trip, b.seatId);
      }
    }

    const hasBookings = s.bookings.some((b) => b.tripId === trip.id);
    if (minsUntil <= -2) {
      depart(s, trip, 'System');
    } else if (minsUntil === -1) {
      trip.tripStatus = 'WAITING';
      trip.boardingOpen = true;
    } else if (minsUntil === 0) {
      if (trip.tripStatus !== 'ARRIVED') {
        trip.tripStatus = 'ARRIVED';
        trip.boardingOpen = true;
        if (hasBookings && !silent) addLog(s, 'info', 'System', `The ${tripLabel(trip)} shuttle arrived. Boarding is open for 2 minutes.`);
      }
    }
  }
}

function findPass(s: SimState, userId: string, tripId: string): Booking | undefined {
  const mine = s.bookings.filter((b) => b.userId === userId && b.tripId === tripId && b.qrCodeToken);
  return mine.find((b) => b.status === 'CHECKED_IN') || mine[mine.length - 1];
}

/** Play one scripted step through the same functions the UI uses. Returns the new state. */
function runStep(state: SimState, step: ScenarioStep): SimState {
  let s = state;
  const a = step.action;
  if (a.type === 'scan') {
    // Skip a normal scripted scan when someone already boarded this passenger by hand.
    const existing = findPass(s, a.userId, a.passTripId || a.tripId);
    if (!existing || !existing.qrCodeToken) return s;
    if (existing.status === 'BOARDED' && !a.reuse) return s;
  }
  if (step.intro) {
    s = clone(s);
    const introUser = s.users.find((u) => u.id === step.introActor);
    addLog(s, 'info', introUser ? shortName(introUser) : 'System', step.intro, introUser);
  }
  switch (a.type) {
    case 'checkIn': {
      const b = s.bookings.find((x) => x.userId === a.userId && x.tripId === a.tripId && x.status === 'RESERVED');
      if (!b) return s; // the user already did it by hand, or the booking is gone
      return checkIn(s, a.userId, b.id).state;
    }
    case 'book':
      return book(s, a.userId, a.tripId).state;
    case 'claim':
      return claim(s, a.userId, a.tripId).state;
    case 'move': {
      const moved = setUserLocation(s, a.userId, a.near);
      const u = moved.users.find((x) => x.id === a.userId);
      addLog(moved, 'info', shortName(u), a.near ? 'Arrived at the pickup point.' : 'Left the pickup point.', u);
      return moved;
    }
    case 'scan': {
      const pass = findPass(s, a.userId, a.passTripId || a.tripId);
      if (!pass || !pass.qrCodeToken) return s;
      return scanPass(s, a.tripId, pass.qrCodeToken, SCENARIO_DRIVER_NAME).state;
    }
    case 'manualBoard': {
      const b = s.bookings.find((x) => x.userId === a.userId && x.tripId === a.tripId && ['RESERVED', 'CHECKED_IN', 'NO_SHOW'].includes(x.status));
      if (!b) return s;
      return manualBoard(s, b.id, a.reason, SCENARIO_DRIVER_NAME).state;
    }
    default:
      return s;
  }
}

function processMinute(state: SimState): SimState {
  let s = state;
  processDeadlines(s);
  if (!s.autoplay) return s;
  const due = SCENARIO_SCRIPT.filter((st) => st.dayIndex === s.dayIndex && st.time === s.time && !s.doneSteps.includes(st.id));
  for (const step of due) {
    s = runStep(s, step);
    s.doneSteps.push(step.id);
  }
  return s;
}

/**
 * Move the clock to `target` (HH:mm). Going forward processes every minute in between, so
 * jumping from 07:45 to 08:03 gives the same result as letting the clock run.
 * Going backward only changes the displayed time (use Reset Demo to start over).
 */
export function advanceTo(state: SimState, target: string): SimState {
  let s = clone(state);
  const from = toMin(s.time);
  const to = toMin(target);
  if (to <= from) {
    s.time = target;
    return s;
  }
  for (let m = from + 1; m <= to; m++) {
    s.time = fromMin(m);
    s = processMinute(s);
  }
  return s;
}

/**
 * Start the next service day (Mon-Fri). Shuttles and bookings start fresh, penalty records
 * carry over, so a restriction earned yesterday applies today and is gone tomorrow.
 */
export function startNextServiceDay(state: SimState): SimState {
  const s = clone(state);
  const restrictedBefore = s.users.filter((u) => u.isRestricted).map((u) => u.id);
  s.day = nextServiceDay(s.day);
  s.dayIndex += 1;
  s.time = SCENARIO_START_TIME;
  s.trips = buildTripsForDay(s.dayIndex);
  s.bookings = [];
  s.seatAlerts = {};
  for (const u of s.users) {
    const original = DEMO_ACCOUNTS.find((d) => d.id === u.id);
    if (original) {
      u.coords = { ...original.coords };
      u.isNearStop = original.isNearStop;
      u.currentLocationName = original.currentLocationName;
    }
  }
  refreshPenalties(s);
  addLog(s, 'info', 'System', `New service day: ${formatServiceDay(s.day)}, ${s.time}. Bookings start fresh. Penalty points carry over.`);
  for (const u of s.users) {
    if (u.isRestricted) {
      addLog(s, 'penalty', shortName(u), `Restricted today (${formatServiceDay(s.day)}) after reaching ${PENALTY_SYSTEM.RESTRICTION_THRESHOLD} points. Booking and Claim are blocked for this one service day.`, u);
    } else if (restrictedBefore.includes(u.id)) {
      addLog(s, 'success', shortName(u), `The one-day restriction is over. Booking works again (points stay at ${u.penaltyPoints} until ${formatDateLong(u.penaltyResetOn || s.day)}).`, u);
    }
  }
  processDeadlines(s, true);
  return s;
}

/* -------------------------------- selectors ------------------------------- */

/**
 * Seat Alert offer for one user: a subscribed shuttle that now has a free seat, inside the
 * Claim window, while the user holds the schedule immediately after it.
 */
export function findClaimOffer(state: SimState, userId: string, dismissedTripIds: string[] = []): { trip: BusTrip; seatId: string; sourceBooking: Booking } | null {
  const user = state.users.find((u) => u.id === userId);
  if (!user) return null;
  for (const [tripId, subscribers] of Object.entries(state.seatAlerts)) {
    if (!subscribers.includes(userId) || dismissedTripIds.includes(tripId)) continue;
    const trip = state.trips.find((t) => t.id === tripId);
    if (!trip) continue;
    const seatId = getFirstFreeSeat(trip);
    if (!seatId) continue;
    const mins = getMinutesUntilDeparture(state.time, trip.departureTime);
    if (mins > 30 || mins < 3 || ['DEPARTED', 'COMPLETED', 'CANCELLED'].includes(trip.tripStatus)) continue;
    const next = getImmediatelyNextTrip(state.trips, trip);
    const sourceBooking = next
      ? state.bookings.find((b) => b.userId === userId && b.tripId === next.id && (b.status === 'RESERVED' || b.status === 'CHECKED_IN'))
      : undefined;
    if (!sourceBooking) continue;
    return { trip, seatId, sourceBooking };
  }
  return null;
}
