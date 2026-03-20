import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useSchoolSettings = () => useQuery({
  queryKey: ['school_settings'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('school_settings' as any)
      .select('*')
      .limit(1)
      .single();
    if (error) throw error;
    return data as any;
  },
});

export const useUpdateSchoolSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      // Get the single row id first
      const { data: existing } = await supabase
        .from('school_settings' as any)
        .select('id')
        .limit(1)
        .single();
      if (!existing) throw new Error('No settings row found');
      const { error } = await supabase
        .from('school_settings' as any)
        .update(updates)
        .eq('id', (existing as any).id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school_settings'] });
      toast.success('Settings saved');
    },
    onError: (err: any) => toast.error(err.message),
  });
};
