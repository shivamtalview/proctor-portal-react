import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Tabs from '@/components/ui/Tabs';
import { getScopedVendor } from '@/utils/access';
import { PROCTOR_TYPES, PROCTOR_TYPE_LABELS, INDIAN_STATES } from '@/utils/constants';
import { useManagedByOptions } from '@/hooks/useManagedByOptions';
import type { Proctor } from '@/types';

export default function AddProctorPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 0, label: '👤 Individual' },
          { id: 1, label: '📤 Bulk Onboard' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as number)}
      />

      {/* Tab Content */}
      {activeTab === 0 ? <IndividualTab /> : <BulkTab />}
    </div>
  );
}

function IndividualTab() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isVendor = user?.role === 'vendor';
  const scopedVendor = getScopedVendor(user);
  const { data: managedByOptions = [] } = useManagedByOptions();
  const managedByValues = new Set(managedByOptions.map((option) => option.value));

  const [formData, setFormData] = useState({
    name: '',
    aadhaar: '',
    dob: '',
    gender: '',
    ptype: '',
    managed_by: scopedVendor || '',
    phone: '',
    email: '',
    city: '',
    state: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showErrorBanner, setShowErrorBanner] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch existing proctors for duplicate check
  const { data: existingProctors = [] } = useQuery({
    queryKey: ['proctors-all'],
    queryFn: async () => {
      let query = supabase.from('proctors').select('id, name, aadhaar, phone, email, vendor, managed_by, status');
      if (scopedVendor) {
        query = query.eq('vendor', scopedVendor).or(`managed_by.eq.${scopedVendor}`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Proctor[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (proctor: Partial<Proctor>) => {
      const now = new Date().toISOString();
      const { data, error } = await supabase.from('proctors').insert({
        ...proctor,
        status: 'In Progress',
        stage: 1,
        demo_eval: 'Pending',
        assessment: 'Pending',
        demo_ready: 'awaiting',
        assessment_ready: 'awaiting',
        by_user: user?.username || '',
        at: now,
        upd: now,
      }).select().single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setToast({ type: 'success', message: `${data.name} onboarded! They appear in In Progress.` });
      queryClient.invalidateQueries({ queryKey: ['proctors'] });
      queryClient.invalidateQueries({ queryKey: ['proctors-all'] });
      clearForm();
    },
    onError: (error: any) => {
      setToast({ type: 'error', message: 'Failed to onboard: ' + error.message });
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
      isValid = false;
    }

    if (!formData.aadhaar) {
      newErrors.aadhaar = 'Aadhaar is required';
      isValid = false;
    } else if (!/^\d{12}$/.test(formData.aadhaar)) {
      newErrors.aadhaar = 'Must be exactly 12 digits';
      isValid = false;
    }

    if (!formData.dob) {
      newErrors.dob = 'Date of Birth is required';
      isValid = false;
    }

    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
      isValid = false;
    }

    if (!formData.ptype) {
      newErrors.ptype = 'Proctor type is required';
      isValid = false;
    }

    if (!formData.managed_by) {
      newErrors.managed_by = 'Managed By is required';
      isValid = false;
    } else if (!isVendor && !managedByValues.has(formData.managed_by)) {
      newErrors.managed_by = 'Selected Managed By is not active';
      isValid = false;
    }

    if (!formData.phone) {
      newErrors.phone = 'Mobile number is required';
      isValid = false;
    } else if (!/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'Must be 10 digits';
      isValid = false;
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!formData.email.includes('@')) {
      newErrors.email = 'Enter a valid email address';
      isValid = false;
    }

    if (!formData.city) {
      newErrors.city = 'City is required';
      isValid = false;
    }

    if (!formData.state) {
      newErrors.state = 'State is required';
      isValid = false;
    }

    // Check for duplicates
    const activeProctors = existingProctors.filter(p => p.status !== 'Archived');
    
    const dupAadhaar = activeProctors.find(p => p.aadhaar === formData.aadhaar);
    if (dupAadhaar) {
      if (dupAadhaar.status === 'Offboarded') {
        newErrors.aadhaar = '⚠️ Previously offboarded — contact admin to re-onboard';
      } else {
        newErrors.aadhaar = `⚠️ Duplicate: ${dupAadhaar.name} (${dupAadhaar.managed_by || dupAadhaar.vendor})`;
      }
      isValid = false;
    }

    const dupPhone = activeProctors.find(p => p.phone === formData.phone);
    if (dupPhone) {
      if (dupPhone.status === 'Offboarded') {
        newErrors.phone = '⚠️ Previously offboarded — contact admin to re-onboard';
      } else {
        newErrors.phone = `⚠️ Duplicate: ${dupPhone.name} (${dupPhone.managed_by || dupPhone.vendor})`;
      }
      isValid = false;
    }

    const dupEmail = activeProctors.find(p => p.email?.toLowerCase() === formData.email.toLowerCase());
    if (dupEmail) {
      if (dupEmail.status === 'Offboarded') {
        newErrors.email = '⚠️ Previously offboarded — contact admin to re-onboard';
      } else {
        newErrors.email = `⚠️ Duplicate: ${dupEmail.name} (${dupEmail.managed_by || dupEmail.vendor})`;
      }
      isValid = false;
    }

    setErrors(newErrors);
    setShowErrorBanner(!isValid);
    return isValid;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    createMutation.mutate({
      name: formData.name.trim(),
      aadhaar: formData.aadhaar,
      dob: formData.dob,
      gender: formData.gender as any,
      ptype: formData.ptype as any,
      managed_by: formData.managed_by as any,
      vendor: formData.managed_by,
      phone: formData.phone,
      email: formData.email.trim(),
      city: formData.city.trim(),
      state: formData.state,
      notes: formData.notes.trim(),
    });
  };

  const clearForm = () => {
    setFormData({
      name: '',
      aadhaar: '',
      dob: '',
      gender: '',
      ptype: '',
      managed_by: formData.managed_by,
      phone: '',
      email: '',
      city: '',
      state: '',
      notes: '',
    });
    setErrors({});
    setShowErrorBanner(false);
  };

  const errorCount = Object.keys(errors).length;

  return (
    <div className="max-w-3xl">
      <Card className="p-6">
        {/* Personal Details */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-4">Personal Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-text mb-1">
                Full Name <span className="text-danger">*</span>
              </label>
              <Input
                placeholder="Full legal name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
              {errors.name && <div className="text-danger text-xs mt-1">{errors.name}</div>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Aadhaar Number <span className="text-danger">*</span>
              </label>
              <Input
                placeholder="12-digit Aadhaar"
                maxLength={12}
                value={formData.aadhaar}
                onChange={(e) => setFormData({ ...formData, aadhaar: e.target.value.replace(/\D/g, '') })}
              />
              {errors.aadhaar && <div className="text-danger text-xs mt-1">{errors.aadhaar}</div>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Date of Birth <span className="text-danger">*</span>
              </label>
              <Input
                type="date"
                value={formData.dob}
                onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
              />
              {errors.dob && <div className="text-danger text-xs mt-1">{errors.dob}</div>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Gender <span className="text-danger">*</span>
              </label>
              <Select
                options={[
                  { value: '', label: 'Select' },
                  { value: 'Male', label: 'Male' },
                  { value: 'Female', label: 'Female' },
                  { value: 'Other', label: 'Other' },
                ]}
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              />
              {errors.gender && <div className="text-danger text-xs mt-1">{errors.gender}</div>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Proctor Type <span className="text-danger">*</span>
              </label>
              <Select
                options={[
                  { value: '', label: 'Select' },
                  ...PROCTOR_TYPES.map(pt => ({ value: pt, label: PROCTOR_TYPE_LABELS[pt] })),
                ]}
                value={formData.ptype}
                onChange={(e) => setFormData({ ...formData, ptype: e.target.value })}
              />
              {errors.ptype && <div className="text-danger text-xs mt-1">{errors.ptype}</div>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Managed By <span className="text-danger">*</span>
              </label>
              {isVendor ? (
                <div className="px-3 py-2 bg-surface2 border border-border rounded-lg text-sm font-semibold text-text">
                  {user?.vendor}
                </div>
              ) : (
                <Select
                options={[
                    { value: '', label: 'Select Managed By...' },
                    ...managedByOptions,
                  ]}
                  value={formData.managed_by}
                  onChange={(e) => setFormData({ ...formData, managed_by: e.target.value })}
                />
              )}
              {errors.managed_by && <div className="text-danger text-xs mt-1">{errors.managed_by}</div>}
            </div>
          </div>
        </div>

        {/* Contact Details */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-4">Contact Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Mobile Number <span className="text-danger">*</span>
              </label>
              <Input
                placeholder="10-digit mobile"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
              />
              {errors.phone && <div className="text-danger text-xs mt-1">{errors.phone}</div>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                Gmail Address <span className="text-danger">*</span>
              </label>
              <Input
                type="email"
                placeholder="name@gmail.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
              {errors.email && <div className="text-danger text-xs mt-1">{errors.email}</div>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                City <span className="text-danger">*</span>
              </label>
              <Input
                placeholder="City"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
              {errors.city && <div className="text-danger text-xs mt-1">{errors.city}</div>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                State <span className="text-danger">*</span>
              </label>
              <Select
                options={[
                  { value: '', label: 'Select State' },
                  ...INDIAN_STATES.map(s => ({ value: s, label: s })),
                ]}
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
              {errors.state && <div className="text-danger text-xs mt-1">{errors.state}</div>}
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-4">Additional Notes</h3>
          <label className="block text-xs font-semibold text-text mb-1">
            Notes <span className="text-text3">(Optional)</span>
          </label>
          <textarea
            rows={3}
            placeholder="Any relevant notes about this proctor..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full px-3 py-2 bg-surface2 border border-border rounded-lg text-sm text-text outline-none focus:border-accent resize-none"
          />
        </div>

        {/* Toast Banner */}
        {toast && (
          <div className={`rounded-lg p-3 mb-4 text-xs font-semibold ${
            toast.type === 'success'
              ? 'bg-success/10 border border-success/30 text-success'
              : 'bg-danger/10 border border-danger/30 text-danger'
          }`}>
            {toast.type === 'success' ? '✅' : '⚠️'} {toast.message}
          </div>
        )}

        {/* Error Banner */}
        {showErrorBanner && (
          <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg p-3 mb-4 text-xs font-semibold">
            ⚠️ {errorCount} required field{errorCount > 1 ? 's are' : ' is'} missing or invalid.
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="primary" onClick={handleSubmit} disabled={createMutation.isPending}>
            ✅ Submit for Onboarding
          </Button>
          <Button variant="ghost" onClick={clearForm}>
            Clear
          </Button>
        </div>
      </Card>
    </div>
  );
}

function BulkTab() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isVendor = user?.role === 'vendor';
  const { data: managedByOptions = [] } = useManagedByOptions();
  const managedByValues = new Set(managedByOptions.map((option) => option.value));
  const [bulkData, setBulkData] = useState<any[]>([]);
  const [isProcessed, setIsProcessed] = useState(false);
  const [bulkToast, setBulkToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!bulkToast) return;
    const t = setTimeout(() => setBulkToast(null), 4000);
    return () => clearTimeout(t);
  }, [bulkToast]);

  const downloadTemplate = () => {
    const BOM = '\uFEFF';
    let headers, example;
    
    if (isVendor) {
      headers = 'name,aadhaar,dob,gender,ptype,phone,email,city,state,notes';
      example = `"John Doe","123456789012","1990-01-01","Male","ODP","9876543210","john@gmail.com","Mumbai","Maharashtra",""`;
    } else {
      headers = 'name,aadhaar,dob,gender,ptype,managed_by,phone,email,city,state,notes';
      example = `"John Doe","123456789012","1990-01-01","Male","WFO","Sai","9876543210","john@gmail.com","Mumbai","Maharashtra",""`;
    }

    const csv = BOM + headers + '\n' + example;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isVendor ? `proctor_upload_template_${user?.vendor}.csv` : 'proctor_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
    setBulkToast({ type: 'success', message: 'Template downloaded' });
  };

  const parseCSV = (text: string) => {
    const lines: string[][] = [];
    let cur = '', inQ = false;
    const chars = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    let row: string[] = [];
    
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === '"') {
        if (inQ && chars[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (c === ',' && !inQ) {
        row.push(cur.trim());
        cur = '';
      } else if (c === '\n' && !inQ) {
        row.push(cur.trim());
        cur = '';
        if (row.some(v => v !== '')) lines.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
    if (cur || row.length) row.push(cur.trim());
    if (row.some(v => v !== '')) lines.push(row);
    return lines;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.length < 2) {
        setBulkToast({ type: 'error', message: 'File appears empty or has no data rows' });
        return;
      }

      const hdrs = parsed[0].map(h => h.toLowerCase().trim());
      const raw = parsed.slice(1).map(row => {
        const obj: any = {};
        hdrs.forEach((h, i) => {
          obj[h] = (row[i] || '').trim();
          // Normalize Aadhaar and Phone (handle Excel scientific notation)
          if ((h === 'aadhaar' || h === 'phone') && /^[\d.]+[eE][+\-]?\d+$/.test(obj[h])) {
            obj[h] = Math.round(Number(obj[h])).toString();
          }
          obj[h] = obj[h].replace(/\.0+$/, '').trim();
        });
        return obj;
      });

      if (!raw.length) {
        setBulkToast({ type: 'error', message: 'No data rows found in file' });
        return;
      }

      // Fetch existing proctors for duplicate check
      const { data: existing, error } = await supabase
        .from('proctors')
        .select('id, name, aadhaar, phone, email, vendor, managed_by, status');

      if (error) {
        setBulkToast({ type: 'error', message: 'Failed to fetch existing proctors: ' + error.message });
        return;
      }

      validateBulk(raw, existing || []);
    };
    reader.readAsText(file);
  };

  const validateBulk = (raw: any[], existing: any[]) => {
    const activeProctors = existing.filter((p: any) => p.status !== 'Archived');
    const seenA: Record<string, number> = {};
    const seenP: Record<string, number> = {};
    const seenE: Record<string, number> = {};

    const validated = raw.map((r, idx) => {
      const errs: string[] = [];
      
      // Field validations
      if (!r.name || r.name.trim() === '') errs.push('Missing name');
      if (!r.aadhaar || !/^\d{12}$/.test(r.aadhaar)) errs.push('Invalid Aadhaar — must be exactly 12 digits');
      if (!r.dob) errs.push('Missing DOB');
      if (!r.gender) errs.push('Missing gender');
      if (!r.ptype || !['WFO', 'ODP', 'Hybrid'].includes(r.ptype)) errs.push('Invalid proctor type');
      
      let vendor;
      if (isVendor) {
        vendor = user?.vendor || '';
        if (r.vendor && r.vendor.trim() && r.vendor.trim() !== vendor) {
          errs.push(`Vendor mismatch — you can only upload for ${vendor}`);
        }
      } else {
        vendor = r.managed_by || r.vendor;
        if (vendor && !managedByValues.has(vendor)) errs.push(`Invalid vendor: "${vendor}"`);
      }
      
      if (!r.phone || !/^\d{10}$/.test(r.phone)) errs.push('Invalid phone (must be 10 digits)');
      if (!r.email || !r.email.includes('@')) errs.push('Invalid email');
      if (!r.city) errs.push('Missing city');
      if (!r.state) errs.push('Missing state');

      // Database duplicates
      const dupA = activeProctors.find((p: any) => p.aadhaar === r.aadhaar);
      if (dupA) {
        if (dupA.status === 'Offboarded') {
          errs.push(`Aadhaar belongs to offboarded proctor ${dupA.name} — contact admin`);
        } else {
          errs.push(`Aadhaar already in database (${dupA.name}, ${dupA.managed_by || dupA.vendor})`);
        }
      }

      const dupP = activeProctors.find((p: any) => p.phone === r.phone);
      if (dupP) {
        if (dupP.status === 'Offboarded') {
          errs.push(`Phone belongs to offboarded proctor ${dupP.name} — contact admin`);
        } else {
          errs.push(`Phone already in database (${dupP.name}, ${dupP.managed_by || dupP.vendor})`);
        }
      }

      const dupE = activeProctors.find((p: any) => (p.email || '').toLowerCase() === (r.email || '').toLowerCase());
      if (dupE) {
        if (dupE.status === 'Offboarded') {
          errs.push(`Email belongs to offboarded proctor ${dupE.name} — contact admin`);
        } else {
          errs.push(`Email already in database (${dupE.name}, ${dupE.managed_by || dupE.vendor})`);
        }
      }

      // File duplicates
      if (r.aadhaar) {
        if (seenA[r.aadhaar]) errs.push(`Aadhaar repeated in file (row ${seenA[r.aadhaar]})`);
        else seenA[r.aadhaar] = idx + 1;
      }
      if (r.phone) {
        if (seenP[r.phone]) errs.push(`Phone repeated in file (row ${seenP[r.phone]})`);
        else seenP[r.phone] = idx + 1;
      }
      if (r.email) {
        const eKey = r.email.toLowerCase();
        if (seenE[eKey]) errs.push(`Email repeated in file (row ${seenE[eKey]})`);
        else seenE[eKey] = idx + 1;
      }

      return { ...r, _vendor: vendor, _ok: errs.length === 0, _errs: errs };
    });

    setBulkData(validated);
    setIsProcessed(true);
  };

  const bulkCreateMutation = useMutation({
    mutationFn: async (proctors: Partial<Proctor>[]) => {
      const now = new Date().toISOString();
      const rows = proctors.map(p => ({
        ...p,
        status: 'In Progress',
        stage: 1,
        demo_eval: 'Pending',
        assessment: 'Pending',
        demo_ready: 'awaiting',
        assessment_ready: 'awaiting',
        by_user: user?.username || '',
        at: now,
        upd: now,
      }));

      const { data, error } = await supabase.from('proctors').insert(rows).select();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setBulkToast({ type: 'success', message: `Successfully uploaded ${data.length} proctors! They appear in In Progress.` });
      queryClient.invalidateQueries({ queryKey: ['proctors'] });
      clearBulk();
    },
    onError: (error: any) => {
      setBulkToast({ type: 'error', message: 'Bulk upload failed: ' + error.message });
    },
  });

  const confirmUpload = () => {
    const ok = bulkData.filter(r => r._ok);
    if (!ok.length) {
      setBulkToast({ type: 'error', message: 'No valid rows to upload' });
      return;
    }

    const newProctors = ok.map(r => ({
      name: r.name,
      aadhaar: r.aadhaar,
      dob: r.dob,
      gender: r.gender,
      ptype: r.ptype,
      managed_by: r._vendor,
      vendor: r._vendor,
      phone: r.phone,
      email: r.email,
      city: r.city,
      state: r.state,
      notes: r.notes || '',
    }));

    bulkCreateMutation.mutate(newProctors);
  };

  const clearBulk = () => {
    setBulkData([]);
    setIsProcessed(false);
    if (bulkFileRef.current) bulkFileRef.current.value = '';
  };

  const okCount = bulkData.filter(r => r._ok).length;
  const errCount = bulkData.filter(r => !r._ok).length;
  const hasErrors = errCount > 0;

  return (
    <div className="max-w-4xl">
      {/* Bulk Toast Banner */}
      {bulkToast && (
        <div className={`rounded-lg p-3 mb-4 text-xs font-semibold ${
          bulkToast.type === 'success'
            ? 'bg-success/10 border border-success/30 text-success'
            : 'bg-danger/10 border border-danger/30 text-danger'
        }`}>
          {bulkToast.type === 'success' ? '✅' : '⚠️'} {bulkToast.message}
        </div>
      )}

      <Card className="p-6">
        {/* Step 1: Download Template */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-2">Step 1 — Download Template</h3>
          <p className="text-text2 text-xs mb-3">Fill in the template. BGV is not required at this stage.</p>
          <Button variant="ghost" onClick={downloadTemplate}>
            ⬇ Download CSV Template
          </Button>
        </div>

        {/* Step 2: Upload File */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-text uppercase tracking-wide mb-2">Step 2 — Upload File</h3>
          <label
            htmlFor="bulkFile"
            className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-accent/50 transition-colors"
          >
            <div className="text-4xl mb-2">📤</div>
            <p className="text-sm text-text2">
              <span className="text-accent font-semibold">Click to upload</span> or drag and drop
            </p>
            <p className="text-xs text-text3 mt-1">CSV files only</p>
          </label>
          <input
            id="bulkFile"
            ref={bulkFileRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {/* Preview */}
        {isProcessed && (
          <div className="mb-6">
            {hasErrors ? (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-4">
                <div className="font-semibold text-danger text-sm mb-2">
                  ❌ Upload blocked — {errCount} error(s) found in {bulkData.length} row(s)
                </div>
                <div className="text-xs text-text2">
                  Fix ALL errors in your CSV and re-upload. No rows have been saved.
                </div>
              </div>
            ) : (
              <div className="bg-info/10 border border-info/30 rounded-lg p-4 mb-4">
                <div className="font-semibold text-info text-sm">
                  ✅ All {okCount} rows valid — ready to upload
                </div>
              </div>
            )}

            {/* Errors List */}
            {hasErrors && (
              <div className="bg-danger/5 border border-danger/20 rounded-lg p-4 mb-4 max-h-60 overflow-y-auto">
                <div className="font-semibold text-sm text-text mb-3">Errors to fix:</div>
                {bulkData.filter(r => !r._ok).map((r, i) => (
                  <div key={i} className="bg-danger/10 rounded-lg p-3 mb-2 text-xs">
                    <div className="font-semibold text-text mb-1">Row: {r.name || '(unnamed)'}</div>
                    <div className="text-danger">{r._errs.join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Table Preview */}
            <div className="bg-surface2 border border-border rounded-lg overflow-hidden mb-4">
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-text3">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-text3">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-text3">Managed By</th>
                      <th className="px-3 py-2 text-left font-semibold text-text3">Phone</th>
                      <th className="px-3 py-2 text-left font-semibold text-text3">Aadhaar</th>
                      <th className="px-3 py-2 text-left font-semibold text-text3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkData.map((r, i) => (
                      <tr key={i} className={`border-t border-border ${r._ok ? '' : 'bg-danger/5'}`}>
                        <td className="px-3 py-2 text-text3">{i + 1}</td>
                        <td className="px-3 py-2 font-semibold text-text">{r.name || '—'}</td>
                        <td className="px-3 py-2 text-text2">{r._vendor || '—'}</td>
                        <td className="px-3 py-2 font-mono text-text2">{r.phone || '—'}</td>
                        <td className="px-3 py-2 font-mono text-text2">
                          {r.aadhaar ? `XXXX-XXXX-${r.aadhaar.slice(-4)}` : '—'}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r._ok ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
                            {r._ok ? '✅ OK' : '❌ Error'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {hasErrors ? (
                <>
                  <Button variant="primary" onClick={() => bulkFileRef.current?.click()}>
                    📂 Upload corrected file
                  </Button>
                  <Button variant="ghost" onClick={clearBulk}>
                    ✕ Clear
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="primary" 
                    onClick={confirmUpload}
                    disabled={bulkCreateMutation.isPending}
                  >
                    ✅ Confirm Upload
                  </Button>
                  <Button variant="ghost" onClick={clearBulk}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
