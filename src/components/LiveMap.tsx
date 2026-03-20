import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { useRoutePoints } from '@/hooks/useSupabaseData';

interface LiveMapProps {
  vanLat: number;
  vanLng: number;
  vanId?: string;
  showRoute?: boolean;
  showPickupPoints?: boolean;
  zoom?: number;
  className?: string;
}

const vanIcon = L.divIcon({
  html: `<div style="background: hsl(42 100% 50%); width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 3px solid hsl(220 60% 18%); box-shadow: 0 2px 8px rgba(0,0,0,0.3); font-size: 18px;">🚐</div>`,
  className: 'van-marker-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

const schoolIcon = L.divIcon({
  html: `<div style="background: hsl(220 60% 18%); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid hsl(42 100% 50%); box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 16px;">🏫</div>`,
  className: 'school-marker-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const pickupIcon = L.divIcon({
  html: `<div style="background: hsl(152 60% 42%); width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.2); font-size: 13px;">📍</div>`,
  className: 'pickup-marker-icon',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

const LiveMap = ({ vanLat, vanLng, vanId, showRoute = true, showPickupPoints = true, zoom = 14, className = '' }: LiveMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const vanMarkerRef = useRef<L.Marker | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const { data: schoolSettings } = useSchoolSettings();
  const { data: dbRoutePoints } = useRoutePoints(vanId);

  const schoolLat = schoolSettings?.school_lat || 24.88;
  const schoolLng = schoolSettings?.school_lng || 85.53;
  const schoolName = schoolSettings?.school_name || 'School';

  // Rebuild map when school location or route points change
  useEffect(() => {
    if (!mapRef.current || !schoolSettings) return;

    // Clean up previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      vanMarkerRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([schoolLat, schoolLng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // School marker
    L.marker([schoolLat, schoolLng], { icon: schoolIcon })
      .addTo(map)
      .bindPopup(`<strong>${schoolName}</strong>`);

    // Pickup points from database
    const points = dbRoutePoints || [];
    if (showPickupPoints && points.length > 0) {
      points.filter(p => p.point_type === 'pickup').forEach(point => {
        L.marker([point.lat, point.lng], { icon: pickupIcon })
          .addTo(map)
          .bindPopup(`<strong>${point.name}</strong><br/>Stop #${point.point_order}`);
      });
    }

    // Route line from database points
    if (showRoute && points.length > 0) {
      const routeCoords: L.LatLngExpression[] = points.map(p => [p.lat, p.lng]);
      L.polyline(routeCoords, {
        color: 'hsl(220, 60%, 18%)',
        weight: 4,
        opacity: 0.7,
        dashArray: '10, 6',
      }).addTo(map);
    }

    // Van marker
    const marker = L.marker([vanLat, vanLng], { icon: vanIcon }).addTo(map);
    vanMarkerRef.current = marker;

    mapInstanceRef.current = map;
    setIsLoaded(true);

    // Fit bounds to show all markers
    const allPoints: L.LatLngExpression[] = [[schoolLat, schoolLng], [vanLat, vanLng]];
    points.forEach(p => allPoints.push([p.lat, p.lng]));
    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [30, 30], maxZoom: 15 });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      vanMarkerRef.current = null;
    };
  }, [schoolLat, schoolLng, schoolName, dbRoutePoints]);

  // Update van position without rebuilding map
  useEffect(() => {
    if (vanMarkerRef.current) {
      vanMarkerRef.current.setLatLng([vanLat, vanLng]);
    }
  }, [vanLat, vanLng]);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border ${className}`}>
      <div ref={mapRef} className="h-full w-full min-h-[300px]" />
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="text-muted-foreground">Loading map...</div>
        </div>
      )}
    </div>
  );
};

export default LiveMap;
