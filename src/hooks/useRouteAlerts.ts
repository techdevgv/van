import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

interface RoutePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  point_type: string;
  point_order: number;
}

// Haversine distance in meters
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Minimum distance from point to polyline defined by ordered stops (in meters) */
function minDistToRoute(lat: number, lng: number, stops: RoutePoint[]): number {
  if (stops.length === 0) return 0;
  if (stops.length === 1) return haversineM(lat, lng, stops[0].lat, stops[0].lng);

  let min = Infinity;
  for (let i = 0; i < stops.length; i++) {
    const d = haversineM(lat, lng, stops[i].lat, stops[i].lng);
    if (d < min) min = d;
  }
  return min;
}

interface UseRouteAlertsOptions {
  tripActive: boolean;
  vanLat: number;
  vanLng: number;
  routePoints: RoutePoint[];
}

export const useRouteAlerts = ({ tripActive, vanLat, vanLng, routePoints }: UseRouteAlertsOptions) => {
  const deviationShownRef = useRef(false);
  const nearbyAlertedRef = useRef<Set<string>>(new Set());

  // Reset alerts when trip starts/stops
  useEffect(() => {
    if (!tripActive) {
      deviationShownRef.current = false;
      nearbyAlertedRef.current = new Set();
    }
  }, [tripActive]);

  useEffect(() => {
    if (!tripActive || vanLat === 0 || routePoints.length === 0) return;

    // --- Route deviation check (1000m) ---
    const dist = minDistToRoute(vanLat, vanLng, routePoints);
    if (dist > 1000) {
      if (!deviationShownRef.current) {
        deviationShownRef.current = true;
        toast.warning('⚠️ You are off route! You have deviated more than 1 km from the planned route.', {
          id: 'route-deviation',
          duration: 8000,
        });
      }
    } else {
      if (deviationShownRef.current) {
        deviationShownRef.current = false;
        toast.success('✅ Back on route!', { id: 'route-deviation', duration: 3000 });
      }
    }

    // --- Stop proximity check (1000m) ---
    for (const point of routePoints) {
      const d = haversineM(vanLat, vanLng, point.lat, point.lng);
      if (d <= 1000 && !nearbyAlertedRef.current.has(point.id)) {
        nearbyAlertedRef.current.add(point.id);
        toast.info(`📍 Approaching: ${point.name} (${Math.round(d)}m away)`, {
          id: `stop-${point.id}`,
          duration: 6000,
        });
      }
      // Re-enable alert if driver moves away (>1500m) and comes back
      if (d > 1500 && nearbyAlertedRef.current.has(point.id)) {
        nearbyAlertedRef.current.delete(point.id);
      }
    }
  }, [tripActive, vanLat, vanLng, routePoints]);
};
