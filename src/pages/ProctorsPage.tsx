import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { proctorService } from '@/services/proctor';
import Table from '@/components/ui/Table';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import Modal from '@/components/ui/Modal';
import { logAudit } from '@/services/audit';
import { getScopedVendor } from '@/utils/access';
import { formatDate, exportToCSV, maskAadhaar } from '@/utils/formatters';
import { useManagedByOptions } from '@/hooks/useManagedByOptions';
import { useAuthStore } from '@/stores/auth';
import type { Proctor, ProctorFilters } from '@/types';

export default function ProctorsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<ProctorFilters>({
    search: '',
    vendor: '',
    status: '',
    ptype: '',
  });
  const [selectedProctor, setSelectedProctor] = useState<Proctor | null>(null);
  const [editingProctor, setEditingProctor] = useState<Proctor | null>(null);
  const [offboardingProctor, setOffboardingProctor] = useState<Proctor | null>(null);
  const scopedVendor = getScopedVendor(user);
  const { data: managedByOptions = [] } = useManagedByOptions();

  const { data: proctors = [], isLoading } = useQuery({
    queryKey: ['proctors', filters],
    queryFn: async () => {
      const rows = await proctorService.getAll(filters);
      if (!scopedVendor) return rows;
      return rows.filter((p) => (p.vendor || p.managed_by) === scopedVendor);
    },
  });

  const isAdmin = user?.role === 'admin';

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<Proctor> & { id: string }) => {
      const { id, ...payload } = updates;
      const { error } = await supabase
        .from('proctors')
        .update({
          ...payload,
          upd: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      const changedFields = Object.keys(variables).filter((key) => key !== 'id');
      await logAudit({
        action: 'Updated',
        target: editingProctor?.name || variables.id,
        detail: `Fields updated: ${changedFields.join(', ')} by ${user?.username || user?.name || 'system'}`,
        user: user?.username || user?.name || null,
      });
      queryClient.invalidateQueries({ queryKey: ['proctors'] });
      setEditingProctor(null);
    },
    onError: (error: any) => {
      alert('Save failed: ' + error.message);
    },
  });

  const offboardMutation = useMutation({
    mutationFn: async (payload: { id: string; reason: string; notes: string }) => {
      const { error } = await supabase
        .from('proctors')
        .update({
          status: 'Offboarded',
          oat: new Date().toISOString(),
          off_reason: payload.reason,
          off_notes: payload.notes,
          upd: new Date().toISOString(),
        })
        .eq('id', payload.id);

      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      const proctor = proctors.find((p) => p.id === variables.id);
      await logAudit({
        action: 'Offboarded',
        target: proctor?.name || variables.id,
        detail: `Reason: ${variables.reason}${variables.notes ? ` · Notes: ${variables.notes}` : ''} · by ${user?.username || user?.name || 'system'}`,
        user: user?.username || user?.name || null,
      });
      queryClient.invalidateQueries({ queryKey: ['proctors'] });
      queryClient.invalidateQueries({ queryKey: ['active-proctors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setOffboardingProctor(null);
    },
    onError: (error: any) => {
      alert('Offboard failed: ' + error.message);
    },
  });

  const handleExport = () => {
    if (proctors.length === 0) return;
    
    const exportData = proctors.map((p) => ({
      ID: p.pid || '—',
      Name: p.name,
      Aadhaar: p.aadhaar,
      'Managed By': p.managed_by || p.vendor || '',
      Type: p.ptype,
      Phone: p.phone,
      Email: p.email,
      Status: p.status,
      'Joined': formatDate(p.at),
    }));

    exportToCSV(exportData, 'proctors');
  };

  const columns = [
    {
      header: 'ID',
      accessor: (row: Proctor) => (
        <span className="font-mono text-xs text-accent">
          {row.pid || '—'}
        </span>
      ),
    },
    {
      header: 'Name',
      accessor: (row: Proctor) => (
        <span className="font-semibold text-text">{row.name}</span>
      ),
    },
    {
      header: 'Aadhaar',
      accessor: (row: Proctor) => (
        <span className="font-mono text-xs">
          {row.aadhaar ? `XXXX-XXXX-${row.aadhaar.slice(-4)}` : '—'}
        </span>
      ),
    },
    {
      header: 'Managed By',
      accessor: (row: Proctor) => {
        const vendor = row.managed_by || row.vendor;
        if (!vendor) return <span className="text-text3 text-xs">—</span>;
        
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
      },
    },
    {
      header: 'Type',
      accessor: (row: Proctor) => (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-info/10 text-info">
          {row.ptype}
        </span>
      ),
    },
    {
      header: 'Phone',
      accessor: (row: Proctor) => (
        <span className="font-mono text-xs text-text2">{row.phone}</span>
      ),
    },
    {
      header: 'BGV',
      accessor: (row: Proctor) =>
        row.bgv ? (
          <span className="text-[11px] font-bold text-success">✅ Uploaded</span>
        ) : (
          <span className="text-[11px] text-warning font-semibold">⚠ Pending</span>
        ),
    },
    {
      header: 'Demo',
      accessor: (row: Proctor) => (
        <EvalBadge value={row.demo_eval} />
      ),
    },
    {
      header: 'Assessment',
      accessor: (row: Proctor) => (
        <EvalBadge value={row.assessment} />
      ),
    },
    {
      header: 'Activated',
      accessor: (row: Proctor) => (
        <span className="text-xs text-text3">{row.aat ? formatDate(row.aat) : '—'}</span>
      ),
    },
    {
      header: 'Status',
      accessor: (row: Proctor) => <Badge status={row.status} />,
    },
    {
      header: 'Joined',
      accessor: (row: Proctor) => (
        <span className="text-xs text-text3">{formatDate(row.at)}</span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: Proctor) => (
        <div className="flex gap-1">
          <button
            className="text-accent hover:text-accent/80 text-xs px-2 py-1"
            onClick={() => setSelectedProctor(row)}
          >
            View
          </button>
          <button
            className="text-warning hover:text-warning/80 text-xs px-2 py-1"
            onClick={() => setEditingProctor(row)}
          >
            Edit
          </button>
          {isAdmin && row.status === 'Active' && (
            <button
              className="text-danger hover:text-danger/80 text-xs px-2 py-1"
              onClick={() => setOffboardingProctor(row)}
            >
              Offboard
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <Input
              placeholder="🔍 Search name, ID, Aadhaar..."
              value={filters.search}
              onChange={(e) =>
                setFilters({ ...filters, search: e.target.value })
              }
            />
          </div>

          <Select
            options={[
              { value: '', label: 'All Managed By' },
              ...managedByOptions,
            ]}
            value={filters.vendor}
            onChange={(e) =>
              setFilters({ ...filters, vendor: e.target.value as any })
            }
            className="min-w-[160px]"
          />

          <Select
            options={[
              { value: '', label: 'All Status' },
              { value: 'In Progress', label: 'In Progress' },
              { value: 'Verified', label: 'Verified' },
              { value: 'Active', label: 'Active' },
              { value: 'Offboarded', label: 'Offboarded' },
            ]}
            value={filters.status}
            onChange={(e) =>
              setFilters({ ...filters, status: e.target.value as any })
            }
            className="min-w-[140px]"
          />

          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-text3">
              {proctors.length} proctor{proctors.length !== 1 ? 's' : ''}
            </span>
            <Button variant="ghost" size="sm" onClick={handleExport}>
              ⬇ Export
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Table
        data={proctors}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No proctors found. Try adjusting your filters."
      />

      {selectedProctor && (
        <ProctorDetailsModal
          proctor={selectedProctor}
          onClose={() => setSelectedProctor(null)}
        />
      )}

      {editingProctor && (
        <EditProctorModal
          proctor={editingProctor}
          isAdmin={isAdmin}
          onClose={() => setEditingProctor(null)}
          onSave={(updates) =>
            updateMutation.mutate({
              id: editingProctor.id,
              ...updates,
            })
          }
          isSaving={updateMutation.isPending}
        />
      )}

      {offboardingProctor && (
        <OffboardProctorModal
          proctor={offboardingProctor}
          onClose={() => setOffboardingProctor(null)}
          onConfirm={(reason, notes) =>
            offboardMutation.mutate({
              id: offboardingProctor.id,
              reason,
              notes,
            })
          }
          isSaving={offboardMutation.isPending}
        />
      )}
    </div>
  );
}

function EvalBadge({ value }: { value?: string }) {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'pass' || normalized === 'passed') {
    return <span className="text-[11px] font-bold text-[#166534] bg-[#dcfce7] px-2 py-0.5 rounded">Pass</span>;
  }
  if (normalized === 'fail' || normalized === 'failed') {
    return <span className="text-[11px] font-bold text-danger">Fail</span>;
  }
  if (normalized === 'ready') {
    return <span className="text-[11px] font-bold text-info">Ready</span>;
  }
  if (normalized === 'scheduled') {
    return <span className="text-[11px] font-bold text-accent">Scheduled</span>;
  }
  if (normalized === 'pending' || !value) {
    return <span className="text-[11px] text-text3">Pending</span>;
  }
  return <span className="text-[11px] text-text3">{value}</span>;
}

function ProctorDetailsModal({
  proctor,
  onClose,
}: {
  proctor: Proctor;
  onClose: () => void;
}) {
  const docs = [
    { key: 'doc_resume', label: 'Resume' },
    { key: 'doc_passport_photo', label: 'Passport Photo' },
    { key: 'doc_grad_cert', label: 'Grad Certificate' },
    { key: 'doc_aadhaar_copy', label: 'Aadhaar Copy' },
    { key: 'doc_pan_copy', label: 'PAN Copy' },
    { key: 'doc_eye_test', label: 'Eye Test' },
  ] as const;

  const demoEval = proctor.demo_eval || '—';
  const assessment = proctor.assessment || '—';
  const ndaStatus = proctor.nda_status || '—';
  const demoOk = demoEval === 'Pass' || demoEval === 'pass';
  const assessOk = assessment === 'Pass' || assessment === 'pass';
  const ndaSigned = ndaStatus === 'NDA Signed';
  const ndaPending = ndaStatus === 'NDA Pending';
  const steps = [
    { label: 'Submitted', done: true },
    { label: 'Assessment', done: assessOk },
    { label: 'Demo', done: demoOk },
    { label: 'NDA signed', done: ndaSigned, warn: ndaPending },
    { label: 'Verified', done: proctor.status === 'Verified' || proctor.status === 'Active' },
    { label: 'Active', done: proctor.status === 'Active' },
  ];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`${proctor.name}${proctor.pid ? ` — ${proctor.pid}` : ''}`}
      size="lg"
    >
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
          <DetailItem label="Aadhaar" value={maskAadhaar(proctor.aadhaar)} mono />
          <DetailItem label="Managed By" value={proctor.managed_by || proctor.vendor || '—'} />
          <DetailItem label="Status" value={proctor.status} />
          <DetailItem label="DOB" value={proctor.dob || '—'} />
          <DetailItem label="Gender" value={proctor.gender || '—'} />
          <DetailItem label="Proctor Type" value={proctor.ptype || '—'} />
          <DetailItem label="Phone" value={proctor.phone || '—'} />
          <DetailItem label="Email" value={proctor.email || '—'} />
          <DetailItem label="Location" value={[proctor.city, proctor.state].filter(Boolean).join(', ') || '—'} className="md:col-span-2" />
          <DetailItem label="Created By" value={`${proctor.by_user || '—'} · ${formatDate(proctor.at)}`} />
          <DetailItem label="Updated" value={formatDate(proctor.upd)} />
          <DetailItem label="Demo Evaluation" value={demoEval} />
          <DetailItem label="Assessment" value={assessment} />
          <DetailItem label="BGV" value={proctor.bgv || '—'} />
          <DetailItem label="NDA Status" value={ndaStatus} />
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
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EditProctorModal({
  proctor,
  isAdmin,
  onClose,
  onSave,
  isSaving,
}: {
  proctor: Proctor;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (updates: Partial<Proctor>) => void;
  isSaving: boolean;
}) {
  const { data: managedByOptions = [] } = useManagedByOptions();
  const [formData, setFormData] = useState({
    name: proctor.name || '',
    aadhaar: proctor.aadhaar || '',
    dob: proctor.dob || '',
    gender: proctor.gender || '',
    ptype: proctor.ptype || '',
    managed_by: proctor.managed_by || proctor.vendor || '',
    phone: proctor.phone || '',
    email: proctor.email || '',
    city: proctor.city || '',
    state: proctor.state || '',
    notes: proctor.notes || '',
  });
  const [error, setError] = useState('');

  const submit = () => {
    if (!isAdmin) {
      setError('No permission');
      return;
    }
    if (!formData.name.trim()) return setError('Name is required');
    if (formData.aadhaar && !/^\d{12}$/.test(formData.aadhaar)) return setError('Aadhaar must be exactly 12 digits');
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) return setError('Mobile number must be exactly 10 digits');
    if (formData.email && !formData.email.includes('@')) return setError('Email address is not valid');

    onSave({
      ...formData,
      vendor: formData.managed_by as any,
      managed_by: formData.managed_by as any,
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Edit ${proctor.name}`} size="lg">
      <div className="space-y-4">
        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger text-sm">
            {error}
          </div>
        )}
        {!isAdmin && (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-warning text-sm">
            Only administrators can edit proctors.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Name" value={formData.name} onChange={(name) => setFormData({ ...formData, name })} />
          <Field label="Aadhaar" value={formData.aadhaar} onChange={(aadhaar) => setFormData({ ...formData, aadhaar })} />
          <Field label="DOB" value={formData.dob} onChange={(dob) => setFormData({ ...formData, dob })} type="date" />
          <SelectField
            label="Gender"
            value={formData.gender}
            onChange={(gender) => setFormData({ ...formData, gender: gender as Proctor['gender'] })}
            options={['', 'Male', 'Female', 'Other']}
          />
          <SelectField
            label="Proctor Type"
            value={formData.ptype}
            onChange={(ptype) => setFormData({ ...formData, ptype: ptype as Proctor['ptype'] })}
            options={['', 'WFO', 'ODP', 'Hybrid']}
          />
          <SelectField
            label="Managed By"
            value={formData.managed_by}
            onChange={(managed_by) => setFormData({ ...formData, managed_by: managed_by as Proctor['managed_by'] })}
            options={['', ...managedByOptions.map((option) => option.value)]}
          />
          <Field label="Phone" value={formData.phone} onChange={(phone) => setFormData({ ...formData, phone })} />
          <Field label="Email" value={formData.email} onChange={(email) => setFormData({ ...formData, email })} />
          <Field label="City" value={formData.city} onChange={(city) => setFormData({ ...formData, city })} />
          <Field label="State" value={formData.state} onChange={(state) => setFormData({ ...formData, state })} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text mb-1">Notes</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-text outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={isSaving || !isAdmin}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function OffboardProctorModal({
  proctor,
  onClose,
  onConfirm,
  isSaving,
}: {
  proctor: Proctor;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
  isSaving: boolean;
}) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const confirm = () => {
    if (!reason) {
      setError('Please select a reason');
      return;
    }
    onConfirm(reason, notes);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Offboard Proctor" size="md">
      <div className="space-y-4">
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-warning text-sm">
          Offboard <strong>{proctor.name}</strong> ({proctor.pid || 'No PID'})
        </div>

        {error && (
          <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-text mb-1">Reason *</label>
          <Select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError('');
            }}
            options={[
              { value: '', label: 'Select reason...' },
              { value: 'Contract ended', label: 'Contract ended' },
              { value: 'Resignation', label: 'Resignation' },
              { value: 'Policy violation', label: 'Policy violation' },
              { value: 'Performance issues', label: 'Performance issues' },
              { value: 'Other', label: 'Other' },
            ]}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-text mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Additional notes..."
            className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-text outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={isSaving}>
            {isSaving ? 'Offboarding...' : 'Confirm Offboard'}
          </Button>
        </div>
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text mb-1">{label}</label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text mb-1">{label}</label>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={options.map((opt) => ({ value: opt, label: opt || 'Select...' }))}
      />
    </div>
  );
}
