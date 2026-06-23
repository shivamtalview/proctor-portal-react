import { supabase } from './supabase';
import type { User } from '@/types';

export interface AuditEntry {
  action: string;
  target: string;
  detail: string;
  user?: string | null;
}

function getStoredUserName(): string {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'system';

    const parsed = JSON.parse(raw) as Partial<User>;
    return parsed.username || parsed.name || 'system';
  } catch {
    return 'system';
  }
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const usr = entry.user || getStoredUserName();

  try {
    const { error } = await supabase.from('audit_log').insert({
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
      usr,
      action: entry.action,
      target: entry.target,
      detail: entry.detail,
    });

    if (error) {
      console.error('Audit log write failed:', error);
    }
  } catch (error) {
    console.error('Audit log write failed:', error);
  }
}
