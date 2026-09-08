'use client';
// 2026-06-26 — 나이스페이 결제창(클라이언트) 헬퍼. SDK 동적 로드 + AUTHNICE.requestPay 로
//   서버승인 결제창을 띄운다. returnUrl 은 서버 핸들러(/api/payments/nicepay/return).
//   참고: docs/payment-nicepay-migration.md §2.
//
// ⚠️ 스캐폴드 — requestPay 파라미터·method 문자열·SDK URL(운영/샌드박스)은 샌드박스 E2E 로
//   확정(docs §6). 나이스페이 클라이언트 키가 'Server 승인 방식'으로 발급돼야 서버승인 결제창 동작.
import { getNicepayClientKey } from '@/lib/payments/nicepay-env';
import { TOSS_PAYMENT_METHOD_OPTIONS } from '@/lib/payments/methods';

const SDK_URL = 'https://pay.nicepay.co.kr/v1/js/';

interface NicepayRequestPayOptions {
  clientId: string;
  method: string;
  orderId: string;
  amount: number;
  goodsName: string;
  returnUrl: string;
  fnError?: (result: { errorMsg?: string; resultMsg?: string }) => void;
}

declare global {
  interface Window {
    AUTHNICE?: { requestPay: (options: NicepayRequestPayOptions) => void };
  }
}

let sdkPromise: Promise<void> | null = null;

function loadNicepaySdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('나이스페이 결제는 브라우저에서만 호출할 수 있습니다.'));
  }
  if (window.AUTHNICE) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('나이스페이 결제 모듈을 불러오지 못했습니다.')));
      if (window.AUTHNICE) resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error('나이스페이 결제 모듈을 불러오지 못했습니다.'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
}

/** 매핑이 없는 코드가 들어왔을 때의 안전한 기본값. 카드는 항상 열려 있다. */
const NICEPAY_METHOD_FALLBACK = 'card';

/**
 * 결제수단 코드 → 나이스페이 method 문자열. 매핑 정본은 methods.ts 의 `nicepayMethod`.
 *
 * 🔴 계좌이체('bank')는 **어떤 입력으로도 나가면 안 된다** — 나이스페이 안내상 넣는 순간
 *   결제 자체가 막힌다(2026-09-08). TRANSFER 는 테이블에서 `nicepayMethod: null` 이라
 *   여기서 fallback('card')으로 떨어진다. 픽커가 이미 안 보여주지만 여기가 마지막 관문이다.
 *
 * 🔴 2026-09-08 — CARD 는 'cardAndEasyPay'(카드+간편결제 한 덩어리)에서 'card'(카드 전용)로
 *   돌아왔다. 간편결제를 우리 화면에서 개별 버튼으로 분리했으므로 카드 창에 또 넣으면
 *   같은 수단이 두 번 나온다. 설계: docs/payment-easypay-picker-design.md
 */
export function toNicepayMethod(methodCode: string): string {
  const option = TOSS_PAYMENT_METHOD_OPTIONS.find((o) => o.code === methodCode);
  return option?.nicepayMethod ?? NICEPAY_METHOD_FALLBACK;
}

/**
 * 나이스페이 서버승인 결제창 호출. 인증 완료 시 나이스페이 서버가 returnUrl(서버 핸들러)로 POST.
 * 토스의 payment.requestPayment 와 동일 위치에서 분기 호출.
 */
export async function requestNicepayPayment(opts: {
  orderId: string;
  amount: number;
  goodsName: string;
  method: string; // toNicepayMethod 결과
  onError?: (message: string) => void;
}): Promise<void> {
  // 2026-06-27 — MODE(sandbox/live) 별 clientKey 자동 선택(nicepay-env, 기존 단일 키 폴백).
  const clientId = getNicepayClientKey();

  await loadNicepaySdk();
  if (!window.AUTHNICE) {
    throw new Error('나이스페이 결제 모듈 초기화에 실패했습니다.');
  }

  window.AUTHNICE.requestPay({
    clientId,
    method: opts.method,
    orderId: opts.orderId,
    amount: opts.amount,
    goodsName: opts.goodsName,
    returnUrl: `${window.location.origin}/api/payments/nicepay/return`,
    fnError: (result) =>
      opts.onError?.(result?.errorMsg ?? result?.resultMsg ?? '결제가 취소되었거나 실패했습니다.'),
  });
}
