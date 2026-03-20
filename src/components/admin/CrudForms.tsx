import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface VanFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
}

export const VanForm = ({ open, onOpenChange, editData }: VanFormProps) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    van_code: '',
    vehicle_number: '',
    route_name: '',
    capacity: 18,
    status: 'active',
  });

  // Sync form when editData changes or dialog opens
  useEffect(() => {
    if (open) {
      setForm({
        van_code: editData?.van_code || '',
        vehicle_number: editData?.vehicle_number || '',
        route_name: editData?.route_name || '',
        capacity: editData?.capacity || 18,
        status: editData?.status || 'active',
      });
    }
  }, [open, editData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editData?.id) {
        const { error } = await supabase.from('vans').update(form).eq('id', editData.id);
        if (error) throw error;
        toast.success('Van updated');
      } else {
        const { error } = await supabase.from('vans').insert(form);
        if (error) throw error;
        toast.success('Van created');
      }
      queryClient.invalidateQueries({ queryKey: ['vans'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{editData ? 'Edit Van' : 'Add Van'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Van Code</Label>
              <Input value={form.van_code} onChange={e => setForm(f => ({ ...f, van_code: e.target.value }))} placeholder="VAN-03" required />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Number</Label>
              <Input value={form.vehicle_number} onChange={e => setForm(f => ({ ...f, vehicle_number: e.target.value }))} placeholder="BR27XX0000" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Route Name</Label>
            <Input value={form.route_name} onChange={e => setForm(f => ({ ...f, route_name: e.target.value }))} placeholder="Station Road Route" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Capacity</Label>
              <Input type="number" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: parseInt(e.target.value) || 0 }))} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Saving...' : editData ? 'Update Van' : 'Add Van'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface DriverFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
  vans: any[];
}

export const DriverForm = ({ open, onOpenChange, editData, vans }: DriverFormProps) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    license_no: '',
    van_id: '',
  });

  useEffect(() => {
    if (open) {
      setForm({
        full_name: editData?.full_name || '',
        phone: editData?.phone || '',
        license_no: editData?.license_no || '',
        van_id: editData?.van_id || '',
      });
    }
  }, [open, editData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, van_id: form.van_id || null };
      if (editData?.id) {
        const { error } = await supabase.from('drivers').update(payload).eq('id', editData.id);
        if (error) throw error;
        toast.success('Driver updated');
      } else {
        const { error } = await supabase.from('drivers').insert(payload);
        if (error) throw error;
        toast.success('Driver created');
      }
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{editData ? 'Edit Driver' : 'Add Driver'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Driver name" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="9876543210" required />
            </div>
            <div className="space-y-2">
              <Label>License No</Label>
              <Input value={form.license_no} onChange={e => setForm(f => ({ ...f, license_no: e.target.value }))} placeholder="BR01-2022-XXXX" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assigned Van</Label>
            <Select value={form.van_id} onValueChange={v => setForm(f => ({ ...f, van_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Select van" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— No Van —</SelectItem>
                {vans.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.van_code} - {v.vehicle_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Saving...' : editData ? 'Update Driver' : 'Add Driver'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface StudentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editData?: any;
  vans: any[];
}

export const StudentForm = ({ open, onOpenChange, editData, vans }: StudentFormProps) => {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    admission_no: '',
    full_name: '',
    class: '',
    pickup_point: '',
    parent_phone: '',
    van_id: '',
    status: 'waiting',
  });

  useEffect(() => {
    if (open) {
      setForm({
        admission_no: editData?.admission_no || '',
        full_name: editData?.full_name || '',
        class: editData?.class || '',
        pickup_point: editData?.pickup_point || '',
        parent_phone: editData?.parent_phone || '',
        van_id: editData?.van_id || '',
        status: editData?.status || 'waiting',
      });
    }
  }, [open, editData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, van_id: form.van_id || null };
      if (editData?.id) {
        const { error } = await supabase.from('students').update(payload).eq('id', editData.id);
        if (error) throw error;
        toast.success('Student updated');
      } else {
        const { error } = await supabase.from('students').insert(payload);
        if (error) throw error;
        toast.success('Student created');
      }
      queryClient.invalidateQueries({ queryKey: ['students'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{editData ? 'Edit Student' : 'Add Student'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Admission No</Label>
              <Input value={form.admission_no} onChange={e => setForm(f => ({ ...f, admission_no: e.target.value }))} placeholder="ADM-2024-001" required />
            </div>
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Student name" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class</Label>
              <Input value={form.class} onChange={e => setForm(f => ({ ...f, class: e.target.value }))} placeholder="5" required />
            </div>
            <div className="space-y-2">
              <Label>Pickup Point</Label>
              <Input value={form.pickup_point} onChange={e => setForm(f => ({ ...f, pickup_point: e.target.value }))} placeholder="Tilak Nagar Chowk" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Parent Phone</Label>
              <Input value={form.parent_phone} onChange={e => setForm(f => ({ ...f, parent_phone: e.target.value }))} placeholder="9123456780" />
            </div>
            <div className="space-y-2">
              <Label>Assigned Van</Label>
              <Select value={form.van_id} onValueChange={v => setForm(f => ({ ...f, van_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select van" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No Van —</SelectItem>
                  {vans.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.van_code} - {v.route_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Saving...' : editData ? 'Update Student' : 'Add Student'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
