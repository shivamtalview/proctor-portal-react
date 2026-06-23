import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

export interface ManagedByOption {
  value: string;
  label: string;
}

export function useManagedByOptions() {
  return useQuery({
    queryKey: ['managed-by-options'],
    queryFn: async (): Promise<ManagedByOption[]> => {
      const { data, error } = await supabase
        .from('vendors')
        .select('name, active')
        .eq('active', true)
        .order('name', { ascending: true });

      if (error) throw error;

      const activeVendorNames = (data || [])
        .map((vendor) => vendor.name)
        .filter(Boolean);

      return activeVendorNames.map((value) => ({ value, label: value }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
