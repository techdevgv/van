import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';

interface UseDriverGpsOptions {
  tripActive: boolean;
  onPositionUpdate?: (lat: number, lng: number, speed: number) => void;
}

export const useDriverGps = ({ tripActive, onPositionUpdate }: UseDriverGpsOptions) => {
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsAvailable, setGpsAvailable] = useState(true);
  const watchRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearWatch = useCallback(() => {
    if (watchRef.current !== null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('GPS not available on this device');
      setGpsAvailable(false);
      return;
    }

    clearWatch();

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed: s } = pos.coords;
        setLat(latitude);
        setLng(longitude);
        const kmh = s ? s * 3.6 : 0;
        setSpeed(kmh);
        setGpsError(null);
        setGpsAvailable(true);
        onPositionUpdate?.(latitude, longitude, kmh);
      },
      (err) => {
        console.error('GPS error:', err);
        setGpsError(err.message);
        setGpsAvailable(false);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
    watchRef.current = id;
  }, [clearWatch, onPositionUpdate]);

  // Auto-retry GPS when it goes off during an active trip
  useEffect(() => {
    if (tripActive && !gpsAvailable) {
      const retry = () => {
        toast.error('GPS signal lost. Trying to reconnect...', { id: 'gps-retry' });
        startWatching();
        retryTimeoutRef.current = setTimeout(retry, 10000);
      };
      retryTimeoutRef.current = setTimeout(retry, 5000);
      return () => {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      };
    }
    if (gpsAvailable && retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
      toast.success('GPS reconnected!', { id: 'gps-retry' });
    }
  }, [tripActive, gpsAvailable, startWatching]);

  useEffect(() => {
    if (tripActive) {
      startWatching();
    } else {
      clearWatch();
    }
    return clearWatch;
  }, [tripActive, startWatching, clearWatch]);

  /** Check GPS once (for pre-trip validation). Returns true if GPS acquired. */
  const checkGps = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        resolve(false);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setGpsAvailable(true);
          setGpsError(null);
          resolve(true);
        },
        () => {
          setGpsAvailable(false);
          resolve(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  return { lat, lng, speed, gpsError, gpsAvailable, checkGps };
};
