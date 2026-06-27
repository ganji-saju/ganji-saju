'use client';
// 2026-06-26 — 나이스페이 결제창(클라이언트) 헬퍼. SDK 동적 로드 + AUTHNICE.requestPay 로
//   서버승인 결제창을 띄운다. returnUrl 은 서버 핸들러(/api/payments/nicepay/return).
//   참고: docs/payment-nicepay-migration.md §2.
//
// ⚠️ 스캐폴드 — requestPay 파라미터·method 문자열·SDK URL(운영/샌드박스)은 샌드박스 E2E 로
//   확정(docs §6). 나이스페이 클라이언트 키가 'Server 승인 방식'으로 발급돼야 서버승인 결제창 동작.
import { getNicepayClientKey } from '@/lib/payments/nicepay-env';

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

/** 토스 결제수단 코드(CARD/TRANSFER) → 나이스페이 method 문자열. */
export function toNicepayMethod(tossMethod: string): string {
  switch (tossMethod) {
    case 'CARD':
      return 'card';
    case 'TRANSFER':
      return 'bank';
    default:
      return 'card';
  }
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
