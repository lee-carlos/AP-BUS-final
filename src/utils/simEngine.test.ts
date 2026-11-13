import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceTo,
  book,
  cancel,
  checkIn,
  claim,
  createInitialState,
  findClaimOffer,
  manualBoard,
  scanPass,
  setAutoplay,
  setTripStatus,
  setUserLocation,
  startNextServiceDay,
} from './simEngine.ts';
import type { SimState } from './simEngine.ts';
import { computePenaltyState, generateQrToken, nextServiceDay } from './bookingRules.ts';
import type { PenaltyRecord } from '../types/bus.ts';

const user = (s: SimState, id: string) => s.users.find((u) => u.id === id)!;
const bookingOf = (s: SimState, userId: string, tripId: string) =>
  s.bookings.filter((b) => b.userId === userId && b.tripId === tripId).at(-1)!;
const trip = (s: SimState, id: string) => s.trips.find((t) => t.id === id)!;
const rec = (day: string, type: 'MINOR' | 'MAJOR', waived = false): PenaltyRecord => ({
  id: `${day}-${type}-${Math.random()}`, userId: 'u', tripId: 't', type, points: type === 'MINOR' ? 1 : 2, reason: '', day, timestamp: '08:00', waived,
});

/* ---------------------------- penalty period ------------------------------ */

test('6 points restricts ONLY the next service day, never permanently', () => {
  const records = [rec('2026-11-10', 'MAJOR'), rec('2026-11-11', 'MAJOR'), rec('2026-11-13', 'MAJOR')]; // 6 pts on Fri
  const fri = computePenaltyState(records, '2026-11-13');
  assert.equal(fri.points, 6);
  assert.equal(fri.restrictedToday, false); // the day it happens is not restricted
  assert.equal(fri.upcomingRestriction, '2026-11-16'); // Friday -> Monday
  assert.equal(computePenaltyState(records, '2026-11-16').restrictedToday, true);
  assert.equal(computePenaltyState(records, '2026-11-17').restrictedToday, false); // back to normal
  assert.equal(computePenaltyState(records, '2026-11-17').points, 6); // points stay until the reset
});

test('points reset 90 days after the first violation of the period', () => {
  const records = [rec('2026-08-01', 'MAJOR'), rec('2026-08-20', 'MAJOR')];
  assert.equal(computePenaltyState(records, '2026-10-29').points, 4); // day 89
  assert.equal(computePenaltyState(records, '2026-10-29').resetsOn, '2026-10-30');
  assert.equal(computePenaltyState(records, '2026-10-30').points, 0); // day 90
  // a violation after the reset starts a new period from zero
  const again = computePenaltyState([...records, rec('2026-11-02', 'MINOR')], '2026-11-02');
  assert.equal(again.points, 1);
  assert.equal(again.periodStart, '2026-11-02');
});

test('reversed (waived) penalties do not count, and next service day skips the weekend', () => {
  const records = [rec('2026-11-10', 'MAJOR'), rec('2026-11-11', 'MAJOR'), rec('2026-11-12', 'MAJOR', true)];
  const st = computePenaltyState(records, '2026-11-12');
  assert.equal(st.points, 4);
  assert.equal(st.upcomingRestriction, null);
  assert.equal(nextServiceDay('2026-11-13'), '2026-11-16');
  assert.equal(nextServiceDay('2026-11-16'), '2026-11-17');
});

test('QR tokens are random and do not contain the TP number, trip or seat', () => {
  const tokens = new Set(Array.from({ length: 200 }, () => generateQrToken()));
  assert.equal(tokens.size, 200);
  for (const t of tokens) assert.match(t, /^APB-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

/* --------------------------- the scripted scenario ------------------------ */

test('scenario day 1: every persona shows its case when the clock runs to 08:25', () => {
  let s = createInitialState();
  assert.equal(s.time, '07:45');
  assert.equal(trip(s, 'demo-a-0800').bookedSeatIds.length, 40); // 08:00 is full
  assert.equal(user(s, 'user-fajar').penaltyPoints, 5);

  s = advanceTo(s, '07:49');
  // Case 1: Nadia checked in, QR issued only now
  assert.equal(bookingOf(s, 'user-nadia', 'demo-a-0800').status, 'CHECKED_IN');
  assert.ok(bookingOf(s, 'user-nadia', 'demo-a-0800').qrCodeToken);
  // Case 7: Gita is far away -> still RESERVED, no QR
  assert.equal(bookingOf(s, 'user-gita', 'demo-b-0810').status, 'RESERVED');
  assert.equal(bookingOf(s, 'user-gita', 'demo-b-0810').qrCodeToken, undefined);
  // Case 8: Hana: duplicate route rejected, second route accepted, third rejected
  const hana = s.bookings.filter((b) => b.userId === 'user-hana');
  assert.deepEqual(hana.map((b) => b.tripId).sort(), ['apu-lrt-1730', 'demo-b-0810']);

  s = advanceTo(s, '07:50');
  // Case 2: Budi expired at T-10, +1 minor, seat released
  assert.equal(bookingOf(s, 'user-budi', 'demo-a-0800').status, 'EXPIRED');
  assert.equal(user(s, 'user-budi').penaltyPoints, 1);
  // Case 4: Dimas (two schedules later) was rejected, his booking is untouched
  assert.equal(bookingOf(s, 'user-dimas', 'lrt-0820').status, 'RESERVED');
  assert.equal(s.bookings.some((b) => b.userId === 'user-dimas' && b.tripId === 'demo-a-0800'), false);
  assert.equal(trip(s, 'demo-a-0800').bookedSeatIds.length, 39); // seat still free after the rejected claim

  s = advanceTo(s, '07:51');
  // Case 3: Citra (immediately next schedule) claimed the seat
  const citraNew = bookingOf(s, 'user-citra', 'demo-a-0800');
  assert.equal(citraNew.status, 'CHECKED_IN');
  assert.equal(citraNew.seatId, '1B');
  assert.equal(bookingOf(s, 'user-citra', 'demo-b-0810').status, 'TRANSFERRED');
  assert.equal(trip(s, 'demo-a-0800').bookedSeatIds.length, 40);
  assert.equal(trip(s, 'demo-b-0810').bookedSeatIds.includes('1A'), false); // her old seat was released

  s = advanceTo(s, '08:01');
  // Case 6: Fajar missed check-in for 08:10 -> 6 points -> restricted next service day only
  assert.equal(user(s, 'user-fajar').penaltyPoints, 6);
  assert.equal(user(s, 'user-fajar').isRestricted, false);
  assert.equal(user(s, 'user-fajar').restrictedOn, '2026-11-16');
  // Case 9: Nadia boarded with one scan, the second scan was rejected, Gita's 08:10 pass was rejected on 08:00
  assert.equal(bookingOf(s, 'user-nadia', 'demo-a-0800').status, 'BOARDED');
  assert.equal(bookingOf(s, 'user-citra', 'demo-a-0800').status, 'BOARDED');
  assert.equal(bookingOf(s, 'user-gita', 'demo-b-0810').status, 'CHECKED_IN');
  assert.ok(s.log.some((l) => l.kind === 'reject' && /already used/.test(l.text)));
  assert.ok(s.log.some((l) => l.kind === 'reject' && /Wrong shuttle/.test(l.text)));

  s = advanceTo(s, '08:02');
  // Case 5: Eka checked in but never scanned -> No-show, +2
  assert.equal(bookingOf(s, 'user-eka', 'demo-a-0800').status, 'NO_SHOW');
  assert.equal(user(s, 'user-eka').penaltyPoints, 2);
  assert.equal(user(s, 'user-nadia').penaltyPoints, 0);

  s = advanceTo(s, '08:25');
  assert.equal(bookingOf(s, 'user-gita', 'demo-b-0810').status, 'BOARDED');
  const hanaBoarding = bookingOf(s, 'user-hana', 'demo-b-0810');
  assert.equal(hanaBoarding.status, 'BOARDED');
  assert.match(hanaBoarding.manualBoardingReason || '', /battery/);
  assert.equal(bookingOf(s, 'user-dimas', 'lrt-0820').status, 'BOARDED');
  // nobody except the four violators has points
  const pts = Object.fromEntries(s.users.filter((u) => u.role === 'Student').map((u) => [u.id.replace('user-', ''), u.penaltyPoints]));
  assert.deepEqual(pts, { nadia: 0, budi: 1, citra: 0, dimas: 0, eka: 2, fajar: 6, gita: 0, hana: 0 });
});

test('jumping the clock gives the same result as running it minute by minute', () => {
  const a = advanceTo(createInitialState(), '08:25');
  let b = createInitialState();
  for (let m = 7 * 60 + 46; m <= 8 * 60 + 25; m++) {
    b = advanceTo(b, `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  }
  const summary = (s: SimState) => s.bookings.map((x) => `${x.userId}:${x.tripId}:${x.status}`).sort();
  assert.deepEqual(summary(a), summary(b));
  assert.deepEqual(a.users.map((u) => u.penaltyPoints), b.users.map((u) => u.penaltyPoints));
});

test('next service day: Fajar is blocked on Monday and can book again on Tuesday', () => {
  let s = advanceTo(createInitialState(), '08:25');
  s = startNextServiceDay(s);
  assert.equal(s.day, '2026-11-16');
  assert.equal(s.bookings.length, 0);
  assert.equal(user(s, 'user-fajar').isRestricted, true);
  assert.equal(user(s, 'user-budi').isRestricted, false);
  const blocked = book(s, 'user-fajar', 'demo-b-0810');
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /restricted today/);
  // other students are unaffected
  assert.equal(book(s, 'user-nadia', 'demo-b-0810').ok, true);

  s = startNextServiceDay(s);
  assert.equal(s.day, '2026-11-17');
  assert.equal(user(s, 'user-fajar').isRestricted, false);
  assert.equal(user(s, 'user-fajar').penaltyPoints, 6);
  assert.equal(book(s, 'user-fajar', 'demo-b-0810').ok, true);
});

/* ------------------------------ manual actions ---------------------------- */

const manual = () => setAutoplay(createInitialState(), false);

test('QR appears only after check-in, and check-in needs the right time and place', () => {
  let s = manual();
  const nadia = bookingOf(s, 'user-nadia', 'demo-a-0800');
  assert.equal(nadia.qrCodeToken, undefined);
  // too far
  const far = checkIn(setUserLocation(s, 'user-nadia', false), 'user-nadia', nadia.id);
  assert.equal(far.ok, false);
  // in range, inside the window
  const ok = checkIn(s, 'user-nadia', nadia.id);
  assert.equal(ok.ok, true);
  assert.ok(ok.booking?.qrCodeToken);
  // Dimas (08:20) at 07:45 is before T-30
  const early = checkIn(s, 'user-dimas', bookingOf(s, 'user-dimas', 'lrt-0820').id);
  assert.equal(early.ok, false);
  s = ok.state;
  assert.equal(checkIn(s, 'user-nadia', nadia.id).ok, false); // already checked in
});

test('scanner accepts only the QR token: TP number and booking reference never board anyone', () => {
  let s = manual();
  s = advanceTo(s, '08:00'); // shuttle arrived, boarding open
  const eka = bookingOf(s, 'user-eka', 'demo-a-0800');
  assert.equal(scanPass(s, 'demo-a-0800', 'TP071105').result.success, false);
  assert.equal(scanPass(s, 'demo-a-0800', eka.id).result.success, false);
  assert.equal(scanPass(s, 'demo-a-0800', 'APB-AAAA-BBBB-CCCC').result.success, false);

  const good = scanPass(s, 'demo-a-0800', ` ${eka.qrCodeToken!.toLowerCase()} `);
  assert.equal(good.result.success, true);
  assert.deepEqual(
    { name: good.result.passenger?.name, tp: good.result.passenger?.studentId, ref: good.result.passenger?.bookingId, seat: good.result.passenger?.seatId },
    { name: 'Eka Putri', tp: 'TP071105', ref: eka.id, seat: '1C' }
  );
  // single use
  const again = scanPass(good.state, 'demo-a-0800', eka.qrCodeToken!);
  assert.equal(again.result.success, false);
  assert.match(again.result.message, /already used/);
  assert.equal(again.result.passenger?.studentId, 'TP071105'); // identity still shown to the driver
});

test('scan is rejected before boarding opens and for a pass that was transferred by a Claim', () => {
  let s = manual();
  const eka = bookingOf(s, 'user-eka', 'demo-a-0800');
  assert.match(scanPass(s, 'demo-a-0800', eka.qrCodeToken!).result.message, /not open/);

  // Citra checks in on 08:10, Budi expires, Citra claims 08:00: her 08:10 pass must die
  s = checkIn(s, 'user-citra', bookingOf(s, 'user-citra', 'demo-b-0810').id).state;
  const oldToken = bookingOf(s, 'user-citra', 'demo-b-0810').qrCodeToken!;
  s = advanceTo(s, '07:50');
  const claimed = claim(s, 'user-citra', 'demo-a-0800');
  assert.equal(claimed.ok, true);
  s = advanceTo(claimed.state, '08:10');
  assert.match(scanPass(s, 'demo-b-0810', oldToken).result.message, /revoked/);
  assert.notEqual(claimed.booking?.qrCodeToken, oldToken);
});

test('claim: closed after T-3, and a failed claim keeps the original booking', () => {
  let s = manual();
  s = advanceTo(s, '07:58'); // T-2 for 08:00, Budi's seat is free since 07:50
  const late = claim(s, 'user-citra', 'demo-a-0800');
  assert.equal(late.ok, false);
  assert.match(late.message, /closed/);
  assert.equal(bookingOf(late.state, 'user-citra', 'demo-b-0810').status, 'RESERVED');
  // at T-3 it still works
  const t3 = claim(advanceTo(manual(), '07:57'), 'user-citra', 'demo-a-0800');
  assert.equal(t3.ok, true);
});

test('seat alert offer is shown only to the holder of the immediately next schedule', () => {
  let s = manual();
  assert.equal(findClaimOffer(s, 'user-citra'), null); // bus still full
  s = advanceTo(s, '07:50');
  assert.equal(findClaimOffer(s, 'user-citra')?.trip.id, 'demo-a-0800');
  assert.equal(findClaimOffer(s, 'user-dimas'), null); // subscribed, but holds 08:20
  assert.equal(findClaimOffer(s, 'user-citra', ['demo-a-0800']), null); // dismissed
});

test('cancel: free before check-in, 1 minor after check-in, seat is released', () => {
  let s = manual();
  const hana = bookingOf(s, 'user-hana', 'demo-b-0810');
  const free = cancel(s, 'user-hana', hana.id);
  assert.equal(user(free.state, 'user-hana').penaltyPoints, 0);
  assert.equal(trip(free.state, 'demo-b-0810').bookedSeatIds.includes('1D'), false);

  const eka = bookingOf(s, 'user-eka', 'demo-a-0800'); // already checked in
  const late = cancel(s, 'user-eka', eka.id);
  assert.equal(user(late.state, 'user-eka').penaltyPoints, 1);
  assert.equal(bookingOf(late.state, 'user-eka', 'demo-a-0800').status, 'CANCELLED');
});

test('booking: closes at T-10, full shuttle rejected, seat cannot be double booked', () => {
  let s = manual();
  assert.equal(book(s, 'user-budi', 'fpark-0830').ok, true);
  assert.match(book(s, 'user-eka', 'demo-b-0810').message, /one active booking per route/i);
  s = cancel(s, 'user-hana', bookingOf(s, 'user-hana', 'demo-b-0810').id).state;
  assert.match(book(s, 'user-hana', 'demo-a-0800').message, /full/);
  assert.match(book(s, 'user-hana', 'demo-b-0810', '1B').message, /just taken/);
  s = advanceTo(s, '08:00');
  assert.match(book(s, 'user-hana', 'demo-b-0810').message, /closes 10 minutes/);
});

test('manual boarding needs a reason, is logged, and reverses a no-show penalty', () => {
  let s = manual();
  s = advanceTo(s, '08:03'); // Eka is now NO_SHOW with 2 points
  assert.equal(user(s, 'user-eka').penaltyPoints, 2);
  const eka = bookingOf(s, 'user-eka', 'demo-a-0800');
  assert.equal(manualBoard(s, eka.id, '  ', 'Pak Rahman').ok, false);
  const done = manualBoard(s, eka.id, 'Scanner failed, passenger was on board', 'Pak Rahman');
  assert.equal(done.ok, true);
  assert.equal(user(done.state, 'user-eka').penaltyPoints, 0);
  assert.ok(done.state.log.some((l) => /Manual boarding/.test(l.text) && /Scanner failed/.test(l.text)));
  assert.ok(done.state.log.some((l) => /reversed/.test(l.text)));
});

test('driver cannot depart before the scheduled time', () => {
  const s = manual();
  const early = setTripStatus(s, 'demo-a-0800', 'DEPARTED', 'Pak Rahman');
  assert.equal(early.ok, false);
  assert.equal(user(early.state, 'user-eka').penaltyPoints, 0);
  const onTime = setTripStatus(advanceTo(s, '08:00'), 'demo-a-0800', 'DEPARTED', 'Pak Rahman');
  assert.equal(onTime.ok, true);
  assert.equal(user(onTime.state, 'user-eka').penaltyPoints, 2);
});
