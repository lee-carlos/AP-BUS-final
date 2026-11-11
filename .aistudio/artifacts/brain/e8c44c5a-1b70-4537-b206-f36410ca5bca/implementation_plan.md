# APU ShuttleMate — Master Rules & Automated Execution Plan

Comprehensive alignment of the APU ShuttleMate campus shuttle booking system with the Master Project Context v2.0 (`ShuttleMate_67a48e4f.pdf`), implementing continuous auto-tick deadline automation, strict FCFS Claim transfers, the agreed Minor/Major penalty system, and authentic role personas.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed during the requirements alignment phase and will govern execution:
> - **MVP Boundaries & Strict Policy Adherence**: Strictly enforce the agreed rules in the PDF document as intended MVP boundaries (e.g., rejecting vehicle capacity reductions that undercut active bookings, disallowing skipping multiple buses on FCFS Claims, and maintaining current prototype parameters).
> - **Continuous Auto-Tick Automation**: An in-memory, continuous background ticker running every second to advance simulated time, evaluate deadlines automatically (T−30 check-in open, T−10 normal booking and check-in close with automatic expiry, T−3 claim close, and boarding close), and transition reservation states without manual triggers.

---

## 1. Overview & Core Concept

**APU ShuttleMate** is a web-based smart campus shuttle reservation and boarding platform designed specifically for students and transportation staff at Asia Pacific University (APU), Malaysia. Operating under Malaysia Time (MYT, UTC+8) and following the official timetable schedule:
- **Operating Day & Booking Window**: Bookings open each day at **06:00 MYT** for same-day travel only.
- **Normal Booking & Check-in Cutoff**: Booking and normal check-in close strictly at **T−10 minutes** before effective departure.
- **Automated Seat Release**: At T−10 minutes, unverified reservations expire automatically, releasing seats for immediate standby transfer.
- **FCFS Claim (Seat Alert)**: Only students with an active reservation on the *immediate next bus* (same route, pickup, and destination) are eligible to claim a vacated seat, closing strictly at **T−3 minutes**.
- **No-Show & Penalty Defense**: Differentiates between Minor (1 pt) and Major (2 pts) infractions with a 90-day rolling record, suspending accounts upon reaching 6 points (3 Major equivalents).

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Student Daily Reservation**:
   - Student browses routes (LRT Bukit Jalil, APU Campus, Fortune Park, etc.) with real-time seat availability.
   - Enforces a maximum of 2 concurrent active bookings with different origin-destination pairs.
   - Initial booking status is `RESERVED` (clean pass placeholder; **no QR is issued yet**).
2. **Proximity Geo Check-in (T−30 to T−10)**:
   - Check-in opens 30 minutes before departure.
   - When inside the verified radius (APU: 100m, LRT: 120m), the student taps Check-in.
   - System updates status to `CHECKED_IN` and securely issues the single-use QR Code.
3. **Automated T−10 Expiry & FCFS Claim Notification**:
   - Any student still `RESERVED` at T−10 is automatically expired, their seat is released, and 1 Minor penalty is recorded.
   - Eligible students on the immediately subsequent bus receive a Seat Alert banner with a 1-tap Claim button.
   - When tapped, location is verified, the prior booking transitions to `TRANSFERRED`, and a new pass on the earlier bus is generated with status `CHECKED_IN` and a fresh QR token.
4. **Driver / Bus Staff Boarding Console**:
   - Staff member can open boarding, monitor manifest counts (`Reserved`, `Checked-in`, `Boarded`), scan/enter QR passes, and trigger Boarding Close.
   - Closing boarding converts checked-in passengers who failed to board into `NO_SHOW` (1 Major penalty).

### Visual Identity & Touch Ergonomics
- **Color Discipline (60-30-10)**: Dark slate canvas (`bg-slate-950`), elevated neutral structural cards (`bg-slate-900/90` with hairline borders `border-slate-800`), and targeted transit blue/amber accents.
- **Touch-First Hierarchy**: Minimum 44px tap targets for mobile safari/chrome ergonomics, clean unboxed metadata with bullet separators (`·`), and sticky bottom actions within thumb reach.
- **Dual-State Demo Controller**: A dedicated Demo Studio bar displaying the live ticker, current simulated time, active persona switch, and instant event triggers.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Strict One-Bus-Earlier FCFS Claim Rule
- **Chosen Approach**: A student holding a booking on Bus C can only claim a vacated seat on Bus B; they cannot leapfrog to Bus A even if Bus B was cancelled.
- **Why**: Enforces predictable, fair queueing rooted in published timetables and prevents chaotic multi-schedule displacement.

### Decision 2: Automated In-App Continuous Ticker
- **Chosen Approach**: A central reactive clock hook operating continuously in the client, evaluating all active trip schedules against current simulated MYT time.
- **Why**: Replaces fragile manual clicking with authentic automated state transitions (T−10 expiry, T−3 claim cutoff, auto-arrival) matching production server cron behavior.

### Decision 3: Penalty Model & Rollback on Delay/Cancellation
- **Chosen Approach**: Cancel before check-in is always free. Cancel after check-in = 1 Minor. T−10 Expiry = 1 Minor. No-Show at boarding close = 1 Major. If a bus is marked Delayed or Cancelled by staff, all penalties associated with that trip are wiped clean.
- **Why**: Prevents punishing students for transportation delays beyond their control while curbing ghost bookings.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    APU ShuttleMate Platform                     │
└─────────────────────────────────────────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│ Student View  │       │ Driver / Staff│       │ Demo Studio & │
│ - Route List  │       │ - Manifest    │       │ Auto-Ticker   │
│ - Live Pass   │       │ - QR Scanner  │       │ - MYT Clock   │
│ - FCFS Alerts │       │ - Close Board │       │ - Personas    │
└───────┬───────┘       └───────┬───────┘       └───────┬───────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
         ┌──────────────────────────────────────────────┐
         │          Central Shuttle Rules Engine        │
         │ - isBookingWindowOpen (06:00 MYT)            │
         │ - evaluateCheckInWindow (T-30 to T-10)       │
         │ - processAutoExpirations (At T-10)           │
         │ - validateClaimEligibility (N+1 Trip Only)   │
         │ - evaluatePenalties (Minor=1pt, Major=2pts)  │
         │ - calculateUsedCapacity (Res + Chk + Brd)    │
         └──────────────────────┬───────────────────────┘
                                ▼
         ┌──────────────────────────────────────────────┐
         │             Reactive State Store             │
         │ - Trips (Status, Seated/Standing Capacity)   │
         │ - Bookings (RESERVED -> CHECKED_IN -> BOARD) │
         │ - Penalties & Audit Activity Logs            │
         │ - Active User / Persona Session              │
         └──────────────────────────────────────────────┘
```

### Data Model & State Lifecycle
- **Reservation Status Flow**:
  `RESERVED` (Created, no QR) $\longrightarrow$ `CHECKED_IN` (GPS verified at T-30..T-10, QR issued) $\longrightarrow$ `BOARDED` (QR scanned).
  - If not checked in by T−10: Transitions to `EXPIRED` (seat freed, +1 Minor).
  - If checked in but not boarded when driver closes bus: Transitions to `NO_SHOW` (+1 Major).
  - If moved via FCFS Claim: Source booking becomes `TRANSFERRED` (old QR revoked), target booking created as `CHECKED_IN` (new QR issued).
- **Capacity Formula**:
  `Used Capacity = count(RESERVED) + count(CHECKED_IN) + count(BOARDED)`.
  Available seats = $\max(0, \text{Capacity} - \text{Used})$. Boarding preserves capacity.
- **Official Demo Personas**:
  - `Rani Pratama`: Student booked on 08:10 bus, Seat Alert active for 08:00 bus.
  - `Amir Hakim`: Competing student booked on 08:10 bus.
  - `Sarah Tan`: Checked-in passenger on 08:00 bus.
  - `Ryan Lim`: Unverified passenger on 08:00 bus (expires at 07:50).
  - `Daniel Lee`: Bus staff (manifest & scanner control).
  - `Alex Morgan`: Admin (trip status & capacity control).
