import { useQuery } from '@tanstack/react-query';
import { proctorService } from '@/services/proctor';
import { useAuthStore } from '@/stores/auth';
import { supabase } from '@/services/supabase';
import { getScopedVendor } from '@/utils/access';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats', user?.vendor],
    queryFn: () => proctorService.getStats(getScopedVendor(user)),
  });

  // Fetch recent activity (last 8 updated proctors, excluding interview_selected)
  const { data: recentActivity = [] } = useQuery({
    queryKey: ['recent-activity', user?.vendor],
    queryFn: async () => {
      let query = supabase
        .from('proctors')
        .select('id, name, managed_by, vendor, status, upd, interview_stage')
        .order('upd', { ascending: false })
        .limit(20); // Fetch more to filter

      const scopedVendor = getScopedVendor(user);
      if (scopedVendor) {
        query = query.or(`vendor.eq."${scopedVendor}",managed_by.eq."${scopedVendor}"`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Map vendor field and filter out interview_selected like HTML app
      const filtered = (data || [])
        .map(p => ({ ...p, vendor: p.vendor || p.managed_by }))
        .filter(p => p.interview_stage !== 'interview_selected')
        .slice(0, 8);
      
      return filtered;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-text2">Loading dashboard...</div>
      </div>
    );
  }

  // Vendor breakdown rows, flattened for the Table component
  const vendorRows = Object.entries(stats?.byVendor || {}).map(
    ([vendor, data]: [string, any]) => ({ vendor, ...data })
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      'In Progress': 'bg-warning/10 text-warning',
      'Verified': 'bg-info/10 text-info',
      'Active': 'bg-success/10 text-success',
      'Offboarded': 'bg-danger/10 text-danger',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors[status] || 'bg-surface2 text-text3'}`}>
        {status}
      </span>
    );
  };

  // Vendor badge with color (matching HTML app)
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
      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
        <StatCard
          label="Total Proctors"
          value={stats?.total || 0}
          className="border-l-accent"
        />
        <StatCard
          label="In Progress"
          value={stats?.inProgress || 0}
          className="border-l-warning"
        />
        <StatCard
          label="Interview Selects"
          value={stats?.interviewSelects || 0}
          subtitle="Pre-onboarding"
          className="border-l-[#8b5cf6]"
        />
        <StatCard
          label="Active"
          value={stats?.active || 0}
          className="border-l-success"
        />
        <StatCard
          label="BGV Overdue"
          value={stats?.bgvOverdue || 0}
          subtitle={`of ${stats?.bgvMissing || 0} missing`}
          valueColor="text-danger"
          className="border-l-danger"
        />
        <StatCard
          label="Demo Certified"
          value={stats?.demoCert || 0}
          valueColor="text-[#a78bfa]"
          className="border-l-[#a78bfa]"
        />
        <StatCard
          label="Assessment Certified"
          value={stats?.assessCert || 0}
          valueColor="text-success"
          className="border-l-success"
        />
      </div>

      {/* Vendor Breakdown */}
      {user?.role === 'admin' && Object.keys(stats?.byVendor || {}).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-text3 uppercase tracking-wide mb-3 pb-2 border-b border-border">
            Vendor Breakdown
          </h3>
          <Table
            data={vendorRows}
            columns={[
              {
                header: 'Vendor',
                accessor: (row) => getVendorBadge(row.vendor),
              },
              {
                header: 'Total',
                accessor: (row) => row.total,
                className: 'text-right font-mono text-sm text-text',
              },
              {
                header: 'In Progress',
                accessor: (row) => row.inProgress,
                className: 'text-right font-mono text-sm text-warning',
              },
              {
                header: 'Active',
                accessor: (row) => row.active,
                className: 'text-right font-mono text-sm text-success',
              },
              {
                header: 'BGV Missing',
                accessor: (row) => row.bgvMissing,
                className: 'text-right font-mono text-sm text-warning',
              },
              {
                header: 'BGV Overdue',
                accessor: (row) => row.bgvOverdue,
                className: 'text-right font-mono text-sm text-danger',
              },
              {
                header: 'Demo Cert',
                accessor: (row) => row.demoCert,
                className: 'text-right font-mono text-sm text-[#7c3aed]',
              },
              {
                header: 'Assess Cert',
                accessor: (row) => row.assessCert,
                className: 'text-right font-mono text-sm text-accent',
              },
            ]}
            emptyMessage="No vendor data available"
          />
        </div>
      )}

      {/* Recent Activity */}
      <div>
        <h3 className="text-xs font-semibold text-text3 uppercase tracking-wide mb-3">
          Recent Activity
        </h3>
        <Table
          data={recentActivity}
          columns={[
            {
              header: 'Name',
              accessor: 'name',
            },
            {
              header: 'Managed By',
              accessor: (row: any) => getVendorBadge(row.vendor || row.managed_by),
            },
            {
              header: 'Status',
              accessor: (row: any) => getStatusBadge(row.status),
            },
            {
              header: 'Updated',
              accessor: (row: any) => formatDate(row.upd),
              className: 'text-[12px] text-text3',
            },
          ]}
          emptyMessage="No activity yet"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  subtitle?: string;
  valueColor?: string;
  className?: string;
}

function StatCard({ label, value, subtitle, valueColor = 'text-text', className = '' }: StatCardProps) {
  return (
    <Card
      className={`p-4 border-l-[3px] ${className}`}
    >
      <div className="text-[11px] font-semibold text-text3 uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className={`text-[28px] font-bold font-mono leading-none ${valueColor}`}>
        {value}
      </div>
      {subtitle && (
        <div className="text-[11px] text-text3 mt-1">
          {subtitle}
        </div>
      )}
    </Card>
  );
}
