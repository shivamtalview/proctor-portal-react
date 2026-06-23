import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '@/services/auth';

describe('authService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('returns null when no user in localStorage', () => {
      expect(authService.getCurrentUser()).toBeNull();
    });

    it('returns parsed user from localStorage', () => {
      const user = {
        id: '1',
        username: 'admin',
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'admin' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem('user', JSON.stringify({ user, storedAt: Date.now() }));
      const result = authService.getCurrentUser();
      expect(result).toEqual(user);
    });

    it('returns null for corrupted localStorage data', () => {
      localStorage.setItem('user', 'invalid-json{{{');
      expect(authService.getCurrentUser()).toBeNull();
    });

    it('returns null when session is expired (older than 8 hours)', () => {
      const user = {
        id: '1',
        username: 'admin',
        name: 'Admin User',
        email: 'admin@test.com',
        role: 'admin' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const eightHoursAgo = Date.now() - 9 * 60 * 60 * 1000; // 9 hours ago
      localStorage.setItem('user', JSON.stringify({ user, storedAt: eightHoursAgo }));
      expect(authService.getCurrentUser()).toBeNull();
    });

    it('returns user for legacy plain User format in localStorage', () => {
      const user = {
        id: '2',
        username: 'vendor_user',
        name: 'Vendor User',
        email: 'vendor@test.com',
        role: 'vendor' as const,
        vendor: 'Sai' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      // Legacy format: no storedAt wrapper
      localStorage.setItem('user', JSON.stringify(user));
      const result = authService.getCurrentUser();
      expect(result).toEqual(user);
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when no user', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('returns true when a valid user is in localStorage', () => {
      const user = {
        id: '1',
        username: 'admin',
        name: 'Admin',
        email: 'admin@test.com',
        role: 'admin' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      localStorage.setItem('user', JSON.stringify({ user, storedAt: Date.now() }));
      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  describe('logout', () => {
    it('removes user from localStorage', () => {
      const user = {
        id: '1', username: 'admin', name: 'Admin', email: 'a@b.com',
        role: 'admin' as const, created_at: '', updated_at: '',
      };
      localStorage.setItem('user', JSON.stringify({ user, storedAt: Date.now() }));
      authService.logout();
      expect(localStorage.getItem('user')).toBeNull();
    });

    it('does not throw when no user is logged in', () => {
      expect(() => authService.logout()).not.toThrow();
    });
  });
});
