import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';

interface AuditLog {
  id: string;
  ts: string;
  usr: string;
  action: string;
  target: string;
  detail: string;
}

const ACTION_TYPES = [
  'Created',
  'Updated',
  'BGV Added',
  'Verified',
  'ID Assigned',
  'Offboarded',
  'Login',
  'Logout',
  'Eval Ready',
  'Form Link Shared',
  'Demo Scheduled',
  'Assessment Scheduled',
  'Assessment Scheduled (Multi)',
  'Assessment Result (CSV)',
  'Eval Result',
  'Eval Override',
  'NDA & Docs Triggered',
  'NDA Signed (Manual)',
  'BGV Uploaded',
];

const ACTION_ICONS: Record<string, string> = {
  'Created': '📝',
  'Updated': '✏️',
  'BGV Added': '📎',
  'Verified': '✅',
  'ID Assigned': '🎯',
  'Offboarded': '🚪',
  'Login': '🔑',
  'Logout': '⏏',
  'Eval Ready': '✅',
  'Form Link Shared': '📨',
  'Demo Scheduled': '🎭',
  'Assessment Scheduled': '📝',
  'Assessment Scheduled (Multi)': '👥',
  'Assessment Result (CSV)': '📊',
  'Eval Result': '🧾',
  'Eval Override': '⚠️',
  'NDA & Docs Triggered': '📄',
  'NDA Signed (Manual)': '✍️',
  'BGV Uploaded': '📎',
};

export default function AuditLogPage() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  // Fetch audit logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('ts', { ascending: false })
        .limit(500);

      if (error) throw error;
      return data as AuditLog[];
    },
  });

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !(log.target || '').toLowerCase().includes(s) &&
        !(log.usr || '').toLowerCase().includes(s)
      ) {
        return false;
      }
    }
    if (actionFilter && log.action !== actionFilter) return false;
    return true;
  });

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  const columns = [
    {
      header: 'Timestamp',
      accessor: (log: AuditLog) => (
        <span className="font-mono text-[11px] text-text3">
          {formatDateTime(log.ts)}
        </span>
      ),
    },
    {
      header: 'User',
      accessor: (log: AuditLog) => (
        <span className="font-semibold text-[13px] text-text">{log.usr}</span>
      ),
    },
    {
      header: 'Action',
      accessor: (log: AuditLog) => (
        <span className="text-[13px] text-text">
          {ACTION_ICONS[log.action] || '•'} {log.action}
        </span>
      ),
    },
    {
      header: 'Target',
      accessor: (log: AuditLog) => <span className="text-text2">{log.target}</span>,
    },
    {
      header: 'Details',
      accessor: (log: AuditLog) => (
        <span className="text-[12px] text-text3">{log.detail}</span>
      ),
    },
  ];

  return (
    <div>
      {/* Filters */}
      <Card className="overflow-hidden">
        <div className="flex gap-2 p-4 items-center flex-wrap border-b border-border">
          <Input
            placeholder="🔍 Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[180px]"
          />
          <Select
            options={[
              { value: '', label: 'All Actions' },
              ...ACTION_TYPES.map((action) => ({ value: action, label: action })),
            ]}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="min-w-[140px]"
          />
          <span className="text-xs text-text2 whitespace-nowrap">
            {filteredLogs.length} entries
          </span>
        </div>

        {/* Table */}
        <Table
          data={filteredLogs}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No entries yet"
          wrapped={false}
        />
      </Card>
    </div>
  );
}
