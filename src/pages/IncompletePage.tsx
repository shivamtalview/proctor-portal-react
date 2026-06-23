import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import { useAuthStore } from '@/stores/auth';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { proctorService } from '@/services/proctor';
import { logAudit } from '@/services/audit';
import { getScopedVendor } from '@/utils/access';
import { useManagedByOptions } from '@/hooks/useManagedByOptions';
import type { Proctor } from '@/types';

export default function IncompletePage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [uploadProctor, setUploadProctor] = useState<Proctor | null>(null);
  const [bgvFile, setBgvFile] = useState<File | null>(null);

  const isVendor = user?.role === 'vendor';
  const scopedVendor = getScopedVendor(user);
  const { data: managedByOptions = [] } = useManagedByOptions();

  // Fetch proctors with missing BGV
  const { data: proctors = [], isLoading } = useQuery({
    queryKey: ['incomplete-bgv', user?.vendor],
    queryFn: async () => {
      let query = supabase
        .from('proctors')
        .select('*')
        .neq('status', 'Archived')
        .neq('status', 'Interview Selected')
        .order('at', { ascending: true });

      // Vendor sees only their proctors
      if (scopedVendor) {
        query = query.or(`vendor.eq.${scopedVendor},managed_by.eq.${scopedVendor}`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter for missing BGV (null or empty string)
      return (data as Proctor[])
        .filter(p => !p.bgv || p.bgv.trim() === '')
        .map(p => ({
          ...p,
          vendor: p.managed_by || p.vendor || ''
        }));
    },
  });

  // Calculate BGV due info
  const BGV_DUE_DAYS = 12;
  
  const getBgvDueInfo = (proctor: Proctor) => {
    if (!proctor.at) return { label: '—', color: 'text-text3', days: 0 };
    
    const submitted = new Date(proctor.at);
    const dueDate = new Date(submitted.getTime() + BGV_DUE_DAYS * 24 * 60 * 60 * 1000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.round((dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    
    if (diff > 0) {
      return {
        label: `Due in ${diff}d`,
        color: diff <= 3 ? 'text-warning' : 'text-success',
        bgColor: diff <= 3 ? 'bg-warning/15' : 'bg-success/10',
        days: diff
      };
    } else {
      return {
        label: `${Math.abs(diff)}d overdue`,
        color: 'text-danger',
        bgColor: 'bg-danger/15',
        days: diff
      };
    }
  };

  // Filter proctors
  const filteredProctors = proctors.filter((p) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !(p.name || '').toLowerCase().includes(s) &&
        !(p.vendor || '').toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    if (statusFilter && p.status !== statusFilter) return false;
    if (vendorFilter && p.vendor !== vendorFilter) return false;
    return true;
  });

  // Sort by status priority (Active first, then Verified, In Progress, Offboarded)
  const statusOrder: Record<string, number> = {
    'Active': 0,
    'Verified': 1,
    'In Progress': 2,
    'Offboarded': 3
  };

  const sortedProctors = [...filteredProctors].sort((a, b) => {
    return (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9);
  });

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

  const getTypeBadge = (ptype: string) => (
    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-info/10 text-info">
      {ptype}
    </span>
  );

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'Active': 'bg-success/10 text-success',
      'In Progress': 'bg-warning/10 text-warning',
      'Verified': 'bg-info/10 text-info',
      'Offboarded': 'bg-danger/10 text-danger',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors[status] || 'bg-text3/10 text-text3'}`}>
        {status}
      </span>
    );
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadProctor) throw new Error('No proctor selected');
      if (!bgvFile) throw new Error('Please choose a BGV file');

      const safeEmail = (uploadProctor.email || uploadProctor.id).replace(/[^a-z0-9]/gi, '_');
      const path = `${safeEmail}_bgv_${Date.now()}`;
      const url = await proctorService.uploadFile('bgv-documents', path, bgvFile);

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('proctors')
        .update({
          bgv: url,
          upd: now,
        })
        .eq('id', uploadProctor.id);

      if (error) throw error;

      await logAudit({
        action: 'BGV Uploaded',
        target: uploadProctor.name,
        detail: `File uploaded to storage by ${user?.username || user?.name || 'system'}`,
        user: user?.username || user?.name || null,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['incomplete-bgv', user?.vendor] });
      await queryClient.invalidateQueries({ queryKey: ['proctors'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      setUploadProctor(null);
      setBgvFile(null);
      alert('BGV uploaded successfully');
    },
    onError: (error: any) => {
      alert('BGV upload failed: ' + error.message);
    },
  });

  return (
    <div>
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <Input
          placeholder="🔍 Search name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[180px]"
        />
        <Select
          options={[
            { value: '', label: 'All Statuses' },
            { value: 'In Progress', label: 'In Progress' },
            { value: 'Verified', label: 'Verified' },
            { value: 'Active', label: 'Active' },
            { value: 'Offboarded', label: 'Offboarded' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-w-[140px]"
        />
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
      </div>

      {/* Cards List */}
      {isLoading ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center text-text3">
          Loading...
        </div>
      ) : sortedProctors.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h3 className="text-lg font-semibold text-text mb-2">All complete!</h3>
          <p className="text-text3 text-sm">
            No proctors with missing BGV documents.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedProctors.map((proctor) => {
            const dueInfo = getBgvDueInfo(proctor);
            
            return (
              <div
                key={proctor.id}
                className="bg-surface border border-border rounded-lg p-4 flex items-start gap-4 hover:border-accent/30 transition-colors"
              >
                <div className="flex-1">
                  {/* Name and ID */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-base font-semibold text-text">{proctor.name}</span>
                    {proctor.pid && (
                      <span className="font-mono text-[11px] text-text3">{proctor.pid}</span>
                    )}
                  </div>

                  {/* Vendor and Type */}
                  <div className="flex items-center gap-2 mb-2">
                    {getVendorBadge(proctor.vendor!)}
                    {getTypeBadge(proctor.ptype)}
                    <span className="text-xs text-text3">
                      Added: {formatDate(proctor.at)}
                    </span>
                  </div>

                  {/* Status, Warning, and Due Date */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {getStatusBadge(proctor.status)}
                    <span className="text-xs text-warning font-semibold">⚠️ BGV missing</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded ${dueInfo.bgColor} ${dueInfo.color}`}>
                      ⏱ {dueInfo.label}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="flex-shrink-0">
                  {proctor.status !== 'Offboarded' ? (
                    <Button variant="primary" size="sm" onClick={() => setUploadProctor(proctor)}>
                      📎 Upload BGV
                    </Button>
                  ) : (
                    <span className="text-xs text-text3">Offboarded</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {uploadProctor && (
        <Modal
          isOpen={true}
          onClose={() => {
            setUploadProctor(null);
            setBgvFile(null);
          }}
          title="Upload BGV Document"
          size="md"
        >
          <div className="space-y-4">
            <div className="bg-info/10 border border-info/30 rounded-lg p-3 text-info text-sm">
              Upload the BGV file for <strong>{uploadProctor.name}</strong>. The file will be stored in Supabase Storage.
            </div>
            <div>
              <label className="block text-xs font-semibold text-text mb-1">
                BGV Document (PDF or Image) <span className="text-danger">*</span>
              </label>
              <Input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => setBgvFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => {
                  setUploadProctor(null);
                  setBgvFile(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => uploadMutation.mutate()}
                disabled={uploadMutation.isPending}
              >
                {uploadMutation.isPending ? 'Uploading...' : '📎 Upload BGV'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
