// 2026-08-11 — 전면 유료화 잠금 (B)갈래 게이트: **결제자 통과 + 나머지 차단**.
//
// 왜 proxy 가 아니라 페이지에서 하나:
//   (B)갈래(오늘운세·대화상담)는 무료 진입점과 **결제자 열람 경로가 프리픽스를 공유**한다.
//   /today-fortune/detail·/runs·/snapshots 는 이미 산 사람이 자기 결과를 보는 화면이고,
//   /today-fortune?paid=today-detail&sourceSessionId=... 는 **결제 직후 복귀 경로**다.
//   proxy 에서 프리픽스로 막으면 이 셋이 같이 죽는다(= 환불 사유).
//   그래서 무료 진입 페이지에만 게이트를 걸고, 결제 흐름은 그대로 통과시킨다.
//
// 왜 proxy 에서 결제 여부를 판정하지 않나:
//   판정에 DB 조회가 3종 필요한데 proxy 는 **모든 요청**(정적 자산 제외 전부)에 돈다.
//   페이지 게이트는 해당 페이지 요청에서만 돌고, 그 페이지들은 어차피 이미 동적(ƒ)이다.
//
// 통과 기준(넓게 잡는다 — 돈 낸 사람을 막는 쪽이 훨씬 비싼 오류다):
//   ① 멤버십(활성/해지유예)  ② product_entitlements 1건 이상  ③ 남은 전 잔액 > 0
//
// 되돌리기: NEXT_PUBLIC_PAYWALL_LOCKDOWN=false → isPaywallLockdown() 이 false 라 무동작.

import 'server-only';
import { redirect } from 'next/navigation';
import { getNonExpiredLotBalance } from '@/lib/credits/deduct';
import { isPaywallLockdown } from '@/lib/paywall-lockdown';
import { getMemberTier } from '@/lib/subscription';
import {
  createClient,
  createServiceClient,
  hasSupabaseServerEnv,
  hasSupabaseServiceEnv,
} from '@/lib/supabase/server';

async function hasAnyProductEntitlement(userId: string): Promise<boolean> {
  if (!hasSupabaseServiceEnv) return false;
  const service = await createServiceClient();
  const { data, error } = await service
    .from('product_entitlements')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (error) {
    // 조회 실패 시엔 **통과**시킨다 — 결제자를 잘못 막는 쪽이 무료 열람 한 번보다 비싸다.
    return true;
  }
  return (data?.length ?? 0) > 0;
}

/** 로그인 사용자가 결제 이력(멤버십·이용권·전 잔액)을 가지고 있는가. */
export async function viewerHasPaidAccess(): Promise<boolean> {
  if (!hasSupabaseServerEnv) return false;

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    return false;
  }

  if (!userId) return false;

  if ((await getMemberTier(userId)) !== null) return true;
  if (await hasAnyProductEntitlement(userId)) return true;

  try {
    if ((await getNonExpiredLotBalance(userId)) > 0) return true;
  } catch {
    // 잔액 조회 실패는 통과 근거로 쓰지 않는다(위 두 판정이 이미 끝났다).
  }

  return false;
}

/**
 * (B)갈래 무료 진입 페이지 상단에 건다. 잠금 중 결제 이력이 없으면 /pricing 으로 보낸다.
 * ⚠️ 결제 복귀 리다이렉트(`paid=...`) **뒤에** 호출할 것 — 앞에 두면 결제 직후 사용자가 튕긴다.
 */
export async function guardLockedFreeEntry(): Promise<void> {
  if (!isPaywallLockdown()) return;
  if (await viewerHasPaidAccess()) return;
  redirect('/pricing');
}
