import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useStudents, useVans } from '@/hooks/useSupabaseData';
import { toast } from 'sonner';
import { Users, Loader2 } from 'lucide-react';

const BulkAssignment = () => {
  const queryClient = useQueryClient();
  const { data: students = [] } = useStudents();
  const { data: vans = [] } = useVans();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetVan, setTargetVan] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleAll = () => {
    if (selected.size === students.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(students.map(s => s.id)));
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleAssign = async () => {
    if (selected.size === 0 || !targetVan) {
      toast.error('Select students and a target van');
      return;
    }
    setLoading(true);
    try {
      const vanIdOrNull = targetVan === 'unassign' ? null : targetVan;
      const { error } = await supabase
        .from('students')
        .update({ van_id: vanIdOrNull })
        .in('id', Array.from(selected));
      if (error) throw error;
      toast.success(`${selected.size} students updated`);
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSelected(new Set());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-4 lg:p-6 space-y-4">
      <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
        <Users className="h-5 w-5 text-secondary" /> Bulk Van Assignment
      </h3>
      <p className="text-sm text-muted-foreground">Select students and assign them to a van in bulk.</p>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Target Van</label>
          <Select value={targetVan} onValueChange={setTargetVan}>
            <SelectTrigger><SelectValue placeholder="Select van..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unassign">— Unassign —</SelectItem>
              {vans.map(v => (
                <SelectItem key={v.id} value={v.id}>{v.van_code} - {v.route_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAssign} disabled={loading || selected.size === 0} className="bg-secondary text-secondary-foreground hover:bg-secondary/90 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Assign {selected.size} Students
        </Button>
      </div>

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-3 py-2 w-10">
                <Checkbox checked={selected.size === students.length && students.length > 0} onCheckedChange={toggleAll} />
              </th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Name</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Class</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Pickup</th>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground">Current Van</th>
            </tr>
          </thead>
          <tbody>
            {students.map(s => (
              <tr key={s.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                </td>
                <td className="px-3 py-2 text-foreground font-medium">{s.full_name}</td>
                <td className="px-3 py-2 text-foreground">{s.class}</td>
                <td className="px-3 py-2 text-foreground">{s.pickup_point}</td>
                <td className="px-3 py-2 text-foreground">{(s as any).vans?.van_code || '—'}</td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No students</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BulkAssignment;
