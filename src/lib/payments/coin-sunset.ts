// 2026-06-30 — 나이스페이 카드전용 제약: 선불충전(전) 신규 발행 전면 중단.
//   기존 보유 잔액 차감(deduct_credits)은 레거시로 유지(만료일까지 소진).
import type { PaymentPackage } from '@/lib/payments/catalog';

/** 전 신규 발행(충전 판매) 허용 여부. 카드전용 전환으로 영구 false. */
export const COIN_TOPUP_ENABLED = false;

export function isCreditPackage(pkg: PaymentPackage): boolean {
  return pkg.kind === 'credits';
}

export function assertCoinTopupAllowed(pkg: PaymentPackage): void {
  if (!COIN_TOPUP_ENABLED && isCreditPackage(pkg)) {
    throw new Error('전 충전은 현재 제공하지 않습니다.');
  }
}

/** 전 적립 허용 여부. COIN_TOPUP_ENABLED=false 인 동안 멤버십 포함 모든 신규 전 적립 중단. */
/** 대화상담 질문 3회(taste_dialogue_entry)의 전달물 = 전 3개. 지급(fulfillment)과 PG 취소 회수(나이스 웹훅)가 같은 값을 쓴다. */
export const DIALOGUE_QUESTION_CREDITS = 3;

/** PG 취소 때 회수할 전 — 결제가 **실제로 지급한** 전과 같아야 한다(2026-09-14).
 *  멤버십은 코인 sunset 뒤 전을 안 준다(카탈로그 credits=90) → 0 · 대화상담은 카탈로그 credits=0 이지만 전 3개를 준다 → 3.
 *  (shouldGrantCredits 는 영구 false 라 기준으로 쓰면 sunset 이전 전 충전 주문 회수까지 꺼진다 — 그래서 카탈로그 값 유지.) */
export function creditsToRevokeOnCancel(pkg: { id: string; kind: string; credits: number } | undefined): number {
  if (!pkg || pkg.kind === 'subscription') return 0;
  if (pkg.id === 'taste_dialogue_entry') return DIALOGUE_QUESTION_CREDITS;
  return pkg.credits > 0 ? pkg.credits : 0;
}

export function shouldGrantCredits(pkg: PaymentPackage): boolean {
  return COIN_TOPUP_ENABLED && pkg.credits > 0;
}
