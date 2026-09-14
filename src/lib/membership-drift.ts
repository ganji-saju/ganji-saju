// 2026-09-14 — 멤버십 기간 원장(086 membership_periods) 드리프트 매일 점검(사용자 결정).
//   불변식: 살아 있는(voided_at null) 기간의 max(end_at) = subscriptions.renews_at.
//   판정은 086 머리말의 드리프트 쿼리 두 개와 같다(값은 ms 로 비교 — 086 이 경계를 ms 로 맞췄다):
//     chain_vs_renews:      살아 있는 사슬 끝이 지금보다 미래인데 그 사용자의 renews_at 과 다름(구독 행 없음 포함, status 무관).
//     entitled_without_end: 권한 남은 구독(active·cancelled, renews_at 미래)인데 end_at = renews_at 인 살아 있는 행이 없음.
//   정리 SQL 은 supabase/migrations/086_membership_periods.sql 머리말 "드리프트 정리".
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { readAllPages } from '@/lib/subscription';

export type DriftPeriodRow = { user_id: string; end_at: string; voided_at: string | null };
export type DriftSubscriptionRow = { user_id: string; status: string; renews_at: string | null };
export type DriftCheck = 'chain_vs_renews' | 'entitled_without_end';
export interface DriftUser {
  userId: string;
  checks: DriftCheck[];
  /** 구독 끝 R(없으면 null). 정리 SQL 의 R. */
  renewsAt: string | null;
  /** 살아 있는 사슬 끝 E(없으면 null). 정리 SQL 의 E. */
  chainEnd: string | null;
}
export interface MembershipDrift {
  chainVsRenews: string[];
  entitledWithoutEnd: string[];
  users: DriftUser[];
}

const ms = (value: string) => Date.parse(value);

/** 순수 판정 — 입력 행을 스스로 거른다(무효 행·과거 기간은 무시). */
export function findMembershipDrift(
  periods: DriftPeriodRow[],
  subscriptions: DriftSubscriptionRow[],
  now: Date
): MembershipDrift {
  const nowMs = now.getTime();
  const chainEnd = new Map<string, number>();
  const liveEnds = new Map<string, Set<number>>();
  for (const row of periods) {
    if (row.voided_at !== null) continue;
    const end = ms(row.end_at);
    chainEnd.set(row.user_id, Math.max(chainEnd.get(row.user_id) ?? -Infinity, end));
    if (!liveEnds.has(row.user_id)) liveEnds.set(row.user_id, new Set());
    liveEnds.get(row.user_id)!.add(end);
  }
  const subByUser = new Map(subscriptions.map((sub) => [sub.user_id, sub]));
  const renewsMs = (userId: string) => {
    const renews = subByUser.get(userId)?.renews_at;
    return renews ? ms(renews) : null;
  };

  const chainVsRenews = [...chainEnd]
    .filter(([userId, end]) => end > nowMs && renewsMs(userId) !== end)
    .map(([userId]) => userId);
  const entitledWithoutEnd = subscriptions
    .filter((sub) => {
      const renews = renewsMs(sub.user_id);
      return (
        (sub.status === 'active' || sub.status === 'cancelled') &&
        renews !== null &&
        renews > nowMs &&
        !liveEnds.get(sub.user_id)?.has(renews)
      );
    })
    .map((sub) => sub.user_id);

  const users = [...new Set([...chainVsRenews, ...entitledWithoutEnd])].sort().map((userId): DriftUser => {
    const end = chainEnd.get(userId);
    return {
      userId,
      checks: [
        ...(chainVsRenews.includes(userId) ? (['chain_vs_renews'] as const) : []),
        ...(entitledWithoutEnd.includes(userId) ? (['entitled_without_end'] as const) : []),
      ],
      renewsAt: subByUser.get(userId)?.renews_at ?? null,
      chainEnd: end === undefined ? null : new Date(end).toISOString(),
    };
  });
  return { chainVsRenews, entitledWithoutEnd, users };
}

/**
 * DB 에서 읽어 판정한다(service — 086 표는 RLS on·정책 없음).
 * 읽기 범위: 판정에 쓰이는 행만 — 둘 다 "끝이 지금보다 미래" 가 필요하다(renews_at ≤ now·null 이면 구독 행 없음과 같은 결과).
 */
export async function runMembershipDriftAudit(
  options: { client?: SupabaseClient; now?: Date } = {}
): Promise<MembershipDrift> {
  const client = options.client ?? (await createServiceClient());
  const now = options.now ?? new Date();
  const nowIso = now.toISOString();
  const periods = await readAllPages<DriftPeriodRow>(
    () => client.from('membership_periods').select('user_id, end_at, voided_at').is('voided_at', null).gt('end_at', nowIso),
    ['id']
  );
  const subscriptions = await readAllPages<DriftSubscriptionRow>(
    () => client.from('subscriptions').select('user_id, status, renews_at').gt('renews_at', nowIso),
    ['user_id']
  );
  return findMembershipDrift(periods, subscriptions, now);
}

const MAX_ALERT_USERS = 20;

/** 운영 메일 본문 — uuid 만(이메일·이름 등 개인정보 금지). */
export function buildMembershipDriftAlert(drift: MembershipDrift, origin = 'https://ganjisaju.kr') {
  const shown = drift.users.slice(0, MAX_ALERT_USERS);
  const rest = drift.users.length - shown.length;
  return {
    subject: `[멤버십] 기간 원장 어긋남 ${drift.users.length}명 — 수동 정리 필요`,
    lines: [
      `chain_vs_renews ${drift.chainVsRenews.length}건 · entitled_without_end ${drift.entitledWithoutEnd.length}건 (살아 있는 기간의 끝 ≠ subscriptions.renews_at).`,
      ...shown.map(
        (user) =>
          `${user.userId} [${user.checks.join(', ')}] 구독 끝 R=${user.renewsAt ?? 'null'} · 사슬 끝 E=${user.chainEnd ?? 'null'} — ${origin}/admin/users/${user.userId}`
      ),
      ...(rest > 0 ? [`외 ${rest}명 — 전체 목록은 /api/admin/audits/membership-drift 수동 호출(super_admin)로 확인.`] : []),
      '정리 SQL: supabase/migrations/086_membership_periods.sql 머리말 "드리프트 정리"(R > E 는 legacy 행 추가 · R < E 는 무효 후 자르기). 정리 뒤 같은 머리말의 드리프트 쿼리가 0 인지 확인.',
    ],
    url: '/admin/users',
  };
}
