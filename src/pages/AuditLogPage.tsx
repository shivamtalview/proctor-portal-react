import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/services/supabase';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

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

  return (
    <div>
      {/* Filters */}
      <div className="bg-surface border border-border rounded-lg overflow-hidden">
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
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface2">
              <tr>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Timestamp
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  User
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Action
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Target
                </th>
                <th className="px-3.5 py-2.5 text-left text-[11px] font-semibold text-text3 uppercase tracking-wide border-b border-border">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3.5 py-8 text-center text-text3">
                    Loading...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3.5 py-16">
                    <div className="flex flex-col items-center justify-center">
                      <div className="text-4xl mb-2">🔍</div>
                      <h3 className="text-base font-semibold text-text">No entries yet</h3>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="border-b border-border hover:bg-surface2/50">
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-text3">
                      {formatDateTime(log.ts)}
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-[13px] text-text">
                      {log.usr}
                    </td>
                    <td className="px-3.5 py-2.5 text-[13px] text-text">
                      {ACTION_ICONS[log.action] || '•'} {log.action}
                    </td>
                    <td className="px-3.5 py-2.5 text-[13px] text-text2">
                      {log.target}
                    </td>
                    <td className="px-3.5 py-2.5 text-[12px] text-text3">
                      {log.detail}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
