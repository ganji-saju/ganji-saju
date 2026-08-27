'use client';
// 2026-08-26 — GTM dataLayer 공통 push.
//
//   ⚠️ GTM 에서 `ecommerce` 객체는 push 사이에 **잔여값이 남는다**. 이전 이벤트의 items 가
//   다음 이벤트에 섞여 들어가므로 반드시 null 로 비우고 push 한다(GA4 전자상거래 표준 관행).
//
//   purchase 는 여기 없다 — 결제 확정은 서버가 정본이다(ga-server.ts). 브라우저에서 쏘면
//   완료 페이지 이탈·새로고침·광고차단으로 누락되고 가상계좌는 전량 빠진다.

import { trafficTypeParams } from '@/lib/analytics/ga-environment';

// dataLayer 타입은 src/lib/analytics.ts 가 이미 전역 선언한다 — 여기서 다시 선언하면
// 두 선언의 타입이 어긋나 TS2717 이 난다.

export interface GtmItem {
  item_id: string;
  item_name: string;
  item_category: string;
  price: number;
  quantity: number;
}

export function pushDataLayer(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ ecommerce: null });
    // 스테이징·프리뷰 이벤트는 internal 로 표식한다(ga-environment.ts 참고).
    //   여기서 막지 않는 이유: GTM 미리보기로 퍼널을 검증할 수 있어야 한다.
    window.dataLayer.push({ ...payload, ...trafficTypeParams() });
  } catch {
    // 계측 실패가 화면을 막지 않는다.
  }
}

export function gtmViewItem(productType: string, value: number, items: GtmItem[]): void {
  pushDataLayer({
    event: 'view_item',
    product_type: productType,
    ecommerce: { currency: 'KRW', value, items },
  });
}

export function gtmBeginCheckout(
  productType: string,
  value: number,
  items: GtmItem[],
  orderId?: string | null
): void {
  pushDataLayer({
    event: 'begin_checkout',
    product_type: productType,
    // 결제 시작 → 완료 퍼널을 주문 단위로 이어 붙이는 키(서버 purchase 의 transaction_id 와 동일).
    ...(orderId ? { order_id: orderId } : {}),
    ecommerce: { currency: 'KRW', value, items },
  });
}

export function gtmAddPaymentInfo(
  productType: string,
  method: string,
  value: number,
  items: GtmItem[]
): void {
  pushDataLayer({
    event: 'add_payment_info',
    product_type: productType,
    payment_method: method,
    ecommerce: { currency: 'KRW', value, payment_type: method, items },
  });
}

export function gtmLogin(method: 'kakao' | 'google' | 'email'): void {
  pushDataLayer({ event: 'login', login_method: method, method });
}

export function gtmSignUp(method: 'kakao' | 'google' | 'email'): void {
  pushDataLayer({ event: 'sign_up', login_method: method, method });
}

/** 결제 완료 화면 노출 — 광고 픽셀 전용 트리거. GA4 purchase 는 서버가 보낸다. */
export function gtmPurchaseCompleteView(orderId: string, value: number): void {
  pushDataLayer({ event: 'purchase_complete_view', order_id: orderId, value, currency: 'KRW' });
}
