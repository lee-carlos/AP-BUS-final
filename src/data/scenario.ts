import type { Booking } from '../types/bus.ts';

/**
 * DEMO SCENARIO
 * -------------
 * One persona per rule case. Day 1 starts at 07:45 on Friday 13 Nov 2026 with the bookings below.
 * When the clock runs, the engine applies the real rules (expiry at T-10, departure, penalties)
 * and plays the scripted actions in SCENARIO_SCRIPT at their time. Every decision is written to
 * the Scenario log. Nothing here bypasses a rule: scripted actions call the same engine
 * functions as the buttons in the app.
 */

export const SCENARIO_START_DAY = '2026-11-13'; // Friday
export const SCENARIO_START_TIME = '07:45';

const LRT = 'LRT Bukit Jalil';
const APU = 'Asia Pacific University (APU Campus)';
const ROUTE = 'LRT Bukit Jalil ➔ APU';

type SeedBooking = Pick<Booking, 'id' | 'userId' | 'tripId' | 'seatId' | 'departureTime' | 'status' | 'bookedAt'> &
  Partial<Booking>;

const seed = (b: SeedBooking): Booking => ({
  routeId: 'lrt',
  routeName: ROUTE,
  fromStopName: LRT,
  toStopName: APU,
  notify30Min: true,
  ...b,
});

/** Bookings that already exist at 07:45 on day 1. `ekaToken` is Eka's already-issued QR token. */
export function createScenarioBookings(ekaToken: string): Booking[] {
  return [
    // 08:00 shuttle (full)
    seed({ id: 'BK-NADIA1', userId: 'user-nadia', tripId: 'demo-a-0800', seatId: '1A', departureTime: '08:00', status: 'RESERVED', bookedAt: '07:05' }),
    seed({ id: 'BK-BUDI01', userId: 'user-budi', tripId: 'demo-a-0800', seatId: '1B', departureTime: '08:00', status: 'RESERVED', bookedAt: '07:08' }),
    seed({ id: 'BK-EKA001', userId: 'user-eka', tripId: 'demo-a-0800', seatId: '1C', departureTime: '08:00', status: 'CHECKED_IN', bookedAt: '07:10', checkedInAt: '07:40', qrCodeToken: ekaToken }),
    // 08:10 shuttle (the schedule immediately after 08:00)
    seed({ id: 'BK-CITRA1', userId: 'user-citra', tripId: 'demo-b-0810', seatId: '1A', departureTime: '08:10', status: 'RESERVED', bookedAt: '07:12' }),
    seed({ id: 'BK-FAJAR1', userId: 'user-fajar', tripId: 'demo-b-0810', seatId: '1B', departureTime: '08:10', status: 'RESERVED', bookedAt: '07:15' }),
    seed({ id: 'BK-GITA01', userId: 'user-gita', tripId: 'demo-b-0810', seatId: '1C', departureTime: '08:10', status: 'RESERVED', bookedAt: '07:18' }),
    seed({ id: 'BK-HANA01', userId: 'user-hana', tripId: 'demo-b-0810', seatId: '1D', departureTime: '08:10', status: 'RESERVED', bookedAt: '07:20' }),
    // 08:20 shuttle (two schedules after 08:00)
    seed({ id: 'BK-DIMAS1', userId: 'user-dimas', tripId: 'lrt-0820', seatId: '1A', departureTime: '08:20', status: 'RESERVED', bookedAt: '07:22' }),
  ];
}

/** Seat Alerts at 07:45: Citra and Dimas both want a seat on the full 08:00 shuttle. */
export const SCENARIO_SEAT_ALERTS: Record<string, string[]> = {
  'demo-a-0800': ['user-citra', 'user-dimas'],
};

export type ScenarioAction =
  | { type: 'checkIn'; userId: string; tripId: string }
  | { type: 'book'; userId: string; tripId: string }
  | { type: 'claim'; userId: string; tripId: string }
  | { type: 'move'; userId: string; near: boolean }
  /** The driver of `tripId` scans the pass that `userId` holds for `passTripId` (defaults to `tripId`). */
  | { type: 'scan'; tripId: string; userId: string; passTripId?: string; reuse?: boolean } // reuse: show an already-used pass on purpose
  | { type: 'manualBoard'; tripId: string; userId: string; reason: string };

export interface ScenarioStep {
  id: string;
  dayIndex: number; // 1 = Fri 13 Nov, 2 = Mon 16 Nov, 3 = Tue 17 Nov
  time: string; // HH:mm. Runs right after the automatic deadlines of that minute.
  intro?: string; // Optional context line written to the log before the action
  introActor?: string; // userId the intro line is about
  action: ScenarioAction;
}

export const SCENARIO_DRIVER_NAME = 'Pak Rahman';

export const SCENARIO_SCRIPT: ScenarioStep[] = [
  // ---- Day 1 · Fri 13 Nov ----
  { id: 'd1-0746-nadia-checkin', dayIndex: 1, time: '07:46', action: { type: 'checkIn', userId: 'user-nadia', tripId: 'demo-a-0800' } },
  { id: 'd1-0747-gita-far', dayIndex: 1, time: '07:47', action: { type: 'checkIn', userId: 'user-gita', tripId: 'demo-b-0810' } },
  { id: 'd1-0748-hana-dup', dayIndex: 1, time: '07:48', action: { type: 'book', userId: 'user-hana', tripId: 'lrt-0845' } },
  { id: 'd1-0749-hana-second', dayIndex: 1, time: '07:49', action: { type: 'book', userId: 'user-hana', tripId: 'apu-lrt-1730' } },
  { id: 'd1-0749-hana-third', dayIndex: 1, time: '07:49', action: { type: 'book', userId: 'user-hana', tripId: 'fpark-1000' } },
  // 07:50 is T-10 of the 08:00 shuttle: Budi's booking expires automatically and his seat is released.
  { id: 'd1-0750-dimas-claim', dayIndex: 1, time: '07:50', action: { type: 'claim', userId: 'user-dimas', tripId: 'demo-a-0800' } },
  { id: 'd1-0751-citra-claim', dayIndex: 1, time: '07:51', action: { type: 'claim', userId: 'user-citra', tripId: 'demo-a-0800' } },
  { id: 'd1-0752-hana-checkin', dayIndex: 1, time: '07:52', action: { type: 'checkIn', userId: 'user-hana', tripId: 'demo-b-0810' } },
  { id: 'd1-0753-dimas-checkin', dayIndex: 1, time: '07:53', action: { type: 'checkIn', userId: 'user-dimas', tripId: 'lrt-0820' } },
  { id: 'd1-0755-gita-move', dayIndex: 1, time: '07:55', action: { type: 'move', userId: 'user-gita', near: true } },
  { id: 'd1-0756-gita-checkin', dayIndex: 1, time: '07:56', action: { type: 'checkIn', userId: 'user-gita', tripId: 'demo-b-0810' } },
  // 08:00: the shuttle arrives and boarding opens. It is also T-10 of 08:10, so Fajar's booking expires (6 points).
  { id: 'd1-0800-scan-nadia', dayIndex: 1, time: '08:00', action: { type: 'scan', tripId: 'demo-a-0800', userId: 'user-nadia' } },
  { id: 'd1-0800-scan-nadia-again', dayIndex: 1, time: '08:00', intro: 'The same QR pass is shown a second time.', introActor: 'user-nadia', action: { type: 'scan', tripId: 'demo-a-0800', userId: 'user-nadia', reuse: true } },
  { id: 'd1-0801-scan-citra', dayIndex: 1, time: '08:01', action: { type: 'scan', tripId: 'demo-a-0800', userId: 'user-citra' } },
  { id: 'd1-0801-scan-gita-wrong', dayIndex: 1, time: '08:01', intro: 'Gita shows her 08:10 pass at the 08:00 shuttle.', introActor: 'user-gita', action: { type: 'scan', tripId: 'demo-a-0800', userId: 'user-gita', passTripId: 'demo-b-0810' } },
  // 08:02: the 08:00 shuttle departs. Eka checked in but never scanned: No-show.
  { id: 'd1-0810-scan-gita', dayIndex: 1, time: '08:10', action: { type: 'scan', tripId: 'demo-b-0810', userId: 'user-gita' } },
  { id: 'd1-0811-hana-manual', dayIndex: 1, time: '08:11', intro: "Hana's phone battery is dead, so she cannot show her QR pass.", introActor: 'user-hana', action: { type: 'manualBoard', tripId: 'demo-b-0810', userId: 'user-hana', reason: 'Phone battery dead, identity checked against APCard' } },
  { id: 'd1-0820-scan-dimas', dayIndex: 1, time: '08:20', action: { type: 'scan', tripId: 'lrt-0820', userId: 'user-dimas' } },

  // ---- Day 2 · Mon 16 Nov: Fajar's one restricted service day ----
  { id: 'd2-0746-fajar-blocked', dayIndex: 2, time: '07:46', action: { type: 'book', userId: 'user-fajar', tripId: 'demo-b-0810' } },

  // ---- Day 3 · Tue 17 Nov: the restriction is over ----
  { id: 'd3-0746-fajar-ok', dayIndex: 3, time: '07:46', action: { type: 'book', userId: 'user-fajar', tripId: 'demo-b-0810' } },
];
