# AP-BUS

**Book the seat, skip the queue.**

Hackathon challenge: **Smart Campus & Student Experience** · Asia Pacific University (APU), Malaysia

## The problem

APU students queue for a long time at the shuttle stops, and after waiting they can still lose their place to queue-cutters or to a full bus. Nobody knows in advance whether they will get a seat.

AP-BUS replaces the queue with one flow: **Book → Check in at the stop → Scan a QR pass at the door**. Seats that are not used are released automatically and offered to students waiting for the next shuttle.

## Team

| Name | GitHub |
|------|--------|
| Carlos Lee | @lee-carlos |
| Aska Aidan | @Vioclast |
| Jevon Cliven Ramaputra | @jevoncliven |
| Juan Tanoto | @juan-tanoto |
| Matthew Soekamto | @matthewsoekamto |

## Links

| Resource | Link |
|------|------|
| GitHub repo | https://github.com/lee-carlos/AP-BUS-final |
| App | https://ap-bus-finale.vercel.app |
| Demo video | https://youtu.be/28BSLtnguiY |
| Pitch deck | _add link_ |

## Key features

1. **Same-day seat booking.** Opens at 06:00, closes 10 minutes before departure (T−10). Maximum 2 active bookings, and they must be for different pickup–destination pairs.
2. **Check-in at the pickup point.** From T−30 until before T−10, within 100 m of the stop (120 m at LRT Bukit Jalil).
3. **Single-use QR boarding pass.** The pass is issued only at check-in. It is a real QR code of a random token, valid once, on one shuttle. The scanner accepts only that token; the driver sees the passenger's name, TP number, booking ID and seat to confirm identity.
4. **Unused seats are reused.** A booking without check-in expires at T−10 and its seat is released. Students with a Seat Alert are told, and the student holding the **schedule immediately after** can **claim** the earlier shuttle until T−3. A failed claim never touches the original booking.
5. **Fair penalties.** Missed check-in or cancelling after check-in: 1 point. Checked in but not scanned before departure (no-show): 2 points. Reaching 6 points restricts booking for **one service day** (the next one). Points reset 90 days after the first violation.
6. **Driver portal.** Pick the shuttle, open boarding, scan passes, see the cabin and manifest. Boarding without a scan needs the driver PIN **and a written reason**, and is recorded. A driver cannot mark a shuttle as departed before its scheduled time.
7. **Scenario log.** Every decision of the rule engine (accepted, rejected, penalty) is listed next to the phone, with the time and the reason.

## Try the demo (2 minutes)

The prototype starts on **Friday 13 Nov 2026 at 07:45** with eight student personas, one per rule case. The 08:00 shuttle is full.

1. Open any persona (for example **Citra**).
2. Press **Auto-Tick** in the simulation bar (use the speed button for 5x / 10x), or use the **Jump to** buttons.
3. Follow the **Scenario log** beside the phone. By 08:22 every day-1 case has happened.
4. Press **Next service day** twice to see Fajar's restriction start (Mon 16 Nov) and end (Tue 17 Nov).

Turn **Persona autoplay** OFF in the Scenario log to act for the personas yourself; the automatic deadlines still run. **Reset Demo** returns to 07:45.

### Demo scenarios

| Persona | Case | What happens | When |
|---|---|---|---|
| **Nadia** | 1 · Normal flow | Checks in at the stop, QR issued, scanned at the door, boards with 0 points | 07:46, 08:00 |
| **Budi** | 2 · Missed check-in | Never checks in: booking expires at T−10, +1 point, seat released | 07:50 |
| **Citra** | 3 · Claim succeeds | Holds 08:10 (the schedule right after 08:00) with a Seat Alert; claims Budi's seat and gets a new QR | 07:51 |
| **Dimas** | 4 · Claim rejected | Holds 08:20 (two schedules later); his claim on 08:00 is rejected, his 08:20 booking stays valid | 07:50 |
| **Eka** | 5 · No-show | Checked in but never scanned: marked No-show at departure, +2 points | 08:02 |
| **Fajar** | 6 · One-day restriction | Starts with 5 points, misses check-in → 6 points → booking blocked on Mon 16 Nov only, works again on Tue 17 Nov | 08:00, then Next service day |
| **Gita** | 7 · Out of range | Check-in from ~11 km away is rejected; succeeds once she is at the stop. Her 08:10 pass is rejected at the 08:00 shuttle | 07:47, 07:56, 08:01 |
| **Hana** | 8 · Booking limits | Second booking on the same route rejected, a different route accepted (2/2), third booking rejected | 07:48–07:49 |
| **Pak Rahman** (driver) | 9 · QR scan | Scan shows identity; scanning the same pass twice is rejected; manual boarding (dead phone) is logged with its reason | 08:00, 08:11 |

Scripted persona actions call the same engine functions as the buttons in the app, so no rule is bypassed.

## Run locally

Requires Node.js 22.6 or newer.

```bash
npm install
cp .env.example .env      # set VITE_GOOGLE_MAPS_API_KEY to show the map
npm run dev               # http://localhost:3000
npm test                  # 34 rule and scenario tests (no install needed for this command)
```

## How it is built

- **React 19 + TypeScript + Vite + Tailwind CSS**, Google Maps via `@vis.gl/react-google-maps`.
- `src/utils/bookingRules.ts`: the rules as pure functions (time windows, eligibility, claim, penalty period, tokens).
- `src/utils/simEngine.ts`: the simulation engine. One state object in, new state out, for booking, check-in, claim, scan, manual boarding, the clock and service days.
- `src/data/scenario.ts`: the personas' starting bookings and the scripted timeline.
- `src/utils/*.test.ts`: tests for the rules and for the complete scenario.

## Known limitations and next steps

This submission is a **front-end prototype with a simulated clock, simulated location and demo accounts**. The following are not built yet:

- **Accounts.** Sign-in with APU student email (`TP######@mail.apu.edu.my`) and login lockout after 5 failed attempts.
- **Server and database.** State lives in the browser tab and resets on refresh. A student phone and a driver phone cannot see each other yet, so "two students claim the last seat at the same moment" is not demonstrated.
- **Real GPS and camera scanning.** Location is a demo toggle; the QR is real and scannable, but the driver screen takes the token by simulated scan or typing.
- **Admin tools.** Marking a shuttle delayed or cancelled (no penalties), reversing penalties from an admin screen, and a full audit trail. Today a driver can only reverse a no-show through manual boarding.
- **Full timetable.** 36 sample trips are loaded; the official timetable (22 Oct 2026) has about 249 trips per day.
- **Gemini Enterprise.** Planned for the final pitch: a shuttle assistant for students and a daily operations summary for the transport office, both reading the same trip and booking data.

The booking rules are this project's proposal, not an official APU policy.
