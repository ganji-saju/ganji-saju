// 상세 뷰 순수 로직: 역할별 마스킹 + 요약 헤더 계산. (M3)
import type { AdminRole } from '@/lib/admin-auth';
import { maskEmail, maskBirthDate } from './masking';

const DAY = 86_400_000;

export interface HeaderInput {
  id: string;
  email: string | null;
  createdAt: string;
  profile: { displayName: string | null } | null;
  ltvWon: number;
  subscriptionStatus: string | null;
  lastActiveAt: string | null;
  refundableWon: number;
}

export interface MemberHeader {
  displayName: string;
  emailMasked: string | null;
  uuid: string;
  signupAt: string;
  ageDays: number;
  ltvWon: number;
  subscriptionStatus: string | null;
  inactiveDays: number | null;
  refundableWon: number;
  isSuper: boolean;
}

function daysBetween(fromIso: string, nowIso: string): number {
  return Math.floor((new Date(nowIso).getTime() - new Date(fromIso).getTime()) / DAY);
}

export function buildMemberHeader(input: HeaderInput, role: AdminRole, nowIso: string): MemberHeader {
  const displayName =
    input.profile?.displayName && input.profile.displayName.trim()
      ? input.profile.displayName.trim()
      : `회원-${input.id.slice(0, 8)}`;
  return {
    displayName,
    emailMasked: maskEmail(input.email, role),
    uuid: input.id,
    signupAt: input.createdAt,
    ageDays: daysBetween(input.createdAt, nowIso),
    ltvWon: input.ltvWon,
    subscriptionStatus: input.subscriptionStatus,
    inactiveDays: input.lastActiveAt ? daysBetween(input.lastActiveAt, nowIso) : null,
    refundableWon: input.refundableWon,
    isSuper: role === 'super_admin',
  };
}

export function formatBirth(
  year: number | null,
  month: number | null,
  day: number | null,
  role: AdminRole
): string | null {
  return maskBirthDate(year, month, day, role);
}
