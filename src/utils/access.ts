import type { User } from '@/types';

export function getScopedVendor(user: Pick<User, 'role' | 'vendor'> | null | undefined): string | undefined {
  if (!user || user.role === 'admin') return undefined;
  return user.vendor;
}

export function isVendorScoped(user: Pick<User, 'role' | 'vendor'> | null | undefined): boolean {
  return !!getScopedVendor(user);
}
