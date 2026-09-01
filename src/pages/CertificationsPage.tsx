import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import type { Proctor } from '@/types';

interface Customer {
  id: string;
  name: string;
  current_version: number;
  org_id?: string;
  session_type?: string[];
  created_at?: string;
  created_by?: string;
}

interface Certification {
  id: string;
  proctor_id: string;
  customer_id: string;
  status: string;
  version_certified: number;
  certified_date: string;
  certified_by: string;
}

interface RegistryRow {
  pid: string;
  name: string;
  vendor: string;
  ptype: string;
  certifications: Certification[];
  customerNames: string;
}

export default function CertificationsPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div>
      {/* Main Tabs */}
      <Tabs
        tabs={[
          { id: 0, label: '🎓 Certify' },
          { id: 1, label: '📋 Registry' },
        ]}
        activeTab={activeTab}
        onChange={(id) => setActiveTab(id as number)}
      />

      {/* Tab Content */}
      {activeTab === 0 && <CertifyTab />}
      {activeTab === 1 && <RegistryTab />}
    </div>
  );
}

function CertifyTab() {
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [subTab, setSubTab] = useState(0);

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Customer[];
    },
  });

  const selectedCust = customers.find(c => c.id === selectedCustomer);

  return (
    <div>
      {/* Customer Selection */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-semibold text-text mb-1">Customer</label>
          <Select
            options={[
              { value: '', label: 'Select customer...' },
              ...customers.map(c => ({
                value: c.id,
                label: `${c.name} (SOP v${c.current_version})`,
              })),
            ]}
            value={selectedCustomer}
            onChange={(e) => setSelectedCustomer(e.target.value)}
          />
        </div>
      </div>

      {/* Customer Info Banner */}
      {selectedCust && (
        <div className="bg-info/10 border border-info/30 rounded-lg p-3 mb-4 text-xs text-info">
          Customer: <strong>{selectedCust.name}</strong> · SOP Version: <strong>v{selectedCust.current_version}</strong>
          {selectedCust.org_id && <> · Org ID: <strong>{selectedCust.org_id}</strong></>}
        </div>
      )}

      {/* Sub Tabs - only show after customer selected */}
      {selectedCustomer && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                subTab === 0
                  ? 'bg-accent text-white'
                  : 'bg-transparent border border-border text-text3 hover:text-text'
              }`}
              onClick={() => setSubTab(0)}
            >
              👤 Individual
            </button>
            <button
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                subTab === 1
                  ? 'bg-accent text-white'
                  : 'bg-transparent border border-border text-text3 hover:text-text'
              }`}
              onClick={() => setSubTab(1)}
            >
              📤 CSV Bulk
            </button>
          </div>

          {subTab === 0 ? (
            <IndividualCertify customer={selectedCust!} />
          ) : (
            <BulkCertify customer={selectedCust!} />
          )}
        </>
      )}
    </div>
  );
}

function IndividualCertify({ customer }: { customer: Customer }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedProctor, setSelectedProctor] = useState<Proctor | null>(null);

  // Fetch active proctors with PID
  const { data: proctors = [] } = useQuery({
    queryKey: ['active-proctors-for-cert'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctors')
        .select('*')
        .eq('status', 'Active')
        .not('pid', 'is', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Proctor[];
    },
  });

  // Fetch existing certifications for this customer
  const { data: existingCerts = [] } = useQuery({
    queryKey: ['certifications', customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctor_certifications')
        .select('*')
        .eq('customer_id', customer.id)
        .eq('status', 'certified');

      if (error) throw error;
      return data as Certification[];
    },
  });

  const certMutation = useMutation({
    mutationFn: async (proctor: Proctor) => {
      const now = new Date().toISOString().slice(0, 10);
      const body = {
        id: crypto.randomUUID(),
        proctor_id: proctor.pid!,
        customer_id: customer.id,
        customer_name: customer.name,
        status: 'certified',
        version_certified: customer.current_version,
        certified_date: now,
        certified_by: user?.username || user?.email || 'unknown',
      };

      const { error } = await supabase
        .from('proctor_certifications')
        .upsert(body, { onConflict: 'proctor_id,customer_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      alert('Proctor certified successfully!');
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
      setSelectedProctor(null);
      setSearch('');
    },
    onError: (error: any) => {
      alert('Failed to certify: ' + error.message);
    },
  });

  const filteredProctors = proctors.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(s) ||
      (p.pid || '').toLowerCase().includes(s)
    );
  });

  const certifiedPIDs = new Set(existingCerts.map(c => c.proctor_id));

  return (
    <Card className="p-5 max-w-[560px]">
      {/* Search */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-text mb-1">
          Search Proctor (by name or ID)
        </label>
        <Input
          placeholder="Type name or PID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Proctor List */}
      <div className="max-h-[240px] overflow-y-auto mb-4 border border-border rounded-lg">
        {filteredProctors.length === 0 ? (
          <div className="p-4 text-center text-text3 text-xs">No active proctors found</div>
        ) : (
          filteredProctors.map((proctor) => {
            const alreadyCertified = certifiedPIDs.has(proctor.pid!);
            return (
              <div
                key={proctor.id}
                onClick={() => !alreadyCertified && setSelectedProctor(proctor)}
                className={`p-3 border-b border-border last:border-0 cursor-pointer transition-colors ${
                  selectedProctor?.id === proctor.id
                    ? 'bg-accent/10'
                    : alreadyCertified
                    ? 'bg-surface2/50 opacity-50 cursor-not-allowed'
                    : 'hover:bg-surface2'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-xs font-semibold text-text">{proctor.name}</div>
                    <div className="text-[10px] text-text3">
                      PID: {proctor.pid} · {proctor.managed_by || proctor.vendor} · {proctor.ptype}
                    </div>
                  </div>
                  {alreadyCertified && (
                    <span className="text-[10px] font-bold text-success">✅ Certified</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Selected Proctor */}
      {selectedProctor && !certifiedPIDs.has(selectedProctor.pid!) && (
        <div className="p-3 bg-accent/10 border border-accent/30 rounded-lg mb-4 text-xs font-semibold text-accent">
          Selected: {selectedProctor.name} ({selectedProctor.pid})
        </div>
      )}

      {/* Certify Button */}
      <Button
        variant="success"
        disabled={!selectedProctor || certifiedPIDs.has(selectedProctor.pid!) || certMutation.isPending}
        onClick={() => selectedProctor && certMutation.mutate(selectedProctor)}
      >
        ✅ Certify Proctor
      </Button>
    </Card>
  );
}

function BulkCertify({ customer }: { customer: Customer }) {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [csvData, setCsvData] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  // Fetch active proctors for template
  const { data: proctors = [] } = useQuery({
    queryKey: ['active-proctors-for-cert'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctors')
        .select('*')
        .eq('status', 'Active')
        .not('pid', 'is', null)
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Proctor[];
    },
  });

  const downloadTemplate = () => {
    const csv = ['proctor_id\n'];
    const content = csv.join('');
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cert_template_${customer.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    if (!headers.includes('proctor_id')) {
      alert('CSV must contain "proctor_id" column');
      return;
    }

    const rows = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: any = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || '';
      });
      return row;
    });

    // Fetch existing certifications
    const { data: existingCerts, error } = await supabase
      .from('proctor_certifications')
      .select('proctor_id')
      .eq('customer_id', customer.id)
      .eq('status', 'certified');

    if (error) {
      alert('Failed to check existing certifications');
      return;
    }

    const certifiedPIDs = new Set((existingCerts || []).map((c: any) => c.proctor_id));

    // Validate rows
    const validated = rows.map((row, idx) => {
      const pid = row.proctor_id;
      const proctor = proctors.find(p => p.pid === pid);
      const alreadyCert = certifiedPIDs.has(pid);

      return {
        ...row,
        _index: idx + 2, // line number in CSV
        _valid: !!proctor && !alreadyCert,
        _error: !proctor
          ? 'Proctor not found or not Active'
          : alreadyCert
          ? 'Already certified for this customer'
          : null,
        _proctor: proctor,
      };
    });

    setCsvData(validated);
  };

  const handleBulkCertify = async () => {
    const valid = csvData.filter(r => r._valid);
    if (valid.length === 0) {
      alert('No valid proctors to certify');
      return;
    }

    if (!confirm(`Certify ${valid.length} proctors for ${customer.name}?`)) return;

    setProcessing(true);
    const now = new Date().toISOString().slice(0, 10);

    try {
      const rows = valid.map(r => ({
        id: crypto.randomUUID(),
        proctor_id: r.proctor_id,
        customer_id: customer.id,
        customer_name: customer.name,
        status: 'certified',
        version_certified: customer.current_version,
        certified_date: now,
        certified_by: user?.username || user?.email || 'unknown',
      }));

      const { error } = await supabase
        .from('proctor_certifications')
        .upsert(rows, { onConflict: 'proctor_id,customer_id' });

      if (error) throw error;

      alert(`Successfully certified ${valid.length} proctors!`);
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
      setCsvData([]);
    } catch (error: any) {
      alert('Failed to certify: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="p-5 max-w-[600px]">
      <p className="text-text2 text-xs mb-3">
        Upload a CSV with one column: <code className="bg-surface2 px-1.5 py-0.5 rounded text-[10px]">proctor_id</code> — one proctor per row.
      </p>

      <Button variant="ghost" size="sm" onClick={downloadTemplate} className="mb-4">
        ⬇ Download Template
      </Button>

      {/* Upload Zone */}
      <label className="block cursor-pointer">
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-accent transition-colors">
          <div className="text-4xl mb-2">📤</div>
          <p className="text-sm text-text mb-1">
            <span className="text-accent font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-text3">CSV files only</p>
        </div>
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </label>

      {/* Preview */}
      {csvData.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-text uppercase tracking-wide mb-2">
            Preview ({csvData.filter(r => r._valid).length} valid / {csvData.length} total)
          </h4>
          <div className="bg-surface2 border border-border rounded-lg max-h-[240px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-text3 uppercase border-b border-border">
                    Line
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-text3 uppercase border-b border-border">
                    Proctor ID
                  </th>
                  <th className="px-2 py-2 text-left text-[10px] font-semibold text-text3 uppercase border-b border-border">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {csvData.map((row, idx) => (
                  <tr key={idx} className="border-b border-border last:border-0">
                    <td className="px-2 py-2 text-text3">{row._index}</td>
                    <td className="px-2 py-2 text-text">{row.proctor_id}</td>
                    <td className="px-2 py-2">
                      {row._valid ? (
                        <span className="text-success text-[10px] font-bold">✓ Valid</span>
                      ) : (
                        <span className="text-danger text-[10px]">{row._error}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            variant="success"
            className="mt-4"
            disabled={csvData.filter(r => r._valid).length === 0 || processing}
            onClick={handleBulkCertify}
          >
            ✅ Certify All Valid
          </Button>
        </div>
      )}
    </Card>
  );
}

function RegistryTab() {
  const [search, setSearch] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');

  // Fetch all certifications
  const { data: certifications = [], isLoading: certsLoading } = useQuery({
    queryKey: ['all-certifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctor_certifications')
        .select('*')
        .eq('status', 'certified')
        .order('certified_date', { ascending: false });

      if (error) throw error;
      return data as Certification[];
    },
  });

  // Fetch proctors
  const { data: proctors = [], isLoading: proctorsLoading } = useQuery({
    queryKey: ['all-proctors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctors')
        .select('*');

      if (error) throw error;
      return data as Proctor[];
    },
  });

  // Fetch customers
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data as Customer[];
    },
  });

  const isLoading = certsLoading || proctorsLoading || customersLoading;

  // Build registry: group certifications by proctor
  const registry: RegistryRow[] = [];
  const proctorMap = new Map(proctors.map(p => [p.pid, p]));
  const customerMap = new Map(customers.map(c => [c.id, c]));

  // Group certs by proctor
  const certsByProctor = new Map<string, Certification[]>();
  certifications.forEach(cert => {
    if (!certsByProctor.has(cert.proctor_id)) {
      certsByProctor.set(cert.proctor_id, []);
    }
    certsByProctor.get(cert.proctor_id)!.push(cert);
  });

  certsByProctor.forEach((certs, pid) => {
    const proctor = proctorMap.get(pid);
    if (!proctor) return;

    // Filter by outdated version
    const validCerts = certs.filter(c => {
      const cust = customerMap.get(c.customer_id);
      return cust && c.version_certified >= cust.current_version;
    });

    if (validCerts.length === 0) return;

    registry.push({
      pid,
      name: proctor.name,
      vendor: proctor.managed_by || proctor.vendor || '—',
      ptype: proctor.ptype,
      certifications: validCerts,
      customerNames: validCerts.map(c => customerMap.get(c.customer_id)?.name || '?').join(', '),
    });
  });

  // Filter registry
  const filteredRegistry = registry.filter(r => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !(r.name || '').toLowerCase().includes(s) &&
        !(r.pid || '').toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    if (vendorFilter && r.vendor !== vendorFilter) return false;
    if (customerFilter) {
      const hasCust = r.certifications.some((c: Certification) => c.customer_id === customerFilter);
      if (!hasCust) return false;
    }
    return true;
  });

  const vendors = Array.from(new Set(proctors.map(p => p.managed_by || p.vendor).filter(Boolean)));

  const escapeCSV = (val: unknown) => {
    const s = String(val ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const exportRegistry = () => {
    const headers = ['Proctor ID', 'Name', 'Type', 'Managed By', 'Certified Customers'];
    const rows = filteredRegistry.map(r => [
      r.pid,
      r.name,
      r.ptype,
      r.vendor,
      r.customerNames,
    ]);

    const csv = [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `certification_registry_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Input
          placeholder="🔍 Name, ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px]"
        />
        <Select
          options={[
            { value: '', label: 'All Managed By' },
            ...vendors.map(v => ({ value: v, label: v })),
          ]}
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="min-w-[160px]"
        />
        <Select
          options={[
            { value: '', label: 'All Customers' },
            ...customers.map(c => ({ value: c.id, label: c.name })),
          ]}
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="min-w-[180px]"
        />
        <Button variant="ghost" size="sm" onClick={exportRegistry}>
          ⬇ Export
        </Button>
      </div>

      {/* Table */}
      <Table
        data={filteredRegistry}
        columns={registryColumns}
        isLoading={isLoading}
        emptyMessage="No certified proctors found"
      />
    </div>
  );
}

const registryColumns = [
  {
    header: 'Proctor ID',
    accessor: (row: RegistryRow) => row.pid,
    className: 'font-mono text-[11px] text-text3',
  },
  {
    header: 'Name',
    accessor: (row: RegistryRow) => row.name,
    className: 'text-[13px] text-text font-semibold',
  },
  {
    header: 'Type',
    accessor: (row: RegistryRow) => (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-info/10 text-info">
        {row.ptype}
      </span>
    ),
  },
  {
    header: 'Managed By',
    accessor: (row: RegistryRow) => row.vendor,
    className: 'text-[12px] text-text2',
  },
  {
    header: 'Certified Customers',
    accessor: (row: RegistryRow) => row.customerNames,
    className: 'text-[12px] text-text2',
  },
];
