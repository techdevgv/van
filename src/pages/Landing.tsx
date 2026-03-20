import { Bus, MapPin, Clock, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';

const features = [
  { icon: MapPin, title: "Live GPS Tracking", desc: "Track your child's school van in real-time on an interactive map" },
  { icon: Clock, title: "ETA Alerts", desc: "Get estimated arrival times and notifications when the van is near" },
  { icon: Shield, title: "Safe & Secure", desc: "Verified drivers, route monitoring, and emergency contact support" },
  { icon: Bus, title: "Route Visibility", desc: "View the complete route with all pickup and drop points" },
];

const Landing = () => {
  const { data: settings } = useSchoolSettings();

  const schoolName = settings?.school_name || 'VanTrack';
  const tagline = settings?.school_tagline || 'Know Where Your Child Is, Every Moment';
  const description = settings?.school_description || 'Real-time school van tracking for parents, drivers, and school administrators. Safe, reliable, and always connected.';
  const stats = (settings?.hero_stats as any[]) || [
    { value: "500+", label: "Students Tracked" },
    { value: "25", label: "Active Vans" },
    { value: "99.9%", label: "Uptime" },
    { value: "< 5s", label: "Location Update" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Bus className="h-5 w-5 text-secondary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">{schoolName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link to="/login">
              <Button size="sm" className="bg-secondary text-secondary-foreground hover:bg-secondary/90">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="gradient-hero relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-24">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, hsl(42 100% 50% / 0.3), transparent 50%)' }} />
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secondary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-secondary" />
              </span>
              <span className="text-sm font-medium text-primary-foreground/80">Live Tracking Active</span>
            </div>
            <h1 className="mb-6 font-display text-4xl font-extrabold leading-tight text-primary-foreground md:text-5xl lg:text-6xl">
              {tagline.includes(',') ? (
                <>{tagline.split(',')[0]},{' '}<span className="text-secondary">{tagline.split(',').slice(1).join(',')}</span></>
              ) : (
                tagline
              )}
            </h1>
            <p className="mb-8 text-lg text-primary-foreground/70 md:text-xl">{description}</p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/login">
                <Button size="lg" className="bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold px-8 text-base">Track Now</Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 px-8 text-base">Admin Login</Button>
              </Link>
            </div>
          </motion.div>
        </div>
        <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="mx-auto mt-12 flex justify-center">
          <div className="text-7xl">🚐</div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4">
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mb-12 text-center">
            <h2 className="mb-3 font-display text-3xl font-bold text-foreground">Why Parents Trust {schoolName}</h2>
            <p className="text-muted-foreground">Everything you need to ensure your child's safe commute</p>
          </motion.div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="glass-card-elevated p-6 text-center transition-transform hover:-translate-y-1">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/10">
                  <f.icon className="h-6 w-6 text-secondary" />
                </div>
                <h3 className="mb-2 font-display font-semibold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-muted/50 py-12">
        <div className="container mx-auto grid grid-cols-2 gap-8 px-4 text-center md:grid-cols-4">
          {stats.map((s: any) => (
            <div key={s.label}>
              <div className="font-display text-3xl font-bold text-foreground">{s.value}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-secondary" />
            <span className="font-display font-bold text-foreground">{schoolName}</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2026 {schoolName}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
