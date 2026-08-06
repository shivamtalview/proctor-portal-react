import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import { getScopedVendor } from '@/utils/access';
import { useManagedByOptions } from '@/hooks/useManagedByOptions';
import type { Proctor } from '@/types';

export default function OffboardedPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyVendorFilter, setHistoryVendorFilter] = useState('');
  const { data: managedByOptions = [] } = useManagedByOptions();

  const isAdmin = user?.role === 'admin';
  const scopedVendor = getScopedVendor(user);

  // Fetch offboarded proctors
  const { data: offboardedProctors = [], isLoading: isLoadingOffboarded } = useQuery({
    queryKey: ['offboarded-proctors', user?.vendor],
    queryFn: async () => {
      let query = supabase
        .from('proctors')
        .select('*')
        .eq('status', 'Offboarded')
        .order('oat', { ascending: false }); // Order by offboarded_at

      // Vendor role sees only their proctors
      if (scopedVendor) {
        query = query.eq('vendor', scopedVendor).or(`managed_by.eq.${scopedVendor}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as Proctor[]).map(p => ({
        ...p,
        vendor: p.managed_by || p.vendor || ''
      }));
    },
  });

  // Fetch archived proctors for history (admin only)
  const { data: archivedProctors = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['archived-proctors'],
    queryFn: async () => {
      if (!isAdmin) return [];

      const { data, error } = await supabase
        .from('proctors')
        .select('*')
        .eq('status', 'Archived')
        .order('at', { ascending: true });

      if (error) throw error;

      return (data as Proctor[]).map(p => ({
        ...p,
        vendor: p.managed_by || p.vendor || ''
      }));
    },
    enabled: isAdmin,
  });

  // Re-onboard mutation
  const reOnboardMutation = useMutation({
    mutationFn: async (proctorId: string) => {
      const now = new Date().toISOString();

      const proctor = offboardedProctors.find(p => p.id === proctorId);
      if (!proctor) throw new Error('Proctor not found');

      // Insert new record FIRST (so if this fails, old record is still intact)
      const { error: insertError } = await supabase.from('proctors').insert({
        name: proctor.name,
        aadhaar: proctor.aadhaar,
        dob: proctor.dob,
        gender: proctor.gender,
        ptype: proctor.ptype,
        managed_by: proctor.managed_by,
        vendor: proctor.vendor,
        phone: proctor.phone,
        email: proctor.email,
        city: proctor.city,
        state: proctor.state,
        notes: 'Re-onboarded from ' + (proctor.pid || 'previous record'),
        status: 'In Progress',
        stage: 0,
        by_user: user?.username || '',
        at: now,
        upd: now,
      });

      if (insertError) throw insertError;

      // Only archive old record AFTER successful insert
      const { error: archiveError } = await supabase
        .from('proctors')
        .update({ status: 'Archived', upd: now })
        .eq('id', proctorId);

      if (archiveError) throw archiveError;
    },
    onSuccess: () => {
      alert('Proctor re-onboarded successfully! They will start fresh in In Progress.');
      queryClient.invalidateQueries({ queryKey: ['offboarded-proctors'] });
      queryClient.invalidateQueries({ queryKey: ['archived-proctors'] });
    },
    onError: (error: any) => {
      alert('Failed to re-onboard: ' + error.message);
    },
  });

  // Filter offboarded proctors
  const filteredOffboarded = offboardedProctors.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !(p.name || '').toLowerCase().includes(s) &&
        !(p.pid || '').toLowerCase().includes(s) &&
        !(p.phone || '').includes(s)
      ) {
        return false;
      }
    }
    if (vendorFilter && p.vendor !== vendorFilter) return false;
    return true;
  });

  // Build history groups
  const historyGroups = useMemo(() => {
    if (!isAdmin) return [];

    // Find all aadhaar numbers with at least one Archived record
    const archivedAadhaar = new Set(
      archivedProctors.filter(p => p.status === 'Archived').map(p => p.aadhaar)
    );

    // Group all proctors by aadhaar (only those with history)
    const groups: Record<string, Proctor[]> = {};
    archivedProctors
      .filter(p => archivedAadhaar.has(p.aadhaar))
      .forEach(p => {
        if (!groups[p.aadhaar]) groups[p.aadhaar] = [];
        groups[p.aadhaar].push(p);
      });

    // Sort each group by onboard date
    Object.values(groups).forEach(g => g.sort((a, b) =>
      new Date(a.at).getTime() - new Date(b.at).getTime()
    ));

    // Filter by search
    return Object.keys(groups).filter(aad => {
      const g = groups[aad];
      const name = (g[0].name || '').toLowerCase();
      const vendorMatch = !historyVendorFilter || g.some(p => p.vendor === historyVendorFilter);
      const searchMatch = !historySearch ||
        name.includes(historySearch.toLowerCase()) ||
        aad.includes(historySearch) ||
        g.some(p => (p.pid || '').toLowerCase().includes(historySearch.toLowerCase()));
      return vendorMatch && searchMatch;
    }).map(aad => groups[aad]);
  }, [archivedProctors, historySearch, historyVendorFilter, isAdmin]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getVendorBadge = (vendor: string) => {
    const vendorColors: Record<string, string> = {
      'Sai': 'bg-blue-500/15 text-blue-400',
      'TSN': 'bg-purple-500/15 text-purple-400',
      'Avner': 'bg-emerald-400/15 text-emerald-400',
      'A&M': 'bg-amber-500/15 text-amber-400',
      'ATS': 'bg-red-400/15 text-red-400',
      'Awign': 'bg-orange-400/15 text-orange-400',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${vendorColors[vendor] || 'bg-accent/10 text-accent'}`}>
        {vendor}
      </span>
    );
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'Active': 'bg-success/10 text-success',
      'In Progress': 'bg-warning/10 text-warning',
      'Verified': 'bg-info/10 text-info',
      'Archived': 'bg-text3/10 text-text3',
      'Offboarded': 'bg-danger/10 text-danger',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors[status] || 'bg-text3/10 text-text3'}`}>
        {status}
      </span>
    );
  };

  const exportCsv = (tab: 'offboarded' | 'history') => {
    const list =
      tab === 'offboarded'
        ? filteredOffboarded
        : archivedProctors.filter((p) => p.status === 'Archived');

    if (list.length === 0) {
      alert('No records to export');
      return;
    }

    const BOM = '\uFEFF';
    const header =
      'Proctor ID,Name,Vendor,Type,Phone,Email,City,State,Status,BGV,NDA,Created,Activated,Offboarded';
    const rows = list.map((p) =>
      [
        p.pid || '',
        p.name || '',
        p.vendor || p.managed_by || '',
        p.ptype || '',
        p.phone || '',
        p.email || '',
        p.city || '',
        p.state || '',
        p.status || '',
        p.bgv ? 'Yes' : 'No',
        p.nda ? 'Yes' : 'No',
        formatDate(p.at),
        formatDate(p.aat || ''),
        formatDate(p.oat || ''),
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    );

    const csv = BOM + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `proctors_${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const offboardedColumns = [
    {
      header: 'ID',
      accessor: (row: Proctor) => row.pid || '—',
      className: 'font-mono text-[12px] text-info',
    },
    {
      header: 'Name',
      accessor: (row: Proctor) => row.name,
      className: 'text-text font-semibold',
    },
    {
      header: 'Managed By',
      accessor: (row: Proctor) => getVendorBadge(row.vendor!),
    },
    {
      header: 'Offboarded',
      accessor: (row: Proctor) => formatDate(row.oat!),
      className: 'text-[12px] text-text3',
    },
    {
      header: 'Reason',
      accessor: (row: Proctor) => row.off_reason || '—',
      className: 'text-[12px] text-text2',
    },
    {
      header: 'Actions',
      accessor: (row: Proctor) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm">
            👁 View
          </Button>
          {isAdmin && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (confirm(`Re-onboard ${row.name}? They will start fresh in In Progress.`)) {
                  reOnboardMutation.mutate(row.id);
                }
              }}
              disabled={reOnboardMutation.isPending}
            >
              ↩ Re-onboard
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 0, label: 'Offboarded' },
          ...(isAdmin ? [{ id: 1, label: 'Re-onboard History' }] : []),
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as number)}
      />

      {/* Tab 0: Offboarded */}
      {activeTab === 0 && (
        <div>
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap items-center">
            <Input
              placeholder="🔍 Name, ID, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-[180px]"
            />
            <Select
              options={[
                { value: '', label: 'All Managed By' },
                ...managedByOptions,
              ]}
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="min-w-[160px]"
            />
            <Button variant="ghost" size="sm" onClick={() => exportCsv('offboarded')}>
              ⬇ Export
            </Button>
          </div>

          {/* Table */}
          <Table
            data={filteredOffboarded}
            columns={offboardedColumns}
            isLoading={isLoadingOffboarded}
            emptyMessage="No offboarded proctors"
          />
        </div>
      )}

      {/* Tab 1: Re-onboard History */}
      {activeTab === 1 && isAdmin && (
        <div>
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            <Input
              placeholder="Search name, Aadhaar..."
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              className="flex-1 min-w-[180px]"
            />
                <Select
                  options={[
                    { value: '', label: 'All Managed By' },
                    ...managedByOptions,
                  ]}
                  value={historyVendorFilter}
                  onChange={(e) => setHistoryVendorFilter(e.target.value)}
                  className="min-w-[160px]"
            />
            <Button variant="ghost" size="sm" onClick={() => exportCsv('history')}>
              ⬇ Export
            </Button>
          </div>

          {/* History Timeline */}
          {isLoadingHistory ? (
            <Card className="p-8 text-center text-text3">
              Loading history...
            </Card>
          ) : historyGroups.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-5xl mb-4">🗂️</div>
              <h3 className="text-lg font-semibold text-text mb-2">No re-onboard history</h3>
              <p className="text-text3 text-sm">
                Proctors who have been offboarded and re-onboarded will appear here.
              </p>
            </Card>
          ) : (
            <div className="space-y-6">
              {historyGroups.map((group, idx) => {
                const person = group[0];
                
                return (
                  <Card key={idx} className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4 pb-4 border-b border-border">
                      <div>
                        <div className="text-base font-semibold text-text mb-1">
                          {person.name}
                        </div>
                        <div className="text-xs text-text3">
                          Aadhaar: {person.aadhaar ? `XXXX-XXXX-${person.aadhaar.slice(-4)}` : '—'} · {group.length} onboarding cycle{group.length > 1 ? 's' : ''}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        👁 View Current
                      </Button>
                    </div>

                    {/* Timeline Chain */}
                    <div className="flex items-center gap-3 overflow-x-auto pb-2">
                      {group.map((proctor, cycleIdx) => (
                        <div key={proctor.id} className="flex items-center gap-3">
                          {/* Node */}
                          <div className="flex-shrink-0 bg-surface2 border border-border rounded-lg p-3 min-w-[200px]">
                            <div className="text-[10px] font-bold text-accent uppercase tracking-wide mb-1">
                              Cycle {cycleIdx + 1}
                            </div>
                            <div className="font-mono text-[11px] text-info mb-2">
                              {proctor.pid || 'No PID'}
                            </div>
                            <div className="mb-2">{getVendorBadge(proctor.vendor!)}</div>
                            <div className="space-y-1">
                              <div className="text-[11px] text-text3">
                                ▲ Onboarded: {formatDate(proctor.at)}
                              </div>
                              {(proctor.status === 'Archived' || proctor.status === 'Offboarded') ? (
                                <div className="text-[11px] text-text3">
                                  ▼ Offboarded: {formatDate(proctor.oat!)}
                                  {proctor.off_reason && <div className="text-[10px]">({proctor.off_reason})</div>}
                                </div>
                              ) : (
                                <div className="text-[11px]">
                                  {getStatusBadge(proctor.status)}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Arrow */}
                          {cycleIdx < group.length - 1 && (
                            <div className="flex-shrink-0 text-2xl text-text3">→</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
