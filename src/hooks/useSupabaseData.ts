import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useVans = () => useQuery({
  queryKey: ['vans'],
  queryFn: async () => {
    const { data, error } = await supabase.from('vans').select('*').order('van_code');
    if (error) throw error;
    return data;
  },
});

export const useDrivers = () => useQuery({
  queryKey: ['drivers'],
  queryFn: async () => {
    const { data, error } = await supabase.from('drivers').select('*, vans(van_code, vehicle_number, route_name)');
    if (error) throw error;
    return data;
  },
});

export const useStudents = (vanId?: string) => useQuery({
  queryKey: ['students', vanId],
  queryFn: async () => {
    let query = supabase.from('students').select('*, vans(van_code, route_name)');
    if (vanId) query = query.eq('van_id', vanId);
    const { data, error } = await query.order('full_name');
    if (error) throw error;
    return data;
  },
});

export const useRoutePoints = (vanId?: string) => useQuery({
  queryKey: ['route_points', vanId],
  queryFn: async () => {
    let query = supabase.from('route_points').select('*');
    if (vanId) query = query.eq('van_id', vanId);
    const { data, error } = await query.order('point_order');
    if (error) throw error;
    return data;
  },
});

export const useTrips = (status?: string) => useQuery({
  queryKey: ['trips', status],
  queryFn: async () => {
    let query = supabase.from('trips').select('*, vans(van_code, vehicle_number), drivers(full_name)');
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const useActiveTrip = (driverUserId?: string) => useQuery({
  queryKey: ['active_trip', driverUserId],
  enabled: !!driverUserId,
  queryFn: async () => {
    // First get driver record
    const { data: driver } = await supabase
      .from('drivers')
      .select('id, van_id')
      .eq('user_id', driverUserId!)
      .single();
    if (!driver) return null;

    const { data: trip } = await supabase
      .from('trips')
      .select('*, vans(van_code, vehicle_number, route_name, capacity)')
      .eq('driver_id', driver.id)
      .eq('status', 'active')
      .maybeSingle();

    return { driver, trip };
  },
});

export const useLatestTripLocation = (tripId?: string) => useQuery({
  queryKey: ['trip_location', tripId],
  enabled: !!tripId,
  refetchInterval: 5000,
  queryFn: async () => {
    const { data, error } = await supabase
      .from('trip_locations')
      .select('*')
      .eq('trip_id', tripId!)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
});
