// 2026-09-14 — 멤버십 기간 원장(086 membership_periods) 드리프트 매일 점검(사용자 결정).
//   불변식: 살아 있는(voided_at null) 기간의 max(end_at) = subscriptions.renews_at.
//   판정은 086 머리말의 드리프트 쿼리 두 개와 같다(값은 µs 로 비교 — Postgres 정밀도. 086 이 경계를 ms 로 맞췄지만 renews_at 엔 제약이 없다):
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
  /** 구독 행 자체가 없음(renewsAt null 과 다르다) — 첫 지급이 기간 행만 쓰고 구독 저장 전에 끊긴 모양. 정리 SQL 의 "R null → 전부 무효" 대상이 아니다:
   *  무효하면 그 주문의 지급 재시도가 '구독 정보가 없습니다' 로 영구히 막히고, 두면 재시도가 구독을 E 로 만든다(activateMembershipSubscription). */
  subscriptionMissing: boolean;
}
export interface MembershipDrift {
  chainVsRenews: string[];
  entitledWithoutEnd: string[];
  users: DriftUser[];
}

/**
 * µs 정수(Postgres timestamptz 정밀도) — Date.parse 는 소수 4~6째 자리를 버려 µs 가 남은 renews_at 을 "일치" 로 본다(086 쿼리의 is distinct from 은 어긋남).
 * end_at 은 ms_precision 제약으로 항상 ms 라, µs 가 남은 renews_at 은 어떤 end_at 과도 같지 않다(정리 전에 R 을 ms 로 잘라야 한다).
 */
const us = (value: string) => Date.parse(value) * 1000 + Number(((/\.(\d+)/.exec(value)?.[1] ?? '') + '000000').slice(3, 6));

/** 순수 판정 — 입력 행을 스스로 거른다(무효 행·과거 기간은 무시). */
export function findMembershipDrift(
  periods: DriftPeriodRow[],
  subscriptions: DriftSubscriptionRow[],
  now: Date
): MembershipDrift {
  const nowUs = now.getTime() * 1000;
  const chainEnd = new Map<string, number>();
  const liveEnds = new Map<string, Set<number>>();
  for (const row of periods) {
    if (row.voided_at !== null) continue;
    const end = us(row.end_at);
    chainEnd.set(row.user_id, Math.max(chainEnd.get(row.user_id) ?? -Infinity, end));
    if (!liveEnds.has(row.user_id)) liveEnds.set(row.user_id, new Set());
    liveEnds.get(row.user_id)!.add(end);
  }
  const subByUser = new Map(subscriptions.map((sub) => [sub.user_id, sub]));
  const renewsUs = (userId: string) => {
    const renews = subByUser.get(userId)?.renews_at;
    return renews ? us(renews) : null;
  };

  const chainVsRenews = [...chainEnd]
    .filter(([userId, end]) => end > nowUs && renewsUs(userId) !== end)
    .map(([userId]) => userId);
  const entitledWithoutEnd = subscriptions
    .filter((sub) => {
      const renews = renewsUs(sub.user_id);
      return (
        (sub.status === 'active' || sub.status === 'cancelled') &&
        renews !== null &&
        renews > nowUs &&
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
      chainEnd: end === undefined ? null : new Date(Math.floor(end / 1000)).toISOString(),
      subscriptionMissing: !subByUser.has(userId),
    };
  });
  return { chainVsRenews, entitledWithoutEnd, users };
}

/**
 * DB 에서 읽어 판정한다(service — 086 표는 RLS on·정책 없음).
 * 읽기 범위: 기간은 살아 있고 끝이 미래인 행만(과거 사슬은 chain_vs_renews 대상이 아니다).
 * 구독은 전부(사용자당 1행) — renews_at 이 과거여도 P2(구독 끝 < 사슬 끝)의 R 로 메일·응답에 원값이 나가야 한다.
 *   R 을 null 로 내보내면 086 정리 SQL 이 "모든 살아 있는 행 무효" 로 읽혀 과거 결제 행까지 무효 처리된다.
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
    () => client.from('subscriptions').select('user_id, status, renews_at'),
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
      '정리 전에 /api/admin/audits/membership-drift 수동 호출(super_admin)로 한 번 더 확인하세요 — 지급·해제가 두 표를 따로 쓰는 틈에 읽혔으면 다시 0 입니다.',
      `chain_vs_renews ${drift.chainVsRenews.length}건 · entitled_without_end ${drift.entitledWithoutEnd.length}건 (살아 있는 기간의 끝 ≠ subscriptions.renews_at).`,
      ...shown.map((user) =>
        user.subscriptionMissing
          ? `${user.userId} [${user.checks.join(', ')}] 구독 행 없음 · 사슬 끝 E=${user.chainEnd ?? 'null'} — ⚠️ 무효 처리 금지: 첫 지급이 기간 행만 쓰고 구독 저장 전에 끊긴 모양이라 그 주문 지급을 다시 돌리면 구독이 E 로 생긴다(무효하면 재시도가 영구히 실패) — ${origin}/admin/users/${user.userId}`
          : `${user.userId} [${user.checks.join(', ')}] 구독 끝 R=${user.renewsAt ?? 'null'} · 사슬 끝 E=${user.chainEnd ?? 'null'} — ${origin}/admin/users/${user.userId}`
      ),
      ...(rest > 0 ? [`외 ${rest}명 — 전체 목록은 /api/admin/audits/membership-drift 수동 호출(super_admin)로 확인.`] : []),
      '정리 SQL: supabase/migrations/086_membership_periods.sql 머리말 "드리프트 정리"(R > E 는 legacy 행 추가 · R < E 는 무효 후 자르기 — 구독 행 없음은 제외). 정리 뒤 같은 머리말의 드리프트 쿼리가 0 인지 확인.',
    ],
    url: '/admin/users',
  };
}
