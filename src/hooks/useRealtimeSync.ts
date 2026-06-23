import { useEffect } from 'react';
import type { QueryClient, QueryKey } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';

const PROCTOR_QUERY_KEYS: QueryKey[] = [
  ['proctors'],
  ['dashboard-stats'],
  ['recent-activity'],
  ['in-progress-proctors'],
  ['offboarded-proctors'],
  ['archived-proctors'],
  ['incomplete-bgv'],
  ['interview-selects'],
  ['demo-ready-proctors'],
  ['assessment-ready-proctors'],
  ['bulk-assessment-ready'],
  ['evaluations-results'],
  ['active-proctors-for-cert'],
  ['all-proctors'],
  ['proctors-all'],
  ['workspace-tasks'],
  ['scheduled-events'],
  ['workspace-eval-proctor'],
  ['proctor'],
];

const TABLE_INVALIDATIONS: Record<string, QueryKey[]> = {
  proctors: PROCTOR_QUERY_KEYS,
  proctor_evaluations: [
    ['evaluations-results'],
    ['workspace-tasks'],
    ['scheduled-events'],
    ['workspace-eval-proctor'],
  ],
  customers: [
    ['customers'],
    ['certifications'],
    ['all-certifications'],
    ['affected-certs'],
  ],
  vendors: [
    ['vendors'],
    ['managed-by-options'],
  ],
  vendor_contacts: [
    ['vendor-contacts'],
  ],
  proctor_certifications: [
    ['certifications'],
    ['all-certifications'],
    ['affected-certs'],
  ],
  user_notes: [
    ['user-notes'],
    ['workspace-tasks'],
  ],
  audit_log: [
    ['audit-logs'],
  ],
  users: [
    ['panel-users'],
  ],
};

function invalidateKeys(queryClient: QueryClient, keys: QueryKey[]) {
  keys.forEach((queryKey) => {
    void queryClient.invalidateQueries({ queryKey });
  });
}

export function useRealtimeSync(queryClient: QueryClient) {
  useEffect(() => {
    const channels = Object.entries(TABLE_INVALIDATIONS).map(([table, queryKeys]) =>
      supabase
        .channel(`realtime-${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table,
          },
          () => {
            invalidateKeys(queryClient, queryKeys);
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel);
      });
    };
  }, [queryClient]);
}
