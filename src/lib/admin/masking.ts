// 서버측 PII 마스킹. role='admin' 은 가림, 'super_admin' 은 원본.
import type { AdminRole } from '@/lib/admin-auth';

export function maskEmail(email: string | null | undefined, role: AdminRole): string | null {
  if (!email) return null;
  if (role === 'super_admin') return email;
  const at = email.indexOf('@');
  if (at <= 0) return '***';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const tld = dot >= 0 ? domain.slice(dot) : '';
  return `${local[0]}***@${domain[0] || ''}***${tld}`;
}

export function maskBirthDate(
  year: number | null,
  month: number | null,
  day: number | null,
  role: AdminRole
): string | null {
  if (year == null) return null;
  const yyyy = String(year).padStart(4, '0');
  if (role === 'super_admin') {
    const mm = month == null ? '??' : String(month).padStart(2, '0');
    const dd = day == null ? '??' : String(day).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return `${yyyy}-**-**`;
}
