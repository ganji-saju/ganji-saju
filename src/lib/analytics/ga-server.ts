// 2026-08-26 — GA4 Measurement Protocol 서버 전송. 결제/환불의 **정본은 서버**다.
//
//   브라우저에서 purchase 를 쏘면 완료 페이지 이탈·새로고침·광고차단으로 5~20% 가 누락되고
//   가상계좌 입금은 브라우저가 없어 전량 누락된다. 반대로 서버는 DB 확정 건과 1:1 이다.
//
//   ⚠️ 세 가지가 빠지면 조용히 틀린다:
//   ① session_id 없으면 GA4 가 '새 세션 / (direct)' 로 처리 → 채널별 매출이 전부 Direct
//   ② engagement_time_msec 없으면 세션이 집계되지 않음
//   ③ timestamp_micros 가 72시간을 넘으면 GA4 가 이벤트를 **폐기**(가상계좌·재시도 큐 주의)
//
//   ⚠️ 동의: 브라우저는 Consent Mode 로 막아 놓고 서버로 우회하면 동의 배너가 거짓말이 된다.
//   analytics_consent === 'denied' 인 주문은 전송하지 않는다(호출부 판정, 여기서도 방어).
import { GA4_MEASUREMENT_ID, GA4_API_SECRET, hasGa4ServerEnv } from './ga-config';

const MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const MP_DEBUG_ENDPOINT = 'https://www.google-analytics.com/debug/mp/collect';
const REQUEST_TIMEOUT_MS = 8_000;
/** MP 가 이벤트를 폐기하는 경계. 이보다 오래된 확정은 보내도 사라진다. */
export const MP_MAX_EVENT_AGE_MS = 72 * 60 * 60 * 1000;

/**
 * GA4 맞춤 측정기준 값 정규화. GA4 는 대소문자를 구분해 'CARD'/'card' 를 다른 값으로 센다 —
 * 소스가 하나여도 나중에 다른 경로가 붙으면 리포트가 조용히 쪼개진다.
 */
export function normalizeGaDimension(value: string): string {
  return value.trim().toLowerCase();
}

export interface GaPurchaseItem {
  itemId: string;
  itemName: string;
  itemCategory: string;
  price: number;
  quantity: number;
}

export interface GaPurchaseInput {
  clientId: string | null;
  sessionId: string | null;
  userId: string | null;
  /** payment_orders.order_id — GA4·광고매체·환불을 꿰는 단 하나의 키. */
  transactionId: string;
  value: number;
  paymentMethod: string | null;
  productType: string;
  isFirstPurchase: boolean | null;
  items: GaPurchaseItem[];
  /** 결제 시작 시 저장한 동의 상태. 'denied' 면 전송하지 않는다. */
  consent?: string | null;
}

export interface GaRefundInput {
  clientId: string | null;
  sessionId: string | null;
  userId: string | null;
  transactionId: string;
  /** 부분 환불이면 환불 금액만. 원거래와 같은 transaction_id 여야 매출이 차감된다. */
  value: number;
  consent?: string | null;
}

export type GaSendResult =
  | { sent: true; debug?: unknown }
  | { sent: false; skipped: 'no_env' | 'no_client_id' | 'consent_denied' | 'error'; error?: string };

interface MpEvent {
  name: string;
  params: Record<string, unknown>;
}

function skipReason(input: {
  clientId: string | null;
  consent?: string | null;
}): 'no_env' | 'no_client_id' | 'consent_denied' | null {
  if (!hasGa4ServerEnv) return 'no_env';
  if (input.consent === 'denied') return 'consent_denied';
  // 귀속 불가능한 데이터는 보내지 않는다 — 임의 client_id 를 만들어 넣으면 Direct 가 부풀고
  // 남의 세션에 매출이 붙는다.
  if (!input.clientId) return 'no_client_id';
  return null;
}

async function send(
  clientId: string,
  userId: string | null,
  events: MpEvent[],
  options: { debug?: boolean } = {}
): Promise<GaSendResult> {
  const url = new URL(options.debug ? MP_DEBUG_ENDPOINT : MP_ENDPOINT);
  url.searchParams.set('measurement_id', GA4_MEASUREMENT_ID as string);
  url.searchParams.set('api_secret', GA4_API_SECRET as string);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        client_id: clientId,
        ...(userId ? { user_id: userId } : {}),
        timestamp_micros: String(Date.now() * 1000),
        events,
      }),
    });
    if (options.debug) {
      return { sent: true, debug: await res.json().catch(() => null) };
    }
    // MP 는 성공 시 204 를 주고 **검증 오류도 204 로 삼킨다** — 그래서 페이로드 검증은
    // /debug/mp/collect 로 따로 해야 한다(09번 검증 절차 4단계).
    return res.ok ? { sent: true } : { sent: false, skipped: 'error', error: `HTTP ${res.status}` };
  } catch (err) {
    return {
      sent: false,
      skipped: 'error',
      error: err instanceof Error ? err.message : 'unknown',
    };
  } finally {
    clearTimeout(timer);
  }
}

/** 전송 페이로드 구성(순수) — 테스트가 파라미터 누락을 잡을 수 있게 분리한다. */
export function buildPurchaseEvent(input: GaPurchaseInput): MpEvent {
  const items = input.items.map((it) => ({
    item_id: it.itemId,
    item_name: it.itemName,
    // item_id 와 같은 값을 넣으면 상품 계열별 분해가 안 된다.
    item_category: it.itemCategory,
    price: it.price,
    quantity: it.quantity,
  }));

  return {
    name: 'purchase',
    params: {
      ...(input.sessionId ? { session_id: input.sessionId } : {}),
      engagement_time_msec: '1',
      transaction_id: input.transactionId,
      currency: 'KRW',
      // value 는 항상 Σ(price × quantity) 와 일치시킨다. 쿠폰 할인은 value 를 실결제액으로
      // 낮추고 coupon 파라미터를 따로 넣는 것이 GA4 표준이다.
      value: input.value,
      // 2026-08-26 — GA4 는 대소문자를 구분한다. 'CARD' 와 'card' 가 섞이면 리포트가 두 행으로
      //   갈려 결제수단별 전환율을 못 본다. **전송 시점**에만 정규화한다 —
      //   payment_orders.payment_method_code 는 PG 어휘 스냅샷이라 건드리지 않는다.
      ...(input.paymentMethod
        ? { payment_method: normalizeGaDimension(input.paymentMethod) }
        : {}),
      product_type: input.productType,
      ...(input.isFirstPurchase == null
        ? {}
        : { is_first_purchase: String(input.isFirstPurchase) }),
      items,
    },
  };
}

export function buildRefundEvent(input: GaRefundInput): MpEvent {
  return {
    name: 'refund',
    params: {
      ...(input.sessionId ? { session_id: input.sessionId } : {}),
      engagement_time_msec: '1',
      transaction_id: input.transactionId,
      currency: 'KRW',
      value: input.value,
    },
  };
}

export async function sendGaPurchase(
  input: GaPurchaseInput,
  options: { debug?: boolean } = {}
): Promise<GaSendResult> {
  const skipped = skipReason(input);
  if (skipped) return { sent: false, skipped };
  return send(input.clientId as string, input.userId, [buildPurchaseEvent(input)], options);
}

export async function sendGaRefund(
  input: GaRefundInput,
  options: { debug?: boolean } = {}
): Promise<GaSendResult> {
  const skipped = skipReason(input);
  if (skipped) return { sent: false, skipped };
  return send(input.clientId as string, input.userId, [buildRefundEvent(input)], options);
}
