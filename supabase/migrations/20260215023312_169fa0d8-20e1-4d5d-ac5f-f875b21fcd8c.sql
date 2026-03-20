
-- 1. Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'driver', 'parent');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: users can read their own roles, admins can manage all
CREATE POLICY "Users can read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 2. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Vans table
CREATE TABLE public.vans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  van_code TEXT NOT NULL UNIQUE,
  vehicle_number TEXT NOT NULL,
  route_name TEXT NOT NULL DEFAULT '',
  capacity INTEGER NOT NULL DEFAULT 18,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read vans" ON public.vans
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage vans" ON public.vans
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_vans_updated_at
  BEFORE UPDATE ON public.vans FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Drivers table
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  license_no TEXT NOT NULL,
  van_id UUID REFERENCES public.vans(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read drivers" ON public.drivers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage drivers" ON public.drivers
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can update own record" ON public.drivers
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER update_drivers_updated_at
  BEFORE UPDATE ON public.drivers FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT '',
  pickup_point TEXT NOT NULL DEFAULT '',
  parent_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  parent_phone TEXT,
  van_id UUID REFERENCES public.vans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'onboard', 'dropped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Parents can read own children" ON public.students
  FOR SELECT TO authenticated USING (parent_user_id = auth.uid());
CREATE POLICY "Admins can manage students" ON public.students
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can read assigned students" ON public.students
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.van_id = van_id
    )
  );
CREATE POLICY "Drivers can update student status" ON public.students
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.van_id = van_id
    )
  );

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Route points table
CREATE TABLE public.route_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id UUID REFERENCES public.vans(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  point_order INTEGER NOT NULL DEFAULT 0,
  point_type TEXT NOT NULL DEFAULT 'pickup' CHECK (point_type IN ('school', 'pickup', 'drop')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.route_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read route_points" ON public.route_points
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage route_points" ON public.route_points
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. Trips table
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  van_id UUID REFERENCES public.vans(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trips" ON public.trips
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage trips" ON public.trips
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can manage own trips" ON public.trips
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = auth.uid() AND d.id = driver_id)
  );

-- 8. Trip locations (real-time GPS pings)
CREATE TABLE public.trip_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION DEFAULT 0,
  heading DOUBLE PRECISION DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trip_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read trip_locations" ON public.trip_locations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Drivers can insert trip_locations" ON public.trip_locations
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trips t
      JOIN public.drivers d ON d.id = t.driver_id
      WHERE t.id = trip_id AND d.user_id = auth.uid()
    )
  );

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
