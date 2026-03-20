import { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2, GripVertical, MapPin, School, Plus, Save } from 'lucide-react';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';

interface RouteStop {
  id?: string;
  name: string;
  lat: number;
  lng: number;
  point_order: number;
  point_type: string;
}

interface RouteStopEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vanId: string;
  vanCode: string;
}

const createStopIcon = () => L.divIcon({
  html: `<div style="background: hsl(152 60% 42%); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 14px; color: white; font-weight: bold;">📍</div>`,
  className: 'stop-marker-icon',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const createSchoolIcon = () => L.divIcon({
  html: `<div style="background: hsl(220 60% 18%); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid hsl(42 100% 50%); box-shadow: 0 2px 8px rgba(0,0,0,0.2); font-size: 16px;">🏫</div>`,
  className: 'school-marker-icon',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const RouteStopEditor = ({ open, onOpenChange, vanId, vanCode }: RouteStopEditorProps) => {
  const queryClient = useQueryClient();
  const { data: schoolSettings, isLoading: settingsLoading } = useSchoolSettings();
  const schoolLat = schoolSettings?.school_lat ?? 24.88;
  const schoolLng = schoolSettings?.school_lng ?? 85.53;
  const schoolName = schoolSettings?.school_name ?? 'School';
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const polylineRef = useRef<L.Polyline | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [addMode, setAddMode] = useState(false);
  const addModeRef = useRef(false);
  const mapInitializedRef = useRef(false);

  useEffect(() => {
    addModeRef.current = addMode;
  }, [addMode]);

  // Load existing stops
  useEffect(() => {
    if (!open || !vanId || settingsLoading) return;
    mapInitializedRef.current = false;
    const fetchStops = async () => {
      const { data } = await supabase
        .from('route_points')
        .select('*')
        .eq('van_id', vanId)
        .order('point_order');
      if (data && data.length > 0) {
        // Always use current school settings coordinates for school stops (DB may have stale values)
        setStops(data.map(d => ({
          id: d.id,
          name: d.point_type === 'school' ? schoolName : d.name,
          lat: d.point_type === 'school' ? schoolLat : d.lat,
          lng: d.point_type === 'school' ? schoolLng : d.lng,
          point_order: d.point_order,
          point_type: d.point_type,
        })));
      } else {
        setStops([{ name: schoolName, lat: schoolLat, lng: schoolLng, point_order: 0, point_type: 'school' }]);
      }
    };
    fetchStops();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      markersRef.current = [];
      polylineRef.current = null;
      mapInitializedRef.current = false;
      setAddMode(false);
    };
  }, [open, vanId, settingsLoading, schoolLat, schoolLng, schoolName]);

  const updateMapMarkers = useCallback((map: L.Map, currentStops: RouteStop[]) => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    polylineRef.current?.remove();

    currentStops.forEach((stop, index) => {
      const icon = stop.point_type === 'school' ? createSchoolIcon() : createStopIcon();
      const marker = L.marker([stop.lat, stop.lng], { icon, draggable: stop.point_type !== 'school' })
        .addTo(map)
        .bindPopup(`<strong>${stop.name}</strong><br/>Stop #${index}`);

      if (stop.point_type !== 'school') {
        marker.on('dragend', (e) => {
          const latlng = (e.target as L.Marker).getLatLng();
          setStops(prev => prev.map((s, i) => i === index ? { ...s, lat: latlng.lat, lng: latlng.lng } : s));
        });
      }
      markersRef.current.push(marker);
    });

    if (currentStops.length > 1) {
      const coords: L.LatLngExpression[] = currentStops.map(s => [s.lat, s.lng]);
      polylineRef.current = L.polyline(coords, {
        color: 'hsl(220, 60%, 18%)',
        weight: 3,
        opacity: 0.7,
        dashArray: '8, 5',
      }).addTo(map);
    }

    if (currentStops.length > 0) {
      const bounds = L.latLngBounds(currentStops.map(s => [s.lat, s.lng] as L.LatLngExpression));
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, []);

  // Initialize map after dialog renders - use MutationObserver pattern
  useEffect(() => {
    if (!open || mapInitializedRef.current) return;

    const tryInitMap = () => {
      const container = mapContainerRef.current;
      if (!container || container.clientHeight === 0) return false;
      if (mapInstanceRef.current) return true;

      const map = L.map(container, {
        zoomControl: true,
        attributionControl: false,
      }).setView([schoolLat, schoolLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        if (!addModeRef.current) return;
        const { lat, lng } = e.latlng;
        setStops(prev => {
          const newStops = [
            ...prev,
            { name: `Stop ${prev.length}`, lat, lng, point_order: prev.length, point_type: 'pickup' },
          ];
          return newStops;
        });
        setAddMode(false);
      });

      mapInstanceRef.current = map;
      mapInitializedRef.current = true;

      // Force a resize after a tick to ensure tiles load
      setTimeout(() => map.invalidateSize(), 100);
      return true;
    };

    // Try immediately, then retry with increasing delays
    if (!tryInitMap()) {
      const timers = [100, 300, 600, 1000].map(delay =>
        setTimeout(() => {
          if (!mapInitializedRef.current) tryInitMap();
        }, delay)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [open]);

  // Update markers when stops change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map) {
      updateMapMarkers(map, stops);
    }
  }, [stops, updateMapMarkers]);

  // Update cursor when addMode changes
  useEffect(() => {
    const container = mapInstanceRef.current?.getContainer();
    if (container) {
      container.style.cursor = addMode ? 'crosshair' : '';
    }
  }, [addMode]);

  const handleRemoveStop = (index: number) => {
    if (stops[index].point_type === 'school') return;
    setStops(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, point_order: i })));
  };

  const handleNameChange = (index: number, name: string) => {
    setStops(prev => prev.map((s, i) => i === index ? { ...s, name } : s));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await supabase.from('route_points').delete().eq('van_id', vanId);
      const inserts = stops.map((s, i) => ({
        van_id: vanId,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        point_order: i,
        point_type: s.point_type,
      }));
      const { error } = await supabase.from('route_points').insert(inserts);
      if (error) throw error;
      toast.success(`Saved ${stops.length} route stops for ${vanCode}`);
      queryClient.invalidateQueries({ queryKey: ['route_points'] });
      queryClient.invalidateQueries({ queryKey: ['driver_route_points'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save route');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto z-[1100]">
        <DialogHeader>
          <DialogTitle className="font-display">Route Editor — {vanCode}</DialogTitle>
          <DialogDescription>Click "Add Stop" then click the map to place pickup stops along the route.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-4">
          <div className="relative">
            <div ref={mapContainerRef} style={{ height: '400px', width: '100%' }} className="rounded-xl border border-border z-0" />
            <div className="absolute top-3 left-3 z-[1000]">
              <Button
                size="sm"
                variant={addMode ? 'default' : 'outline'}
                onClick={() => setAddMode(!addMode)}
                className={`gap-1 shadow-md ${addMode ? 'bg-secondary text-secondary-foreground' : 'bg-card'}`}
              >
                <Plus className="h-4 w-4" />
                {addMode ? 'Click map to place stop' : 'Add Stop'}
              </Button>
            </div>
            {addMode && (
              <div className="absolute bottom-3 left-3 right-3 z-[1000] bg-secondary text-secondary-foreground rounded-lg px-3 py-2 text-sm font-medium text-center shadow-lg">
                👆 Click anywhere on the map to place a new stop
              </div>
            )}
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Stops ({stops.length})</p>
            {stops.map((stop, index) => (
              <div key={index} className="flex items-center gap-2 rounded-lg border border-border p-2 bg-card">
                <div className="flex-shrink-0 text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="flex-shrink-0">
                  {stop.point_type === 'school' ? (
                    <School className="h-4 w-4 text-primary" />
                  ) : (
                    <MapPin className="h-4 w-4 text-success" />
                  )}
                </div>
                <Input
                  value={stop.name}
                  onChange={(e) => handleNameChange(index, e.target.value)}
                  className="h-7 text-xs"
                  disabled={stop.point_type === 'school'}
                />
                {stop.point_type !== 'school' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => handleRemoveStop(index)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading} className="gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/90">
            <Save className="h-4 w-4" />
            {loading ? 'Saving...' : 'Save Route'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteStopEditor;
