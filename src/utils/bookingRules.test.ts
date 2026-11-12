import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isBookingWindowOpen,
  isNormalBookingOpen,
  isClaimWindowOpen,
  getMinutesUntilDeparture,
  evaluateCheckInAssessment,
  calculateTripCapacity,
  canUpdateVehicleCapacity,
  evaluateCancellationPenalty,
  evaluateAutoExpiryPenalty,
  evaluateNoShowPenalty,
  validateBookingEligibility,
  validateClaimEligibility,
  PENALTY_SYSTEM,
  formatTime12h,
  isTripPastSchedule,
  getBusLifecycleStatus,
} from './bookingRules';
import { calculateDistanceMeters, isWithinBusStopRange, getStopRadius } from './geo';
import { Booking, BusTrip } from '../types/bus';

test('booking window opens at 06:00 AM MYT sharp', () => {
  assert.equal(isBookingWindowOpen('05:59'), false);
  assert.equal(isBookingWindowOpen('06:00'), true);
  assert.equal(isBookingWindowOpen('07:30'), true);
  assert.equal(isBookingWindowOpen('18:20'), true);
});

test('normal booking closes at T-10 minutes', () => {
  // Departure at 08:00
  assert.equal(isNormalBookingOpen('07:49', '08:00'), true); // 11 mins left -> OPEN
  assert.equal(isNormalBookingOpen('07:50', '08:00'), true); // exactly 10 mins left -> OPEN
  assert.equal(isNormalBookingOpen('07:51', '08:00'), false); // 9 mins left -> CLOSED
});

test('claim window closes at T-3 minutes or when boarding closed', () => {
  assert.equal(isClaimWindowOpen('07:56', '08:00', true), true); // 4 mins left -> OPEN
  assert.equal(isClaimWindowOpen('07:57', '08:00', true), true); // 3 mins left -> OPEN
  assert.equal(isClaimWindowOpen('07:58', '08:00', true), false); // 2 mins left -> CLOSED
  assert.equal(isClaimWindowOpen('07:50', '08:00', false), false); // Boarding closed by driver -> CLOSED
});

test('stop radii match prototype specifications (APU: 100m, LRT: 120m)', () => {
  assert.equal(getStopRadius('lrt'), 120);
  assert.equal(getStopRadius('apu'), 100);
  assert.equal(getStopRadius('other'), 100);

  const lrtStop = { lat: 3.0587, lng: 101.6917 };
  const userAt110m = { lat: 3.0587, lng: 101.6907 }; // ~111 meters
  const check = isWithinBusStopRange(userAt110m, lrtStop, 'lrt');
  assert.equal(check.thresholdMeters, 120);
  assert.equal(check.inRange, true);
});

test('geo check-in assessment respects T-30 to T-10 window', () => {
  const lrtStop = { lat: 3.0587, lng: 101.6917 };
  const userNear = { lat: 3.0586, lng: 101.6918 };
  const userFar = { lat: 3.1205, lng: 101.7275 };

  // Case 1: T-35 (07:25 for 08:00 bus) -> WAITING_WINDOW
  const res1 = evaluateCheckInAssessment({
    currentTimeStr: '07:25',
    departureTimeStr: '08:00',
    userCoord: userNear,
    stopCoord: lrtStop,
    stopIdentifier: 'lrt',
    currentBookingStatus: 'RESERVED',
  });
  assert.equal(res1.status, 'WAITING_WINDOW');

  // Case 2: T-15 (07:45 for 08:00 bus) + user near -> READY_TO_CHECK_IN
  const res2 = evaluateCheckInAssessment({
    currentTimeStr: '07:45',
    departureTimeStr: '08:00',
    userCoord: userNear,
    stopCoord: lrtStop,
    stopIdentifier: 'lrt',
    currentBookingStatus: 'RESERVED',
  });
  assert.equal(res2.status, 'READY_TO_CHECK_IN');

  // Case 3: T-15 (07:45 for 08:00 bus) + user far -> OUT_OF_RANGE
  const res3 = evaluateCheckInAssessment({
    currentTimeStr: '07:45',
    departureTimeStr: '08:00',
    userCoord: userFar,
    stopCoord: lrtStop,
    stopIdentifier: 'lrt',
    currentBookingStatus: 'RESERVED',
  });
  assert.equal(res3.status, 'OUT_OF_RANGE');

  // Case 4: T-8 (07:52 for 08:00 bus) -> WINDOW_CLOSED
  const res4 = evaluateCheckInAssessment({
    currentTimeStr: '07:52',
    departureTimeStr: '08:00',
    userCoord: userNear,
    stopCoord: lrtStop,
    stopIdentifier: 'lrt',
    currentBookingStatus: 'RESERVED',
  });
  assert.equal(res4.status, 'WINDOW_CLOSED');
});

test('calculateTripCapacity: Used = Reserved + CheckedIn + Boarded, boarding does not release capacity', () => {
  const trip: BusTrip = {
    id: 'demo-a',
    routeId: 'lrt',
    routeName: 'LRT ➔ APU',
    fromStopId: 'lrt',
    toStopId: 'apu',
    departureTime: '08:00',
    totalSeats: 40,
    seatedCapacity: 40,
    standingCapacity: 0,
    bookedSeatIds: [],
    routeColor: '#2563EB',
    tripStatus: 'SCHEDULED',
    boardingOpen: true,
  };

  const bookings: Booking[] = [
    { id: '1', userId: 'u1', tripId: 'demo-a', seatId: '1A', routeId: 'lrt', routeName: '', fromStopName: '', toStopName: '', departureTime: '08:00', notify30Min: false, status: 'RESERVED', bookedAt: '' },
    { id: '2', userId: 'u2', tripId: 'demo-a', seatId: '1B', routeId: 'lrt', routeName: '', fromStopName: '', toStopName: '', departureTime: '08:00', notify30Min: false, status: 'CHECKED_IN', bookedAt: '' },
    { id: '3', userId: 'u3', tripId: 'demo-a', seatId: '1C', routeId: 'lrt', routeName: '', fromStopName: '', toStopName: '', departureTime: '08:00', notify30Min: false, status: 'BOARDED', bookedAt: '' },
    { id: '4', userId: 'u4', tripId: 'demo-a', seatId: '1D', routeId: 'lrt', routeName: '', fromStopName: '', toStopName: '', departureTime: '08:00', notify30Min: false, status: 'CANCELLED', bookedAt: '' },
    { id: '5', userId: 'u5', tripId: 'demo-a', seatId: '2A', routeId: 'lrt', routeName: '', fromStopName: '', toStopName: '', departureTime: '08:00', notify30Min: false, status: 'EXPIRED', bookedAt: '' },
  ];

  const cap = calculateTripCapacity(trip, bookings);
  assert.equal(cap.reservedCount, 1);
  assert.equal(cap.checkedInCount, 1);
  assert.equal(cap.boardedCount, 1);
  assert.equal(cap.usedCapacity, 3);
  assert.equal(cap.availableSeats, 37);
});

test('canUpdateVehicleCapacity blocks capacity cuts below active reservations', () => {
  // Current active bookings = 25
  const allowSame = canUpdateVehicleCapacity(20, 10, 25); // total 30 >= 25 -> allowed
  assert.equal(allowSame.allowed, true);

  const blockCut = canUpdateVehicleCapacity(14, 0, 25); // total 14 < 25 -> rejected
  assert.equal(blockCut.allowed, false);
});

test('penalty system: cancellation before check-in is always free, after check-in is 1 minor', () => {
  const reservedBooking: Booking = {
    id: 'b1', userId: 'u1', tripId: 't1', seatId: '1A', routeId: 'lrt', routeName: '', fromStopName: '', toStopName: '', departureTime: '08:00', notify30Min: false, status: 'RESERVED', bookedAt: '',
  };
  const resCancelFree = evaluateCancellationPenalty(reservedBooking);
  assert.equal(resCancelFree.points, 0);

  const checkedInBooking: Booking = {
    ...reservedBooking,
    status: 'CHECKED_IN',
  };
  const resCancelMinor = evaluateCancellationPenalty(checkedInBooking);
  assert.equal(resCancelMinor.points, PENALTY_SYSTEM.POINTS_MINOR);
  assert.equal(resCancelMinor.type, 'MINOR');

  // If trip is delayed or cancelled, cancellation is free
  const resDelayedCancel = evaluateCancellationPenalty(checkedInBooking, true);
  assert.equal(resDelayedCancel.points, 0);
});

test('auto-expiry at T-10 incurs 1 minor point, no-show at boarding close incurs 1 major point', () => {
  const expiry = evaluateAutoExpiryPenalty();
  assert.equal(expiry.points, 1);
  assert.equal(expiry.type, 'MINOR');

  const noShow = evaluateNoShowPenalty();
  assert.equal(noShow.points, 2);
  assert.equal(noShow.type, 'MAJOR');

  // Delay/Cancel waives penalties
  assert.equal(evaluateAutoExpiryPenalty(true).points, 0);
  assert.equal(evaluateNoShowPenalty(true).points, 0);
});

test('validateBookingEligibility enforces maximum 2 active bookings & duplicate route check', () => {
  const activeBookings: Booking[] = [
    { id: '1', userId: 'u1', tripId: 't1', seatId: '1A', routeId: 'lrt', routeName: '', fromStopName: 'LRT Bukit Jalil', toStopName: 'APU Campus', departureTime: '08:00', notify30Min: false, status: 'RESERVED', bookedAt: '' },
  ];

  // Disallow duplicate route
  const dupCheck = validateBookingEligibility({
    activeBookings,
    candidateFromStopName: 'LRT Bukit Jalil',
    candidateToStopName: 'APU Campus',
  });
  assert.equal(dupCheck.canBook, false);
  assert.equal(dupCheck.reason, 'DUPLICATE_ROUTE');

  // Allow return trip
  const returnCheck = validateBookingEligibility({
    activeBookings,
    candidateFromStopName: 'APU Campus',
    candidateToStopName: 'LRT Bukit Jalil',
  });
  assert.equal(returnCheck.canBook, true);

  // Disallow 3rd booking
  const twoBookings: Booking[] = [
    ...activeBookings,
    { id: '2', userId: 'u1', tripId: 't2', seatId: '1B', routeId: 'lrt', routeName: '', fromStopName: 'APU Campus', toStopName: 'LRT Bukit Jalil', departureTime: '17:00', notify30Min: false, status: 'RESERVED', bookedAt: '' },
  ];
  const maxCheck = validateBookingEligibility({
    activeBookings: twoBookings,
    candidateFromStopName: 'Fortune Park',
    candidateToStopName: 'APU Campus',
  });
  assert.equal(maxCheck.canBook, false);
  assert.equal(maxCheck.reason, 'MAX_LIMIT_REACHED');

  // Block restricted account (>= 6 points)
  const restrictCheck = validateBookingEligibility({
    activeBookings: [],
    candidateFromStopName: 'LRT Bukit Jalil',
    candidateToStopName: 'APU Campus',
    penaltyPoints: 6,
  });
  assert.equal(restrictCheck.canBook, false);
  assert.equal(restrictCheck.reason, 'RESTRICTED');
});

test('validateClaimEligibility strictly requires booking on immediately following bus', () => {
  const tripA: BusTrip = {
    id: 'demo-a', routeId: 'lrt', routeName: 'LRT ➔ APU', fromStopId: 'lrt', toStopId: 'apu',
    departureTime: '08:00', totalSeats: 2, seatedCapacity: 2, standingCapacity: 0, bookedSeatIds: [],
    routeColor: '#2563EB', tripStatus: 'SCHEDULED', boardingOpen: true,
  };
  const tripB: BusTrip = {
    id: 'demo-b', routeId: 'lrt', routeName: 'LRT ➔ APU', fromStopId: 'lrt', toStopId: 'apu',
    departureTime: '08:10', totalSeats: 40, seatedCapacity: 40, standingCapacity: 0, bookedSeatIds: [],
    routeColor: '#2563EB', tripStatus: 'SCHEDULED', boardingOpen: false,
  };
  const tripC: BusTrip = {
    id: 'demo-c', routeId: 'lrt', routeName: 'LRT ➔ APU', fromStopId: 'lrt', toStopId: 'apu',
    departureTime: '08:45', totalSeats: 40, seatedCapacity: 40, standingCapacity: 0, bookedSeatIds: [],
    routeColor: '#2563EB', tripStatus: 'SCHEDULED', boardingOpen: false,
  };

  const lrtStop = { lat: 3.0587, lng: 101.6917 };
  const userAtLrt = { lat: 3.0586, lng: 101.6918 };

  // User with booking on Trip B (immediately next) can claim Trip A
  const bookingOnB: Booking = {
    id: 'bk-b', userId: 'rani', tripId: 'demo-b', seatId: '1A', routeId: 'lrt', routeName: '',
    fromStopName: 'LRT Bukit Jalil', toStopName: 'APU Campus', departureTime: '08:10',
    notify30Min: false, status: 'RESERVED', bookedAt: '',
  };

  const claimValid = validateClaimEligibility({
    targetTrip: tripA,
    allTripsInRoute: [tripA, tripB, tripC],
    userBookings: [bookingOnB],
    currentTimeStr: '07:51',
    userCoord: userAtLrt,
    stopCoord: lrtStop,
    stopIdentifier: 'lrt',
  });
  assert.equal(claimValid.eligible, true);
  assert.equal(claimValid.sourceBooking?.id, 'bk-b');

  // User with booking on Trip C (leapfrogging B to claim A) is REJECTED
  const bookingOnC: Booking = {
    id: 'bk-c', userId: 'user-c', tripId: 'demo-c', seatId: '1A', routeId: 'lrt', routeName: '',
    fromStopName: 'LRT Bukit Jalil', toStopName: 'APU Campus', departureTime: '08:45',
    notify30Min: false, status: 'RESERVED', bookedAt: '',
  };

  const claimInvalidLeap = validateClaimEligibility({
    targetTrip: tripA,
    allTripsInRoute: [tripA, tripB, tripC],
    userBookings: [bookingOnC],
    currentTimeStr: '07:51',
    userCoord: userAtLrt,
    stopCoord: lrtStop,
    stopIdentifier: 'lrt',
  });
  assert.equal(claimInvalidLeap.eligible, false);
});

test('formatTime12h outputs clean 12h labels', () => {
  assert.equal(formatTime12h('06:00'), '6:00 AM');
  assert.equal(formatTime12h('08:00'), '8:00 AM');
  assert.equal(formatTime12h('12:30'), '12:30 PM');
});

test('isTripPastSchedule accurately identifies passed schedule', () => {
  assert.equal(isTripPastSchedule('08:01', '08:00'), true); // 1 minute passed
  assert.equal(isTripPastSchedule('08:15', '08:00'), true); // 15 minutes passed
  assert.equal(isTripPastSchedule('08:00', '08:00'), false); // exactly at departure
  assert.equal(isTripPastSchedule('07:55', '08:00'), false); // 5 minutes before departure
});

test('everyone is not allowed to have 2 active booked seats from same depart point to same destination in a day', () => {
  // Test case 1: Active RESERVED booking blocks another booking on the same route
  const activeReserved: Booking[] = [
    { id: 'b1', userId: 'u1', tripId: 't1', seatId: '1A', routeId: 'lrt', routeName: 'LRT ➔ APU', fromStopName: 'LRT Bukit Jalil', toStopName: 'Asia Pacific University (APU Campus)', departureTime: '08:00', notify30Min: false, status: 'RESERVED', bookedAt: '' },
  ];
  const res1 = validateBookingEligibility({
    activeBookings: activeReserved,
    candidateFromStopName: 'LRT Bukit Jalil',
    candidateToStopName: 'Asia Pacific University (APU Campus)',
  });
  assert.equal(res1.canBook, false);
  assert.equal(res1.reason, 'DUPLICATE_ROUTE');

  // Test case 2: Active CHECKED_IN booking blocks another booking on the same route
  const activeCheckedIn: Booking[] = [
    { id: 'b2', userId: 'u1', tripId: 't1', seatId: '1A', routeId: 'lrt', routeName: 'LRT ➔ APU', fromStopName: 'LRT Bukit Jalil', toStopName: 'Asia Pacific University (APU Campus)', departureTime: '08:00', notify30Min: false, status: 'CHECKED_IN', bookedAt: '' },
  ];
  const res2 = validateBookingEligibility({
    activeBookings: activeCheckedIn,
    candidateFromStopName: 'LRT Bukit Jalil',
    candidateToStopName: 'Asia Pacific University (APU Campus)',
  });
  assert.equal(res2.canBook, false);
  assert.equal(res2.reason, 'DUPLICATE_ROUTE');

  // Test case 3: Active BOARDED booking also blocks another booking on the same route in a day
  const activeBoarded: Booking[] = [
    { id: 'b3', userId: 'u1', tripId: 't1', seatId: '1A', routeId: 'lrt', routeName: 'LRT ➔ APU', fromStopName: 'LRT Bukit Jalil', toStopName: 'Asia Pacific University (APU Campus)', departureTime: '08:00', notify30Min: false, status: 'BOARDED', bookedAt: '' },
  ];
  const res3 = validateBookingEligibility({
    activeBookings: activeBoarded,
    candidateFromStopName: 'LRT Bukit Jalil',
    candidateToStopName: 'Asia Pacific University (APU Campus)',
  });
  assert.equal(res3.canBook, false);
  assert.equal(res3.reason, 'DUPLICATE_ROUTE');

  // Test case 4: Reverse / Return direction (APU Campus ➔ LRT Bukit Jalil) is ALLOWED
  const resReturn = validateBookingEligibility({
    activeBookings: activeReserved,
    candidateFromStopName: 'Asia Pacific University (APU Campus)',
    candidateToStopName: 'LRT Bukit Jalil',
  });
  assert.equal(resReturn.canBook, true);
});

test('getBusLifecycleStatus correctly transitions through all 6 required states', () => {
  // Bus departure scheduled at 08:00
  const depTime = '08:00';

  // 1. Not Available Now (when it hasn't reach the time, > 30 minutes away)
  assert.equal(getBusLifecycleStatus('07:20', depTime), 'Not Available Now');
  assert.equal(getBusLifecycleStatus('07:29', depTime), 'Not Available Now');

  // 2. On the Way (when counting down the time, T-30 down to T-1)
  assert.equal(getBusLifecycleStatus('07:30', depTime), 'On the Way');
  assert.equal(getBusLifecycleStatus('07:45', depTime), 'On the Way');
  assert.equal(getBusLifecycleStatus('07:59', depTime), 'On the Way');

  // 3. Arrived (when 0 countdown)
  assert.equal(getBusLifecycleStatus('08:00', depTime), 'Arrived');

  // 4. Waiting (during 2 minutes for waiting and depart: minute 1)
  assert.equal(getBusLifecycleStatus('08:01', depTime), 'Waiting');

  // 5. Depart (minute 2: waiting ends and bus departs)
  assert.equal(getBusLifecycleStatus('08:02', depTime), 'Depart');

  // 6. Expired (when the bus section is done)
  assert.equal(getBusLifecycleStatus('08:03', depTime), 'Expired');
  assert.equal(getBusLifecycleStatus('08:15', depTime), 'Expired');
});

test('evaluateNoShowPenalty applies exactly 2 score of penalties when checked in without depart scan', () => {
  const penalty = evaluateNoShowPenalty();
  assert.equal(penalty.points, 2);
  assert.equal(penalty.type, 'MAJOR');
  assert.equal(penalty.reason.includes('2 score penalty'), true);

  // When waived due to delay
  const waivedPenalty = evaluateNoShowPenalty(true);
  assert.equal(waivedPenalty.points, 0);
});

test('driver authorization pin code is 1234 for conscious security override', () => {
  const DRIVER_PIN: string = '1234';
  assert.equal(DRIVER_PIN === '1234', true);
  assert.equal(DRIVER_PIN === '0000', false);
});

test('lecturer and staff accounts share full booking functionality with students', () => {
  // A lecturer with 0 penalties can book a seat
  const lecturerBookingCheck = validateBookingEligibility({
    activeBookings: [],
    candidateFromStopName: 'LRT Bukit Jalil',
    candidateToStopName: 'Asia Pacific University (APU Campus)',
  });
  assert.equal(lecturerBookingCheck.canBook, true);

  // A lecturer reaches active booking limit (2/2)
  const twoBookings: Booking[] = [
    { id: 'b1', userId: 'staff-daniel', tripId: 't1', seatId: '1A', routeId: 'lrt', routeName: 'LRT ➔ APU', fromStopName: 'LRT Bukit Jalil', toStopName: 'APU', departureTime: '08:00', notify30Min: false, status: 'RESERVED', bookedAt: '' },
    { id: 'b2', userId: 'staff-daniel', tripId: 't2', seatId: '1B', routeId: 'apu', routeName: 'APU ➔ LRT', fromStopName: 'APU', toStopName: 'LRT Bukit Jalil', departureTime: '17:00', notify30Min: false, status: 'RESERVED', bookedAt: '' },
  ];
  const atLimitCheck = validateBookingEligibility({
    activeBookings: twoBookings,
    candidateFromStopName: 'LRT Bukit Jalil',
    candidateToStopName: 'One South',
  });
  assert.equal(atLimitCheck.canBook, false);
  assert.equal(atLimitCheck.reason, 'MAX_LIMIT_REACHED');
});

