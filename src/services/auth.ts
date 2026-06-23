import { supabase } from './supabase';
import { logAudit } from './audit';
import type { User } from '@/types';

export const authService = {
  /**
   * Login with username and password using Supabase RPC (same as original HTML)
   */
  async login(username: string, password: string): Promise<User> {
    try {
      // Call the verify_login RPC function (same as original HTML app)
      const { data, error } = await supabase.rpc('verify_login', {
        p_username: username,
        p_password: password,
      });

      if (error) {
        throw new Error('Invalid credentials');
      }

      if (!data || data.length === 0) {
        throw new Error('Invalid credentials');
      }

      const userData = data[0];

      // Map the role names to match our type system
      const roleMap: Record<string, 'admin' | 'vendor' | 'coordinator'> = {
        admin: 'admin',
        talview: 'coordinator',
        vendor: 'vendor',
      };

      const user: User = {
        id: userData.id || username,
        username: userData.username,
        name: userData.username.replace(/_/g, ' '),
        email: userData.email || '',
        role: roleMap[userData.role] || 'vendor',
        vendor: userData.vendor || undefined,
        created_at: userData.created_at || new Date().toISOString(),
        updated_at: userData.updated_at || new Date().toISOString(),
      };

      localStorage.setItem('user', JSON.stringify({ user, storedAt: Date.now() }));
      void logAudit({
        action: 'Login',
        target: user.username,
        detail: `Signed in as ${user.role}${user.vendor ? ` · ${user.vendor}` : ''}`,
        user: user.username,
      });
      return user;
    } catch (error) {
      if (error instanceof Error && error.message !== 'Invalid credentials') {
        throw error;
      }
      throw new Error('Invalid credentials');
    }
  },

  /**
   * Logout current user
   */
  logout(): void {
    const current = this.getCurrentUser();
    if (current) {
      void logAudit({
        action: 'Logout',
        target: current.username,
        detail: `Signed out by ${current.username}`,
        user: current.username,
      });
    }
    localStorage.removeItem('user');
  },

  /**
   * Get current logged-in user
   */
  getCurrentUser(): User | null {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;

    try {
      const parsed = JSON.parse(userStr) as { user?: User; storedAt?: number } | User;

      // Handle new session wrapper format
      if ('storedAt' in parsed && parsed.storedAt !== undefined) {
        const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours
        if (Date.now() - parsed.storedAt > SESSION_TTL) {
          localStorage.removeItem('user');
          return null;
        }
        return (parsed as { user: User; storedAt: number }).user;
      }

      // Handle legacy format (plain User object)
      return parsed as User;
    } catch {
      return null;
    }
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null;
  },
};
