import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { logAudit } from '@/services/audit';
import { getScopedVendor } from '@/utils/access';
import { useManagedByOptions } from '@/hooks/useManagedByOptions';
import type { Proctor } from '@/types';

const VENDOR_PID_PREFIX: Record<string, string> = {
  Sai: 'SAI',
  TSN: 'TSN',
  Avner: 'AVN',
  'A&M': 'ANM',
  ATS: 'ATS',
  Awign: 'AWG',
};

export default function OnboardingPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [selectedProctor, setSelectedProctor] = useState<Proctor | null>(null);

  const isAdmin = user?.role === 'admin';
  const isVendor = user?.role === 'vendor';
  const scopedVendor = getScopedVendor(user);
  const { data: managedByOptions = [] } = useManagedByOptions();

  // Fetch proctors with status In Progress or Verified
  const { data: proctors = [], isLoading } = useQuery({
    queryKey: ['in-progress-proctors', user?.vendor],
    queryFn: async () => {
      let query = supabase
        .from('proctors')
        .select('*')
        .neq('status', 'Archived')
        .in('status', ['In Progress', 'Verified'])
        .order('at', { ascending: false });

      // Vendor role sees only their proctors
      if (scopedVendor) {
        query = query.eq('vendor', scopedVendor).or(`managed_by.eq.${scopedVendor}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data as Proctor[]).map(p => ({
        ...p,
        vendor: p.vendor || p.managed_by
      }));
    },
  });

  // Filter proctors
  const filteredProctors = proctors.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !(p.name || '').toLowerCase().includes(s) &&
        !(p.email || '').toLowerCase().includes(s) &&
        !(p.phone || '').includes(s)
      ) {
        return false;
      }
    }
    if (vendorFilter && p.vendor !== vendorFilter) return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const exportCsv = () => {
    const BOM = '\uFEFF';
    const header = 'Proctor ID,Name,Vendor,Type,Phone,Email,City,State,Status,BGV,NDA,Created,Activated,Offboarded';
    const rows = filteredProctors.map((p) =>
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
    a.download = `proctors_onboarding_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Input
          placeholder="🔍 Name, phone, email..."
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
        <Button variant="ghost" size="sm" onClick={exportCsv}>
          ⬇ Export
        </Button>
      </div>

      {/* Table */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface2">
              <tr>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Name
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Managed By
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Type
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Submitted
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  BGV
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Demo
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Assessment
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  NDA
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Docs
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="px-3.5 py-8 text-center text-text3">
                    Loading...
                  </td>
                </tr>
              ) : filteredProctors.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3.5 py-8 text-center text-text3">
                    No proctors in progress
                  </td>
                </tr>
              ) : (
                filteredProctors.map((proctor) => (
                  <ProctorRow
                    key={proctor.id}
                    proctor={proctor}
                    isAdmin={isAdmin}
                    isVendor={isVendor}
                    formatDate={formatDate}
                    onView={() => setSelectedProctor(proctor)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedProctor && (
        <ProctorDetailsModal
          proctor={selectedProctor}
          isAdmin={isAdmin}
          formatDate={formatDate}
          onClose={() => setSelectedProctor(null)}
        />
      )}
    </div>
  );
}

interface ProctorRowProps {
  proctor: Proctor;
  isAdmin: boolean;
  isVendor: boolean;
  formatDate: (date: string) => string;
  onView: () => void;
}

function ProctorRow({ proctor, isAdmin, isVendor, formatDate, onView }: ProctorRowProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { error } = await supabase.from('proctors').update({
        vendor_verified: true,
        vendor_verified_by: user?.username || '',
        vendor_verified_at: now,
        status: 'Verified',
        stage: 2,
        upd: now,
      }).eq('id', proctor.id);
      if (error) throw error;
      await logAudit({
        action: 'Verified',
        target: proctor.name,
        detail: `Vendor verification complete by ${user?.username || 'system'}`,
        user: user?.username || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-progress-proctors'] });
    },
    onError: (error: any) => {
      console.error('Verify failed: ' + error.message);
    },
  });

  // Trigger NDA & Docs mutation
  const triggerNDAMutation = useMutation({
    mutationFn: async () => {
      const now = new Date().toISOString();
      const { error } = await supabase.from('proctors').update({
        nda_status: 'NDA Pending',
        nda_triggered_at: now,
        nda_triggered_by: user?.username || '',
        final_form_status: 'sent',
        upd: now,
      }).eq('id', proctor.id);
      if (error) throw error;
      await logAudit({
        action: 'NDA & Docs Triggered',
        target: proctor.name,
        detail: `NDA and document collection triggered by ${user?.username || 'system'}`,
        user: user?.username || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-progress-proctors'] });
    },
    onError: (error: any) => {
      console.error('NDA trigger failed: ' + error.message);
    },
  });

  // Set eval ready mutation
  const setReadyMutation = useMutation({
    mutationFn: async ({ type }: { type: 'demo' | 'assessment' }) => {
      const field = type === 'demo' ? 'demo_ready' : 'assessment_ready';
      
      const { error } = await supabase
        .from('proctors')
        .update({
          [field]: 'ready',
          upd: new Date().toISOString(),
        })
        .eq('id', proctor.id);

      if (error) throw error;
    },
    onSuccess: async (_, vars) => {
      await logAudit({
        action: 'Eval Ready',
        target: proctor.name,
        detail: `${vars.type === 'demo' ? 'Demo' : 'Assessment'} marked Ready by ${user?.username || user?.name || 'system'}`,
        user: user?.username || user?.name || null,
      });
      queryClient.invalidateQueries({ queryKey: ['in-progress-proctors'] });
      alert('Marked as ready');
    },
    onError: (error: any) => {
      alert('Failed: ' + error.message);
    },
  });

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

  const getTypeBadge = (ptype: string) => (
    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-info/10 text-info">
      {ptype}
    </span>
  );

  const getBGVBadge = (bgv?: string) => {
    if (!bgv) return <span className="text-[11px] text-text3">—</span>;
    const colors: Record<string, string> = {
      'Pending': 'text-warning',
      'Clear': 'text-success',
      'Rejected': 'text-danger',
    };
    return <span className={`text-[11px] font-bold ${colors[bgv] || 'text-text3'}`}>{bgv}</span>;
  };

  const getEvalBadge = (status?: string, type?: 'demo' | 'assessment') => {
    if (status === 'pass') {
      return <span className="text-[11px] font-bold text-success">✅ Pass</span>;
    }
    if (status === 'scheduled') {
      return <span className="text-[11px] font-bold text-accent">📅 Scheduled</span>;
    }
    if (status === 'ready') {
      return <span className="text-[11px] font-bold text-info">✅ Ready</span>;
    }
    if (['reattempt', 'noshow', 'reschedule'].includes(status || '')) {
      const label = status === 'reattempt' ? '🔄 Reattempt' : status === 'noshow' ? '❌ No Show' : '📅 Rescheduled';
      return (
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-bold text-warning">{label}</span>
          {isVendor && type && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => setReadyMutation.mutate({ type })}
              className="!text-[10px] !px-2 !py-1"
            >
              Ready
            </Button>
          )}
        </div>
      );
    }
    // awaiting
    if (isVendor && type) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setReadyMutation.mutate({ type })}
          className="!text-[11px] !px-2 !py-1"
        >
          Set Ready
        </Button>
      );
    }
    return <span className="text-[11px] text-text3">Awaiting</span>;
  };

  const getNDABadge = (status?: string) => {
    if (status === 'NDA Signed') {
      return <span className="text-[11px] font-bold text-success">✅ Signed</span>;
    }
    if (status === 'NDA Pending') {
      return <span className="text-[11px] font-bold text-warning">⏳ Pending</span>;
    }
    return <span className="text-[11px] text-text3">—</span>;
  };

  const getDocsBadge = () => {
    const docs = ['doc_resume', 'doc_passport_photo', 'doc_grad_cert', 'doc_aadhaar_copy', 'doc_pan_copy', 'doc_eye_test'];
    const filled = docs.filter(d => (proctor as any)[d]).length;
    const total = docs.length;

    if (!proctor.final_form_status && filled === 0) {
      return <span className="text-[11px] text-text3">—</span>;
    }
    if (filled === total) {
      return <span className="text-[11px] font-bold text-success">✅ Complete</span>;
    }
    if (filled > 0) {
      return <span className="text-[11px] font-bold text-warning">📄 {filled}/{total}</span>;
    }
    if (proctor.final_form_status === 'sent') {
      return <span className="text-[11px] font-bold text-accent">📨 Sent</span>;
    }
    return <span className="text-[11px] text-text3">—</span>;
  };

  const getActions = () => {
    if (!isAdmin) {
      return (
        <Button variant="ghost" size="sm" onClick={onView}>
          👁 View
        </Button>
      );
    }

    const demoPass = proctor.demo_ready === 'pass';
    const assessPass = proctor.assessment_ready === 'pass';
    const bothPass = demoPass && assessPass;
    const ndaSigned = proctor.nda_status === 'NDA Signed';
    const ndaPending = proctor.nda_status === 'NDA Pending';

    const docs = ['doc_resume', 'doc_passport_photo', 'doc_grad_cert', 'doc_aadhaar_copy', 'doc_pan_copy', 'doc_eye_test'];
    const docsOk = docs.every(d => (proctor as any)[d]);
    const canVerify = (proctor.status === 'In Progress' || proctor.status === 'Verified') && docsOk && ndaSigned && !proctor.vendor_verified;

      return (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onView}>
          👁 View
        </Button>
        
        {canVerify ? (
          <Button variant="ghost" size="sm" onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
            ✅ Verify
          </Button>
        ) : (docsOk && ndaSigned && proctor.vendor_verified) ? (
          <span className="text-[11px] text-success font-semibold">✅ Verified</span>
        ) : (
          <Button variant="ghost" size="sm" disabled title={!ndaSigned ? 'NDA not signed' : !docsOk ? 'Documents not submitted' : 'Already verified'}>
            ✅ Verify
          </Button>
        )}

        {!bothPass ? (
          <Button variant="ghost" size="sm" disabled title="Assessment and Demo must both pass first">
            📨 Trigger NDA
          </Button>
        ) : !ndaPending && !ndaSigned ? (
          <Button variant="primary" size="sm" onClick={() => triggerNDAMutation.mutate()} disabled={triggerNDAMutation.isPending}>
            📨 Trigger NDA & Docs
          </Button>
        ) : ndaPending && !ndaSigned ? (
          <Button variant="ghost" size="sm" disabled title="Waiting for proctor to sign">
            ⏳ NDA Pending
          </Button>
        ) : ndaSigned && !proctor.pid ? (
          <Button variant="success" size="sm" onClick={onView}>
            🎯 Assign ID
          </Button>
        ) : proctor.pid ? (
          <span className="text-[11px] text-success font-semibold">✅ Active</span>
        ) : null}
      </div>
    );
  };

  return (
    <tr className="border-b border-border hover:bg-surface2/50">
      <td className="px-3.5 py-2.5">
        <div className="text-[13px] text-text">{proctor.name}</div>
        <div className="text-[11px] text-text3">{proctor.email || ''}</div>
      </td>
      <td className="px-3.5 py-2.5">{getVendorBadge(proctor.vendor!)}</td>
      <td className="px-3.5 py-2.5">{getTypeBadge(proctor.ptype)}</td>
      <td className="px-3.5 py-2.5 text-[12px] text-text3">{formatDate(proctor.at)}</td>
      <td className="px-3.5 py-2.5">{getBGVBadge(proctor.bgv)}</td>
      <td className="px-3.5 py-2.5">{getEvalBadge(proctor.demo_ready, 'demo')}</td>
      <td className="px-3.5 py-2.5">{getEvalBadge(proctor.assessment_ready, 'assessment')}</td>
      <td className="px-3.5 py-2.5">{getNDABadge(proctor.nda_status)}</td>
      <td className="px-3.5 py-2.5">{getDocsBadge()}</td>
      <td className="px-3.5 py-2.5">{getActions()}</td>
    </tr>
  );
}

function ProctorDetailsModal({
  proctor,
  isAdmin,
  formatDate,
  onClose,
}: {
  proctor: Proctor;
  isAdmin: boolean;
  formatDate: (date: string) => string;
  onClose: () => void;
}) {
  const demoOk = proctor.demo_eval === 'Pass' || proctor.demo_eval === 'pass';
  const assessOk = proctor.assessment === 'Pass' || proctor.assessment === 'pass';
  const ndaSigned = proctor.nda_status === 'NDA Signed';
  const ndaPending = proctor.nda_status === 'NDA Pending';
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!isAdmin) throw new Error('No permission');
      if (!ndaSigned) throw new Error('NDA not signed');
      if (proctor.pid) throw new Error('Proctor already has an ID');

      const { data: pidRows, error: pidError } = await supabase
        .from('proctors')
        .select('pid, vendor, managed_by')
        .not('pid', 'is', null);

      if (pidError) throw pidError;

      const vendorName = proctor.vendor || proctor.managed_by || '';
      const prefix = VENDOR_PID_PREFIX[vendorName] || vendorName.slice(0, 3).toUpperCase();
      const existing = (pidRows || [])
        .map((row: any) => row.pid as string)
        .filter((pid: string) => pid && pid.startsWith(`${prefix}-`));

      let maxN = 0;
      for (const pid of existing) {
        const match = pid.match(/-(\d+)$/);
        if (match) maxN = Math.max(maxN, parseInt(match[1], 10));
      }

      let newPid = `${prefix}-${String(maxN + 1).padStart(4, '0')}`;
      const now = new Date().toISOString();

      // Check if PID already taken (race condition guard)
      const { data: existingPid } = await supabase
        .from('proctors')
        .select('id')
        .eq('pid', newPid)
        .maybeSingle();
      if (existingPid) {
        maxN += 1;
        newPid = `${prefix}-${String(maxN + 1).padStart(4, '0')}`;
      }

      const { error: updateError } = await supabase
        .from('proctors')
        .update({
          pid: newPid,
          status: 'Active',
          stage: 3,
          aat: now,
          upd: now,
        })
        .eq('id', proctor.id);

      if (updateError) throw updateError;

      await logAudit({
        action: 'ID Assigned',
        target: proctor.name,
        detail: `ID: ${newPid} → Active · by ${user?.username || user?.name || 'system'}`,
        user: user?.username || user?.name || null,
      });

      return newPid;
    },
    onSuccess: async (newPid) => {
      await queryClient.invalidateQueries({ queryKey: ['in-progress-proctors'] });
      await queryClient.invalidateQueries({ queryKey: ['proctors'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      alert(`ID ${newPid} assigned! ${proctor.name} is now Active.`);
      onClose();
    },
    onError: (error: any) => {
      alert('Assign ID failed: ' + error.message);
    },
  });

  const steps = [
    { label: 'Submitted', done: true },
    { label: 'Assessment', done: assessOk },
    { label: 'Demo', done: demoOk },
    { label: 'NDA signed', done: ndaSigned, warn: ndaPending },
    { label: 'Verified', done: (proctor.stage || 1) >= 2 },
    { label: 'Active', done: (proctor.stage || 1) >= 3 },
  ];

  const docs = [
    { key: 'doc_resume', label: 'Resume' },
    { key: 'doc_passport_photo', label: 'Passport Photo' },
    { key: 'doc_grad_cert', label: 'Grad Certificate' },
    { key: 'doc_aadhaar_copy', label: 'Aadhaar Copy' },
    { key: 'doc_pan_copy', label: 'PAN Copy' },
    { key: 'doc_eye_test', label: 'Eye Test' },
  ] as const;

  const getEvalLabel = (value?: string) => {
    if (!value) return '—';
    return value;
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`${proctor.name}${proctor.pid ? ` — ${proctor.pid}` : ''}`} size="lg">
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
          {steps.map((step, idx) => (
            <div key={step.label} className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-semibold ${
                  step.done
                    ? 'bg-success text-white'
                    : step.warn
                      ? 'bg-warning text-black'
                      : 'bg-surface2 text-text3'
                }`}
              >
                {step.done ? '✓' : step.warn ? '⏳' : '○'} {step.label}
              </span>
              {idx < steps.length - 1 && <span className="text-text3 text-xs">›</span>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <DetailItem label="Full Name" value={proctor.name} />
          <DetailItem label="Proctor ID" value={proctor.pid || 'Not assigned yet'} mono />
          <DetailItem label="Aadhaar" value={isAdmin ? proctor.aadhaar : maskAadhaar(proctor.aadhaar)} mono />
          <DetailItem label="Managed By" value={proctor.vendor || proctor.managed_by || '—'} />
          <DetailItem label="Status" value={proctor.status} />
          <DetailItem label="DOB" value={proctor.dob || '—'} />
          <DetailItem label="Gender" value={proctor.gender || '—'} />
          <DetailItem label="Proctor Type" value={proctor.ptype || '—'} />
          <DetailItem label="Phone" value={proctor.phone || '—'} />
          <DetailItem label="Email" value={proctor.email || '—'} />
          <DetailItem label="Location" value={[proctor.city, proctor.state].filter(Boolean).join(', ') || '—'} className="md:col-span-2" />
          <DetailItem label="Created By" value={`${proctor.by_user || '—'} · ${formatDate(proctor.at)}`} />
          <DetailItem label="Updated" value={formatDate(proctor.upd)} />
          <DetailItem label="Demo Evaluation" value={getEvalLabel(proctor.demo_eval)} />
          <DetailItem label="Assessment" value={getEvalLabel(proctor.assessment)} />
          <DetailItem label="BGV" value={proctor.bgv || '—'} />
          <DetailItem label="NDA Status" value={proctor.nda_status || '—'} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-text mb-2">Documents & NDA</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {docs.map((doc) => {
              const value = (proctor as any)[doc.key] as string | undefined;
              return (
                <div key={doc.key} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface2 px-3 py-2">
                  <span className="text-[12px] text-text2">{doc.label}</span>
                  {value ? (
                    <a href={value} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-accent">
                      View
                    </a>
                  ) : (
                    <span className="text-[12px] text-text3">Missing</span>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface2 px-3 py-2">
              <span className="text-[12px] text-text2">NDA File</span>
              {proctor.nda_file_url ? (
                <a href={proctor.nda_file_url} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-accent">
                  View
                </a>
              ) : (
                <span className="text-[12px] text-text3">Missing</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface2 px-3 py-2">
              <span className="text-[12px] text-text2">Form Status</span>
              <span className="text-[12px] font-semibold text-text">{proctor.form_status || '—'}</span>
            </div>
          </div>
        </div>

        {isAdmin && ndaSigned && !proctor.pid && (
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="success"
              onClick={() => assignMutation.mutate()}
              disabled={assignMutation.isPending}
            >
              {assignMutation.isPending ? 'Assigning...' : '🎯 Assign ID'}
            </Button>
          </div>
        )}

        {proctor.pid && (
          <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-success text-sm">
            Proctor is active with ID <strong>{proctor.pid}</strong>.
          </div>
        )}
      </div>
    </Modal>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
  className = '',
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-border bg-surface2 px-3 py-2 ${className}`}>
      <div className="text-[11px] uppercase tracking-wide text-text3 mb-1">{label}</div>
      <div className={`text-[13px] text-text ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function maskAadhaar(aadhaar?: string) {
  if (!aadhaar) return '—';
  if (aadhaar.length >= 4) return `XXXX-XXXX-${aadhaar.slice(-4)}`;
  return aadhaar;
}
