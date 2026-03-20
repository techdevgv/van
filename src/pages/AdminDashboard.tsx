import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Bus, Users, MapPin, BarChart3, LogOut, Plus, Eye, Navigation, History, Settings, Pencil, Route, Upload, Trash2, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import LiveMap from '@/components/LiveMap';
import { useAuth } from '@/contexts/AuthContext';
import { useVans, useDrivers, useStudents, useTrips } from '@/hooks/useSupabaseData';
import { useSchoolSettings } from '@/hooks/useSchoolSettings';
import { VanForm, DriverForm, StudentForm } from '@/components/admin/CrudForms';
import RouteStopEditor from '@/components/admin/RouteStopEditor';
import SchoolSettingsEditor from '@/components/admin/SchoolSettingsEditor';
import BulkCsvUpload from '@/components/admin/BulkCsvUpload';
import BulkAssignment from '@/components/admin/BulkAssignment';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const StatCard = ({ icon: Icon, label, value, color }: { icon: typeof Bus; label: string; value: string | number; color: string }) => (
  <div className="glass-card-elevated p-4">
    <div className="flex items-center gap-3">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-bold text-foreground">{value}</p>
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const { data: vans = [] } = useVans();
  const { data: drivers = [] } = useDrivers();
  const { data: students = [] } = useStudents();
  const { data: activeTrips = [] } = useTrips('active');
  const { data: schoolSettings } = useSchoolSettings();
  
  const [vanLat, setVanLat] = useState(0);
  const [vanLng, setVanLng] = useState(0);
  
  // Search/filter state
  const [studentSearch, setStudentSearch] = useState('');
  const [studentVanFilter, setStudentVanFilter] = useState('all');
  const [driverSearch, setDriverSearch] = useState('');

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{ type: string; id: string; name: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Set initial position from school settings
  useEffect(() => {
    if (schoolSettings && vanLat === 0 && vanLng === 0) {
      setVanLat(schoolSettings.school_lat || 0);
      setVanLng(schoolSettings.school_lng || 0);
    }
  }, [schoolSettings]);
  
  // CRUD form state
  const [vanFormOpen, setVanFormOpen] = useState(false);
  const [driverFormOpen, setDriverFormOpen] = useState(false);
  const [studentFormOpen, setStudentFormOpen] = useState(false);
  const [editVan, setEditVan] = useState<any>(null);
  const [editDriver, setEditDriver] = useState<any>(null);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [routeEditorOpen, setRouteEditorOpen] = useState(false);
  const [routeEditorVan, setRouteEditorVan] = useState<{ id: string; code: string } | null>(null);

  // Show real van position from active trips only
  useEffect(() => {
    if (activeTrips.length === 0) return;
    const tripId = activeTrips[0]?.id;
    if (!tripId) return;

    const channel = supabase
      .channel('admin-live-tracking')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_locations', filter: `trip_id=eq.${tripId}` },
        (payload) => {
          const loc = payload.new as any;
          setVanLat(loc.lat);
          setVanLng(loc.lng);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeTrips]);

  // Filtered data
  const filteredStudents = students.filter(s => {
    const matchSearch = !studentSearch || 
      s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      (s.admission_no || '').toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.pickup_point.toLowerCase().includes(studentSearch.toLowerCase());
    const matchVan = studentVanFilter === 'all' || 
      (studentVanFilter === 'unassigned' ? !s.van_id : s.van_id === studentVanFilter);
    return matchSearch && matchVan;
  });

  const filteredDrivers = drivers.filter(d => {
    return !driverSearch || 
      d.full_name.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.phone.includes(driverSearch);
  });

  const handleDelete = async () => {
    if (!deleteDialog) return;
    setDeleteLoading(true);
    try {
      const { error } = await supabase.from(deleteDialog.type as any).delete().eq('id', deleteDialog.id);
      if (error) throw error;
      toast.success(`${deleteDialog.name} deleted`);
      queryClient.invalidateQueries({ queryKey: [deleteDialog.type] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleteLoading(false);
      setDeleteDialog(null);
    }
  };

  // Quick assign student to van inline
  const handleQuickAssign = async (studentId: string, vanId: string) => {
    const vanIdOrNull = vanId === 'none' ? null : vanId;
    const { error } = await supabase.from('students').update({ van_id: vanIdOrNull }).eq('id', studentId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Van assignment updated');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass-card border-b border-border/50 lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
              <Bus className="h-4 w-4 text-secondary-foreground" />
            </div>
            <span className="font-display font-bold text-foreground">Admin Panel</span>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
        </div>
      </header>

      <div className="flex">
        <aside className="hidden lg:flex w-64 flex-col gradient-hero min-h-screen sticky top-0">
          <div className="flex items-center gap-2 p-5 border-b border-primary-foreground/10">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Bus className="h-5 w-5 text-secondary-foreground" />
            </div>
            <div>
              <span className="font-display font-bold text-primary-foreground">VanTrack</span>
              <p className="text-xs text-primary-foreground/50">Admin Dashboard</p>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1">
            {[
              { icon: BarChart3, label: 'Overview' },
              { icon: Bus, label: 'Vans' },
              { icon: Users, label: 'Students' },
              { icon: Navigation, label: 'Live Tracking' },
              { icon: History, label: 'Trip History' },
              { icon: Settings, label: 'Settings' },
            ].map((item, i) => (
              <button
                key={item.label}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  i === 0 ? 'bg-primary-foreground/10 text-primary-foreground' : 'text-primary-foreground/60 hover:bg-primary-foreground/5 hover:text-primary-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-primary-foreground/10">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/20 text-sm text-primary-foreground">OP</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary-foreground truncate">Admin</p>
                <p className="text-xs text-primary-foreground/50">Super Admin</p>
              </div>
              <LogOut className="h-4 w-4 text-primary-foreground/40 hover:text-primary-foreground cursor-pointer" onClick={signOut} />
            </div>
          </div>
        </aside>

        <main className="flex-1 p-4 lg:p-6 space-y-6 max-w-6xl">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <h1 className="font-display text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground text-sm">{schoolSettings?.school_name || 'School'} • Transport Overview</p>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Bus} label="Active Vans" value={vans.filter(v => v.status === 'active').length} color="bg-secondary/10 text-secondary" />
            <StatCard icon={Users} label="Total Students" value={students.length} color="bg-info/10 text-info" />
            <StatCard icon={Navigation} label="Active Trips" value={activeTrips.length} color="bg-success/10 text-success" />
            <StatCard icon={MapPin} label="Total Vans" value={vans.length} color="bg-warning/10 text-warning" />
          </div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
                </span>
                Live Tracking
              </h2>
              <Button variant="outline" size="sm" className="gap-1"><Eye className="h-4 w-4" /> Fullscreen</Button>
            </div>
            {vanLat !== 0 && vanLng !== 0 && (
              <LiveMap vanLat={vanLat} vanLng={vanLng} className="h-[300px] lg:h-[400px]" />
            )}
          </motion.div>

          <Tabs defaultValue="vans">
            <TabsList className="bg-muted flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="vans">Vans</TabsTrigger>
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="drivers">Drivers</TabsTrigger>
              <TabsTrigger value="bulk" className="gap-1"><Upload className="h-3 w-3" />Bulk</TabsTrigger>
              <TabsTrigger value="settings" className="gap-1"><Settings className="h-3 w-3" />Settings</TabsTrigger>
            </TabsList>

            {/* === VANS TAB === */}
            <TabsContent value="vans" className="mt-4">
              <div className="glass-card overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <h3 className="font-display font-semibold text-foreground">Vans ({vans.length})</h3>
                  <Button size="sm" onClick={() => { setEditVan(null); setVanFormOpen(true); }} className="gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"><Plus className="h-4 w-4" /> Add Van</Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Van Code</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Vehicle No.</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Route</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Cap.</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Students</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Driver</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vans.map(van => {
                        const vanStudentCount = students.filter(s => s.van_id === van.id).length;
                        const vanDriver = drivers.find(d => d.van_id === van.id);
                        return (
                          <tr key={van.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-3 font-medium text-foreground">{van.van_code}</td>
                            <td className="px-4 py-3 text-foreground">{van.vehicle_number}</td>
                            <td className="px-4 py-3 text-foreground">{van.route_name || '—'}</td>
                            <td className="px-4 py-3 text-foreground">{van.capacity}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs font-medium ${vanStudentCount > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {vanStudentCount}/{van.capacity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-foreground text-xs">{vanDriver?.full_name || <span className="text-muted-foreground">No driver</span>}</td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                van.status === 'active' ? 'bg-success/10 text-success' : van.status === 'maintenance' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'
                              }`}>{van.status}</span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditVan(van); setVanFormOpen(true); }} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setRouteEditorVan({ id: van.id, code: van.van_code }); setRouteEditorOpen(true); }} title="Edit Route"><Route className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ type: 'vans', id: van.id, name: van.van_code })} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {vans.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No vans added yet</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* === STUDENTS TAB === */}
            <TabsContent value="students" className="mt-4">
              <div className="glass-card overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border gap-3">
                  <h3 className="font-display font-semibold text-foreground">Students ({students.length})</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search students..."
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        className="pl-8 h-9 w-48 text-sm"
                      />
                    </div>
                    <Select value={studentVanFilter} onValueChange={setStudentVanFilter}>
                      <SelectTrigger className="h-9 w-40 text-sm">
                        <SelectValue placeholder="Filter by van" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Vans</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {vans.map(v => (
                          <SelectItem key={v.id} value={v.id}>{v.van_code}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => { setEditStudent(null); setStudentFormOpen(true); }} className="gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Adm. No</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Class</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Pickup</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Van</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map(s => (
                        <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-xs text-foreground">{s.admission_no || '-'}</td>
                          <td className="px-4 py-3 font-medium text-foreground">{s.full_name}</td>
                          <td className="px-4 py-3 text-foreground">{s.class}</td>
                          <td className="px-4 py-3 text-foreground">{s.pickup_point}</td>
                          <td className="px-4 py-3 text-foreground">{s.parent_phone || '-'}</td>
                          <td className="px-4 py-2">
                            <Select value={s.van_id || 'none'} onValueChange={v => handleQuickAssign(s.id, v)}>
                              <SelectTrigger className="h-8 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— None —</SelectItem>
                                {vans.map(v => (
                                  <SelectItem key={v.id} value={v.id}>{v.van_code}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditStudent(s); setStudentFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ type: 'students', id: s.id, name: s.full_name })}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredStudents.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{studentSearch || studentVanFilter !== 'all' ? 'No matching students' : 'No students added yet'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            {/* === DRIVERS TAB === */}
            <TabsContent value="drivers" className="mt-4">
              <div className="glass-card overflow-hidden">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border gap-3">
                  <h3 className="font-display font-semibold text-foreground">Drivers ({drivers.length})</h3>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Search drivers..."
                        value={driverSearch}
                        onChange={e => setDriverSearch(e.target.value)}
                        className="pl-8 h-9 w-48 text-sm"
                      />
                    </div>
                    <Button size="sm" onClick={() => { setEditDriver(null); setDriverFormOpen(true); }} className="gap-1 bg-secondary text-secondary-foreground hover:bg-secondary/90"><Plus className="h-4 w-4" /> Add</Button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phone</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">License</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Van</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDrivers.map(d => (
                        <tr key={d.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-3 font-medium text-foreground">{d.full_name}</td>
                          <td className="px-4 py-3 text-foreground">{d.phone}</td>
                          <td className="px-4 py-3 text-foreground">{d.license_no}</td>
                          <td className="px-4 py-3 text-foreground">{(d as any).vans?.van_code || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditDriver(d); setDriverFormOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteDialog({ type: 'drivers', id: d.id, name: d.full_name })}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredDrivers.length === 0 && (
                        <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">{driverSearch ? 'No matching drivers' : 'No drivers added yet'}</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="bulk" className="mt-4 space-y-6">
              <BulkCsvUpload />
              <BulkAssignment />
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <SchoolSettingsEditor />
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* CRUD Dialogs */}
      <VanForm open={vanFormOpen} onOpenChange={(o) => { setVanFormOpen(o); if (!o) setEditVan(null); }} editData={editVan} />
      <DriverForm open={driverFormOpen} onOpenChange={(o) => { setDriverFormOpen(o); if (!o) setEditDriver(null); }} editData={editDriver} vans={vans} />
      <StudentForm open={studentFormOpen} onOpenChange={(o) => { setStudentFormOpen(o); if (!o) setEditStudent(null); }} editData={editStudent} vans={vans} />
      {routeEditorVan && (
        <RouteStopEditor
          open={routeEditorOpen}
          onOpenChange={(o) => { setRouteEditorOpen(o); if (!o) setRouteEditorVan(null); }}
          vanId={routeEditorVan.id}
          vanCode={routeEditorVan.code}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={(o) => { if (!o) setDeleteDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-destructive">Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteDialog?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
