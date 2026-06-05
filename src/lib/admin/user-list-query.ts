// src/lib/admin/user-list-query.ts
// 가입자 목록 순수 로직: 파라미터 파싱·keyset 커서·목록아이템·CSV.
import type { AdminRole } from '@/lib/admin-auth';
import { maskEmail } from './masking';

export type AdminUserSortKey = 'signup' | 'ltv' | 'last_active' | 'paid_count';
export type MemberStatusFilter = 'all' | 'active' | 'dormant';
export type PaidFilter = 'all' | 'yes' | 'no';
export type SubscriptionFilter = 'all' | 'active' | 'cancelled' | 'expired' | 'none';
export type ProfileFilter = 'all' | 'complete' | 'incomplete';

export interface AdminUserListParams {
  status: MemberStatusFilter;
  signupFrom: string | null;
  signupTo: string | null;
  paid: PaidFilter;
  minLtv: number | null;
  subscription: SubscriptionFilter;
  provider: string[];
  inactiveDays: number | null;
  profile: ProfileFilter;
  sort: AdminUserSortKey;
  cursor: string | null;
  limit: number;
}

export interface AdminUserSummaryRow {
  user_id: string;
  email: string | null;
  display_name: string | null;
  signup_at: string;
  signup_provider: string | null;
  profile_complete: boolean;
  last_active_at: string;
  ltv_won: number;
  paid_count: number;
  credit_balance: number;
  credit_expiring: number;
  subscription_status: string | null;
  refundable_won: number;
  reading_count: number;
  chat_count: number;
}

export interface AdminUserListItem {
  userId: string;
  email: string | null;
  displayName: string;
  signupAt: string;
  signupProvider: string | null;
  ltvWon: number;
  paidCount: number;
  subscriptionStatus: string | null;
  creditBalance: number;
  lastActiveAt: string;
  badges: Array<'new' | 'subscribed' | 'refundable' | 'at_risk'>;
}

export interface Cursor {
  v: string;
  id: string;
}

const SORT_KEYS: AdminUserSortKey[] = ['signup', 'ltv', 'last_active', 'paid_count'];
const STATUS: MemberStatusFilter[] = ['all', 'active', 'dormant'];
const PAID: PaidFilter[] = ['all', 'yes', 'no'];
const SUBS: SubscriptionFilter[] = ['all', 'active', 'cancelled', 'expired', 'none'];
const PROFILE: ProfileFilter[] = ['all', 'complete', 'incomplete'];
const PROVIDERS = ['email', 'google', 'kakao'];

function pick<T extends string>(value: string | null, allowed: T[], fallback: T): T {
  return value && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function parseIntOrNull(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && Number.isInteger(n) ? n : null;
}

export function parseListParams(sp: URLSearchParams): AdminUserListParams {
  const rawLimit = parseIntOrNull(sp.get('limit'));
  const limit = rawLimit == null ? 50 : Math.min(100, Math.max(1, rawLimit));
  const provider = (sp.get('provider') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => PROVIDERS.includes(s));
  return {
    status: pick(sp.get('status'), STATUS, 'all'),
    signupFrom: sp.get('signupFrom') || null,
    signupTo: sp.get('signupTo') || null,
    paid: pick(sp.get('paid'), PAID, 'all'),
    minLtv: parseIntOrNull(sp.get('minLtv')),
    subscription: pick(sp.get('subscription'), SUBS, 'all'),
    provider,
    inactiveDays: parseIntOrNull(sp.get('inactiveDays')),
    profile: pick(sp.get('profile'), PROFILE, 'all'),
    sort: pick(sp.get('sort'), SORT_KEYS, 'signup'),
    cursor: sp.get('cursor') || null,
    limit,
  };
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (obj && typeof obj.v === 'string' && typeof obj.id === 'string') {
      return { v: obj.v, id: obj.id };
    }
    return null;
  } catch {
    return null;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(fromIso: string, nowIso: string): number {
  return (new Date(nowIso).getTime() - new Date(fromIso).getTime()) / DAY_MS;
}

export function resolveDisplayName(row: AdminUserSummaryRow): string {
  if (row.display_name && row.display_name.trim()) return row.display_name.trim();
  return `회원-${row.user_id.slice(0, 8)}`;
}

export function buildListItem(
  row: AdminUserSummaryRow,
  role: AdminRole,
  nowIso: string
): AdminUserListItem {
  const badges: AdminUserListItem['badges'] = [];
  if (daysBetween(row.signup_at, nowIso) <= 30) badges.push('new');
  if (row.subscription_status === 'active') badges.push('subscribed');
  if (row.refundable_won > 0) badges.push('refundable');
  if (daysBetween(row.last_active_at, nowIso) > 30 && row.ltv_won > 0) badges.push('at_risk');
  return {
    userId: row.user_id,
    email: maskEmail(row.email, role),
    displayName: resolveDisplayName(row),
    signupAt: row.signup_at,
    signupProvider: row.signup_provider,
    ltvWon: row.ltv_won,
    paidCount: row.paid_count,
    subscriptionStatus: row.subscription_status,
    creditBalance: row.credit_balance,
    lastActiveAt: row.last_active_at,
    badges,
  };
}

export function cursorForRow(row: AdminUserSummaryRow, sort: AdminUserSortKey): Cursor {
  const v =
    sort === 'signup'
      ? row.signup_at
      : sort === 'last_active'
        ? row.last_active_at
        : sort === 'ltv'
          ? String(row.ltv_won)
          : String(row.paid_count);
  return { v, id: row.user_id };
}

function csvCell(value: string | number | null): string {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** super_admin 만 PII 컬럼(email, display_name) 포함. */
export function buildCsv(items: AdminUserListItem[], role: AdminRole): string {
  const pii = role === 'super_admin';
  const header = pii
    ? ['user_id', 'email', 'display_name', 'signup_at', 'ltv_won', 'paid_count', 'subscription_status', 'last_active_at']
    : ['user_id', 'signup_at', 'ltv_won', 'paid_count', 'subscription_status', 'last_active_at'];
  const rows = items.map((i) => {
    const base = pii
      ? [i.userId, i.email, i.displayName, i.signupAt, i.ltvWon, i.paidCount, i.subscriptionStatus, i.lastActiveAt]
      : [i.userId, i.signupAt, i.ltvWon, i.paidCount, i.subscriptionStatus, i.lastActiveAt];
    return base.map(csvCell).join(',');
  });
  return [header.join(','), ...rows].join('\n') + '\n';
}
