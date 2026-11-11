/// <reference types="@types/google.maps" />
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { BusStop, BusTrip, Booking, DemoUser, LocationCoord } from '../types/bus';
import { APU_STOPS, ROUTE_WAYPOINTS } from '../data/apuRoutes';
import { interpolateAlongPolyline, isWithinBusStopRange } from '../utils/geo';
import { getMinutesUntilDeparture } from '../utils/bookingRules';
import { Bus, MapPin, Target, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface BusMapProps {
  currentUser: DemoUser;
  selectedFrom: BusStop | null;
  selectedTo: BusStop | null;
  bookings: Booking[]; // Support multiple bookings
  trips: BusTrip[];
  currentTimeStr?: string;
  apiKey?: string;
}

// Google Maps Route Polyline & 250m Radius Circle Manager
function MapOverlays({
  passedPath,
  remainingPath,
  isRoutePassed,
  isBooked,
  departureStop,
  userCoord,
  userInRange,
}: {
  passedPath: LocationCoord[];
  remainingPath: LocationCoord[];
  isRoutePassed: boolean;
  isBooked: boolean;
  departureStop: BusStop | null;
  userCoord: LocationCoord;
  userInRange: boolean;
}) {
  const map = useMap();
  const passedPolylineRef = useRef<google.maps.Polyline | null>(null);
  const remainingPolylineRef = useRef<google.maps.Polyline | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);

  // 1. Passed Route Segment (Gray color #71717A as sign that route is already passed)
  useEffect(() => {
    if (!map || passedPath.length < 2) {
      if (passedPolylineRef.current) {
        passedPolylineRef.current.setMap(null);
        passedPolylineRef.current = null;
      }
      return;
    }

    const options: google.maps.PolylineOptions = {
      path: passedPath,
      strokeColor: '#71717A', // Muted Gray for passed route
      strokeOpacity: 0.75,
      strokeWeight: 4,
      map,
    };

    if (!passedPolylineRef.current) {
      passedPolylineRef.current = new google.maps.Polyline(options);
    } else {
      passedPolylineRef.current.setPath(passedPath);
      passedPolylineRef.current.setOptions(options);
    }

    return () => {
      if (passedPolylineRef.current) {
        passedPolylineRef.current.setMap(null);
        passedPolylineRef.current = null;
      }
    };
  }, [map, passedPath]);

  // 2. Remaining / Upcoming Route Segment (Emerald Mint #10B981 when booked, or Gray if route is passed)
  useEffect(() => {
    if (!map || remainingPath.length < 2 || isRoutePassed) {
      if (remainingPolylineRef.current) {
        remainingPolylineRef.current.setMap(null);
        remainingPolylineRef.current = null;
      }
      return;
    }

    const strokeColor = isBooked ? '#10B981' : '#A1A1AA';

    const options: google.maps.PolylineOptions = {
      path: remainingPath,
      strokeColor,
      strokeOpacity: 0.95,
      strokeWeight: 5,
      map,
    };

    if (!remainingPolylineRef.current) {
      remainingPolylineRef.current = new google.maps.Polyline(options);
    } else {
      remainingPolylineRef.current.setPath(remainingPath);
      remainingPolylineRef.current.setOptions(options);
    }

    return () => {
      if (remainingPolylineRef.current) {
        remainingPolylineRef.current.setMap(null);
        remainingPolylineRef.current = null;
      }
    };
  }, [map, remainingPath, isBooked, isRoutePassed]);

  // 3. Departure Stop 250m Check-in Radius Circle
  useEffect(() => {
    if (!map || !departureStop) {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
      return;
    }

    const circleOptions: google.maps.CircleOptions = {
      strokeColor: userInRange ? '#10B981' : '#71717A',
      strokeOpacity: 0.85,
      strokeWeight: 2,
      fillColor: userInRange ? '#10B981' : '#71717A',
      fillOpacity: userInRange ? 0.18 : 0.08,
      center: departureStop.coords,
      radius: 250, // 250 meters departure check-in radius
      map,
    };

    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle(circleOptions);
    } else {
      circleRef.current.setOptions(circleOptions);
    }

    return () => {
      if (circleRef.current) {
        circleRef.current.setMap(null);
        circleRef.current = null;
      }
    };
  }, [map, departureStop, userInRange]);

  return null;
}

export const BusMap: React.FC<BusMapProps> = ({
  currentUser,
  selectedFrom,
  selectedTo,
  bookings,
  trips,
  currentTimeStr = '07:45',
  apiKey,
}) => {
  // Bus simulation progress (0 to 1 along realistic road waypoints)
  const [busProgress, setBusProgress] = useState(0.25);
  const [directionForward, setDirectionForward] = useState(true);
  const [mapError, setMapError] = useState(false);

  // Active route stops
  const activeFrom = selectedFrom || (bookings.length > 0 ? APU_STOPS.find(s => s.name === bookings[0].fromStopName) || null : null);
  const activeTo = selectedTo || (bookings.length > 0 ? APU_STOPS.find(s => s.name === bookings[0].toStopName) || null : null);

  const isRouteFiltered = Boolean(selectedFrom && selectedTo);

  // Check if current active route matches ANY of our booked buses
  const isBookedRoute = useMemo(() => {
    if (bookings.length === 0 || !activeFrom || !activeTo) return false;
    return bookings.some(
      (b) =>
        (b.fromStopName === activeFrom.name && b.toStopName === activeTo.name) ||
        (b.fromStopName === activeTo.name && b.toStopName === activeFrom.name)
    );
  }, [bookings, activeFrom, activeTo]);

  // Check if this route has already passed its scheduled departure time
  const isRoutePassed = useMemo(() => {
    // 1. If user holds a booking on this route
    if (bookings.length > 0 && activeFrom && activeTo) {
      const matchingBooking = bookings.find(
        (b) =>
          (b.fromStopName === activeFrom.name && b.toStopName === activeTo.name) ||
          (b.fromStopName === activeTo.name && b.toStopName === activeFrom.name)
      );
      if (matchingBooking) {
        if (
          matchingBooking.status === 'BOARDED' ||
          matchingBooking.status === 'NO_SHOW' ||
          matchingBooking.status === 'EXPIRED'
        ) {
          return true;
        }
        if (currentTimeStr && matchingBooking.departureTime) {
          return getMinutesUntilDeparture(currentTimeStr, matchingBooking.departureTime) < 0;
        }
      }
    }

    // 2. Or check corresponding trip
    if (activeFrom && activeTo && trips.length > 0) {
      const matchingTrip = trips.find(
        (t) =>
          (t.fromStopId === activeFrom.id && t.toStopId === activeTo.id) ||
          (t.fromStopId === activeTo.id && t.toStopId === activeFrom.id)
      );
      if (matchingTrip) {
        if (matchingTrip.tripStatus === 'COMPLETED') return true;
        if (currentTimeStr && matchingTrip.departureTime) {
          return getMinutesUntilDeparture(currentTimeStr, matchingTrip.departureTime) < 0;
        }
      }
    }

    return false;
  }, [bookings, activeFrom, activeTo, trips, currentTimeStr]);

  // Real road waypoints strictly around Bukit Jalil 57000 / APU TPM
  const activeWaypoints = useMemo<LocationCoord[]>(() => {
    if (!activeFrom || !activeTo) {
      // Default to LRT Bukit Jalil ➔ APU Campus
      return ROUTE_WAYPOINTS['lrt'] || [];
    }

    if (ROUTE_WAYPOINTS[activeFrom.id]) {
      return ROUTE_WAYPOINTS[activeFrom.id];
    }
    if (ROUTE_WAYPOINTS[activeTo.id]) {
      return [...ROUTE_WAYPOINTS[activeTo.id]].reverse();
    }
    return [activeFrom.coords, activeTo.coords];
  }, [activeFrom, activeTo]);

  // Animate dummy bus along road waypoints
  useEffect(() => {
    if (activeWaypoints.length < 2 || isRoutePassed) return;
    const interval = setInterval(() => {
      setBusProgress((prev) => {
        if (prev >= 0.95 && directionForward) {
          setDirectionForward(false);
          return 0.95;
        } else if (prev <= 0.05 && !directionForward) {
          setDirectionForward(true);
          return 0.05;
        }
        return directionForward ? prev + 0.015 : prev - 0.015;
      });
    }, 850);
    return () => clearInterval(interval);
  }, [directionForward, activeWaypoints, isRoutePassed]);

  // Simulated live dummy bus position along road waypoints
  const dummyBusPosition = useMemo<LocationCoord | null>(() => {
    if (activeWaypoints.length < 2) return null;
    return interpolateAlongPolyline(activeWaypoints, isRoutePassed ? 1 : busProgress);
  }, [activeWaypoints, busProgress, isRoutePassed]);

  // Split waypoints into passed segment (GRAY) and remaining segment (ACTIVE MINT)
  const { passedWaypoints, remainingWaypoints } = useMemo(() => {
    if (activeWaypoints.length < 2) {
      return { passedWaypoints: [], remainingWaypoints: [] };
    }

    // When route has already passed its schedule: the entire route is Gray
    if (isRoutePassed) {
      return { passedWaypoints: activeWaypoints, remainingWaypoints: [] };
    }

    const total = activeWaypoints.length;
    const splitIndex = Math.min(
      total - 1,
      Math.max(0, Math.floor(busProgress * (total - 1)))
    );
    const busCoord = dummyBusPosition || activeWaypoints[splitIndex];

    const passed = [...activeWaypoints.slice(0, splitIndex + 1), busCoord];
    const remaining = [busCoord, ...activeWaypoints.slice(splitIndex + 1)];

    return { passedWaypoints: passed, remainingWaypoints: remaining };
  }, [activeWaypoints, isRoutePassed, busProgress, dummyBusPosition]);

  // Check user proximity to departure stop
  const userProximity = useMemo(() => {
    const targetStop = activeFrom || APU_STOPS[1]; // default LRT Bukit Jalil
    return isWithinBusStopRange(currentUser.coords, targetStop.coords, 250);
  }, [currentUser.coords, activeFrom]);

  // Map Bounds Restriction covering every stop point:
  // Bukit Jalil, TPM, Seri Kembangan (Fortune Park), Kuchai, and Cheras (M Vertica)
  // north: 3.140, south: 3.020, west: 101.650, east: 101.745
  const mapRestriction = useMemo(() => ({
    latLngBounds: {
      north: 3.140,
      south: 3.020,
      west: 101.650,
      east: 101.745,
    },
    strictBounds: true,
  }), []);

  // Center in Bukit Jalil 57000 (APU Campus & LRT hub)
  const defaultCenter = useMemo<LocationCoord>(() => ({ lat: 3.0650, lng: 101.6970 }), []);

  const mapsKey = apiKey || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

  return (
    <div className="relative w-full overflow-hidden bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
      {/* Map Header Status Overlay */}
      <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-center justify-between pointer-events-none">
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center gap-2 pointer-events-auto shadow-2xs">
          <div
            className={`w-2 h-2 rounded-xs ${
              isRoutePassed
                ? 'bg-zinc-400'
                : isBookedRoute
                ? 'bg-emerald-500 animate-pulse'
                : 'bg-zinc-400'
            }`}
          />
          <span className="text-[11px] font-semibold text-zinc-900 dark:text-white">
            {isRouteFiltered
              ? `${activeFrom?.shortCode} ➔ ${activeTo?.shortCode}`
              : 'AP-BUS Network (14 Stops)'}
          </span>
          <span
            className={`text-[9px] px-1 py-0.2 rounded-xs font-mono font-medium ${
              isRoutePassed
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-300 dark:border-zinc-700'
                : isBookedRoute
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
            }`}
          >
            {isRoutePassed ? 'ROUTE PASSED (GRAY)' : isBookedRoute ? 'BOOKED ACTIVE' : 'SCROLLABLE'}
          </span>
        </div>

        {/* 250m Proximity Status Badge */}
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center gap-1.5 pointer-events-auto shadow-2xs text-[10px]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              userProximity.inRange ? 'bg-emerald-500 animate-ping' : 'bg-zinc-400'
            }`}
          />
          <span className={userProximity.inRange ? 'text-emerald-700 dark:text-emerald-400 font-semibold' : 'text-zinc-500 font-medium'}>
            {userProximity.inRange
              ? `${userProximity.distanceMeters}m (In Zone)`
              : `${userProximity.distanceMeters}m from Stop`}
          </span>
        </div>
      </div>

      {/* Main Map Rendering Area (Scrollable around all 14 points) */}
      <div className="w-full h-72 sm:h-84 relative">
        {mapsKey && !mapError ? (
          <APIProvider apiKey={mapsKey}>
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={13}
              minZoom={11}
              maxZoom={17}
              restriction={mapRestriction}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              gestureHandling="greedy" /* Fully scrollable, draggable, and pinch-to-zoom */
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Passed Route (Gray) & Remaining Route (Mint) */}
              <MapOverlays
                passedPath={passedWaypoints}
                remainingPath={remainingWaypoints}
                isRoutePassed={isRoutePassed}
                isBooked={isBookedRoute}
                departureStop={activeFrom}
                userCoord={currentUser.coords}
                userInRange={userProximity.inRange}
              />

              {/* Stop Markers for all 14 stops */}
              {APU_STOPS.map((stop) => {
                const isDeparture = activeFrom?.id === stop.id;
                const isDestination = activeTo?.id === stop.id;
                return (
                  <AdvancedMarker key={stop.id} position={stop.coords}>
                    <div className="flex flex-col items-center group cursor-pointer">
                      <div
                        className={`p-1 rounded-sm shadow-md border transition-all ${
                          isDeparture
                            ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-zinc-700 scale-105'
                            : isDestination
                            ? 'bg-emerald-600 text-white border-emerald-500 scale-105'
                            : stop.isCampus
                            ? 'bg-emerald-700 text-white border-emerald-600'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[9px] font-mono px-1 py-0.2 bg-zinc-900/90 text-white rounded-xs mt-0.5 whitespace-nowrap shadow border border-zinc-800">
                        {isDeparture ? `DEP: ${stop.shortCode}` : isDestination ? `DEST: ${stop.shortCode}` : stop.shortCode}
                      </span>
                    </div>
                  </AdvancedMarker>
                );
              })}

              {/* Student GPS Marker */}
              <AdvancedMarker position={currentUser.coords}>
                <div className="relative flex items-center justify-center">
                  <div className={`absolute w-8 h-8 rounded-full animate-ping ${
                    userProximity.inRange ? 'bg-emerald-500/30' : 'bg-zinc-500/20'
                  }`} />
                  <div className={`w-5 h-5 rounded-full border border-white shadow-md flex items-center justify-center text-white text-[8px] font-bold ${
                    userProximity.inRange ? 'bg-emerald-600' : 'bg-zinc-700'
                  }`}>
                    ME
                  </div>
                </div>
              </AdvancedMarker>

              {/* Live Dummy Bus Marker */}
              {dummyBusPosition && !isRoutePassed && (
                <AdvancedMarker position={dummyBusPosition}>
                  <div className="p-1.5 rounded-sm shadow-md border border-white flex items-center justify-center text-white bg-emerald-600 transition-all duration-700">
                    <Bus className="w-3.5 h-3.5 animate-bounce" />
                  </div>
                </AdvancedMarker>
              )}
            </Map>
          </APIProvider>
        ) : (
          /* High-Fidelity Vector Transit Map Canvas (Bukit Jalil 57000 Restricted Zone) */
          <div className="w-full h-full bg-zinc-950 relative overflow-hidden select-none">
            <svg className="w-full h-full" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">
              <defs>
                <pattern id="gridRoad" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#27272A" strokeWidth="0.5" />
                </pattern>
                {/* Radar pulse for departure zone */}
                <radialGradient id="radiusGradient" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={userProximity.inRange ? '#10B981' : '#71717A'} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={userProximity.inRange ? '#10B981' : '#71717A'} stopOpacity="0.04" />
                </radialGradient>
              </defs>

              <rect width="400" height="300" fill="#09090B" />
              <rect width="400" height="300" fill="url(#gridRoad)" />

              {/* Authentic Roads in Kuala Lumpur, Bukit Jalil 57000 */}
              <g stroke="#27272A" strokeLinecap="round">
                {/* Bukit Jalil Highway */}
                <path d="M 20 90 Q 140 130 210 170 T 380 230" fill="none" strokeWidth="12" />
                {/* Jalan Merah Caga (LRT link) */}
                <path d="M 50 40 Q 80 100 120 180" fill="none" strokeWidth="8" />
                {/* TPM Technology Park Access */}
                <path d="M 70 270 Q 150 180 210 170 T 360 70" fill="none" strokeWidth="8" />
              </g>

              {/* Road labels */}
              <text x="70" y="80" fill="#52525B" fontSize="7" fontWeight="bold">JALAN MERAH CAGA</text>
              <text x="210" y="145" fill="#52525B" fontSize="7" fontWeight="bold">BUKIT JALIL HIGHWAY</text>
              <text x="230" y="220" fill="#52525B" fontSize="7" fontWeight="bold">TECHNOLOGY PARK MALAYSIA (57000 KL)</text>

              {/* 250m Check-in Radius Zone around Departure Stop */}
              {activeFrom && (
                <g transform="translate(80, 100)">
                  <circle r="40" fill="none" stroke={userProximity.inRange ? '#10B981' : '#71717A'} strokeWidth="1.5" strokeDasharray="3,3" opacity="0.8">
                    <animate attributeName="r" values="36;44;36" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.3;0.8" dur="3s" repeatCount="indefinite" />
                  </circle>
                  <circle r="36" fill="url(#radiusGradient)" stroke={userProximity.inRange ? '#10B981' : '#71717A'} strokeWidth="1.5" />
                  <rect x="-48" y="-48" width="96" height="14" rx="3" fill="#18181B" stroke={userProximity.inRange ? '#10B981' : '#71717A'} strokeWidth="1" />
                  <text x="0" y="-38" fill={userProximity.inRange ? '#34D399' : '#A1A1AA'} fontSize="7" fontWeight="bold" textAnchor="middle">
                    250m Check-in Zone
                  </text>
                </g>
              )}

              {/* Route Rendering: Passed Section in GRAY, Remaining Section in MINT */}
              {isRouteFiltered ? (
                <>
                  {isRoutePassed ? (
                    /* Entire Route is Passed -> Solid Gray */
                    <path
                      d="M 80 100 Q 130 135 180 155 T 225 175"
                      fill="none"
                      stroke="#71717A"
                      strokeWidth="4"
                      strokeDasharray="4,3"
                      strokeLinecap="round"
                    />
                  ) : (
                    <>
                      {/* 1. Passed route segment (Origin to Bus) in GRAY */}
                      <path
                        d="M 80 100 Q 110 120 145 135"
                        fill="none"
                        stroke="#71717A"
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                      {/* 2. Remaining route segment (Bus to Destination) in MINT */}
                      <path
                        d="M 145 135 Q 180 155 225 175"
                        fill="none"
                        stroke={isBookedRoute ? '#10B981' : '#A1A1AA'}
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </>
                  )}
                </>
              ) : (
                <g stroke="#3F3F46" strokeWidth="1.2" strokeDasharray="3,3">
                  <line x1="225" y1="175" x2="80" y2="100" />
                  <line x1="225" y1="175" x2="310" y2="80" />
                  <line x1="225" y1="175" x2="140" y2="240" />
                  <line x1="225" y1="175" x2="280" y2="230" />
                </g>
              )}

              {/* APU Campus Central Hub */}
              <g transform="translate(225, 175)">
                <circle r="14" fill="#047857" fillOpacity="0.25" className="animate-pulse" />
                <circle r="8" fill="#10B981" stroke="#FFFFFF" strokeWidth="1.5" />
                <text x="0" y="18" fill="#34D399" fontSize="8" fontWeight="bold" textAnchor="middle">
                  APU CAMPUS
                </text>
              </g>

              {/* LRT Bukit Jalil Stop */}
              <g transform="translate(80, 100)">
                <circle r="7" fill="#18181B" stroke="#FFFFFF" strokeWidth="1.5" />
                <text x="0" y="-12" fill="#E4E4E7" fontSize="8" fontWeight="600" textAnchor="middle">
                  LRT Bukit Jalil
                </text>
              </g>

              {/* Parkhill */}
              <g transform="translate(140, 240)">
                <circle r="4.5" fill="#3F3F46" stroke="#FFFFFF" strokeWidth="1" />
                <text x="0" y="13" fill="#A1A1AA" fontSize="7" textAnchor="middle">Parkhill</text>
              </g>

              {/* City of Green */}
              <g transform="translate(280, 230)">
                <circle r="4.5" fill="#3F3F46" stroke="#FFFFFF" strokeWidth="1" />
                <text x="0" y="13" fill="#A1A1AA" fontSize="7" textAnchor="middle">City of Green</text>
              </g>

              {/* Fortune Park */}
              <g transform="translate(320, 260)">
                <circle r="4.5" fill="#3F3F46" stroke="#FFFFFF" strokeWidth="1" />
                <text x="0" y="13" fill="#A1A1AA" fontSize="7" textAnchor="middle">Fortune Park</text>
              </g>

              {/* Animated Dummy Bus Along Road Path (if not passed) */}
              {isRouteFiltered && !isRoutePassed && (
                <g
                  transform={`translate(${80 + busProgress * (225 - 80)}, ${
                    100 + Math.sin(busProgress * Math.PI) * 25 + busProgress * 75
                  })`}
                  style={{ transition: 'transform 0.8s linear' }}
                >
                  <circle r="10" fill="#10B981" fillOpacity="0.3" className="animate-ping" />
                  <rect
                    x="-8"
                    y="-6"
                    width="16"
                    height="12"
                    rx="2"
                    fill={isBookedRoute ? '#10B981' : '#71717A'}
                    stroke="#FFFFFF"
                    strokeWidth="1.2"
                  />
                  <text x="0" y="-9" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle">
                    BUS
                  </text>
                </g>
              )}

              {/* User Real Location Pin */}
              <g
                transform={
                  currentUser.isNearStop
                    ? 'translate(88, 115)' // Inside the 250m zone!
                    : 'translate(325, 80)' // Far
                }
              >
                <circle
                  r="5"
                  fill={currentUser.isNearStop ? '#10B981' : '#71717A'}
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <text
                  x="0"
                  y="-8"
                  fill={currentUser.isNearStop ? '#34D399' : '#A1A1AA'}
                  fontSize="7"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  YOU
                </text>
              </g>
            </svg>
          </div>
        )}
      </div>

      {/* Route Info Caption below Map with Passed / Active Legend */}
      <div className="px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-1.5">
          <Target className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          <span>
            {userProximity.inRange
              ? 'GPS verified within pickup radius (Bukit Jalil 57000).'
              : `Distance: ${userProximity.distanceMeters}m from pickup stop.`}
          </span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-1.5 rounded-xs bg-zinc-500" />
            <span className="text-zinc-500">Passed (Gray)</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-1.5 rounded-xs bg-emerald-500" />
            <span className="text-emerald-700 dark:text-emerald-400">Active (Mint)</span>
          </span>
        </div>
      </div>
    </div>
  );
};
