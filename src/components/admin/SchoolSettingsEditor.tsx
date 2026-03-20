import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSchoolSettings, useUpdateSchoolSettings } from '@/hooks/useSchoolSettings';
import { toast } from 'sonner';
import { MapPin, Save, Loader2, LocateFixed } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const SchoolSettingsEditor = () => {
  const { data: settings, isLoading } = useSchoolSettings();
  const mutation = useUpdateSchoolSettings();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const [form, setForm] = useState({
    school_name: '',
    school_tagline: '',
    school_description: '',
    school_lat: 24.88,
    school_lng: 85.53,
    contact_phone: '',
    contact_email: '',
    hero_stats: '[]',
  });

  useEffect(() => {
    if (settings) {
      setForm({
        school_name: settings.school_name || '',
        school_tagline: settings.school_tagline || '',
        school_description: settings.school_description || '',
        school_lat: settings.school_lat || 24.88,
        school_lng: settings.school_lng || 85.53,
        contact_phone: settings.contact_phone || '',
        contact_email: settings.contact_email || '',
        hero_stats: JSON.stringify(settings.hero_stats || [], null, 2),
      });
    }
  }, [settings]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current).setView([form.school_lat, form.school_lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
    }).addTo(map);

    const marker = L.marker([form.school_lat, form.school_lng], { draggable: true }).addTo(map);
    marker.bindPopup('School Location').openPopup();
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setForm(f => ({ ...f, school_lat: pos.lat, school_lng: pos.lng }));
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      setForm(f => ({ ...f, school_lat: e.latlng.lat, school_lng: e.latlng.lng }));
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    setTimeout(() => map.invalidateSize(), 300);

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, [settings]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng([form.school_lat, form.school_lng]);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([form.school_lat, form.school_lng]);
    }
  }, [form.school_lat, form.school_lng]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, school_lat: pos.coords.latitude, school_lng: pos.coords.longitude }));
        toast.success('Location updated to your current position');
      },
      (err) => toast.error(`Location error: ${err.message}`),
      { enableHighAccuracy: true }
    );
  };

  const handleSave = () => {
    let parsedStats;
    try {
      parsedStats = JSON.parse(form.hero_stats);
    } catch {
      parsedStats = [];
    }
    mutation.mutate({
      school_name: form.school_name,
      school_tagline: form.school_tagline,
      school_description: form.school_description,
      school_lat: form.school_lat,
      school_lng: form.school_lng,
      contact_phone: form.contact_phone,
      contact_email: form.contact_email,
      hero_stats: parsedStats,
    });
  };

  if (isLoading) return <div className="flex items-center justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 lg:p-6 space-y-4">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <MapPin className="h-5 w-5 text-secondary" /> School Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>School Name</Label>
            <Input value={form.school_name} onChange={e => setForm(f => ({ ...f, school_name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Contact Phone</Label>
            <Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Contact Email</Label>
            <Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} />
          </div>
        </div>
      </div>

      <div className="glass-card p-4 lg:p-6 space-y-4">
        <h3 className="font-display font-semibold text-foreground">Landing Page Content</h3>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Hero Tagline</Label>
            <Input value={form.school_tagline} onChange={e => setForm(f => ({ ...f, school_tagline: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Hero Description</Label>
            <Textarea value={form.school_description} onChange={e => setForm(f => ({ ...f, school_description: e.target.value }))} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Stats (JSON)</Label>
            <Textarea value={form.hero_stats} onChange={e => setForm(f => ({ ...f, hero_stats: e.target.value }))} rows={5} className="font-mono text-xs" />
          </div>
        </div>
      </div>

      <div className="glass-card p-4 lg:p-6 space-y-4">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <MapPin className="h-5 w-5 text-secondary" /> School Location
        </h3>
        <p className="text-sm text-muted-foreground">Click or drag the marker to set the school's GPS location.</p>
        <Button variant="outline" size="sm" onClick={handleUseMyLocation} className="gap-2">
          <LocateFixed className="h-4 w-4" /> Use My Current Location
        </Button>
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="space-y-1">
            <Label className="text-xs">Latitude</Label>
            <Input type="number" step="any" value={form.school_lat} onChange={e => setForm(f => ({ ...f, school_lat: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Longitude</Label>
            <Input type="number" step="any" value={form.school_lng} onChange={e => setForm(f => ({ ...f, school_lng: parseFloat(e.target.value) || 0 }))} />
          </div>
        </div>
        <div ref={mapRef} className="h-[300px] rounded-lg border border-border z-0" />
      </div>

      <Button onClick={handleSave} disabled={mutation.isPending} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Save Settings
      </Button>
    </div>
  );
};

export default SchoolSettingsEditor;
