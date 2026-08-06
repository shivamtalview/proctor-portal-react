import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth';
import Table from '@/components/ui/Table';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { logAudit } from '@/services/audit';
import { getScopedVendor } from '@/utils/access';
import { PROCTOR_TYPES } from '@/utils/constants';
import { useManagedByOptions } from '@/hooks/useManagedByOptions';
import type { Proctor } from '@/types';

export default function InterviewSelectsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingProctor, setEditingProctor] = useState<Proctor | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvProcessing, setCsvProcessing] = useState(false);

  const isReadOnly = user?.role === 'coordinator';
  const isVendor = user?.role === 'vendor';
  const scopedVendor = getScopedVendor(user);
  const { data: managedByOptions = [] } = useManagedByOptions();
  const managedByValues = new Set(managedByOptions.map((option) => option.value));

  // Fetch interview selects
  const { data: interviewSelects = [], isLoading } = useQuery({
    queryKey: ['interview-selects', user?.vendor],
    queryFn: async () => {
      let query = supabase
        .from('proctors')
        .select('*')
        .order('at', { ascending: false });

      // Vendor role sees only their proctors
      if (scopedVendor) {
        query = query.eq('managed_by', scopedVendor);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter for interview_stage = 'interview_selected' (client-side like HTML app)
      return (data as Proctor[]).filter(p => p.interview_stage === 'interview_selected');
    },
  });

  // Filter by search, vendor, and status
  const filteredData = interviewSelects.filter((p) => {
    // Search filter
    if (search) {
      const s = search.toLowerCase();
      if (
        !p.email?.toLowerCase().includes(s) &&
        !p.name?.toLowerCase().includes(s)
      ) {
        return false;
      }
    }

    // Vendor filter (only for non-vendor roles)
    if (!isVendor && vendorFilter && p.managed_by !== vendorFilter) {
      return false;
    }

    // Status filter
    if (statusFilter) {
      if (statusFilter === 'not_sent') {
        if (p.form_status && p.form_status !== 'not_sent') return false;
      } else if (p.form_status !== statusFilter) {
        return false;
      }
    }

    return true;
  });

  // Send onboarding link mutation
  const sendLinkMutation = useMutation({
    mutationFn: async (proctorId: string) => {
      const proctor = filteredData.find((p) => p.id === proctorId);
      if (!proctor || !proctor.email) throw new Error('No email address');

      // Call Edge Function to send email
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/send-form-link`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ proctorId }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Invalid response from server');
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to send form link');
      }

      return data;
    },
    onSuccess: async (_, proctorId) => {
      const proctor = filteredData.find((p) => p.id === proctorId);
      if (proctor) {
        await logAudit({
          action: 'Form Link Shared',
          target: proctor.email || proctor.name || proctor.id,
          detail: `Sent by ${user?.username || user?.name || 'system'}`,
          user: user?.username || user?.name || null,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['interview-selects'] });
      alert('✅ Form link sent successfully! The proctor will receive an email with instructions.');
    },
    onError: (error: any) => {
      console.error('Send form error:', error);
      alert('❌ Error: ' + error.message);
    },
  });

  // Export Links function
  const handleExportLinks = () => {
    const toExport = selectedIds.size > 0 
      ? filteredData.filter(p => selectedIds.has(p.id))
      : filteredData;

    if (toExport.length === 0) {
      alert('No records to export');
      return;
    }

    const baseUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
    const BOM = '\uFEFF';
    const header = 'Email,Vendor,Type,Form Link';
    
    const rows = toExport.map(p => {
      const token = p.form_link_token || crypto.randomUUID().replace(/-/g, '');
      const url = `${baseUrl}?pubform=1&vendor=${encodeURIComponent(p.managed_by || '')}&ptype=${encodeURIComponent(p.ptype || '')}&email=${encodeURIComponent(p.email || '')}&token=${token}`;
      
      return [p.email, p.managed_by, p.ptype, url]
        .map(v => `"${String(v || '').replace(/"/g, '\\"')}"`)
        .join(',');
    });

    const csv = BOM + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `interview_selects_links_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    alert('Links exported successfully!');
  };

  // Download CSV template
  const downloadTemplate = () => {
    const BOM = '\uFEFF';
    const header = 'email,managed_by,ptype,notes';
    const example = '"john@gmail.com","Sai","ODP","Strong candidate"\n"jane@gmail.com","TSN","WFO",""';
    const blob = new Blob([BOM + header + '\n' + example], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'interview_selects_template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    alert('Template downloaded');
  };

  // Handle CSV file upload
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset processing state when new file is uploaded
    setCsvProcessing(false);

    const text = await file.text();
    const lines = text.trim().split('\n');
    
    if (lines.length < 2) {
      alert('File appears empty');
      return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const emailIdx = headers.indexOf('email');
    const vendorIdx = headers.indexOf('managed_by');
    const ptypeIdx = headers.indexOf('ptype');
    const notesIdx = headers.indexOf('notes');

    if (emailIdx < 0) {
      alert('CSV must have email column');
      return;
    }

    const rows = lines.slice(1).map(line => {
      // Simple CSV parse (handles quoted values)
      const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      
      const email = values[emailIdx]?.trim().toLowerCase() || '';
      const vendor = values[vendorIdx]?.trim() || '';
      const ptype = values[ptypeIdx]?.trim() || '';
      const notes = notesIdx >= 0 ? values[notesIdx]?.trim() || '' : '';

      const errors: string[] = [];
      
      if (!email || !email.includes('@')) errors.push('Invalid email');
      if (vendor && !managedByValues.has(vendor)) errors.push('Unknown vendor: ' + vendor);
      if (!['WFO', 'ODP', 'Hybrid'].includes(ptype)) errors.push('Invalid ptype: ' + ptype);
      
      // Check if already exists
      const exists = interviewSelects.find(p => p.email?.toLowerCase() === email);
      if (exists) errors.push(`Already in system (${email})`);

      return {
        email,
        vendor,
        ptype,
        notes,
        _ok: errors.length === 0,
        _errors: errors,
      };
    }).filter(r => r.email);

    setCsvData(rows);
  };

  // Import CSV mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const validRows = csvData.filter(r => r._ok);
      if (validRows.length === 0) {
        throw new Error('Nothing to import');
      }

      const now = new Date().toISOString();

      // Build all rows upfront for a single batch insert
      const rowsToInsert = validRows.map(r => {
        const pid = crypto.randomUUID();
        const token = crypto.randomUUID().replace(/-/g, '');
        return {
          id: pid,
          pid: '',
          name: '',
          aadhaar: `PENDING_${pid.slice(0, 8)}`,
          vendor: r.vendor,
          phone: `PENDING_${pid.slice(9, 17)}`,
          email: r.email,
          address: '',
          city: '',
          state: '',
          dob: '',
          gender: '',
          ptype: r.ptype,
          bgv: '',
          nda: '',
          notes: r.notes,
          demo_eval_link: '',
          assessment_link: '',
          demo_eval: 'Pending',
          assessment: 'Pending',
          demo_ready: 'awaiting',
          assessment_ready: 'awaiting',
          demo_ready_attempt: 1,
          assessment_ready_attempt: 1,
          nda_status: '',
          nda_triggered_at: null,
          nda_triggered_by: '',
          nda_signed_at: null,
          nda_file_url: '',
          status: 'Interview Selected',
          stage: 0,
          interview_stage: 'interview_selected',
          form_status: 'not_sent',
          form_link_token: token,
          managed_by: r.vendor,
          vendor_verified: false,
          vendor_verified_by: '',
          vendor_verified_at: null,
          by_user: user?.username || user?.email || 'system',
          at: now,
          upd: now,
          vby: '',
          vat: null,
          aat: null,
          oat: null,
          off_reason: '',
          off_notes: '',
        };
      });

      const { error: insertError } = await supabase.from('proctors').insert(rowsToInsert);
      if (insertError) throw insertError;

      return { succeeded: rowsToInsert.length, failed: 0, total: validRows.length };
    },
    onSuccess: (result) => {
      setCsvProcessing(false);
      if (result.failed > 0) {
        alert(`${result.succeeded} interview selects imported successfully! ${result.failed} failed.`);
      } else {
        alert(`${result.succeeded} interview selects imported successfully!`);
      }
      queryClient.invalidateQueries({ queryKey: ['interview-selects'] });
      setShowImport(false);
      setCsvData([]);
      // Reset file input
      const fileInput = document.querySelector('input[type="file"][accept=".csv"]') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    },
    onError: (error: any) => {
      setCsvProcessing(false);
      alert('Import failed: ' + error.message);
    },
  });

  const handleConfirmImport = () => {
    const validCount = csvData.filter(r => r._ok).length;
    if (validCount === 0) {
      alert('Nothing to import');
      return;
    }
    setCsvProcessing(true);
    importMutation.mutate();
  };
  const getStatusBadge = (status?: string) => {
    if (status === 'submitted') {
      return <span className="text-[#166534] bg-[#dcfce7] px-2 py-0.5 rounded text-[11px] font-bold">Submitted</span>;
    }
    if (status === 'shared') {
      return <span className="text-accent text-[11px] font-bold">Shared</span>;
    }
    return <span className="text-text3 text-[11px]">Not Sent</span>;
  };

  const columns = [
    {
      header: '',
      accessor: (row: Proctor) => (
        <input
          type="checkbox"
          checked={selectedIds.has(row.id)}
          onChange={(e) => {
            const newSet = new Set(selectedIds);
            if (e.target.checked) {
              newSet.add(row.id);
            } else {
              newSet.delete(row.id);
            }
            setSelectedIds(newSet);
          }}
          className="w-4 h-4 accent-accent cursor-pointer"
        />
      ),
    },
    {
      header: 'Email',
      accessor: (row: Proctor) => (
        <div>
          <div className="text-[13px]">{row.email}</div>
          <div className="text-[11px] text-text3">{row.name || '—'}</div>
        </div>
      ),
    },
    {
      header: 'Managed By',
      accessor: 'managed_by' as keyof Proctor,
    },
    {
      header: 'Type',
      accessor: 'ptype' as keyof Proctor,
    },
    {
      header: 'Notes',
      accessor: (row: Proctor) => (
        <div className="text-[12px] text-text2 max-w-[200px] truncate">
          {row.notes || '—'}
        </div>
      ),
    },
    {
      header: 'Form Status',
      accessor: (row: Proctor) => getStatusBadge(row.form_status),
    },
    {
      header: 'Actions',
      accessor: (row: Proctor) => (
        <div className="flex gap-1">
          {user?.role === 'admin' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingProctor(row)}
            >
              ✏️ Edit
            </Button>
          )}
          {!isReadOnly && row.form_status !== 'submitted' && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => sendLinkMutation.mutate(row.id)}
              disabled={sendLinkMutation.isPending}
            >
              📨 Send Form
            </Button>
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
              placeholder="🔍 Search name, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {!isVendor && (
            <Select
              options={[
                { value: '', label: 'All Managed By' },
                ...managedByOptions,
              ]}
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="min-w-[160px]"
            />
          )}

          <Select
            options={[
              { value: '', label: 'All Form Status' },
              { value: 'not_sent', label: 'Not Sent' },
              { value: 'shared', label: 'Shared' },
              { value: 'submitted', label: 'Submitted' },
            ]}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="min-w-[160px]"
          />

          <div className="flex items-center gap-2 ml-auto">
            {!isReadOnly && (
              <>
                <Button variant="ghost" size="sm" onClick={handleExportLinks}>
                  ⬇ Export Links
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setShowImport(true)}
                >
                  📥 Import CSV
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Table
        data={filteredData}
        columns={columns}
        isLoading={isLoading}
        emptyMessage="No interview selects — import a CSV to get started"
      />

      {/* Edit Modal */}
      {editingProctor && (
        <EditInterviewSelectModal
          proctor={editingProctor}
          onClose={() => setEditingProctor(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['interview-selects'] });
            setEditingProctor(null);
          }}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <Modal
          isOpen={true}
          onClose={() => {
            setShowImport(false);
            setCsvData([]);
            setCsvProcessing(false); // Reset processing state
          }}
          title="Import Interview Selects"
          size="lg"
        >
          <div className="space-y-4">
            <p className="text-text2 text-xs">
              CSV columns: <code className="bg-surface2 px-1.5 py-0.5 rounded text-[10px]">email, managed_by, ptype, notes</code>
            </p>

            <Button variant="ghost" size="sm" onClick={downloadTemplate}>
              ⬇ Download Template
            </Button>

            {/* Upload Zone */}
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent transition-colors">
                <div className="text-4xl mb-2">📥</div>
                <p className="text-sm text-text mb-1">
                  <span className="text-accent font-semibold">Click to upload</span> interview selects CSV
                </p>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
            </label>

            {/* Preview */}
            {csvData.length > 0 && (
              <div>
                <div className={`p-3 rounded-lg mb-3 text-xs ${
                  csvData.filter(r => !r._ok).length > 0 
                    ? 'bg-warning/10 border border-warning/30 text-warning'
                    : 'bg-info/10 border border-info/30 text-info'
                }`}>
                  <strong>{csvData.filter(r => r._ok).length}</strong> to import · 
                  <strong> {csvData.filter(r => !r._ok).length}</strong> error(s)
                </div>

                {csvData.filter(r => !r._ok).length > 0 && (
                  <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 mb-3 text-xs text-danger space-y-1">
                    {csvData.filter(r => !r._ok).map((r, i) => (
                      <div key={i}>
                        <strong>{r.email}</strong> — {r._errors.join(', ')}
                      </div>
                    ))}
                  </div>
                )}

                <div className="bg-surface2 border border-border rounded-lg max-h-[240px] overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-surface sticky top-0">
                      <tr>
                        <th className="px-2 py-2 text-left text-[10px] font-semibold text-text3 uppercase border-b border-border">
                          Email
                        </th>
                        <th className="px-2 py-2 text-left text-[10px] font-semibold text-text3 uppercase border-b border-border">
                          Vendor
                        </th>
                        <th className="px-2 py-2 text-left text-[10px] font-semibold text-text3 uppercase border-b border-border">
                          Type
                        </th>
                        <th className="px-2 py-2 text-left text-[10px] font-semibold text-text3 uppercase border-b border-border">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvData.map((row, idx) => (
                        <tr key={idx} className="border-b border-border last:border-0">
                          <td className="px-2 py-2 text-text">{row.email}</td>
                          <td className="px-2 py-2 text-text">{row.vendor}</td>
                          <td className="px-2 py-2 text-text">{row.ptype}</td>
                          <td className="px-2 py-2">
                            {row._ok ? (
                              <span className="text-success text-[10px] font-bold">✅ OK</span>
                            ) : (
                              <span className="text-danger text-[10px] font-bold">❌ Error</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button
                    variant="success"
                    disabled={csvData.filter(r => r._ok).length === 0 || csvProcessing}
                    onClick={handleConfirmImport}
                  >
                    ✅ Import All Valid
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setShowImport(false);
                      setCsvData([]);
                      setCsvProcessing(false); // Reset processing state
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

interface EditInterviewSelectModalProps {
  proctor: Proctor;
  onClose: () => void;
  onSuccess: () => void;
}

function EditInterviewSelectModal({ proctor, onClose, onSuccess }: EditInterviewSelectModalProps) {
  const [email, setEmail] = useState(proctor.email || '');
  const [vendor, setVendor] = useState(proctor.vendor || proctor.managed_by || '');
  const [ptype, setPtype] = useState(proctor.ptype || '');
  const [notes, setNotes] = useState(proctor.notes || '');
  const [emailError, setEmailError] = useState('');
  const { data: managedByOptions = [] } = useManagedByOptions();

  // Validate email on change
  const validateEmail = (value: string) => {
    if (value && !value.includes('@')) {
      setEmailError('Enter valid email');
    } else {
      setEmailError('');
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedEmail = email.trim().toLowerCase();
      
      // Validate
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        throw new Error('Enter a valid email address');
      }
      if (!vendor) {
        throw new Error('Managed By is required');
      }
      if (!ptype) {
        throw new Error('Proctor Type is required');
      }

      // Check email uniqueness (skip own record)
      if (trimmedEmail !== proctor.email?.toLowerCase()) {
        const { data: duplicates, error: checkError } = await supabase
          .from('proctors')
          .select('id, name')
          .neq('id', proctor.id)
          .ilike('email', trimmedEmail);

        if (checkError) throw checkError;

        if (duplicates && duplicates.length > 0) {
          throw new Error(`Email already exists for ${duplicates[0].name}`);
        }
      }

      // Update proctor
      const { error } = await supabase
        .from('proctors')
        .update({
          email: trimmedEmail,
          vendor,
          managed_by: vendor, // Update both vendor and managed_by
          ptype,
          notes,
          upd: new Date().toISOString(),
        })
        .eq('id', proctor.id);

      if (error) throw error;
    },
    onSuccess: () => {
      alert('Interview select updated successfully');
      onSuccess();
    },
    onError: (error: any) => {
      if (error.message.includes('Email already exists')) {
        setEmailError(error.message);
      } else {
        alert('Save failed: ' + error.message);
      }
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title="Edit Interview Select">
      <div className="space-y-4">
        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">
            Email <span className="text-danger">*</span>
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              validateEmail(e.target.value);
            }}
            placeholder="proctor@gmail.com"
          />
          {emailError && (
            <div className="text-[11px] text-danger mt-1">{emailError}</div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Managed By <span className="text-danger">*</span>
            </label>
            <Select
              options={[
                { value: '', label: 'Select...' },
                ...managedByOptions,
              ]}
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Proctor Type <span className="text-danger">*</span>
            </label>
            <Select
              options={[
                { value: '', label: 'Select...' },
                ...PROCTOR_TYPES.map((t) => ({ value: t, label: t })),
              ]}
              value={ptype}
              onChange={(e) => setPtype(e.target.value as Proctor['ptype'])}
            />
          </div>
        </div>

        <div>
          <label className="block text-[12px] font-semibold text-text mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any relevant info about this candidate..."
            rows={2}
            className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-[13px] text-text outline-none focus:border-accent resize-none"
          />
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            💾 Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
