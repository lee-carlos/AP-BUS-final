import React, { useState, useEffect, useMemo, useRef } from 'react';
import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import { BusTrip, BusStop, LocationCoord } from '../types/bus';
import { APU_STOPS, ROUTE_WAYPOINTS } from '../data/apuRoutes';
import { interpolateAlongPolyline } from '../utils/geo';
import { MapPin, Navigation, Compass, Layers, Bus, Radio, Sparkles } from 'lucide-react';

interface DriverRouteMapProps {
  trip: BusTrip;
  busStatus: string; // 'On the Way' | 'Arrived' | 'Waiting' | 'Depart' | 'Not Available Now' | 'Expired'
  theme: 'light' | 'dark';
  apiKey?: string;
}

// Sub-component to manage Route Polyline and 250m Stop Geofence circles on Google Map
function DriverMapOverlays({
  waypoints,
  originStop,
  destStop,
  vehicleCoord,
}: {
  waypoints: LocationCoord[];
  originStop: BusStop;
  destStop: BusStop;
  vehicleCoord: LocationCoord;
}) {
  const map = useMap();
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const originCircleRef = useRef<google.maps.Circle | null>(null);
  const destCircleRef = useRef<google.maps.Circle | null>(null);

  // 1. Render Google Maps Route Polyline
  useEffect(() => {
    if (!map || waypoints.length < 2) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      return;
    }

    const options: google.maps.PolylineOptions = {
      path: waypoints,
      strokeColor: '#10B981', // Emerald Mint Active Route
      strokeOpacity: 0.95,
      strokeWeight: 5,
      map,
    };

    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline(options);
    } else {
      polylineRef.current.setPath(waypoints);
      polylineRef.current.setOptions(options);
    }

    return () => {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
    };
  }, [map, waypoints]);

  // 2. Render 250m Departure & Arrival Geofence Circles
  useEffect(() => {
    if (!map) return;

    const originOptions: google.maps.CircleOptions = {
      strokeColor: '#10B981',
      strokeOpacity: 0.8,
      strokeWeight: 1.5,
      fillColor: '#10B981',
      fillOpacity: 0.12,
      center: originStop.coords,
      radius: 250, // 250m radius
      map,
    };

    const destOptions: google.maps.CircleOptions = {
      strokeColor: '#3B82F6',
      strokeOpacity: 0.8,
      strokeWeight: 1.5,
      fillColor: '#3B82F6',
      fillOpacity: 0.10,
      center: destStop.coords,
      radius: 250,
      map,
    };

    if (!originCircleRef.current) {
      originCircleRef.current = new google.maps.Circle(originOptions);
    } else {
      originCircleRef.current.setOptions(originOptions);
    }

    if (!destCircleRef.current) {
      destCircleRef.current = new google.maps.Circle(destOptions);
    } else {
      destCircleRef.current.setOptions(destOptions);
    }

    return () => {
      if (originCircleRef.current) {
        originCircleRef.current.setMap(null);
        originCircleRef.current = null;
      }
      if (destCircleRef.current) {
        destCircleRef.current.setMap(null);
        destCircleRef.current = null;
      }
    };
  }, [map, originStop, destStop]);

  return null;
}

export const DriverRouteMap: React.FC<DriverRouteMapProps> = ({
  trip,
  busStatus,
  theme,
  apiKey,
}) => {
  const mapsKey = apiKey || (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || '';

  // View Mode: 'google_maps' | 'vector_radar'
  const [viewMode, setViewMode] = useState<'google_maps' | 'vector_radar'>(
    mapsKey ? 'google_maps' : 'vector_radar'
  );

  // Vehicle progress simulation along the route (0% at origin, 100% at destination)
  const getInitialProgress = () => {
    if (busStatus === 'Arrived' || busStatus === 'Waiting') return 95;
    if (busStatus === 'Depart' || busStatus === 'Expired') return 100;
    if (busStatus === 'On the Way') return 48; // halfway on highway
    return 15;
  };

  const [vehicleProgress, setVehicleProgress] = useState<number>(getInitialProgress);

  useEffect(() => {
    setVehicleProgress(getInitialProgress());
  }, [busStatus]);

  // Route Stops info
  const fromStop = useMemo(() => {
    return (
      APU_STOPS.find((s) => s.id === trip.fromStopId) || {
        id: trip.fromStopId,
        name: 'LRT Bukit Jalil',
        shortCode: 'LRT-BJ',
        coords: { lat: 3.0587, lng: 101.6917 },
        address: 'Jalan Merah Caga, Bukit Jalil, 57000 Kuala Lumpur',
      }
    );
  }, [trip.fromStopId]);

  const toStop = useMemo(() => {
    return (
      APU_STOPS.find((s) => s.id === trip.toStopId) || {
        id: trip.toStopId,
        name: 'APU Campus Terminal',
        shortCode: 'APU',
        coords: { lat: 3.0558, lng: 101.7003 },
        address: 'Technology Park Malaysia, Bukit Jalil, 57000 Kuala Lumpur',
      }
    );
  }, [trip.toStopId]);

  const isReturn = trip.fromStopId === 'apu';

  // Realistic GPS Waypoints for this trip corridor
  const gpsWaypoints = useMemo<LocationCoord[]>(() => {
    const raw = ROUTE_WAYPOINTS[trip.routeId] || ROUTE_WAYPOINTS['lrt'] || [];
    if (raw.length === 0) {
      return [fromStop.coords, toStop.coords];
    }
    if (isReturn) {
      return [...raw].reverse();
    }
    return raw;
  }, [trip.routeId, isReturn, fromStop.coords, toStop.coords]);

  // Current real-world vehicle GPS coordinates
  const vehicleCoord = useMemo<LocationCoord>(() => {
    return interpolateAlongPolyline(gpsWaypoints, vehicleProgress / 100);
  }, [gpsWaypoints, vehicleProgress]);

  // Map Center: Midpoint between origin and destination in Bukit Jalil 57000
  const defaultCenter = useMemo<LocationCoord>(() => {
    return {
      lat: (fromStop.coords.lat + toStop.coords.lat) / 2,
      lng: (fromStop.coords.lng + toStop.coords.lng) / 2,
    };
  }, [fromStop.coords, toStop.coords]);

  // Strict geographical bounds around Kuala Lumpur / Bukit Jalil 57000 corridor
  const mapRestriction = useMemo(
    () => ({
      latLngBounds: {
        north: 3.14,
        south: 3.02,
        west: 101.65,
        east: 101.745,
      },
      strictBounds: true,
    }),
    []
  );

  // SVG dimensions for vector view
  const viewBoxWidth = 600;
  const viewBoxHeight = 220;

  const routePoints = isReturn
    ? [
        { x: 530, y: 70, label: 'APU Campus' },
        { x: 440, y: 85, label: 'TPM Gate' },
        { x: 310, y: 130, label: 'Bukit Jalil Hwy' },
        { x: 190, y: 155, label: 'Jalan Merah Caga' },
        { x: 70, y: 160, label: 'LRT Bukit Jalil' },
      ]
    : [
        { x: 70, y: 160, label: 'LRT Bukit Jalil' },
        { x: 190, y: 155, label: 'Jalan Merah Caga' },
        { x: 310, y: 130, label: 'Bukit Jalil Hwy' },
        { x: 440, y: 85, label: 'TPM Gate' },
        { x: 530, y: 70, label: 'APU Campus' },
      ];

  const pathD = isReturn
    ? 'M 530,70 C 480,75 460,85 440,85 C 380,85 350,125 310,130 C 260,135 220,155 190,155 C 140,155 100,160 70,160'
    : 'M 70,160 C 100,160 140,155 190,155 C 220,155 260,135 310,130 C 350,125 380,85 440,85 C 460,85 480,75 530,70';

  const t = Math.max(0, Math.min(1, vehicleProgress / 100));

  const getVehiclePosition = (p: number) => {
    const numSegments = routePoints.length - 1;
    const segment = Math.min(Math.floor(p * numSegments), numSegments - 1);
    const segT = p * numSegments - segment;

    const p0 = routePoints[segment];
    const p1 = routePoints[segment + 1];

    const currentX = p0.x + (p1.x - p0.x) * segT;
    const currentY = p0.y + (p1.y - p0.y) * segT;

    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    return { x: currentX, y: currentY, angle: angleDeg };
  };

  const vehiclePos = getVehiclePosition(t);
  const startPoint = routePoints[0];
  const endPoint = routePoints[routePoints.length - 1];

  return (
    <div className="w-full bg-zinc-900 dark:bg-black rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm flex flex-col font-mono">
      {/* Top Map Header: Clean Corridor Info & Controls */}
      <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px] gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
          <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Kuala Lumpur, Bukit Jalil 57000 Transit Map</span>
        </div>

        {/* View Toggle (Google Maps vs Transit Radar) */}
        <div className="flex items-center gap-1.5">
          {mapsKey && (
            <div className="flex items-center rounded bg-zinc-200 dark:bg-zinc-800 p-0.5 text-[9px] font-bold">
              <button
                onClick={() => setViewMode('google_maps')}
                className={`px-1.5 py-0.5 rounded transition ${
                  viewMode === 'google_maps'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Google Maps
              </button>
              <button
                onClick={() => setViewMode('vector_radar')}
                className={`px-1.5 py-0.5 rounded transition ${
                  viewMode === 'vector_radar'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Radar
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 text-[10px]">
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
              Live GPS Active
            </span>
            <span className="text-zinc-500 hidden sm:inline">36 km/h</span>
          </div>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div className="relative w-full h-64 bg-slate-900 overflow-hidden select-none">
        {mapsKey && viewMode === 'google_maps' ? (
          /* ============================================================= */
          /* GOOGLE MAPS PLATFORM INTEGRATION FOR DRIVER ACCOUNT           */
          /* ============================================================= */
          <APIProvider apiKey={mapsKey} region="MY" language="en">
            <Map
              defaultCenter={defaultCenter}
              defaultZoom={14}
              minZoom={12}
              maxZoom={18}
              restriction={mapRestriction}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              gestureHandling="greedy"
              disableDefaultUI={false}
              zoomControl={true}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={false}
              style={{ width: '100%', height: '100%' }}
            >
              {/* Route Polyline and Geofence Circles */}
              <DriverMapOverlays
                waypoints={gpsWaypoints}
                originStop={fromStop}
                destStop={toStop}
                vehicleCoord={vehicleCoord}
              />

              {/* Origin Stop Advanced Marker */}
              <AdvancedMarker position={fromStop.coords}>
                <div className="flex flex-col items-center">
                  <div className="p-1 rounded-sm shadow-md bg-zinc-900 text-white border border-zinc-700">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="text-[9px] font-mono px-1 py-0.2 bg-zinc-900/90 text-white rounded-xs mt-0.5 whitespace-nowrap shadow border border-zinc-800 font-bold">
                    DEP: {fromStop.shortCode}
                  </span>
                </div>
              </AdvancedMarker>

              {/* Destination Stop Advanced Marker */}
              <AdvancedMarker position={toStop.coords}>
                <div className="flex flex-col items-center">
                  <div className="p-1 rounded-sm shadow-md bg-blue-700 text-white border border-blue-500">
                    <MapPin className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-[9px] font-mono px-1 py-0.2 bg-zinc-900/90 text-white rounded-xs mt-0.5 whitespace-nowrap shadow border border-zinc-800 font-bold">
                    DEST: {toStop.shortCode}
                  </span>
                </div>
              </AdvancedMarker>

              {/* Live Vehicle Marker ("Gambar Mobil" / Shuttle Bus) */}
              <AdvancedMarker position={vehicleCoord}>
                <div className="relative flex flex-col items-center">
                  {/* Radar pulse around vehicle */}
                  <div className="absolute w-10 h-10 -top-2 rounded-full bg-emerald-500/25 animate-ping pointer-events-none" />

                  {/* Bus Graphic Card */}
                  <div className="p-1.5 rounded-sm shadow-lg border-2 border-white flex items-center gap-1 text-white bg-emerald-600 transition-all">
                    <Bus className="w-4 h-4 text-white" />
                    <span className="text-[9px] font-bold font-mono tracking-tight">
                      BUS {trip.departureTime}
                    </span>
                  </div>

                  {/* Floating callout */}
                  <div className="px-1.5 py-0.2 rounded-xs bg-slate-950/90 text-emerald-300 text-[8px] font-mono font-bold mt-0.5 shadow border border-slate-700">
                    {Math.round(vehicleProgress)}% Corridor Progress
                  </div>
                </div>
              </AdvancedMarker>
            </Map>
          </APIProvider>
        ) : (
          /* ============================================================= */
          /* VECTOR TRANSIT RADAR MAP (MAPS + ROUTE + VEHICLE GRAPHIC)     */
          /* ============================================================= */
          <svg
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            className="w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <pattern id="roadGrid" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1E293B" strokeWidth="0.75" />
              </pattern>

              <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" />
                <stop offset="50%" stopColor="#059669" />
                <stop offset="100%" stopColor="#3B82F6" />
              </linearGradient>

              <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10B981" floodOpacity="0.7" />
              </filter>
            </defs>

            <rect width={viewBoxWidth} height={viewBoxHeight} fill="#0F172A" />
            <rect width={viewBoxWidth} height={viewBoxHeight} fill="url(#roadGrid)" />

            {/* Geographical Area Blocks */}
            <path
              d="M 240,20 Q 320,10 400,25 Q 480,40 520,15 L 590,10 L 590,90 Q 510,110 430,95 Q 350,80 270,95 Z"
              fill="#064E3B"
              fillOpacity="0.25"
            />
            <text x="360" y="55" fill="#34D399" fillOpacity="0.4" fontSize="10" fontWeight="bold">
              Technology Park Malaysia (TPM)
            </text>

            <path
              d="M 10,130 Q 80,110 160,125 Q 230,140 280,180 L 280,210 L 10,210 Z"
              fill="#1E3A8A"
              fillOpacity="0.2"
            />
            <text x="50" y="195" fill="#60A5FA" fillOpacity="0.4" fontSize="9" fontWeight="bold">
              Bukit Jalil Transit Corridor (57000)
            </text>

            {/* Arterial Roads */}
            <path
              d="M 10,110 Q 150,115 280,140 Q 420,165 590,160"
              fill="none"
              stroke="#334155"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 10,110 Q 150,115 280,140 Q 420,165 590,160"
              fill="none"
              stroke="#475569"
              strokeWidth="1.5"
              strokeDasharray="6,6"
            />
            <text x="340" y="160" fill="#94A3B8" fontSize="8" letterSpacing="0.5">
              LEBUHRAYA BUKIT JALIL
            </text>

            <path
              d="M 40,30 L 70,160 L 100,210"
              fill="none"
              stroke="#334155"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <text x="18" y="90" fill="#94A3B8" fontSize="8" transform="rotate(78 18,90)">
              JALAN MERAH CAGA
            </text>

            <path
              d="M 450,210 Q 480,140 530,70 L 580,20"
              fill="none"
              stroke="#334155"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <text x="475" y="130" fill="#94A3B8" fontSize="8" transform="rotate(-55 475,130)">
              TPM APU ROAD
            </text>

            {/* Official Shuttle Route Line */}
            <path d={pathD} fill="none" stroke="#000000" strokeWidth="8" strokeLinecap="round" />
            <path
              d={pathD}
              fill="none"
              stroke="url(#routeGradient)"
              strokeWidth="5"
              strokeLinecap="round"
              filter="url(#routeGlow)"
            />
            <path
              d={pathD}
              fill="none"
              stroke="#ECFDF5"
              strokeWidth="1.5"
              strokeDasharray="4,6"
              className="animate-pulse"
            />

            {/* Landmark Road Waypoint Labels */}
            <g opacity="0.85">
              <rect x="150" y="165" width="95" height="15" rx="3" fill="#1E293B" stroke="#475569" strokeWidth="0.5" />
              <text x="197" y="176" fill="#CBD5E1" fontSize="8" textAnchor="middle">
                Jalan Merah Caga
              </text>

              <rect x="270" y="105" width="100" height="15" rx="3" fill="#1E293B" stroke="#475569" strokeWidth="0.5" />
              <text x="320" y="116" fill="#CBD5E1" fontSize="8" textAnchor="middle">
                Bukit Jalil Highway
              </text>

              <rect x="400" y="65" width="85" height="15" rx="3" fill="#1E293B" stroke="#475569" strokeWidth="0.5" />
              <text x="442" y="76" fill="#CBD5E1" fontSize="8" textAnchor="middle">
                TPM Campus Gate
              </text>
            </g>

            {/* Origin Stop Pin */}
            <g transform={`translate(${startPoint.x}, ${startPoint.y})`}>
              <circle r="12" fill="#10B981" fillOpacity="0.25" className="animate-ping" />
              <circle r="7" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
              <g transform="translate(-40, -28)">
                <rect width="80" height="20" rx="4" fill="#0F172A" stroke="#10B981" strokeWidth="1.2" />
                <text x="40" y="13" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
                  {fromStop.shortCode} (Depart)
                </text>
              </g>
            </g>

            {/* Destination Stop Pin */}
            <g transform={`translate(${endPoint.x}, ${endPoint.y})`}>
              <circle r="12" fill="#3B82F6" fillOpacity="0.25" />
              <circle r="7" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" />
              <g transform="translate(-42, -28)">
                <rect width="84" height="20" rx="4" fill="#0F172A" stroke="#3B82F6" strokeWidth="1.2" />
                <text x="42" y="13" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
                  {toStop.shortCode} (Arrival)
                </text>
              </g>
            </g>

            {/* Vehicle Graphic ("Gambar Mobil" / Shuttle Bus) */}
            <g transform={`translate(${vehiclePos.x}, ${vehiclePos.y})`}>
              <circle r="22" fill="#10B981" fillOpacity="0.2" className="animate-ping" />
              <circle r="15" fill="#10B981" fillOpacity="0.3" />

              <g transform={`rotate(${vehiclePos.angle})`}>
                <rect x="-17" y="-9" width="34" height="18" rx="4" fill="#000000" fillOpacity="0.5" />
                <rect
                  x="-16"
                  y="-8"
                  width="32"
                  height="16"
                  rx="3.5"
                  fill="#059669"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
                <rect x="7" y="-6" width="6" height="12" rx="1.5" fill="#E2E8F0" />
                <rect x="-1" y="-6.5" width="6" height="2.5" rx="0.5" fill="#E2E8F0" />
                <rect x="-8" y="-6.5" width="5" height="2.5" rx="0.5" fill="#E2E8F0" />
                <rect x="-1" y="4" width="6" height="2.5" rx="0.5" fill="#E2E8F0" />
                <rect x="-8" y="4" width="5" height="2.5" rx="0.5" fill="#E2E8F0" />
                <rect x="-14" y="-5" width="2" height="10" rx="0.5" fill="#E2E8F0" />
                <rect x="-6" y="-3" width="10" height="6" rx="1" fill="#047857" stroke="#10B981" strokeWidth="0.5" />
                <polygon points="16,-4 26,-8 26,8 16,4" fill="#FDE047" fillOpacity="0.35" />
                <circle cx="15.5" cy="-5" r="1.5" fill="#FEF08A" />
                <circle cx="15.5" cy="5" r="1.5" fill="#FEF08A" />
                <rect x="-16.5" y="-6" width="1" height="2" fill="#EF4444" />
                <rect x="-16.5" y="4" width="1" height="2" fill="#EF4444" />
              </g>

              <g transform="translate(0, -32)">
                <rect
                  x="-60"
                  y="-2"
                  width="120"
                  height="22"
                  rx="4"
                  fill="#0F172A"
                  stroke="#10B981"
                  strokeWidth="1.5"
                  filter="url(#routeGlow)"
                />
                <text x="0" y="12" fill="#FFFFFF" fontSize="9" fontWeight="bold" textAnchor="middle">
                  🚌 APU Bus · {trip.departureTime}
                </text>
              </g>
            </g>
          </svg>
        )}

        {/* Live GPS Route HUD Overlay in bottom right */}
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-slate-950/90 border border-slate-700/80 text-[10px] text-slate-200 flex items-center gap-2 pointer-events-none z-10">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>
            {fromStop.shortCode} ➔ {toStop.shortCode}
          </span>
          <span className="text-emerald-400 font-bold">{Math.round(vehicleProgress)}%</span>
        </div>

        {/* Live Vehicle Simulator Buttons: allows driver to adjust vehicle position along route */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/85 border border-slate-700 text-[9px] text-slate-300 z-10">
          <span className="hidden sm:inline">Simulate:</span>
          <button
            onClick={() => setVehicleProgress(10)}
            className={`px-1.5 py-0.5 rounded cursor-pointer ${
              vehicleProgress <= 25 ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-slate-800'
            }`}
          >
            Bay
          </button>
          <button
            onClick={() => setVehicleProgress(50)}
            className={`px-1.5 py-0.5 rounded cursor-pointer ${
              vehicleProgress > 25 && vehicleProgress < 85
                ? 'bg-emerald-600 text-white font-bold'
                : 'hover:bg-slate-800'
            }`}
          >
            Highway
          </button>
          <button
            onClick={() => setVehicleProgress(95)}
            className={`px-1.5 py-0.5 rounded cursor-pointer ${
              vehicleProgress >= 85 ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-slate-800'
            }`}
          >
            Arrived
          </button>
        </div>
      </div>

      {/* Map Bottom Legend: Maps, Route, Car info */}
      <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400">
            <span className="w-2.5 h-0.5 bg-emerald-500 rounded-full" />
            <span>Route Line</span>
          </span>
          <span className="flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400">
            <span>🚌</span>
            <span>Bus Vehicle</span>
          </span>
          <span className="flex items-center gap-1 font-bold text-blue-700 dark:text-blue-400">
            <MapPin className="w-3 h-3" />
            <span>250m Stop Zones</span>
          </span>
        </div>
        <div className="text-[9px] text-zinc-500 truncate max-w-[200px]">
          {trip.routeName} · Bukit Jalil 57000
        </div>
      </div>
    </div>
  );
};
