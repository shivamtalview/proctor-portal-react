import { format, formatDistanceToNow } from 'date-fns';

/**
 * Format date to readable string
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), 'dd MMM yyyy');
  } catch {
    return '—';
  }
}

/**
 * Format datetime to readable string
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), 'dd MMM yyyy, HH:mm');
  } catch {
    return '—';
  }
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return '—';
  }
}

/**
 * Format phone number
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  // Format as +91 XXXXX XXXXX
  if (phone.length === 10) {
    return `${phone.slice(0, 5)} ${phone.slice(5)}`;
  }
  return phone;
}

/**
 * Mask Aadhaar number (show only last 4 digits)
 */
export function maskAadhaar(aadhaar: string | null | undefined): string {
  if (!aadhaar) return '—';
  if (aadhaar.length === 12) {
    return `XXXX XXXX ${aadhaar.slice(-4)}`;
  }
  return aadhaar;
}

/**
 * Generate initials from name
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Export data to CSV
 */
export function exportToCSV<T extends Record<string, unknown>>(data: T[], filename: string) {
  if (data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map((row) =>
      headers.map((header) => {
        const value = row[header];
        // Escape commas, quotes, and newlines
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
