import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface Customer {
  id: string;
  name: string;
  org_id: string;
  current_version: number;
  session_type: string[];
  created_at: string;
  created_by: string;
}

const SESSION_TYPES = [
  'Live Proctoring',
  'Record & Review',
  'Testing',
  'Training',
  'Other Value Added Services',
];

const SESSION_COLORS: Record<string, string> = {
  'Live Proctoring': 'bg-accent/15 text-accent',
  'Record & Review': 'bg-purple-400/15 text-purple-400',
  'Testing': 'bg-success/15 text-success',
  'Training': 'bg-warning/15 text-warning',
  'Other Value Added Services': 'bg-danger/15 text-danger',
};

export default function CustomersPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showBumpModal, setShowBumpModal] = useState(false);
  const [bumpCustomer, setBumpCustomer] = useState<Customer | null>(null);

  // Fetch customers
  const { data: customers = [], isLoading } = useQuery({
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

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setShowModal(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowModal(true);
  };

  const handleBumpVersion = (customer: Customer) => {
    setBumpCustomer(customer);
    setShowBumpModal(true);
  };

  const deleteMutation = useMutation({
    mutationFn: async (customer: Customer) => {
      // Delete all certifications first
      const { error: certError } = await supabase
        .from('proctor_certifications')
        .delete()
        .eq('customer_id', customer.id);

      if (certError) throw certError;

      // Delete customer
      const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', customer.id);

      if (error) throw error;
    },
    onSuccess: (_, customer) => {
      alert(`Customer "${customer.name}" deleted`);
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['certifications'] });
    },
    onError: (error: any) => {
      alert('Failed to delete: ' + error.message);
    },
  });

  const handleDeleteCustomer = (customer: Customer) => {
    if (
      !confirm(
        `Delete "${customer.name}"? This will also delete all certifications for this customer. This cannot be undone.`
      )
    )
      return;
    deleteMutation.mutate(customer);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h3 className="text-lg font-semibold text-text mb-1">Admin Access Only</h3>
          <p className="text-text3 text-sm">This page is only accessible to administrators.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-end mb-4">
        <Button variant="primary" size="sm" onClick={handleAddCustomer}>
          + Add Customer
        </Button>
      </div>

      {/* Customer List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-2">⏳</div>
            <h3 className="text-lg font-semibold text-text">Loading customers...</h3>
          </div>
        </div>
      ) : customers.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl mb-2">🏢</div>
            <h3 className="text-lg font-semibold text-text mb-1">No customers yet</h3>
            <p className="text-text3 text-sm">
              Add your first customer to start managing certifications.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="bg-surface border border-border rounded-lg p-4 flex items-center gap-4"
            >
              {/* Version Badge */}
              <div className="text-center min-w-[56px]">
                <div className="text-[10px] font-bold text-text3 uppercase tracking-wider mb-1">
                  SOP
                </div>
                <div className="text-2xl font-bold text-accent">
                  v{customer.current_version}
                </div>
              </div>

              {/* Customer Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <div className="text-base font-bold text-text">{customer.name}</div>
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-accent/15 text-accent">
                    {customer.org_id || 'No Org ID'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  {customer.session_type && customer.session_type.length > 0 ? (
                    customer.session_type.map((type) => (
                      <span
                        key={type}
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          SESSION_COLORS[type] || 'bg-surface2 text-text3'
                        }`}
                      >
                        {type}
                      </span>
                    ))
                  ) : (
                    <span className="text-[11px] text-text3">No session type set</span>
                  )}
                </div>
                <div className="text-[11px] text-text3">
                  Added {formatDate(customer.created_at)} · by {customer.created_by || '—'}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleBumpVersion(customer)}
                >
                  ⬆ Bump SOP
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEditCustomer(customer)}
                >
                  ✏️ Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteCustomer(customer)}
                  disabled={deleteMutation.isPending}
                >
                  🗑 Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <CustomerModal
          customer={editingCustomer}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            setShowModal(false);
          }}
        />
      )}

      {/* Bump Version Modal */}
      {showBumpModal && bumpCustomer && (
        <BumpVersionModal
          customer={bumpCustomer}
          onClose={() => setShowBumpModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['certifications'] });
            setShowBumpModal(false);
          }}
        />
      )}
    </div>
  );
}

interface CustomerModalProps {
  customer: Customer | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CustomerModal({ customer, onClose, onSuccess }: CustomerModalProps) {
  const { user } = useAuthStore();
  const [name, setName] = useState(customer?.name || '');
  const [orgId, setOrgId] = useState(customer?.org_id || '');
  const [version, setVersion] = useState(customer?.current_version || 1);
  const [sessionTypes, setSessionTypes] = useState<string[]>(
    customer?.session_type || []
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: async () => {
      const newErrors: Record<string, string> = {};

      if (!name.trim()) {
        alert('Customer name is required');
        throw new Error('Validation failed');
      }
      if (!orgId.trim()) newErrors.orgId = 'Org ID is required';
      if (sessionTypes.length === 0)
        newErrors.sessionTypes = 'Select at least one session type';

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        throw new Error('Validation failed');
      }

      if (customer) {
        // Edit existing customer
        const { error } = await supabase
          .from('customers')
          .update({
            name: name.trim(),
            org_id: orgId.trim(),
            session_type: sessionTypes,
          })
          .eq('id', customer.id);

        if (error) throw error;
      } else {
        // Add new customer
        const { error } = await supabase.from('customers').insert({
          id: crypto.randomUUID(),
          name: name.trim(),
          org_id: orgId.trim(),
          current_version: version,
          session_type: sessionTypes,
          created_by: user?.username || user?.email || 'unknown',
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      alert(
        customer
          ? 'Customer updated'
          : `Customer "${name}" added`
      );
      onSuccess();
    },
    onError: (error: any) => {
      if (error.message !== 'Validation failed') {
        alert('Failed to save: ' + error.message);
      }
    },
  });

  const toggleSessionType = (type: string) => {
    setSessionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
    setErrors({ ...errors, sessionTypes: '' });
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={customer ? 'Edit Customer' : 'Add Customer'}
    >
      <div className="space-y-4">
        {/* Customer Name */}
        <div>
          <label className="block text-xs font-semibold text-text mb-1">
            Customer Name <span className="text-danger">*</span>
          </label>
          <Input
            placeholder="e.g. Accenture, Infosys..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Org ID */}
        <div>
          <label className="block text-xs font-semibold text-text mb-1">
            Org ID <span className="text-danger">*</span>
          </label>
          <Input
            placeholder="e.g. ORG-001"
            value={orgId}
            onChange={(e) => {
              setOrgId(e.target.value);
              setErrors({ ...errors, orgId: '' });
            }}
          />
          <div className="text-[11px] text-text3 mt-1">
            Existing ID from your workflow — core reference across all portals.
          </div>
          {errors.orgId && (
            <div className="text-danger text-xs mt-1">{errors.orgId}</div>
          )}
        </div>

        {/* Session Type */}
        <div>
          <label className="block text-xs font-semibold text-text mb-1">
            Session Type <span className="text-danger">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            {SESSION_TYPES.map((type) => (
              <label
                key={type}
                className="flex items-center gap-2 text-[13px] font-medium text-text cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={sessionTypes.includes(type)}
                  onChange={() => toggleSessionType(type)}
                  className="accent-accent w-[15px] h-[15px]"
                />
                {type}
              </label>
            ))}
          </div>
          {errors.sessionTypes && (
            <div className="text-danger text-xs mt-1">{errors.sessionTypes}</div>
          )}
        </div>

        {/* Initial SOP Version (only for new customers) */}
        {!customer && (
          <div>
            <label className="block text-xs font-semibold text-text mb-1">
              Initial SOP Version
            </label>
            <Input
              type="number"
              min={1}
              value={version}
              onChange={(e) => setVersion(parseInt(e.target.value) || 1)}
              placeholder="1"
            />
            <div className="text-[11px] text-text3 mt-1">
              Bumping version later invalidates all existing certs for this customer.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            💾 {customer ? 'Save Changes' : 'Add Customer'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

interface BumpVersionModalProps {
  customer: Customer;
  onClose: () => void;
  onSuccess: () => void;
}

function BumpVersionModal({ customer, onClose, onSuccess }: BumpVersionModalProps) {
  // Fetch affected certifications count
  const { data: affectedCertsCount } = useQuery({
    queryKey: ['affected-certs', customer.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proctor_certifications')
        .select('id', { count: 'exact', head: false })
        .eq('customer_id', customer.id)
        .eq('status', 'certified');

      if (error) throw error;
      return data?.length ?? 0;
    },
  });

  const bumpMutation = useMutation({
    mutationFn: async () => {
      const newVersion = customer.current_version + 1;

      const { error } = await supabase
        .from('customers')
        .update({ current_version: newVersion })
        .eq('id', customer.id);

      if (error) throw error;
    },
    onSuccess: () => {
      const newVersion = customer.current_version + 1;
      alert(
        `${customer.name} bumped to v${newVersion}. All previous certs are now outdated.`
      );
      onSuccess();
    },
    onError: (error: any) => {
      alert('Bump failed: ' + error.message);
    },
  });

  return (
    <Modal isOpen={true} onClose={onClose} title="Bump SOP Version" size="sm">
      <div className="space-y-4">
        {/* Warning */}
        <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 text-xs text-warning">
          ⚠️ Bumping the SOP version will{' '}
          <strong>invalidate all existing certifications</strong> for this customer.
          Proctors will need to be re-certified before they can be allocated.
        </div>

        {/* Version Info */}
        <p className="text-sm font-semibold text-text">
          {customer.name} — v{customer.current_version} → v
          {customer.current_version + 1}
        </p>

        {/* Affected Certifications */}
        <p className="text-xs text-text3">
          {affectedCertsCount === undefined
            ? 'Checking affected certifications...'
            : affectedCertsCount > 0
            ? `${affectedCertsCount} existing certification(s) will become outdated and need re-certification.`
            : 'No active certifications will be affected.'}
        </p>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t border-border">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="warning"
            onClick={() => bumpMutation.mutate()}
            disabled={bumpMutation.isPending || affectedCertsCount === undefined}
          >
            ⬆ Bump to v{customer.current_version + 1}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
