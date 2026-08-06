import { useRef, useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import { logAudit } from '@/services/audit';
import { PROCTOR_TYPES } from '@/utils/constants';
import { useManagedByOptions } from '@/hooks/useManagedByOptions';
import type { Proctor, Evaluation } from '@/types';

export default function EvaluationsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [bulkAssessConfig, setBulkAssessConfig] = useState<{
    panel: string;
    date: string;
    time: string;
    score: number;
  } | null>(null);

  // Cleanup global state on unmount
  useEffect(() => {
    return () => {
      delete (window as any)._bulkAssessConfig;
    };
  }, []);

  return (
    <div>
      {/* Main Tabs */}
      <Tabs
        tabs={[
          { id: 0, label: '🎭 Demo' },
          { id: 1, label: '📝 Assessment' },
          { id: 2, label: '📊 Results' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as number)}
      />

      {/* Tab Content */}
      {activeTab === 0 && <DemoTab />}
      {activeTab === 1 && <AssessmentTab bulkAssessConfig={bulkAssessConfig} setBulkAssessConfig={setBulkAssessConfig} />}
      {activeTab === 2 && <ResultsTab />}
    </div>
  );
}

function usePanelUsers() {
  return useQuery({
    queryKey: ['panel-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('role', 'talview');

      if (error) throw error;
      return (data || []).map((u: any) => u.username).filter(Boolean) as string[];
    },
  });
}

function downloadCsv(filename: string, header: string, rows: string[][]) {
  const BOM = '\uFEFF';
  const csv = BOM + header + '\n' + rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function DemoTab() {
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedProctors, setSelectedProctors] = useState<Set<string>>(new Set());
  const [panelUser, setPanelUser] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scoreOutOf, setScoreOutOf] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { data: panelUsers = [] } = usePanelUsers();
  const { data: managedByOptions = [] } = useManagedByOptions();

  // Fetch proctors with demo_ready = 'ready'
  const { data: proctors = [], isLoading } = useQuery({
    queryKey: ['demo-ready-proctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctors')
        .select('*')
        .eq('demo_ready', 'ready')
        .order('at', { ascending: false });

      if (error) throw error;
      return (data as Proctor[]).map(p => ({
        ...p,
        vendor: p.managed_by || p.vendor || ''
      }));
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!panelUser) throw new Error('Select a coordinator');
      if (!scheduledDate) throw new Error('Select a scheduled date');
      if (!scheduledTime) throw new Error('Select a scheduled time');
      if (!scoreOutOf || Number(scoreOutOf) < 1) throw new Error('Enter a valid score out of');

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (scheduledDate < today) throw new Error('Cannot schedule on a past date');
      if (scheduledDate === today) {
        const [h, m] = scheduledTime.split(':').map(Number);
        const scheduled = new Date();
        scheduled.setHours(h, m, 0, 0);
        if (scheduled <= now) throw new Error('Cannot schedule at a past time for today');
      }

      const selected = proctors.filter((p) => selectedProctors.has(p.id));
      if (!selected.length) throw new Error('No proctors selected');

      const scheduledAt = new Date().toISOString();
      await Promise.all(selected.map(async (p) => {
        const { data: prevRows, error: prevError } = await supabase
          .from('proctor_evaluations')
          .select('attempt_number')
          .eq('proctor_id', p.id)
          .eq('eval_type', 'demo')
          .order('attempt_number', { ascending: false })
          .limit(1);

        if (prevError) throw prevError;

        const attempt = (prevRows?.[0]?.attempt_number || 0) + 1;

        const { error: insertError } = await supabase.from('proctor_evaluations').insert({
          id: crypto.randomUUID(),
          proctor_id: p.id,
          eval_type: 'demo',
          panel_user: panelUser,
          scheduled_date: scheduledDate,
          scheduled_time: scheduledTime,
          score_out_of: Number(scoreOutOf),
          result: null,
          attempt_number: attempt,
          comment: '',
          created_at: scheduledAt,
          created_by: user?.username || user?.email || 'system',
          status: 'scheduled',
        });

        if (insertError) throw insertError;

        const { error: updateError } = await supabase
          .from('proctors')
          .update({
            demo_ready: 'scheduled',
            demo_ready_attempt: attempt,
            upd: scheduledAt,
          })
          .eq('id', p.id);

        if (updateError) throw updateError;

        await logAudit({
          action: 'Demo Scheduled',
          target: p.name,
          detail: `Panel: ${panelUser} · Attempt ${attempt} · Date: ${scheduledDate} ${scheduledTime} · by ${user?.username || user?.name || 'system'}`,
          user: user?.username || user?.name || null,
        });
      }));
    },
    onSuccess: async () => {
      alert(`Demo scheduled for ${selectedProctors.size} proctor${selectedProctors.size !== 1 ? 's' : ''}`);
      setSelectedProctors(new Set());
      setPanelUser('');
      setScheduledDate('');
      setScheduledTime('');
      setScoreOutOf('');
      await queryClient.invalidateQueries({ queryKey: ['demo-ready-proctors'] });
      await queryClient.invalidateQueries({ queryKey: ['evaluations-results', 'demo'] });
      await queryClient.invalidateQueries({ queryKey: ['proctors'] });
    },
    onError: (error: any) => {
      alert('Failed to schedule demo: ' + error.message);
    },
  });

  // Filter proctors
  const filteredProctors = proctors.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (!(p.name || '').toLowerCase().includes(s) && !(p.email || '').toLowerCase().includes(s)) {
        return false;
      }
    }
    if (vendorFilter && p.vendor !== vendorFilter) return false;
    if (typeFilter && p.ptype !== typeFilter) return false;
    return true;
  });

  const exportReadyList = () => {
    if (filteredProctors.length === 0) {
      alert('No proctors to export');
      return;
    }

    downloadCsv(
      `demo_ready_list_${new Date().toISOString().slice(0, 10)}.csv`,
      'Name,Managed By,Type,Demo Status,Attempts',
      filteredProctors.map((p) => [
        p.name || '',
        p.vendor || '',
        p.ptype || '',
        'Ready',
        String(p.demo_ready_attempt || 0),
      ])
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProctors(new Set(filteredProctors.map(p => p.id)));
    } else {
      setSelectedProctors(new Set());
    }
  };

  const toggleProctor = (id: string) => {
    const newSet = new Set(selectedProctors);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedProctors(newSet);
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

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Input
          placeholder="🔍 Name, email..."
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
        <Select
          options={[
            { value: '', label: 'All Types' },
            ...PROCTOR_TYPES.map(t => ({ value: t, label: t })),
          ]}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="min-w-[120px]"
        />
        <Button variant="ghost" size="sm" onClick={exportReadyList}>
          ⬇ Export
        </Button>
        <label className="flex items-center gap-2 text-xs text-text2 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={selectedProctors.size === filteredProctors.length && filteredProctors.length > 0}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="accent-accent"
          />
          Select All
        </label>
      </div>

      {/* Info Banner */}
      <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-4 text-xs text-info">
        Only proctors with Demo status <strong>Ready</strong> appear here. Coordinators mark readiness from the In Progress tab.
      </div>

      {/* Table */}
      <div className="mb-4">
        <Table
          data={filteredProctors}
          isLoading={isLoading}
          emptyMessage="No proctors ready for demo"
          columns={[
            {
              header: '',
              accessor: (proctor) => (
                <input
                  type="checkbox"
                  checked={selectedProctors.has(proctor.id)}
                  onChange={() => toggleProctor(proctor.id)}
                  className="accent-accent"
                />
              ),
              className: 'w-8',
            },
            {
              header: 'Name',
              accessor: (proctor) => (
                <span className="text-text font-semibold">{proctor.name}</span>
              ),
            },
            {
              header: 'Managed By',
              accessor: (proctor) => getVendorBadge(proctor.vendor!),
            },
            {
              header: 'Type',
              accessor: (proctor) => (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-info/10 text-info">
                  {proctor.ptype}
                </span>
              ),
            },
            {
              header: 'Demo Status',
              accessor: () => <span className="text-[11px] font-bold text-info">Ready</span>,
            },
            {
              header: 'Attempts',
              accessor: (proctor) => (
                <span className="text-[12px] text-text3">{proctor.demo_ready_attempt || 0}</span>
              ),
            },
          ]}
        />
      </div>

      {/* Assignment Panel - shown when proctors selected */}
      {selectedProctors.size > 0 && (
        <div className="bg-surface border-2 border-accent rounded-lg p-5 max-w-2xl">
          <div className="text-sm font-bold text-text mb-4">
            Assign Demo Panel ({selectedProctors.size} selected)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Panel (Coordinator) <span className="text-danger">*</span>
              </label>
              <Select
                options={[
                  { value: '', label: 'Select coordinator...' },
                  ...panelUsers.map((u) => ({ value: u, label: u })),
                ]}
                value={panelUser}
                onChange={(e) => setPanelUser(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Scheduled Date <span className="text-danger">*</span>
              </label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Scheduled Time <span className="text-danger">*</span>
              </label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Score Out Of <span className="text-danger">*</span>
              </label>
              <Input type="number" min={1} placeholder="e.g. 100" value={scoreOutOf} onChange={(e) => setScoreOutOf(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="primary"
              size="sm"
              onClick={() => scheduleMutation.mutate()}
              disabled={scheduleMutation.isPending}
            >
              {scheduleMutation.isPending ? 'Scheduling...' : '✅ Schedule Demo'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface BulkAssessConfig {
  panel: string;
  date: string;
  time: string;
  score: number;
}

function AssessmentTab({ bulkAssessConfig, setBulkAssessConfig }: {
  bulkAssessConfig: BulkAssessConfig | null;
  setBulkAssessConfig: (cfg: BulkAssessConfig | null) => void;
}) {
  const [subTab, setSubTab] = useState(0);

  return (
    <div>
      {/* Sub Tabs */}
      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            subTab === 0
              ? 'text-accent border-b-2 border-accent'
              : 'text-text3 hover:text-text'
          }`}
          onClick={() => setSubTab(0)}
        >
          👤 Individual Assign
        </button>
        <button
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            subTab === 1
              ? 'text-accent border-b-2 border-accent'
              : 'text-text3 hover:text-text'
          }`}
          onClick={() => setSubTab(1)}
        >
          👥 Multi Assign (Bulk)
        </button>
      </div>

      {subTab === 0 ? <IndividualAssessment /> : <BulkAssessment bulkAssessConfig={bulkAssessConfig} setBulkAssessConfig={setBulkAssessConfig} />}
    </div>
  );
}

function IndividualAssessment() {
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedProctor, setSelectedProctor] = useState<string | null>(null);
  const [panelUser, setPanelUser] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scoreOutOf, setScoreOutOf] = useState('');
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { data: panelUsers = [] } = usePanelUsers();
  const { data: managedByOptions = [] } = useManagedByOptions();

  // Fetch proctors with assessment_ready = 'ready'
  const { data: proctors = [], isLoading } = useQuery({
    queryKey: ['assessment-ready-proctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctors')
        .select('*')
        .eq('assessment_ready', 'ready')
        .order('at', { ascending: false });

      if (error) throw error;
      return (data as Proctor[]).map(p => ({
        ...p,
        vendor: p.managed_by || p.vendor || ''
      }));
    },
  });

  const selectedProctorData = proctors.find((p) => p.id === selectedProctor) || null;

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProctorData) throw new Error('Select a proctor');
      if (!panelUser) throw new Error('Select a coordinator');
      if (!scheduledDate) throw new Error('Select a scheduled date');
      if (!scheduledTime) throw new Error('Select a scheduled time');
      if (!scoreOutOf || Number(scoreOutOf) < 1) throw new Error('Enter a valid score out of');

      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      if (scheduledDate < today) throw new Error('Cannot schedule on a past date');
      if (scheduledDate === today) {
        const [h, m] = scheduledTime.split(':').map(Number);
        const scheduled = new Date();
        scheduled.setHours(h, m, 0, 0);
        if (scheduled <= now) throw new Error('Cannot schedule at a past time for today');
      }

      const { data: prevRows, error: prevError } = await supabase
        .from('proctor_evaluations')
        .select('attempt_number')
        .eq('proctor_id', selectedProctorData.id)
        .eq('eval_type', 'assessment')
        .order('attempt_number', { ascending: false })
        .limit(1);

      if (prevError) throw prevError;

      const attempt = (prevRows?.[0]?.attempt_number || 0) + 1;
      const scheduledAt = new Date().toISOString();

      const { error: insertError } = await supabase.from('proctor_evaluations').insert({
        id: crypto.randomUUID(),
        proctor_id: selectedProctorData.id,
        eval_type: 'assessment',
        panel_user: panelUser,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        score_out_of: Number(scoreOutOf),
        result: null,
        attempt_number: attempt,
        comment: '',
        created_at: scheduledAt,
        created_by: user?.username || user?.email || 'system',
        group_id: crypto.randomUUID(),
        status: 'scheduled',
      });

      if (insertError) throw insertError;

      const { error: updateError } = await supabase
        .from('proctors')
        .update({
          assessment_ready: 'scheduled',
          assessment_ready_attempt: attempt,
          upd: scheduledAt,
        })
        .eq('id', selectedProctorData.id);

      if (updateError) throw updateError;

      await logAudit({
        action: 'Assessment Scheduled',
        target: selectedProctorData.name,
        detail: `Panel: ${panelUser} · Attempt ${attempt} · Date: ${scheduledDate} ${scheduledTime} · by ${user?.username || user?.name || 'system'}`,
        user: user?.username || user?.name || null,
      });
    },
    onSuccess: async () => {
      alert('Assessment scheduled successfully');
      setSelectedProctor(null);
      setPanelUser('');
      setScheduledDate('');
      setScheduledTime('');
      setScoreOutOf('');
      await queryClient.invalidateQueries({ queryKey: ['assessment-ready-proctors'] });
      await queryClient.invalidateQueries({ queryKey: ['evaluations-results', 'assessment'] });
      await queryClient.invalidateQueries({ queryKey: ['proctors'] });
    },
    onError: (error: any) => {
      alert('Failed to schedule assessment: ' + error.message);
    },
  });

  // Filter proctors
  const filteredProctors = proctors.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (!(p.name || '').toLowerCase().includes(s) && !(p.email || '').toLowerCase().includes(s)) {
        return false;
      }
    }
    if (vendorFilter && p.vendor !== vendorFilter) return false;
    if (typeFilter && p.ptype !== typeFilter) return false;
    return true;
  });

  const exportReadyList = () => {
    if (filteredProctors.length === 0) {
      alert('No proctors to export');
      return;
    }

    downloadCsv(
      `assessment_ready_list_${new Date().toISOString().slice(0, 10)}.csv`,
      'Name,Managed By,Type,Assessment Status,Attempts',
      filteredProctors.map((p) => [
        p.name || '',
        p.vendor || '',
        p.ptype || '',
        'Ready',
        String(p.assessment_ready_attempt || 0),
      ])
    );
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

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Input
          placeholder="🔍 Name, email..."
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
        <Select
          options={[
            { value: '', label: 'All Types' },
            ...PROCTOR_TYPES.map(t => ({ value: t, label: t })),
          ]}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="min-w-[120px]"
        />
        <Button variant="ghost" size="sm" onClick={exportReadyList}>
          ⬇ Export Ready List
        </Button>
      </div>

      {/* Info Banner */}
      <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-4 text-xs text-info">
        Select one proctor from below, then configure and schedule their assessment.
      </div>

      {/* Table */}
      <div className="mb-4">
        <Table
          data={filteredProctors}
          isLoading={isLoading}
          emptyMessage="No proctors ready for assessment"
          columns={[
            {
              header: '',
              accessor: (proctor) => (
                <input
                  type="radio"
                  name="assessProctor"
                  checked={selectedProctor === proctor.id}
                  onChange={() => setSelectedProctor(proctor.id)}
                  className="accent-accent"
                />
              ),
              className: 'w-8',
            },
            {
              header: 'Name',
              accessor: (proctor) => (
                <span className="text-text font-semibold">{proctor.name}</span>
              ),
            },
            {
              header: 'Managed By',
              accessor: (proctor) => getVendorBadge(proctor.vendor!),
            },
            {
              header: 'Type',
              accessor: (proctor) => (
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-info/10 text-info">
                  {proctor.ptype}
                </span>
              ),
            },
            {
              header: 'Assessment Status',
              accessor: () => <span className="text-[11px] font-bold text-info">Ready</span>,
            },
            {
              header: 'Attempts',
              accessor: (proctor) => (
                <span className="text-[12px] text-text3">{proctor.assessment_ready_attempt || 0}</span>
              ),
            },
          ]}
        />
      </div>

      {/* Assignment Panel */}
      {selectedProctor && (
        <div className="bg-surface border-2 border-accent rounded-lg p-5 max-w-2xl">
          <div className="text-sm font-bold text-text mb-4">
            Schedule Assessment
          </div>
          {selectedProctorData && (
            <div className="text-xs text-text2 mb-4">
              Selected: <strong className="text-text">{selectedProctorData.name}</strong> · {selectedProctorData.vendor || selectedProctorData.managed_by} · {selectedProctorData.ptype}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Panel (Coordinator) <span className="text-danger">*</span>
              </label>
              <Select
                options={[
                  { value: '', label: 'Select coordinator...' },
                  ...panelUsers.map((u) => ({ value: u, label: u })),
                ]}
                value={panelUser}
                onChange={(e) => setPanelUser(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Scheduled Date <span className="text-danger">*</span>
              </label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Scheduled Time <span className="text-danger">*</span>
              </label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Score Out Of <span className="text-danger">*</span>
              </label>
              <Input type="number" min={1} placeholder="e.g. 100" value={scoreOutOf} onChange={(e) => setScoreOutOf(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => scheduleMutation.mutate()} disabled={scheduleMutation.isPending}>
              {scheduleMutation.isPending ? 'Scheduling...' : '✅ Schedule Assessment'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function BulkAssessment({ bulkAssessConfig, setBulkAssessConfig }: {
  bulkAssessConfig: BulkAssessConfig | null;
  setBulkAssessConfig: (cfg: BulkAssessConfig | null) => void;
}) {
  const { user } = useAuthStore();
  const [panelUser, setPanelUser] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [scoreOutOf, setScoreOutOf] = useState('');
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const { data: panelUsers = [] } = usePanelUsers();

  const { data: proctors = [] } = useQuery({
    queryKey: ['bulk-assessment-ready'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctors')
        .select('id, email, name, vendor, managed_by, ptype, assessment_ready')
        .eq('assessment_ready', 'ready')
        .order('at', { ascending: false });
      if (error) throw error;
      return (data as Proctor[]).map((p) => ({ ...p, vendor: p.managed_by || p.vendor || '' }));
    },
  });

  const downloadTemplate = () => {
    if (!panelUser || !scheduledDate || !scheduledTime || !scoreOutOf || Number(scoreOutOf) < 1) {
      alert('Select a Panel Coordinator, Scheduled Date, Time, and Score Out Of first');
      return;
    }
    const ready = proctors;
    if (!ready.length) {
      alert('No proctors with Assessment Ready status');
      return;
    }

    const BOM = '\uFEFF';
    const header = 'email,proctor_name,managed_by,ptype';
    const rows = ready.map((p) => `"${(p.email || '').replace(/"/g, '""')}","${(p.name || '').replace(/"/g, '""')}","${(p.vendor || '').replace(/"/g, '""')}","${(p.ptype || '').replace(/"/g, '""')}"`);
    const blob = new Blob([BOM + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `assessment_assign_${scheduledDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    alert(`Downloaded ${ready.length} ready proctors. Delete rows you don't need, then upload the edited file back.`);
    setBulkAssessConfig({
      panel: panelUser,
      date: scheduledDate,
      time: scheduledTime,
      score: Number(scoreOutOf),
    });
  };

  const uploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cfg = bulkAssessConfig;
    if (!cfg?.panel || !cfg?.date) {
      alert('Download the Ready Proctors List first to set session config');
      e.target.value = '';
      return;
    }

    const text = await file.text();
    const lines = text.trim().split('\n');
    if (lines.length < 2) {
      alert('File appears empty');
      return;
    }

    const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    const emailIdx = header.indexOf('email');
    if (emailIdx < 0) {
      alert('CSV must have an email column');
      return;
    }

    const rows = lines.slice(1).map((line) => {
      const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map((v) => v.replace(/^"|"$/g, '').trim()) || [];
      const email = values[emailIdx]?.trim().toLowerCase() || '';
      const proctor = proctors.find((p) => (p.email || '').toLowerCase() === email);
      const errors: string[] = [];
      if (!email) errors.push('Missing email');
      if (!proctor) errors.push('Proctor not found in portal');
      else if (proctor.assessment_ready !== 'ready') errors.push(`No longer in Ready status (${proctor.assessment_ready || 'unknown'})`);
      return { email, proctor, name: proctor?.name || '—', vendor: proctor?.vendor || '—', ptype: proctor?.ptype || '—', _ok: errors.length === 0, _errors: errors };
    }).filter((r) => r.email);

    const validRows = rows.filter((r) => r._ok);
    if (!validRows.length) {
      alert('Nothing to import');
      return;
    }

    const now = new Date().toISOString();
    await Promise.all(validRows.map(async (row) => {
      const attemptRow = await supabase
        .from('proctor_evaluations')
        .select('attempt_number')
        .eq('proctor_id', row.proctor!.id)
        .eq('eval_type', 'assessment')
        .order('attempt_number', { ascending: false })
        .limit(1);

      if (attemptRow.error) throw attemptRow.error;
      const attempt = (attemptRow.data?.[0]?.attempt_number || 0) + 1;
      const groupId = crypto.randomUUID();

      const insertRes = await supabase.from('proctor_evaluations').insert({
        id: crypto.randomUUID(),
        proctor_id: row.proctor!.id,
        eval_type: 'assessment',
        panel_user: cfg.panel,
        scheduled_date: cfg.date,
        scheduled_time: cfg.time,
        score_out_of: cfg.score,
        group_id: groupId,
        result: null,
        attempt_number: attempt,
        comment: '',
        created_at: now,
        created_by: 'system',
        status: 'scheduled',
      });
      if (insertRes.error) throw insertRes.error;

      const updRes = await supabase.from('proctors').update({
        assessment_ready: 'scheduled',
        assessment_ready_attempt: attempt,
        upd: now,
      }).eq('id', row.proctor!.id);
      if (updRes.error) throw updRes.error;

      await logAudit({
        action: 'Assessment Scheduled (Multi)',
        target: row.proctor!.name,
        detail: `Panel: ${cfg.panel} · Attempt ${attempt} · ${cfg.date} ${cfg.time} · by ${user?.username || user?.name || 'system'}`,
        user: user?.username || user?.name || null,
      });
    }));

    alert(`${validRows.length} assessment(s) scheduled for ${cfg.panel}`);
    e.target.value = '';
  };

  return (
    <Card className="p-6 max-w-3xl">
      <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-2">
        Step 1 — Configure Session
      </h3>
      <p className="text-text2 text-xs mb-4">
        Set the panel, date, time and score. Then download the pre-filled template with all Ready proctors and upload results.
      </p>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold text-text mb-1">
            Panel (Coordinator) <span className="text-danger">*</span>
          </label>
          <Select
            options={[
              { value: '', label: 'Select coordinator...' },
              ...panelUsers.map((u) => ({ value: u, label: u })),
            ]}
            value={panelUser}
            onChange={(e) => setPanelUser(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text mb-1">
            Scheduled Date <span className="text-danger">*</span>
          </label>
          <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text mb-1">
            Scheduled Time <span className="text-danger">*</span>
          </label>
          <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text mb-1">
            Score Out Of <span className="text-danger">*</span>
          </label>
          <Input type="number" placeholder="e.g. 100" min={1} value={scoreOutOf} onChange={(e) => setScoreOutOf(e.target.value)} />
        </div>
      </div>

      <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-2">
        Step 2 — Download, Edit & Upload
      </h3>
      <p className="text-text2 text-xs mb-1">
        Download the full list of Assessment Ready proctors. <strong>Delete the rows you don't want to assign</strong>, keep only those for this session, then upload the edited file back.
      </p>
      <p className="text-text3 text-[11px] mb-3">
        Columns: <code className="bg-surface2 px-1.5 py-0.5 rounded text-[10px]">email, proctor_name, managed_by, ptype</code> — do not add or rename columns.
      </p>

      <div className="flex gap-2 flex-wrap">
        <Button variant="primary" size="sm" onClick={downloadTemplate}>
          ⬇ Download Ready Proctors List
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => uploadInputRef.current?.click()}
        >
          📤 Upload Edited List
        </Button>
        <input
          ref={uploadInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={uploadTemplate}
        />
      </div>
    </Card>
  );
}

function ResultsTab() {
  const [subTab, setSubTab] = useState(0);

  return (
    <div>
      {/* Sub Tabs */}
      <div className="flex gap-2 mb-4 border-b border-border">
        <button
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            subTab === 0
              ? 'text-accent border-b-2 border-accent'
              : 'text-text3 hover:text-text'
          }`}
          onClick={() => setSubTab(0)}
        >
          🎭 Demo Results
        </button>
        <button
          className={`px-3 py-2 text-xs font-medium transition-colors ${
            subTab === 1
              ? 'text-accent border-b-2 border-accent'
              : 'text-text3 hover:text-text'
          }`}
          onClick={() => setSubTab(1)}
        >
          📝 Assessment Results
        </button>
      </div>

      {subTab === 0 ? <ResultsTable type="demo" /> : <ResultsTable type="assessment" />}
    </div>
  );
}

function ResultsTable({ type }: { type: 'demo' | 'assessment' }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [overrideEvaluation, setOverrideEvaluation] = useState<any | null>(null);
  const { data: managedByOptions = [] } = useManagedByOptions();

  const isAdmin = user?.role === 'admin';

  // Fetch evaluations with results
  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ['evaluations-results', type],
    queryFn: async () => {
      const { data: evalData, error: evalError } = await supabase
        .from('proctor_evaluations')
        .select('*')
        .eq('eval_type', type)
        .not('result', 'is', null)
        .order('created_at', { ascending: false });

      if (evalError) throw evalError;

      // Fetch all proctors to join with evaluations
      const { data: proctorsData, error: proctorsError } = await supabase
        .from('proctors')
        .select('id, name, email, vendor, managed_by');

      if (proctorsError) throw proctorsError;

      // Create proctor lookup map
      const proctorMap = new Map(
        (proctorsData as any[]).map(p => [p.id, { ...p, vendor: p.managed_by || p.vendor }])
      );

      // Join evaluations with proctor data
      return (evalData as Evaluation[]).map(e => {
        const proctor = proctorMap.get(e.proctor_id);
        return {
          ...e,
          proctor_name: proctor?.name || 'Unknown',
          proctor_email: proctor?.email || '',
          proctor_vendor: proctor?.vendor || '—',
          proctor_type: proctor?.ptype || '—',
        };
      });
    },
  });

  // Filter evaluations
  const filteredEvaluations = evaluations.filter((e: any) => {
    if (search) {
      const s = search.toLowerCase();
      if (!(e.proctor_name || '').toLowerCase().includes(s) && !(e.proctor_email || '').toLowerCase().includes(s)) {
        return false;
      }
    }
    if (resultFilter && e.result !== resultFilter) return false;
    if (vendorFilter && e.proctor_vendor !== vendorFilter) return false;
    return true;
  });

  const exportResults = () => {
    if (filteredEvaluations.length === 0) {
      alert(`No ${type} results to export`);
      return;
    }

    downloadCsv(
      `eval_${type}_${new Date().toISOString().slice(0, 10)}.csv`,
      'Proctor Name,Email,Vendor,Proctor Type,Eval Type,Panel,Scheduled Date,Attempt,Result,Comment,Certified Date',
      filteredEvaluations.map((evaluation: any) => [
        evaluation.proctor_name || '—',
        evaluation.proctor_email || '—',
        evaluation.proctor_vendor || '—',
        evaluation.proctor_type || '—',
        evaluation.eval_type || '',
        evaluation.panel_user || '',
        evaluation.scheduled_date || '',
        evaluation.attempt_number || '',
        evaluation.result || '',
        evaluation.comment || '',
        evaluation.certified_date || '',
      ])
    );
  };

  const formatDateTime = (date?: string, time?: string) => {
    if (!date) return '—';
    const d = new Date(date);
    const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    return time ? `${dateStr} ${time}` : dateStr;
  };

  const getResultBadge = (result?: string, overriddenBy?: string) => {
    const colors: Record<string, string> = {
      'Pass': 'text-success',
      'Fail': 'text-danger',
      'Reattempt': 'text-warning',
      'No Show': 'text-text3',
      'Reschedule': 'text-warning',
    };
    return (
      <span className="flex items-center gap-1">
        <span className={`text-[12px] font-bold ${colors[result || ''] || 'text-text3'}`}>
          {result || '—'}
        </span>
        {overriddenBy && (
          <span 
            className="text-[10px] font-bold text-warning" 
            title={`Overridden by ${overriddenBy}`}
          >
            ⚠️OVR
          </span>
        )}
      </span>
    );
  };

  const handleOverride = (evaluation: any) => {
    setOverrideEvaluation(evaluation);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Input
          placeholder="🔍 Name, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px]"
        />
        <Select
          options={[
            { value: '', label: 'All Results' },
            { value: 'Pass', label: 'Pass' },
            { value: 'Reattempt', label: 'Reattempt' },
            { value: 'No Show', label: 'No Show' },
            { value: 'Reschedule', label: 'Reschedule' },
          ]}
          value={resultFilter}
          onChange={(e) => setResultFilter(e.target.value)}
          className="min-w-[140px]"
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
        <Button variant="ghost" size="sm" onClick={exportResults}>
          ⬇ Export
        </Button>
      </div>

      {/* Table */}
      <Table
        data={filteredEvaluations}
        isLoading={isLoading}
        emptyMessage={`No ${type} results recorded yet`}
        columns={[
          {
            header: 'Proctor',
            accessor: (evaluation: any) => (
              <div>
                <div className="text-[13px] text-text font-semibold">{evaluation.proctor_name}</div>
                <div className="text-[11px] text-text3">{evaluation.proctor_vendor}</div>
              </div>
            ),
          },
          {
            header: 'Panel',
            accessor: (evaluation: any) => (
              <span className="text-[12px] text-text2">{evaluation.panel_user || '—'}</span>
            ),
          },
          {
            header: 'Scheduled',
            accessor: (evaluation: any) => (
              <span className="text-[12px] text-text3">
                {formatDateTime(evaluation.scheduled_date, evaluation.scheduled_time)}
              </span>
            ),
          },
          {
            header: 'Score',
            accessor: (evaluation: any) => (
              <span className="font-mono text-[12px] text-text2">
                {evaluation.score_obtained != null
                  ? `${evaluation.score_obtained}${evaluation.score_out_of ? '/' + evaluation.score_out_of : ''}`
                  : '—'}
              </span>
            ),
          },
          {
            header: 'Certified Date',
            accessor: (evaluation: any) => (
              <span className="text-[12px] text-success">
                {evaluation.result === 'Pass'
                  ? formatDateTime(evaluation.certified_date || evaluation.scheduled_date)
                  : '—'}
              </span>
            ),
          },
          {
            header: 'Attempt',
            accessor: (evaluation: any) => (
              <span className="px-2 py-0.5 rounded bg-accent/10 text-accent text-[10px] font-bold">
                #{evaluation.attempt_number || 1}
              </span>
            ),
          },
          {
            header: 'Result',
            accessor: (evaluation: any) => getResultBadge(evaluation.result, evaluation.overridden_by),
          },
          {
            header: 'Comment',
            accessor: (evaluation: any) => (
              <span className="text-[12px] text-text2">{evaluation.comment || '—'}</span>
            ),
            className: 'max-w-xs truncate',
          },
          {
            header: 'Actions',
            accessor: (evaluation: any) =>
              isAdmin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOverride(evaluation)}
                >
                  🔄 Override
                </Button>
              ) : (
                <span className="text-text3 text-[11px]">Recorded</span>
              ),
          },
        ]}
      />

      {/* Override Modal */}
      {overrideEvaluation && (
        <OverrideModal
          evaluation={overrideEvaluation}
          onClose={() => setOverrideEvaluation(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['evaluations-results'] });
            setOverrideEvaluation(null);
          }}
        />
      )}
    </div>
  );
}


interface OverrideModalProps {
  evaluation: any;
  onClose: () => void;
  onSuccess: () => void;
}

function OverrideModal({ evaluation, onClose, onSuccess }: OverrideModalProps) {
  const { user } = useAuthStore();
  const [result, setResult] = useState(evaluation.result || '');
  const [score, setScore] = useState(evaluation.score_obtained != null ? evaluation.score_obtained.toString() : '');
  const [comment, setComment] = useState(evaluation.comment || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const overrideMutation = useMutation({
    mutationFn: async () => {
      const newErrors: Record<string, string> = {};
      
      if (!result) newErrors.result = 'Result is required';
      if (!score || isNaN(Number(score))) newErrors.score = 'Score is required';
      if (['Reattempt', 'Reschedule'].includes(result) && !comment) {
        newErrors.comment = 'Comment is required for ' + result;
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        throw new Error('Validation failed');
      }

      const now = new Date().toISOString();
      const certDate = result === 'Pass' ? new Date().toISOString().slice(0, 10) : null;
      
      // Update evaluation
      const { error: evalError } = await supabase
        .from('proctor_evaluations')
        .update({
          result,
          score_obtained: Number(score),
          comment,
          certified_date: certDate,
          overridden_by: user?.username,
          overridden_at: now,
        })
        .eq('id', evaluation.id);

      if (evalError) throw evalError;

      // Update proctor ready status
      const readyField = evaluation.eval_type === 'demo' ? 'demo_ready' : 'assessment_ready';
      const evalField = evaluation.eval_type === 'demo' ? 'demo_eval' : 'assessment';
      const readyVal = result === 'Pass' ? 'pass' : result === 'No Show' ? 'noshow' : result === 'Reschedule' ? 'reschedule' : 'reattempt';
      const evalVal = result === 'Pass' ? 'Pass' : 'Pending';

      const { error: proctorError } = await supabase
        .from('proctors')
        .update({
          [readyField]: readyVal,
          [evalField]: evalVal,
          upd: now,
        })
        .eq('id', evaluation.proctor_id);

      if (proctorError) throw proctorError;

      await logAudit({
        action: evaluation.result ? 'Eval Override' : 'Eval Result',
        target: evaluation.proctor_name,
        detail: `${evaluation.eval_type} Attempt #${evaluation.attempt_number}: ${result}${comment ? ` — ${comment}` : ''}${evaluation.result ? ` [overrides: ${evaluation.result}]` : ''} · by ${user?.username || user?.name || 'system'}`,
        user: user?.username || user?.name || null,
      });
    },
    onSuccess: () => {
      alert('Result overridden successfully');
      onSuccess();
    },
    onError: (error: any) => {
      if (error.message !== 'Validation failed') {
        alert('Failed to override: ' + error.message);
      }
    },
  });

  const formatDateTime = (date?: string, time?: string) => {
    if (!date) return '—';
    const d = new Date(date);
    const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
    return time ? `${dateStr} ${time}` : dateStr;
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Override Result">
      <div className="space-y-4">
        {/* Info */}
        <div className="text-xs text-text2">
          <div>
            <strong>{evaluation.proctor_name}</strong> ({evaluation.proctor_vendor}) · {evaluation.eval_type} · 
            Panel: {evaluation.panel_user} · 
            Scheduled: {formatDateTime(evaluation.scheduled_date, evaluation.scheduled_time)} · 
            Attempt #{evaluation.attempt_number}
            {evaluation.score_out_of && ` · Score out of: ${evaluation.score_out_of}`}
          </div>
          {evaluation.result && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-2 mt-2">
              ⚠️ Result already submitted as <strong>{evaluation.result}</strong>. Admin override will be logged.
            </div>
          )}
        </div>

        {/* Form */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Result <span className="text-danger">*</span>
            </label>
            <Select
              options={[
                { value: '', label: 'Select result...' },
                { value: 'Pass', label: 'Pass' },
                { value: 'Reattempt', label: 'Reattempt' },
                { value: 'No Show', label: 'No Show' },
                { value: 'Reschedule', label: 'Reschedule' },
              ]}
              value={result}
              onChange={(e) => {
                setResult(e.target.value);
                setErrors({ ...errors, result: '' });
              }}
            />
            {errors.result && <div className="text-danger text-xs mt-1">{errors.result}</div>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Score {evaluation.score_out_of && <span className="text-text3">(out of {evaluation.score_out_of})</span>} <span className="text-danger">*</span>
            </label>
            <Input
              type="number"
              placeholder="Enter score..."
              min={0}
              value={score}
              onChange={(e) => {
                setScore(e.target.value);
                setErrors({ ...errors, score: '' });
              }}
            />
            {errors.score && <div className="text-danger text-xs mt-1">{errors.score}</div>}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text mb-1">
            Comment {['Reattempt', 'Reschedule'].includes(result) && <span className="text-danger">*</span>}
          </label>
          <textarea
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              setErrors({ ...errors, comment: '' });
            }}
            placeholder="Additional notes..."
            rows={3}
            className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-xs text-text outline-none focus:border-accent resize-none"
          />
          {errors.comment && <div className="text-danger text-xs mt-1">{errors.comment}</div>}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => overrideMutation.mutate()}
            disabled={overrideMutation.isPending}
          >
            💾 Submit Evaluation
          </Button>
        </div>
      </div>
    </Modal>
  );
}
