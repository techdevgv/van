import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, School, CheckCircle2, Clock, Navigation } from 'lucide-react';

interface RouteStop {
  id: string;
  name: string;
  point_type: string;
  point_order: number;
  lat: number;
  lng: number;
}

interface RouteTrackerProps {
  stops: RouteStop[];
  vanLat: number;
  vanLng: number;
  tripActive: boolean;
  speed?: number;
  className?: string;
  pickupStopName?: string;
  onETAUpdate?: (eta: number | null) => void;
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371e3;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getVanProgress(stops: RouteStop[], vanLat: number, vanLng: number, permanentlyPassed: Set<number>) {
  if (stops.length < 2) return { currentStopIndex: 0, progress: 0, passedStops: new Set<number>() };

  const REACHED_RADIUS = 100; // 100 meters to mark as done
  const passedStops = new Set<number>(permanentlyPassed);

  let closestIndex = 0;
  let closestDist = Infinity;

  for (let i = 0; i < stops.length; i++) {
    const dist = getDistance(vanLat, vanLng, stops[i].lat, stops[i].lng);
    if (dist < closestDist) {
      closestDist = dist;
      closestIndex = i;
    }
    // Mark as passed if within 100m
    if (dist <= REACHED_RADIUS) {
      for (let j = 0; j <= i; j++) {
        passedStops.add(j);
      }
    }
  }

  // If van is at a stop
  if (closestDist <= REACHED_RADIUS) {
    for (let i = 0; i <= closestIndex; i++) {
      passedStops.add(i);
    }
    return { currentStopIndex: closestIndex, progress: 0, passedStops };
  }

  // Van is between stops — find which segment
  for (let i = 0; i < stops.length - 1; i++) {
    const distToThis = getDistance(vanLat, vanLng, stops[i].lat, stops[i].lng);
    const distToNext = getDistance(vanLat, vanLng, stops[i + 1].lat, stops[i + 1].lng);
    const segLen = getDistance(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
    
    if (distToThis + distToNext <= segLen * 1.3) {
      for (let j = 0; j <= i; j++) passedStops.add(j);
      const progress = Math.min(distToThis / segLen, 1);
      return { currentStopIndex: i, progress, passedStops };
    }
  }

  // Fallback: use closest stop
  for (let i = 0; i < closestIndex; i++) passedStops.add(i);
  return { currentStopIndex: Math.max(0, closestIndex - 1), progress: 0.5, passedStops };
}

const RouteTracker = ({ stops, vanLat, vanLng, tripActive, speed = 0, className = '', pickupStopName, onETAUpdate }: RouteTrackerProps) => {
  // Permanently passed stops — once done, never undone during a trip
  const permanentlyPassedRef = useRef<Set<number>>(new Set());
  const [, forceUpdate] = useState(0);

  // Reset when trip ends
  useEffect(() => {
    if (!tripActive) {
      permanentlyPassedRef.current = new Set();
    }
  }, [tripActive]);

  const { currentStopIndex, progress, passedStops } = getVanProgress(stops, vanLat, vanLng, permanentlyPassedRef.current);

  // Merge newly passed stops into permanent set
  useEffect(() => {
    if (!tripActive) return;
    let changed = false;
    passedStops.forEach(idx => {
      if (!permanentlyPassedRef.current.has(idx)) {
        permanentlyPassedRef.current.add(idx);
        changed = true;
      }
    });
    if (changed) forceUpdate(v => v + 1);
  }, [tripActive, passedStops]);

  // Use permanent set for display
  const displayPassed = permanentlyPassedRef.current;

  // Calculate ETA based on real distance along route and current speed
  const getRouteDistanceToStop = (targetIndex: number): number => {
    if (targetIndex <= currentStopIndex) return 0;
    let distance = 0;
    const nextIdx = Math.min(currentStopIndex + 1, stops.length - 1);
    if (progress > 0 && currentStopIndex < stops.length - 1) {
      const segDist = getDistance(stops[currentStopIndex].lat, stops[currentStopIndex].lng, stops[nextIdx].lat, stops[nextIdx].lng);
      distance += segDist * (1 - progress);
    } else {
      distance += getDistance(vanLat, vanLng, stops[nextIdx].lat, stops[nextIdx].lng);
    }
    for (let i = nextIdx; i < targetIndex; i++) {
      distance += getDistance(stops[i].lat, stops[i].lng, stops[i + 1].lat, stops[i + 1].lng);
    }
    return distance;
  };

  const getETA = (stopIndex: number): number | null => {
    if (!tripActive) return null;
    if (displayPassed.has(stopIndex)) return null;
    const distMeters = getRouteDistanceToStop(stopIndex);
    if (speed < 1) {
      return (stopIndex - currentStopIndex) * 3;
    }
    const timeMinutes = (distMeters / 1000) / (speed / 60);
    return Math.max(1, Math.round(timeMinutes));
  };

  const totalETA = getETA(stops.length - 1);

  const pickupIndex = pickupStopName ? stops.findIndex(s => s.name === pickupStopName) : -1;
  const pickupETA = pickupIndex >= 0 ? getETA(pickupIndex) : null;

  useEffect(() => {
    onETAUpdate?.(pickupETA);
  }, [pickupETA, onETAUpdate]);

  return (
    <div className={`glass-card-elevated p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/10">
            <Navigation className="h-4 w-4 text-secondary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground text-sm">Live Route</h3>
            <p className="text-xs text-muted-foreground">
              {tripActive ? `${speed.toFixed(0)} km/h` : 'Trip not active'}
            </p>
          </div>
        </div>
        {tripActive && (
          <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-xs font-medium text-success">Live</span>
          </div>
        )}
      </div>

      {/* Linear Route */}
      <div className="relative">
        {stops.map((stop, index) => {
          const isPassed = tripActive && displayPassed.has(index) && index !== currentStopIndex;
          const isCurrent = tripActive && index === currentStopIndex && !displayPassed.has(index);
          const isUpcoming = !tripActive || (!isPassed && !isCurrent);
          const isLast = index === stops.length - 1;
          const eta = getETA(index);
          const isSchool = stop.point_type === 'school';
          // If it was permanently passed and is the current closest, still show as passed
          const isPassedCurrent = tripActive && displayPassed.has(index) && index === currentStopIndex;

          return (
            <div key={stop.id} className="relative">
              {/* Connector line */}
              {!isLast && (
                <div className="absolute left-[19px] top-[40px] w-[2px] h-[calc(100%-24px)]">
                  <div
                    className={`w-full h-full transition-colors duration-500 ${
                      isPassed || isPassedCurrent ? 'bg-success' : isCurrent ? 'bg-gradient-to-b from-success to-muted' : 'bg-border'
                    }`}
                  />
                  {/* Van position between stops */}
                  {isCurrent && tripActive && progress > 0 && (
                    <motion.div
                      initial={{ top: '0%' }}
                      animate={{ top: `${progress * 100}%` }}
                      transition={{ type: 'spring', damping: 20 }}
                      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
                    >
                      <div className="relative">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary border-3 border-secondary-foreground shadow-xl text-xl van-marker animate-pulse" style={{ boxShadow: '0 0 12px hsl(var(--secondary) / 0.6)' }}>
                          🚐
                        </div>
                        <div className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-success border-2 border-card">
                          <span className="text-[9px] text-success-foreground font-bold">{speed.toFixed(0)}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Stop node */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                className={`flex items-start gap-3 pb-5 relative ${isCurrent ? 'z-10' : ''}`}
              >
                {/* Stop marker */}
                <div className="flex-shrink-0 relative">
                  {isCurrent && tripActive && progress === 0 ? (
                    <div className="relative">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary border-3 border-secondary-foreground shadow-xl text-2xl van-marker" style={{ boxShadow: '0 0 14px hsl(var(--secondary) / 0.6)' }}>
                        🚐
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-success border-2 border-card">
                        <CheckCircle2 className="h-3 w-3 text-success-foreground" />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                        isPassed || isPassedCurrent
                          ? 'bg-success/10 border-success text-success'
                          : isSchool
                          ? 'bg-primary border-primary text-primary-foreground'
                          : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      {isPassed || isPassedCurrent ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : isSchool ? (
                        <School className="h-5 w-5" />
                      ) : (
                        <MapPin className="h-5 w-5" />
                      )}
                    </div>
                  )}
                </div>

                {/* Stop info */}
                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p
                        className={`text-sm font-medium transition-colors ${
                          isPassed || isPassedCurrent ? 'text-success' : isCurrent ? 'text-foreground font-semibold' : 'text-foreground'
                        }`}
                      >
                        {stop.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isSchool ? 'School' : `Stop #${stop.point_order}`}
                        {(isPassed || isPassedCurrent) && ' • Passed ✓'}
                        {isCurrent && tripActive && ' • Current Location'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {(isPassed || isPassedCurrent) && (
                        <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                          Done
                        </span>
                      )}
                      {isCurrent && tripActive && (
                        <span className="text-xs font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded-full">
                          Here
                        </span>
                      )}
                      {eta !== null && !isPassed && !isCurrent && !isPassedCurrent && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="text-xs font-medium">{eta} min</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Trip summary bar */}
      {tripActive && stops.length > 1 && (
        <div className="mt-2 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {displayPassed.size} of {stops.length} stops completed
            </span>
            <span className="text-muted-foreground">
              ~{totalETA ?? '--'} min remaining
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-success to-secondary"
              initial={{ width: 0 }}
              animate={{ width: `${(displayPassed.size / stops.length) * 100}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteTracker;
