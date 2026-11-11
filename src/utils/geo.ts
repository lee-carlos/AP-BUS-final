import { LocationCoord } from '../types/bus';

/**
 * Calculates Haversine great-circle distance between two GPS coordinates in meters.
 */
export function calculateDistanceMeters(coord1: LocationCoord, coord2: LocationCoord): number {
  const R = 6371e3; // Earth radius in meters
  const lat1Rad = (coord1.lat * Math.PI) / 180;
  const lat2Rad = (coord2.lat * Math.PI) / 180;
  const deltaLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
  const deltaLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Prototype agreed proximity parameters (Master Context v2.0 Section 8.4):
 * - APU Campus: 100 meters
 * - LRT Bukit Jalil: 120 meters
 * - Other stops: 100 meters
 * - Maximum allowable device GPS accuracy: 50 meters
 */
export const STOP_PROXIMITY_RADII: Record<string, number> = {
  apu: 100,
  lrt: 120,
};

export const DEFAULT_STOP_RADIUS_METERS = 100;
export const MAX_GPS_ACCURACY_METERS = 50;

export function getStopRadius(stopIdOrName?: string): number {
  if (!stopIdOrName) return DEFAULT_STOP_RADIUS_METERS;
  const key = stopIdOrName.toLowerCase();
  if (key.includes('lrt')) return 120;
  if (key.includes('apu')) return 100;
  return DEFAULT_STOP_RADIUS_METERS;
}

/**
 * Checks whether user coordinates are within allowable bus stop range.
 */
export function isWithinBusStopRange(
  userCoord: LocationCoord,
  stopCoord: LocationCoord,
  stopIdentifierOrRadius?: string | number,
  thresholdMetersOverride?: number
): { inRange: boolean; distanceMeters: number; thresholdMeters: number } {
  let thresholdMeters = DEFAULT_STOP_RADIUS_METERS;
  if (typeof thresholdMetersOverride === 'number') {
    thresholdMeters = thresholdMetersOverride;
  } else if (typeof stopIdentifierOrRadius === 'number') {
    thresholdMeters = stopIdentifierOrRadius;
  } else if (typeof stopIdentifierOrRadius === 'string') {
    thresholdMeters = getStopRadius(stopIdentifierOrRadius);
  }
  const dist = calculateDistanceMeters(userCoord, stopCoord);
  return {
    inRange: dist <= thresholdMeters,
    distanceMeters: dist,
    thresholdMeters,
  };
}

/**
 * Interpolates coordinates along a multi-point polyline given progress 0..1
 */
export function interpolateAlongPolyline(points: LocationCoord[], progress: number): LocationCoord {
  if (points.length === 0) return { lat: 3.0558, lng: 101.7003 };
  if (points.length === 1) return points[0];

  const clamped = Math.max(0, Math.min(1, progress));
  const totalSegments = points.length - 1;
  const targetIndex = clamped * totalSegments;
  const segmentIndex = Math.min(Math.floor(targetIndex), totalSegments - 1);
  const segmentProgress = targetIndex - segmentIndex;

  const p1 = points[segmentIndex];
  const p2 = points[segmentIndex + 1];

  return {
    lat: p1.lat + (p2.lat - p1.lat) * segmentProgress,
    lng: p1.lng + (p2.lng - p1.lng) * segmentProgress,
  };
}
