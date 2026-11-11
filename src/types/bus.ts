export interface LocationCoord {
  lat: number;
  lng: number;
}

export interface BusStop {
  id: string;
  name: string;
  shortCode: string;
  coords: LocationCoord;
  address: string;
  isCampus?: boolean;
  fridayOnly?: boolean;
  radiusMeters?: number; // e.g. 100m for APU, 120m for LRT Bukit Jalil
}

export type TripStatus =
  | 'WAITING'     // Bus waiting at station bay / scheduled
  | 'ARRIVED'     // Bus has arrived at pickup stop
  | 'BOARDING'    // Boarding in progress
  | 'DEPARTED'    // Bus has departed pickup bay (departed without scan = 2 score penalty)
  | 'ON_THE_WAY'  // Bus en route / on the way to destination
  | 'SCHEDULED'   // Timetabled schedule
  | 'DELAYED'     // Service delayed
  | 'CANCELLED'   // Service cancelled
  | 'COMPLETED';  // Trip completed

export interface BusTrip {
  id: string;
  routeId: string;
  routeName: string;
  fromStopId: string;
  toStopId: string;
  departureTime: string; // e.g. "08:45" (24-hour format)
  effectiveDepartureTime?: string; // used when delayed
  returnTime?: string;
  totalSeats: number;
  seatedCapacity: number; // e.g. 40 or 2 for demo
  standingCapacity: number; // e.g. 0 or 10
  bookedSeatIds: string[]; // e.g. ["1A", "1B"]
  routeColor: string; // hex or tailwind color
  notes?: string;
  isPeakContinuous?: boolean;
  tripStatus: TripStatus;
  boardingOpen: boolean;
  isDelayPenaltiesWaived?: boolean;
}

export interface Seat {
  id: string;
  row: number;
  col: 'A' | 'B' | 'C' | 'D';
  isBooked: boolean;
  bookedByUserId?: string;
}

export type BookingStatus =
  | 'RESERVED'     // Booked, not yet checked-in. NO QR ISSUED!
  | 'CHECKED_IN'   // Checked in at stop (T-30 to T-10). Active single-use QR issued.
  | 'BOARDED'      // Boarded into bus. QR redeemed and disabled.
  | 'CANCELLED'    // Cancelled by user.
  | 'EXPIRED'      // Missed T-10 check-in deadline. Seat released, 1 minor penalty.
  | 'NO_SHOW'      // Checked in but failed to board before boarding close. 1 major penalty.
  | 'TRANSFERRED'; // Transferred to earlier bus via FCFS Claim. Old QR revoked.

// Check-in assessment status for UI feedback
export type CheckInAssessmentStatus =
  | 'WAITING_WINDOW'
  | 'OUT_OF_RANGE'
  | 'READY_TO_CHECK_IN'
  | 'WINDOW_CLOSED';

export type CheckInStatus = BookingStatus | CheckInAssessmentStatus;

export interface Booking {
  id: string;
  userId: string;
  tripId: string;
  seatId: string;
  routeId: string;
  routeName: string;
  fromStopName: string;
  toStopName: string;
  departureTime: string;
  notify30Min: boolean;
  status: BookingStatus;
  bookedAt: string;
  checkedInAt?: string;
  boardedAt?: string;
  qrCodeToken?: string; // Only issued when status === 'CHECKED_IN' or 'BOARDED'
  transferredToTripId?: string;
  notes?: string;
}

export type UserRole = 'Student' | 'Staff' | 'Admin';

export interface PenaltyRecord {
  id: string;
  userId: string;
  tripId: string;
  type: 'MINOR' | 'MAJOR';
  points: number; // Minor = 1, Major = 2
  reason: string;
  timestamp: string;
  waived: boolean;
}

export interface DemoUser {
  id: string;
  name: string;
  studentId: string;
  email: string;
  avatar: string;
  role: UserRole;
  currentLocationName: string;
  coords: LocationCoord;
  isNearStop: boolean;
  description: string;
  minorPenalties: number;
  majorPenalties: number;
  penaltyPoints: number; // minor*1 + major*2. Limit = 6 points (3 major equivalents)
  penaltyStrikes: number; // legacy strike display
  isRestricted: boolean;
  apCardNumber?: string;
  courseDepartment?: string;
  phone?: string;
}

export interface SeatAlertSubscription {
  id: string;
  earlierTripId: string; // The earlier trip receiving the alert
  userId: string;
  sourceBookingId: string; // Active booking on immediately subsequent bus
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details: string;
}
