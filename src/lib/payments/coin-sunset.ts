// 2026-06-30 — 나이스페이 카드전용 제약: 선불충전(코인) 신규 발행 전면 중단.
//   기존 보유 잔액 차감(deduct_credits)은 레거시로 유지(만료일까지 소진).
import type { PaymentPackage } from '@/lib/payments/catalog';

/** 코인 신규 발행(충전 판매) 허용 여부. 카드전용 전환으로 영구 false. */
export const COIN_TOPUP_ENABLED = false;

export function isCreditPackage(pkg: PaymentPackage): boolean {
  return pkg.kind === 'credits';
}

export function assertCoinTopupAllowed(pkg: PaymentPackage): void {
  if (!COIN_TOPUP_ENABLED && isCreditPackage(pkg)) {
    throw new Error('코인 충전은 현재 제공하지 않습니다.');
  }
}

/** 코인 적립 허용 여부. COIN_TOPUP_ENABLED=false 인 동안 멤버십 포함 모든 신규 코인 적립 중단. */
export function shouldGrantCredits(pkg: PaymentPackage): boolean {
  return COIN_TOPUP_ENABLED && pkg.credits > 0;
}
