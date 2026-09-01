// 2026-09-01 — 무료 하루 1회 제한이 **탈퇴/재가입으로 리셋되던** 구멍 차단(migration 076).
//
// 🔴 뿌리: `membership_benefit_usage.user_id` 가 auth.users 를 `on delete cascade` 로
//   참조한다(056). 탈퇴하면 오늘 쓴 기록이 사라지고, 카카오 로그인은 가입 절차가 없어
//   탈퇴→재로그인이 10초다(로그 실측). 즉 무료 1회를 하루에 몇 번이든 다시 받을 수 있었다.
//   쿠폰 쪽 같은 구멍은 075 로 막았다([[project_kakao-friend-coupon]]).
//
// 설계 — **소비 경로를 건드리지 않는다.** `consumeFreeDaily` 호출부가 7곳이라 거기에
//   식별자를 심으면 새 무료 메뉴가 생길 때 누군가 빠뜨려 같은 구멍이 다시 난다.
//   대신 경계 두 곳(탈퇴 직전 / 로그인 직후)에만 붙인다:
//     탈퇴 직전 → 지금 쓴 free_* 사용량을 카카오 회원번호 해시로 떠 놓는다(snapshot)
//     로그인 직후 → 그 해시로 **현재 기간** 기록을 새 user_id 에 되돌린다(restore)
//   그래서 제한 로직·호출부는 한 줄도 바뀌지 않고, 새 메뉴도 자동으로 보호된다.
//
// ⚠️ 카카오가 아닌 경로(이메일 등)로 가입한 계정은 대조 키가 없어 이 보호가 걸리지 않는다.
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import { FREE_DAILY_SURFACES } from '@/lib/free-usage/daily-limit';
import { dailyPeriodKey, monthlyPeriodKey } from '@/lib/credits/member-benefits';

/** 이 원장이 지키는 benefit 키 = 무료 메뉴 제한만. 멤버십 쿼터(유료)는 대상이 아니다. */
export const LEDGERED_BENEFITS: readonly string[] = Object.values(FREE_DAILY_SURFACES).map(
  (s) => s.benefit
);

export function isLedgeredBenefit(benefit: string): boolean {
  return LEDGERED_BENEFITS.includes(benefit);
}

/**
 * 되돌릴 가치가 있는 기간키 = 지금 유효한 것뿐.
 * 어제 기록을 되돌리면 오늘 무료를 잘못 막는다(056 과 같은 KST 기준).
 */
export function currentPeriodKeys(now: Date = new Date()): string[] {
  return [dailyPeriodKey(now), monthlyPeriodKey(now)];
}

/**
 * 탈퇴 직전 호출 — 지금 사용량을 카카오 해시로 떠 놓는다.
 * 실패해도 탈퇴를 막지 않는다(탈퇴는 사용자의 권리다 — 우리 기록 사정으로 못 막는다).
 */
export async function snapshotFreeDailyUsage(
  userId: string,
  uidHash: string | null
): Promise<number> {
  if (!userId || !uidHash) return 0;
  try {
    const svc = await createServiceClient();
    const { data, error } = await svc
      .from('membership_benefit_usage')
      .select('benefit, period_key, used_count')
      .eq('user_id', userId)
      .in('benefit', LEDGERED_BENEFITS)
      .in('period_key', currentPeriodKeys());
    if (error || !data?.length) return 0;

    const rows = data.map((r) => ({
      kakao_uid_hash: uidHash,
      benefit: r.benefit as string,
      period_key: r.period_key as string,
      used_count: (r.used_count as number) ?? 1,
    }));
    const { error: upErr } = await svc
      .from('free_daily_ledger')
      .upsert(rows, { onConflict: 'kakao_uid_hash,benefit,period_key' });
    if (upErr) {
      console.warn('[free-daily-ledger] 스냅샷 저장 실패', { reason: upErr.message });
      return 0;
    }
    return rows.length;
  } catch (error) {
    console.warn('[free-daily-ledger] 스냅샷 예외', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}

/**
 * 로그인 직후 호출 — 같은 카카오 계정이 남긴 **현재 기간** 사용량을 새 user_id 로 되돌린다.
 * 원장이 비어 있으면(대부분의 정상 로그인) 셀렉트 한 번으로 끝난다.
 * 실패해도 로그인을 막지 않는다.
 */
export async function restoreFreeDailyUsage(
  userId: string,
  uidHash: string | null
): Promise<number> {
  if (!userId || !uidHash) return 0;
  try {
    const svc = await createServiceClient();
    const { data, error } = await svc
      .from('free_daily_ledger')
      .select('benefit, period_key, used_count')
      .eq('kakao_uid_hash', uidHash)
      .in('period_key', currentPeriodKeys());
    if (error || !data?.length) return 0;

    // 이미 이 계정에 기록이 있으면 덮어쓰지 않는다 — 새 계정에서 쓴 양이 더 많을 수 있다.
    const { data: existing } = await svc
      .from('membership_benefit_usage')
      .select('benefit, period_key, used_count')
      .eq('user_id', userId)
      .in('benefit', LEDGERED_BENEFITS)
      .in('period_key', currentPeriodKeys());
    const usedNow = new Map(
      (existing ?? []).map((r) => [`${r.benefit}|${r.period_key}`, (r.used_count as number) ?? 0])
    );

    const rows = data
      .filter((r) => isLedgeredBenefit(r.benefit as string))
      .map((r) => ({
        user_id: userId,
        benefit: r.benefit as string,
        period_key: r.period_key as string,
        used_count: Math.max(
          (r.used_count as number) ?? 1,
          usedNow.get(`${r.benefit}|${r.period_key}`) ?? 0
        ),
      }));
    if (!rows.length) return 0;

    const { error: upErr } = await svc
      .from('membership_benefit_usage')
      .upsert(rows, { onConflict: 'user_id,benefit,period_key' });
    if (upErr) {
      console.warn('[free-daily-ledger] 복원 실패', { reason: upErr.message });
      return 0;
    }
    console.info('[free-daily-ledger] 재가입 계정에 무료 사용량 복원', {
      userId,
      restored: rows.length,
    });
    return rows.length;
  } catch (error) {
    console.warn('[free-daily-ledger] 복원 예외', {
      reason: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
}
