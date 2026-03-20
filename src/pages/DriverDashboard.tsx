import { useState, useEffect } from 'react';
import { Bus, MapPin, Users, Play, Square, LogOut, CheckCircle2, UserCheck, UserX, Navigation } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import RouteTracker from '@/components/RouteTracker';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useDriverGps } from '@/hooks/useDriverGps';
import { useRouteAlerts } from '@/hooks/useRouteAlerts';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const DriverDashboard = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [tripActive, setTripActive] = useState(false);
  const [gpsDialogOpen, setGpsDialogOpen] = useState(false);
  const [gpsChecking, setGpsChecking] = useState(false);

  // Fetch driver record
  const { data: driver } = useQuery({
    queryKey: ['my_driver', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('drivers')
        .select('*, vans(id, van_code, vehicle_number, route_name, capacity)')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const van = (driver as any)?.vans;

  // Fetch students for this van
  const { data: vanStudents = [] } = useQuery({
    queryKey: ['van_students', van?.id],
    enabled: !!van?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('students')
        .select('*')
        .eq('van_id', van!.id)
        .order('full_name');
      return data || [];
    },
  });

  // Fetch route points
  const { data: routePoints = [] } = useQuery({
    queryKey: ['driver_route_points', van?.id],
    enabled: !!van?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('route_points')
        .select('*')
        .eq('van_id', van!.id)
        .order('point_order');
      return data || [];
    },
  });

  // Fetch active trip
  const { data: activeTrip } = useQuery({
    queryKey: ['my_active_trip', driver?.id],
    enabled: !!driver?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('trips')
        .select('*')
        .eq('driver_id', driver!.id)
        .eq('status', 'active')
        .maybeSingle();
      return data;
    },
  });

  // GPS hook
  const { lat: vanLat, lng: vanLng, speed, gpsError, gpsAvailable, checkGps } = useDriverGps({
    tripActive,
  });

  // Route alerts hook — deviation + stop proximity
  useRouteAlerts({ tripActive, vanLat, vanLng, routePoints });

  // Restore active trip on load
  useEffect(() => {
    if (activeTrip) {
      setTripActive(true);
      const startedMs = new Date(activeTrip.started_at!).getTime();
      setElapsed(Math.floor((Date.now() - startedMs) / 1000));
    }
  }, [activeTrip]);

  // Elapsed timer
  useEffect(() => {
    if (!tripActive) return;
    const interval = setInterval(() => setElapsed(prev => prev + 1), 1000);
    return () => clearInterval(interval);
  }, [tripActive]);

  // Broadcast location every 5 seconds
  useEffect(() => {
    if (!tripActive || !activeTrip) return;
    const interval = setInterval(async () => {
      if (vanLat !== 0 && vanLng !== 0) {
        await supabase.from('trip_locations').insert({
          trip_id: activeTrip.id,
          lat: vanLat,
          lng: vanLng,
          speed,
          heading: 0,
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [tripActive, activeTrip, vanLat, vanLng, speed]);

  // Show GPS dialog when GPS lost during active trip
  useEffect(() => {
    if (tripActive && !gpsAvailable && gpsError) {
      setGpsDialogOpen(true);
    }
  }, [tripActive, gpsAvailable, gpsError]);

  // Auto-dismiss dialog when GPS comes back
  useEffect(() => {
    if (gpsAvailable && gpsDialogOpen && tripActive) {
      setGpsDialogOpen(false);
    }
  }, [gpsAvailable, gpsDialogOpen, tripActive]);

  const handleToggleTrip = async () => {
    if (!driver || !van) {
      toast.error('No van assigned to your account');
      return;
    }

    if (tripActive && activeTrip) {
      // End trip
      await supabase.from('trips').update({ status: 'completed', ended_at: new Date().toISOString() }).eq('id', activeTrip.id);
      await supabase.from('students').update({ status: 'waiting' }).eq('van_id', van.id);
      setTripActive(false);
      setElapsed(0);
      toast.success('Trip ended');
    } else {
      // Check GPS before starting
      setGpsChecking(true);
      const hasGps = await checkGps();
      setGpsChecking(false);

      if (!hasGps) {
        setGpsDialogOpen(true);
        return; // Don't start trip without GPS
      }

      const { error } = await supabase.from('trips').insert({
        van_id: van.id,
        driver_id: driver.id,
        status: 'active',
        started_at: new Date().toISOString(),
      });
      if (error) {
        toast.error('Failed to start trip');
        return;
      }
      setTripActive(true);
      setElapsed(0);
      toast.success('Trip started! GPS tracking is now active.');
    }
    queryClient.invalidateQueries({ queryKey: ['my_active_trip'] });
    queryClient.invalidateQueries({ queryKey: ['van_students'] });
  };

  const handleRetryGps = async () => {
    setGpsChecking(true);
    const ok = await checkGps();
    setGpsChecking(false);
    if (ok) {
      setGpsDialogOpen(false);
      toast.success('GPS is now active!');
    } else {
      toast.error('GPS still unavailable. Please enable location services.');
    }
  };

  const toggleStudentStatus = async (studentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'onboard' ? 'waiting' : 'onboard';
    await supabase.from('students').update({ status: newStatus }).eq('id', studentId);
    queryClient.invalidateQueries({ queryKey: ['van_students'] });
    toast.success(newStatus === 'onboard' ? 'Student picked up' : 'Student dropped off');
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const onboardCount = vanStudents.filter((s: any) => s.status === 'onboard').length;

  return (
    <div className="min-h-[100dvh] bg-background pb-safe">
      {/* GPS Required Dialog */}
      <AlertDialog open={gpsDialogOpen} onOpenChange={setGpsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-destructive" />
              {tripActive ? 'GPS Signal Lost' : 'GPS Required'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                {tripActive
                  ? 'Your GPS signal has been lost during the trip. Please enable location services to continue tracking.'
                  : 'GPS must be enabled before starting a trip. Please turn on your device\'s location services and try again.'}
              </p>
              <p className="text-xs text-muted-foreground">
                Go to your device Settings → Location → Turn On GPS/Location Services
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleRetryGps}
              disabled={gpsChecking}
              className="gap-2 bg-primary text-primary-foreground"
            >
              <Navigation className="h-4 w-4" />
              {gpsChecking ? 'Checking GPS...' : 'Retry GPS'}
            </Button>
            {tripActive && (
              <AlertDialogAction onClick={() => setGpsDialogOpen(false)} className="bg-muted text-muted-foreground hover:bg-muted/80">
                Continue Without GPS
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <header className="sticky top-0 z-40 glass-card border-b border-border/50 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <Bus className="h-4 w-4 text-secondary-foreground" />
            </div>
            <div>
              <span className="font-display font-bold text-foreground text-sm">Driver Panel</span>
              <p className="text-xs text-muted-foreground">{driver?.full_name || 'Loading...'}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4 space-y-4">
        {driver ? (
          <>
            {/* Trip Control */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className={`rounded-xl p-5 text-center ${tripActive ? 'bg-success text-success-foreground' : 'gradient-hero text-primary-foreground'}`}>
                <p className="text-sm font-medium opacity-80 mb-1">{tripActive ? 'Trip In Progress — GPS Active' : 'Ready to Start'}</p>
                {gpsError && tripActive && (
                  <button onClick={() => setGpsDialogOpen(true)} className="text-xs bg-destructive/20 text-destructive-foreground rounded px-2 py-1 mb-2 cursor-pointer hover:bg-destructive/30 transition-colors">
                    ⚠️ GPS: {gpsError} — Tap to retry
                  </button>
                )}
                {tripActive && (
                  <div className="flex items-center justify-center gap-6 mb-3">
                    <div>
                      <p className="font-display text-3xl font-bold">{formatTime(elapsed)}</p>
                      <p className="text-xs opacity-70">Duration</p>
                    </div>
                    <div className="w-px h-10 bg-current opacity-20" />
                    <div>
                      <p className="font-display text-3xl font-bold">{speed.toFixed(0)}</p>
                      <p className="text-xs opacity-70">km/h</p>
                    </div>
                    <div className="w-px h-10 bg-current opacity-20" />
                    <div>
                      <p className="font-display text-3xl font-bold">{onboardCount}</p>
                      <p className="text-xs opacity-70">Onboard</p>
                    </div>
                  </div>
                )}
                <Button size="lg" onClick={handleToggleTrip} disabled={gpsChecking}
                  className={`font-semibold gap-2 h-12 text-base active:scale-[0.97] transition-transform ${tripActive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'}`}
                >
                  {gpsChecking ? (
                    <><Navigation className="h-5 w-5 animate-pulse" /> Checking GPS...</>
                  ) : tripActive ? (
                    <><Square className="h-5 w-5" /> End Trip</>
                  ) : (
                    <><Play className="h-5 w-5" /> Start Trip</>
                  )}
                </Button>
              </div>
            </motion.div>

            {/* Vehicle Info */}
            {van && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Vehicle</p>
                    <p className="font-display font-semibold text-foreground text-sm">{van.vehicle_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Route</p>
                    <p className="font-display font-semibold text-foreground text-sm">{van.route_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Students</p>
                    <p className="font-display font-semibold text-foreground text-sm">{onboardCount}/{vanStudents.length}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Route Tracker */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <RouteTracker
                stops={routePoints}
                vanLat={vanLat}
                vanLng={vanLng}
                tripActive={tripActive}
                speed={speed}
              />
            </motion.div>

            {/* Student Attendance */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass-card p-4">
              <h3 className="mb-3 font-display font-semibold text-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-secondary" /> Attendance ({onboardCount}/{vanStudents.length})
              </h3>
              <div className="space-y-2">
                {vanStudents.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold ${
                        s.status === 'onboard' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                      }`}>
                        {s.status === 'onboard' ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> {s.pickup_point}</p>
                      </div>
                    </div>
                    {tripActive ? (
                      <Button
                        size="sm"
                        variant={s.status === 'onboard' ? 'outline' : 'default'}
                        onClick={() => toggleStudentStatus(s.id, s.status)}
                        className={`gap-1 text-xs h-9 min-w-[80px] active:scale-95 transition-transform ${s.status === 'onboard' ? '' : 'bg-success text-success-foreground hover:bg-success/90'}`}
                      >
                        {s.status === 'onboard' ? <>Drop Off</> : <><CheckCircle2 className="h-3 w-3" /> Pick Up</>}
                      </Button>
                    ) : (
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.status === 'onboard' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                      }`}>{s.status === 'onboard' ? 'Onboard' : 'Waiting'}</span>
                    )}
                  </div>
                ))}
                {vanStudents.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No students assigned</p>
                )}
              </div>
            </motion.div>
          </>
        ) : (
          <div className="glass-card p-8 text-center">
            <Bus className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="font-display font-semibold text-foreground mb-2">No Driver Profile</h2>
            <p className="text-muted-foreground text-sm">Ask your admin to link your account to a driver profile.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default DriverDashboard;
