import { useState, useEffect, useRef } from 'react';
import { Bus, Clock, Phone, Bell, LogOut, User, Shield, History, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import RouteTracker from '@/components/RouteTracker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { toast } from 'sonner';

// Haversine distance in meters
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ParentDashboard = () => {
  const { user, signOut } = useAuth();
  const [vanLat, setVanLat] = useState(0);
  const [vanLng, setVanLng] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [pickupETA, setPickupETA] = useState<number | null>(null);
  const [sosDialogOpen, setSosDialogOpen] = useState(false);
  const approachAlertedRef = useRef(false);

  const { data: schoolSettings } = useSchoolSettings();

  // Fetch parent's children
  const { data: myStudents = [] } = useQuery({
    queryKey: ['my_students', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('*, vans(van_code, vehicle_number, route_name)')
        .eq('parent_user_id', user!.id);
      return data || [];
    },
  });

  const myStudent = myStudents[0];

  // Fetch driver for the student's van
  const { data: driver } = useQuery({
    queryKey: ['van_driver', myStudent?.van_id],
    enabled: !!myStudent?.van_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('drivers')
        .select('*')
        .eq('van_id', myStudent!.van_id)
        .maybeSingle();
      return data;
    },
  });

  // Fetch route points
  const { data: routePoints = [] } = useQuery({
    queryKey: ['route_points', myStudent?.van_id],
    enabled: !!myStudent?.van_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('route_points')
        .select('*')
        .eq('van_id', myStudent!.van_id)
        .order('point_order');
      return data || [];
    },
  });

  // Fetch active trip for this van — refetch every 30s
  const { data: activeTrip } = useQuery({
    queryKey: ['van_active_trip', myStudent?.van_id],
    enabled: !!myStudent?.van_id,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from('trips')
        .select('*')
        .eq('van_id', myStudent!.van_id)
        .eq('status', 'active')
        .maybeSingle();
      return data;
    },
  });

  // Fetch recent completed trips
  const { data: recentTrips = [] } = useQuery({
    queryKey: ['recent_trips', myStudent?.van_id],
    enabled: !!myStudent?.van_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('trips')
        .select('*, drivers(full_name)')
        .eq('van_id', myStudent!.van_id)
        .eq('status', 'completed')
        .order('ended_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  // Poll latest location every 30 seconds + realtime subscription
  useEffect(() => {
    if (!activeTrip?.id) {
      setVanLat(0);
      setVanLng(0);
      setSpeed(0);
      approachAlertedRef.current = false;
      return;
    }

    const fetchLatest = async () => {
      const { data } = await supabase
        .from('trip_locations')
        .select('*')
        .eq('trip_id', activeTrip.id)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setVanLat(data.lat);
        setVanLng(data.lng);
        setSpeed(data.speed || 0);
      }
    };

    // Fetch immediately
    fetchLatest();

    // Poll every 30 seconds
    const pollInterval = setInterval(fetchLatest, 30000);

    // Also subscribe to realtime for instant updates
    const channel = supabase
      .channel('trip-location-updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_locations', filter: `trip_id=eq.${activeTrip.id}` },
        (payload) => {
          const loc = payload.new as any;
          setVanLat(loc.lat);
          setVanLng(loc.lng);
          setSpeed(loc.speed || 0);
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [activeTrip?.id]);

  // Notify parent when van is within 1km of child's pickup stop
  useEffect(() => {
    if (!activeTrip || vanLat === 0 || !myStudent?.pickup_point || routePoints.length === 0) return;

    const pickupStop = routePoints.find((rp: any) => rp.name === myStudent.pickup_point);
    if (!pickupStop) return;

    const dist = haversineM(vanLat, vanLng, pickupStop.lat, pickupStop.lng);

    if (dist <= 1000 && !approachAlertedRef.current) {
      approachAlertedRef.current = true;
      toast.info(`🚐 Van is approaching ${myStudent.pickup_point}! (~${Math.round(dist)}m away)`, {
        id: 'van-approaching',
        duration: 10000,
      });
    }
    // Reset if van moves away > 1500m
    if (dist > 1500 && approachAlertedRef.current) {
      approachAlertedRef.current = false;
    }
  }, [vanLat, vanLng, activeTrip, myStudent, routePoints]);

  const handleEmergencyCall = () => {
    const phone = schoolSettings?.contact_phone;
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      toast.error('No emergency contact number set by the school.');
    }
    setSosDialogOpen(false);
  };

  const formatDuration = (start: string, end: string) => {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(ms / 60000);
    return `${mins} min`;
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-safe">
      <header className="sticky top-0 z-40 glass-card border-b border-border/50 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <Bus className="h-4 w-4 text-secondary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">VanTrack</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="relative h-10 w-10">
              <Bell className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {myStudent ? (
          <>
            {/* Student Card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card-elevated p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/10">
                  <User className="h-5 w-5 text-secondary" />
                </div>
                <div className="flex-1">
                  <h2 className="font-display font-semibold text-foreground">{myStudent.full_name}</h2>
                  <p className="text-sm text-muted-foreground">Class {myStudent.class} • {myStudent.pickup_point}</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                  </span>
                  <span className="text-xs font-medium text-success capitalize">{myStudent.status}</span>
                </div>
              </div>
            </motion.div>

            {/* ETA / Status Card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className={`rounded-xl p-4 ${activeTrip ? 'gradient-accent text-secondary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-80">{activeTrip ? 'Trip in Progress' : 'Trip Status'}</p>
                    {activeTrip ? (
                      <div className="flex items-baseline gap-3">
                        <div>
                          <p className="font-display text-3xl font-bold">
                            {pickupETA !== null ? `~${pickupETA} min` : '--'}
                          </p>
                          <p className="text-xs opacity-70">ETA to pickup</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg font-semibold">{speed.toFixed(0)} km/h</p>
                          <p className="text-xs opacity-70">Speed</p>
                        </div>
                      </div>
                    ) : (
                      <p className="font-display text-3xl font-bold">No active trip</p>
                    )}
                    {activeTrip && (
                      <p className="text-sm mt-1 opacity-80">
                        Van: {(myStudent as any).vans?.vehicle_number || 'N/A'}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    {activeTrip ? (
                      <Bus className="h-10 w-10 opacity-40" />
                    ) : (
                      <Clock className="h-10 w-10 opacity-30" />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Linear Route Tracker */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <RouteTracker
                stops={routePoints}
                vanLat={vanLat}
                vanLng={vanLng}
                tripActive={!!activeTrip}
                speed={speed}
                pickupStopName={myStudent.pickup_point}
                onETAUpdate={setPickupETA}
              />
            </motion.div>

            {/* Driver Card */}
            {driver && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4">
                <h3 className="mb-3 font-display font-semibold text-foreground flex items-center gap-2">
                  <Shield className="h-4 w-4 text-secondary" />
                  Driver Details
                </h3>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg">🧑‍✈️</div>
                    <div>
                      <p className="font-medium text-foreground">{driver.full_name}</p>
                      <p className="text-sm text-muted-foreground">License: {driver.license_no}</p>
                    </div>
                  </div>
                  <a href={`tel:${driver.phone}`}>
                    <Button size="sm" variant="outline" className="gap-1"><Phone className="h-4 w-4" /> Call</Button>
                  </a>
                </div>
              </motion.div>
            )}

            {/* Trip History */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass-card overflow-hidden">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex w-full items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                  <History className="h-4 w-4 text-secondary" />
                  Recent Trips ({recentTrips.length})
                </h3>
                {showHistory ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2">
                      {recentTrips.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No completed trips yet</p>
                      )}
                      {recentTrips.map((trip: any) => (
                        <div key={trip.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{formatDate(trip.started_at)}</p>
                            <p className="text-xs text-muted-foreground">
                              Driver: {trip.drivers?.full_name || 'N/A'}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-full">
                              Completed
                            </span>
                            {trip.started_at && trip.ended_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDuration(trip.started_at, trip.ended_at)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Emergency Button */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <Button
                variant="destructive"
                className="w-full font-semibold gap-2"
                size="lg"
                onClick={() => setSosDialogOpen(true)}
              >
                <AlertTriangle className="h-5 w-5" />
                🆘 Emergency Contact
              </Button>
            </motion.div>

            {/* SOS Confirmation Dialog */}
            <Dialog open={sosDialogOpen} onOpenChange={setSosDialogOpen}>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle className="font-display flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    Emergency Call
                  </DialogTitle>
                  <DialogDescription>
                    You are about to call the school's emergency contact number.
                    {schoolSettings?.contact_phone && (
                      <span className="block mt-2 font-semibold text-foreground text-lg">
                        📞 {schoolSettings.contact_phone}
                      </span>
                    )}
                    {!schoolSettings?.contact_phone && (
                      <span className="block mt-2 text-destructive">
                        No emergency number has been set by the school admin.
                      </span>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-3 mt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setSosDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1 gap-2"
                    onClick={handleEmergencyCall}
                    disabled={!schoolSettings?.contact_phone}
                  >
                    <Phone className="h-4 w-4" />
                    Call Now
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <div className="glass-card p-8 text-center">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="font-display font-semibold text-foreground mb-2">No Student Linked</h2>
            <p className="text-muted-foreground text-sm">Ask your school admin to link your child to your account.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ParentDashboard;
