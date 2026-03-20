import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, User, ShieldCheck, Truck } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Role = 'parent' | 'driver' | 'admin';

const roleConfig: { key: Role; label: string; icon: typeof User; desc: string }[] = [
  { key: 'parent', label: 'Parent', icon: User, desc: "Track your child's van" },
  { key: 'driver', label: 'Driver', icon: Truck, desc: 'Manage your trip' },
  { key: 'admin', label: 'Admin', icon: ShieldCheck, desc: 'School management' },
];

const Login = () => {
  const [selectedRole, setSelectedRole] = useState<Role>('parent');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, roles: userRoles } = useAuth();

  const [rememberMe, setRememberMe] = useState(true);

  // Load saved credentials from localStorage
  const getSaved = (key: string) => localStorage.getItem(`vantrack_${key}`) || '';

  // Admin fields
  const [email, setEmail] = useState(() => getSaved('admin_email'));
  const [password, setPassword] = useState(() => getSaved('admin_password'));

  // Parent fields
  const [admissionNo, setAdmissionNo] = useState(() => getSaved('parent_admission'));
  const [parentPhone, setParentPhone] = useState(() => getSaved('parent_phone'));

  // Driver fields
  const [licenseNo, setLicenseNo] = useState(() => getSaved('driver_license'));
  const [driverPhone, setDriverPhone] = useState(() => getSaved('driver_phone'));

  // If already logged in, redirect
  useEffect(() => {
    if (user && userRoles.length > 0) {
      if (userRoles.includes('admin')) navigate('/admin', { replace: true });
      else if (userRoles.includes('driver')) navigate('/driver', { replace: true });
      else if (userRoles.includes('parent')) navigate('/parent', { replace: true });
    }
  }, [user, userRoles, navigate]);

  const saveCredentials = () => {
    if (rememberMe) {
      if (selectedRole === 'admin') {
        localStorage.setItem('vantrack_admin_email', email);
        localStorage.setItem('vantrack_admin_password', password);
      } else if (selectedRole === 'parent') {
        localStorage.setItem('vantrack_parent_admission', admissionNo);
        localStorage.setItem('vantrack_parent_phone', parentPhone);
      } else {
        localStorage.setItem('vantrack_driver_license', licenseNo);
        localStorage.setItem('vantrack_driver_phone', driverPhone);
      }
      localStorage.setItem('vantrack_last_role', selectedRole);
    }
  };

  // Restore last used role
  useEffect(() => {
    const lastRole = localStorage.getItem('vantrack_last_role') as Role | null;
    if (lastRole) setSelectedRole(lastRole);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (selectedRole === 'admin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message);
        } else {
          saveCredentials();
          setTimeout(() => navigate('/admin'), 500);
        }
      } else {
        const identifier = selectedRole === 'parent' ? admissionNo : licenseNo;
        const phone = selectedRole === 'parent' ? parentPhone : driverPhone;

        if (!identifier || !phone) {
          toast.error('Please fill in all fields');
          return;
        }

        const { data, error } = await supabase.functions.invoke('custom-login', {
          body: { role: selectedRole, identifier, phone },
        });

        if (error) {
          toast.error(error.message || 'Login failed');
          return;
        }

        if (data?.error) {
          toast.error(data.error);
          return;
        }

        // The edge function returns { session: { access_token, refresh_token }, user: {...} }
        const session = data?.session;
        if (session?.access_token && session?.refresh_token) {
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          saveCredentials();
          setTimeout(() => navigate(`/${selectedRole}`), 500);
        } else {
          console.error('Custom login response:', data);
          toast.error('Login failed. Please try again.');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh]">
      {/* Left panel */}
      <div className="hidden gradient-hero lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, hsl(42 100% 50% / 0.4), transparent 50%)' }} />
        <div className="relative text-center">
          <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
            <div className="text-8xl mb-8">🚐</div>
          </motion.div>
          <h2 className="font-display text-3xl font-bold text-primary-foreground mb-3">VanTrack</h2>
          <p className="text-primary-foreground/60 max-w-sm">Safe school transport tracking for Gyanoday Vidyalay</p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 safe-area-padding">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Bus className="h-5 w-5 text-secondary-foreground" />
            </div>
            <span className="font-display text-lg font-bold">VanTrack</span>
          </div>

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">Welcome back</h1>
          <p className="text-muted-foreground mb-6">Select your role and sign in</p>

          {/* Role selector */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-6">
            {roleConfig.map(r => (
              <button
                key={r.key}
                onClick={() => setSelectedRole(r.key)}
                className={`flex flex-col items-center gap-1.5 sm:gap-2 rounded-xl border-2 p-3 sm:p-4 transition-all active:scale-95 ${
                  selectedRole === r.key
                    ? 'border-secondary bg-secondary/10'
                    : 'border-border hover:border-secondary/40'
                }`}
              >
                <r.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${selectedRole === r.key ? 'text-secondary' : 'text-muted-foreground'}`} />
                <span className={`text-xs sm:text-sm font-medium ${selectedRole === r.key ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {r.label}
                </span>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {selectedRole === 'admin' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@school.edu" required className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} className="h-12 text-base" />
                </div>
              </>
            )}

            {selectedRole === 'parent' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="admissionNo">Admission Number</Label>
                  <Input id="admissionNo" value={admissionNo} onChange={e => setAdmissionNo(e.target.value)} placeholder="e.g. ADM-2024-001" required className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentPhone">Registered Mobile Number</Label>
                  <Input id="parentPhone" type="tel" value={parentPhone} onChange={e => setParentPhone(e.target.value)} placeholder="9123456780" required className="h-12 text-base" />
                </div>
              </>
            )}

            {selectedRole === 'driver' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="licenseNo">License Number</Label>
                  <Input id="licenseNo" value={licenseNo} onChange={e => setLicenseNo(e.target.value)} placeholder="BR01-2022-XXXX" required className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="driverPhone">Registered Mobile Number</Label>
                  <Input id="driverPhone" type="tel" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="9876543210" required className="h-12 text-base" />
                </div>
              </>
            )}

            <div className="flex items-center gap-2">
              <Checkbox id="remember" checked={rememberMe} onCheckedChange={(v) => setRememberMe(!!v)} />
              <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">Remember my details</Label>
            </div>

            <Button type="submit" disabled={isLoading} className="w-full h-12 bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold text-base active:scale-[0.98] transition-transform">
              {isLoading ? 'Please wait...' : `Sign In as ${roleConfig.find(r => r.key === selectedRole)?.label}`}
            </Button>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
