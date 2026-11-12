import React, { useState, useEffect } from 'react';
import { BusTrip, BusStop, LocationCoord } from '../types/bus';
import { APU_STOPS } from '../data/apuRoutes';
import { MapPin, Navigation, Compass, Layers } from 'lucide-react';

interface DriverRouteMapProps {
  trip: BusTrip;
  busStatus: string; // 'On the Way' | 'Arrived' | 'Waiting' | 'Depart' | 'Not Available Now' | 'Expired'
  theme: 'light' | 'dark';
}

export const DriverRouteMap: React.FC<DriverRouteMapProps> = ({
  trip,
  busStatus,
  theme,
}) => {
  // Vehicle progress simulation along the route (0% at origin, 100% at destination)
  // By default, based on status:
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
  const fromStop = APU_STOPS.find((s) => s.id === trip.fromStopId) || {
    id: trip.fromStopId,
    name: 'LRT Bukit Jalil',
    shortCode: 'LRT-BJ',
    address: 'Jalan Merah Caga, Bukit Jalil, 57000 Kuala Lumpur',
  };

  const toStop = APU_STOPS.find((s) => s.id === trip.toStopId) || {
    id: trip.toStopId,
    name: 'APU Campus Terminal',
    shortCode: 'APU',
    address: 'Technology Park Malaysia, Bukit Jalil, 57000 Kuala Lumpur',
  };

  // SVG dimensions
  const viewBoxWidth = 600;
  const viewBoxHeight = 220;

  // Waypoints for the route path in SVG space:
  // (Start) LRT Bus Bay -> Jalan Merah Caga -> Lebuhraya Bukit Jalil -> TPM Gate -> (End) APU Campus Terminal
  const isReturn = trip.fromStopId === 'apu';

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

  // SVG curved path connecting the waypoints
  const pathD = isReturn
    ? 'M 530,70 C 480,75 460,85 440,85 C 380,85 350,125 310,130 C 260,135 220,155 190,155 C 140,155 100,160 70,160'
    : 'M 70,160 C 100,160 140,155 190,155 C 220,155 260,135 310,130 C 350,125 380,85 440,85 C 460,85 480,75 530,70';

  // Calculate vehicle coordinates along path based on progress (0% - 100%)
  // Simple parametric bezier approximation for smooth positioning
  const t = Math.max(0, Math.min(1, vehicleProgress / 100));

  const getVehiclePosition = (p: number) => {
    // Piecewise linear interpolation across the 5 waypoints for stable positioning
    const numSegments = routePoints.length - 1;
    const segment = Math.min(Math.floor(p * numSegments), numSegments - 1);
    const segT = (p * numSegments) - segment;

    const p0 = routePoints[segment];
    const p1 = routePoints[segment + 1];

    const currentX = p0.x + (p1.x - p0.x) * segT;
    const currentY = p0.y + (p1.y - p0.y) * segT;

    // Angle of motion
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
      {/* Top Map Header: Clean Corridor Info */}
      <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1.5 font-bold text-zinc-900 dark:text-white">
          <Navigation className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Kuala Lumpur, Bukit Jalil 57000 Transit Map</span>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-800">
            Live GPS Active
          </span>
          <span className="text-zinc-500">Speed: 36 km/h</span>
        </div>
      </div>

      {/* SVG Canvas Map Display (Maps + Route + Car/Bus Vehicle) */}
      <div className="relative w-full h-52 bg-slate-900 overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Map Grid Pattern */}
            <pattern id="roadGrid" width="30" height="30" patternUnits="userSpaceOnUse">
              <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1E293B" strokeWidth="0.75" />
            </pattern>

            {/* Route Gradient */}
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="50%" stopColor="#059669" />
              <stop offset="100%" stopColor="#3B82F6" />
            </linearGradient>

            {/* Glowing filter for route */}
            <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#10B981" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Map Base Background */}
          <rect width={viewBoxWidth} height={viewBoxHeight} fill="#0F172A" />
          <rect width={viewBoxWidth} height={viewBoxHeight} fill="url(#roadGrid)" />

          {/* Geographical Area Blocks: Bukit Jalil Tech Corridor & Park zones */}
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

          {/* Secondary Arterial Roads (Maps roads background) */}
          {/* Lebuhraya Bukit Jalil arterial road */}
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

          {/* Jalan Merah Caga connecting to LRT */}
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

          {/* TPM Avenue connecting to APU */}
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

          {/* ================================================================= */}
          {/* THE OFFICIAL SHUTTLE ROUTE (BOLD GLOWING TRANSIT LINE)            */}
          {/* ================================================================= */}
          {/* Route casing/shadow */}
          <path
            d={pathD}
            fill="none"
            stroke="#000000"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Glowing active route line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#routeGlow)"
          />
          {/* Route center directional dashes */}
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

          {/* Origin Stop Pin (Start) */}
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

          {/* Destination Stop Pin (End) */}
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

          {/* ================================================================= */}
          {/* VEHICLE GRAPHIC ("GAMBAR MOBIL" / SHUTTLE BUS)                   */}
          {/* ================================================================= */}
          <g transform={`translate(${vehiclePos.x}, ${vehiclePos.y})`}>
            {/* Live GPS Radar Pulse Beacon */}
            <circle r="22" fill="#10B981" fillOpacity="0.2" className="animate-ping" />
            <circle r="15" fill="#10B981" fillOpacity="0.3" />

            {/* Rotated Vehicle Body (Sleek APU Shuttle Bus Vector) */}
            <g transform={`rotate(${vehiclePos.angle})`}>
              {/* Bus shadow */}
              <rect x="-17" y="-9" width="34" height="18" rx="4" fill="#000000" fillOpacity="0.5" />

              {/* Main Bus Chassis (Emerald & Slate livery) */}
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

              {/* Front Windshield (Right facing by default) */}
              <rect x="7" y="-6" width="6" height="12" rx="1.5" fill="#E2E8F0" />
              {/* Side windows */}
              <rect x="-1" y="-6.5" width="6" height="2.5" rx="0.5" fill="#E2E8F0" />
              <rect x="-8" y="-6.5" width="5" height="2.5" rx="0.5" fill="#E2E8F0" />
              <rect x="-1" y="4" width="6" height="2.5" rx="0.5" fill="#E2E8F0" />
              <rect x="-8" y="4" width="5" height="2.5" rx="0.5" fill="#E2E8F0" />

              {/* Rear window */}
              <rect x="-14" y="-5" width="2" height="10" rx="0.5" fill="#E2E8F0" />

              {/* Roof AC Unit / Fleet ID */}
              <rect x="-6" y="-3" width="10" height="6" rx="1" fill="#047857" stroke="#10B981" strokeWidth="0.5" />

              {/* Headlights (Yellow beams) */}
              <polygon points="16,-4 26,-8 26,8 16,4" fill="#FDE047" fillOpacity="0.35" />
              <circle cx="15.5" cy="-5" r="1.5" fill="#FEF08A" />
              <circle cx="15.5" cy="5" r="1.5" fill="#FEF08A" />

              {/* Taillights */}
              <rect x="-16.5" y="-6" width="1" height="2" fill="#EF4444" />
              <rect x="-16.5" y="4" width="1" height="2" fill="#EF4444" />
            </g>

            {/* Vehicle Floating Status Callout Card */}
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

        {/* Live GPS Route HUD Overlay in bottom right */}
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-slate-950/90 border border-slate-700/80 text-[10px] text-slate-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Corridor: {fromStop.name.split(' ')[0]} ➔ {toStop.name.split(' ')[0]}</span>
          <span className="text-emerald-400 font-bold">{Math.round(vehicleProgress)}%</span>
        </div>

        {/* Live Vehicle Simulator Slider: allows driver to adjust/simulate vehicle location */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded bg-slate-950/80 border border-slate-700 text-[9px] text-slate-300">
          <span>Live Position:</span>
          <button
            onClick={() => setVehicleProgress(10)}
            className={`px-1 rounded ${vehicleProgress <= 25 ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-slate-800'}`}
          >
            Bay
          </button>
          <button
            onClick={() => setVehicleProgress(50)}
            className={`px-1 rounded ${vehicleProgress > 25 && vehicleProgress < 85 ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-slate-800'}`}
          >
            Highway
          </button>
          <button
            onClick={() => setVehicleProgress(95)}
            className={`px-1 rounded ${vehicleProgress >= 85 ? 'bg-emerald-600 text-white font-bold' : 'hover:bg-slate-800'}`}
          >
            Arrived
          </button>
        </div>
      </div>

      {/* Map Bottom Legend: Maps, Route, Car info */}
      <div className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-[10px] text-zinc-600 dark:text-zinc-400">
        <div className="flex items-center gap-2">
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
            <span>Stops</span>
          </span>
        </div>
        <div className="text-[9px] text-zinc-500 truncate max-w-[200px]">
          {trip.routeName} · Bukit Jalil 57000
        </div>
      </div>
    </div>
  );
};
