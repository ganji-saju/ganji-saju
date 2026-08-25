// 2026-08-25 전면 개편 — 990원 라이트 언락 게이트.
//   구 무료 메뉴 4종(간단운세·타로·꿈해몽·대화상담)은 이제 990원 결제 후 이용한다
//   (별자리·띠운세만 무료 유지 — 사용자 확정). **당일권**(2026-08-25 사용자 확정):
//   결제일 KST 당일만 유효 — scope_key 'day:{YYYY-MM-DD}' 정확 일치로 판정한다.
//   통과 기준: ① 멤버십(활성/해지유예)  ② 오늘 날짜의 해당 990원 당일권.
//   비로그인·미결제는 체크아웃으로 보낸다(체크아웃이 로그인 흐름을 이미 처리).
//
//   ⚠️ guardLockedFreeEntry(전면 잠금 (B)게이트)와 별개다 — 그쪽은 잠금 스위치용
//   광역 게이트(아무 결제 이력이면 통과), 이쪽은 메뉴별 상품 게이트(해당 이용권 필요).
//   결제 복귀 리다이렉트(?paid=…)가 있는 페이지에선 그 **뒤**에 호출할 것.

import 'server-only';
import { redirect } from 'next/navigation';
import type { PackageId, TasteProductId } from '@/lib/payments/catalog';
import { buildDayPassScopeKey } from '@/lib/payments/product-scope';
import { getTasteProductEntitlement } from '@/lib/product-entitlements';
import { getMemberTier } from '@/lib/subscription';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';

export interface MenuPass {
  packageId: PackageId;
  productId: TasteProductId;
}

export const MENU_PASSES = {
  today: { packageId: 'taste_today_basic', productId: 'today-basic' },
  tarot: { packageId: 'taste_tarot_daily', productId: 'tarot-daily' },
  dream: { packageId: 'taste_dream_search', productId: 'dream-search' },
  dialogue: { packageId: 'taste_dialogue_entry', productId: 'dialogue-entry' },
} as const satisfies Record<string, MenuPass>;

export type MenuPassKey = keyof typeof MENU_PASSES;

function checkoutHref(pass: MenuPass, from: string) {
  // ⚠️ 체크아웃의 product 파라미터는 packageId 가 아니라 **tasteProductId** 를 받는다
  //   (isTasteProductId 판정 — packageId 를 넘기면 멤버십 기본값으로 폴백하는 실버그 냄).
  return `/membership/checkout?product=${pass.productId}&from=${encodeURIComponent(from)}`;
}

/** 게이트 없이 판정만 — 라벨 분기(이용권 보유 표시 등)에 사용. */
export async function viewerHasMenuPass(key: MenuPassKey): Promise<boolean> {
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

  try {
    // 당일권 — 오늘(KST) 날짜 scope 정확 일치. 어제 산 권한은 자연 소멸.
    return Boolean(
      await getTasteProductEntitlement(userId, MENU_PASSES[key].productId, buildDayPassScopeKey())
    );
  } catch {
    // 조회 실패 시엔 통과 — 결제자를 잘못 막는 오류가 무료 열람 한 번보다 비싸다
    // (guardLockedFreeEntry 와 동일 원칙).
    return true;
  }
}

/**
 * 메뉴 진입 페이지 상단에 건다. 이용권·멤버십이 없으면 해당 상품 체크아웃으로 redirect.
 * Supabase env 부재(로컬 빌드 등)에서는 무동작 — 게이트가 빌드를 깨면 안 된다.
 */
export async function guardMenuPassEntry(key: MenuPassKey, from: string): Promise<void> {
  if (!hasSupabaseServerEnv) return;
  if (await viewerHasMenuPass(key)) return;
  redirect(checkoutHref(MENU_PASSES[key], from));
}
