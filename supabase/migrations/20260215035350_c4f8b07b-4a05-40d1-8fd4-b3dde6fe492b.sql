
-- Create school_settings table (single-row config table)
CREATE TABLE public.school_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name text NOT NULL DEFAULT 'Gyanoday Vidyalay',
  school_tagline text NOT NULL DEFAULT 'Know Where Your Child Is, Every Moment',
  school_description text NOT NULL DEFAULT 'Real-time school van tracking for parents, drivers, and school administrators. Safe, reliable, and always connected.',
  school_lat double precision NOT NULL DEFAULT 24.88,
  school_lng double precision NOT NULL DEFAULT 85.53,
  hero_stats jsonb NOT NULL DEFAULT '[{"value":"500+","label":"Students Tracked"},{"value":"25","label":"Active Vans"},{"value":"99.9%","label":"Uptime"},{"value":"< 5s","label":"Location Update"}]'::jsonb,
  contact_phone text DEFAULT '',
  contact_email text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings (for landing page)
CREATE POLICY "Anyone can read school_settings" ON public.school_settings
FOR SELECT USING (true);

-- Only admins can update
CREATE POLICY "Admins can manage school_settings" ON public.school_settings
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default row
INSERT INTO public.school_settings (id) VALUES (gen_random_uuid());

-- Add trigger for updated_at
CREATE TRIGGER update_school_settings_updated_at
BEFORE UPDATE ON public.school_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add start_lat, start_lng, end_lat, end_lng columns to vans for route start/end points
ALTER TABLE public.vans
ADD COLUMN start_lat double precision,
ADD COLUMN start_lng double precision,
ADD COLUMN end_lat double precision,
ADD COLUMN end_lng double precision;
