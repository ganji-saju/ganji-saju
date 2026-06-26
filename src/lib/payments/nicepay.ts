// 2026-06-26 — 나이스페이(NICEPAY V2) 결제 어댑터 스캐폴드. toss.ts 와 동일 책임:
//   서버승인(승인/취소/조회) + 서명 검증/생성. 인가 = Basic base64(clientKey:secretKey),
//   서명 = SHA256 hex (토스의 HMAC-base64 와 다름). 참고: docs/payment-nicepay-migration.md
//
// ⚠️ 스캐폴드 — 게재(연동) 전 공식 문서/콘솔로 반드시 확정할 것(docs §6):
//   1) 승인/취소 정확한 호스트(운영 api.nicepay.co.kr / 샌드박스 sandbox-api.*) + 전 엔드포인트 prefix
//   2) Authorization 형식(Basic base64 인코딩: clientKey:secretKey 순서)
//   3) 서명 바이트 규칙: 인증응답 sha256(authToken+clientId+amount+secretKey),
//      승인 signData sha256(tid+amount+ediDate+secretKey)
//   4) ediDate 정확한 포맷(ISO 8601 vs yyyyMMddHHmmss) — 공식 파라미터표
//   5) 결과/상태 코드표(0000=정상만 확정)
import { createHash, timingSafeEqual } from 'node:crypto';

const DEFAULT_API_BASE = 'https://api.nicepay.co.kr';

/** 운영/샌드박스 전환: NICEPAY_API_BASE 미설정 시 운영. 샌드박스는 https://sandbox-api.nicepay.co.kr. */
function getApiBase(): string {
  return process.env.NICEPAY_API_BASE?.replace(/\/$/, '') ?? DEFAULT_API_BASE;
}

function getClientKey(): string {
  // 결제창용 clientKey 는 공개(NEXT_PUBLIC_)지만 서버 Basic 인가에도 필요.
  const key = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_NICEPAY_CLIENT_KEY 가 설정되어 있지 않습니다.');
  return key;
}

function getSecretKey(): string {
  const key = process.env.NICEPAY_SECRET_KEY;
  if (!key) throw new Error('NICEPAY_SECRET_KEY 가 설정되어 있지 않습니다.');
  return key;
}

/** 인가 헤더 — Basic base64(clientKey:secretKey). */
function getNicepayAuthorizationHeader(): string {
  return `Basic ${Buffer.from(`${getClientKey()}:${getSecretKey()}`).toString('base64')}`;
}

/** SHA256 hex 서명 유틸(테스트 가능하도록 secretKey 주입형 코어 + env 래퍼 분리). */
export function nicepaySha256Hex(raw: string): string {
  return createHash('sha256').update(raw, 'utf8').digest('hex');
}

/**
 * 인증응답 위변조 검증(서버승인 1차 방어선). returnUrl 콜백의 signature 와 재계산값 비교.
 * signature = hex(sha256(authToken + clientId + amount + secretKey)). timing-safe 비교.
 */
export function verifyNicepayAuthSignature(input: {
  authToken: string;
  clientId?: string;
  amount: number | string;
  signature: string;
}): boolean {
  const clientId = input.clientId ?? getClientKey();
  const expected = nicepaySha256Hex(`${input.authToken}${clientId}${input.amount}${getSecretKey()}`);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(input.signature ?? '', 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 승인 요청 signData = hex(sha256(tid + amount + ediDate + secretKey)). */
function buildApproveSignData(tid: string, amount: number, ediDate: string): string {
  return nicepaySha256Hex(`${tid}${amount}${ediDate}${getSecretKey()}`);
}

// ⚠️ ediDate 포맷은 공식 확정 필요. 일단 ISO 8601.
function buildEdiDate(now: Date = new Date()): string {
  return now.toISOString();
}

/** 나이스페이 결제 객체(응답). 스캐폴드 — 정확한 필드는 공식 응답표로 좁힐 것. */
export interface NicepayPaymentObject {
  resultCode?: string;
  resultMsg?: string;
  tid?: string;
  orderId?: string;
  amount?: number;
  status?: string;
  [key: string]: unknown;
}

async function parseNicepayResponse(
  response: Response,
  fallbackMessage: string
): Promise<NicepayPaymentObject> {
  const body = (await response.json().catch(() => ({}))) as NicepayPaymentObject;

  // HTTP 비정상 또는 resultCode 가 정상(0000)이 아니면 실패.
  if (!response.ok || (body.resultCode && body.resultCode !== '0000')) {
    // 진단 로그(임시) — 나이스페이 실제 거부 사유. secret 미노출.
    console.error('[nicepay] API 응답 실패', {
      httpStatus: response.status,
      resultCode: body.resultCode ?? '(none)',
      resultMsg: body.resultMsg ?? '(none)',
      keys: Object.keys(body),
    });
    const message =
      typeof body.resultMsg === 'string' && body.resultMsg ? body.resultMsg : fallbackMessage;
    throw new Error(message);
  }

  return body;
}

/**
 * 서버승인 — 인증 성공(authResultCode 0000) 후 받은 tid 로 결제 확정.
 * POST {API_BASE}/v1/payments/{tid}. 호출 전 verifyNicepayAuthSignature + 주문 금액 검증을 거칠 것.
 */
export async function approveNicepayPayment(
  tid: string,
  amount: number
): Promise<NicepayPaymentObject> {
  const ediDate = buildEdiDate();
  const signData = buildApproveSignData(tid, amount, ediDate);

  // 진단 로그(임시) — 승인 요청 파라미터. signData/secret 미노출.
  console.log('[nicepay] approve 요청', {
    url: `${getApiBase()}/v1/payments/${encodeURIComponent(tid)}`,
    tid,
    amount,
    ediDate,
  });

  const response = await fetch(`${getApiBase()}/v1/payments/${encodeURIComponent(tid)}`, {
    method: 'POST',
    headers: {
      Authorization: getNicepayAuthorizationHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ amount, ediDate, signData }),
  });

  return parseNicepayResponse(response, '결제 승인 실패');
}

/** 결제 조회 — GET {API_BASE}/v1/payments/{tid}. */
export async function getNicepayPayment(tid: string): Promise<NicepayPaymentObject> {
  const response = await fetch(`${getApiBase()}/v1/payments/${encodeURIComponent(tid)}`, {
    method: 'GET',
    headers: { Authorization: getNicepayAuthorizationHeader() },
  });

  return parseNicepayResponse(response, '결제 조회 실패');
}

/**
 * 결제 취소/부분취소 — POST {API_BASE}/v1/payments/{tid}/cancel.
 * cancelAmt 생략 시 전체취소. reason 필수(≤100). Idempotency 로 이중취소 방지(toss 패턴 동일).
 */
export async function cancelNicepayPayment(
  tid: string,
  options: {
    reason: string;
    orderId?: string;
    cancelAmt?: number;
    idempotencyKey?: string;
  }
): Promise<NicepayPaymentObject> {
  const ediDate = buildEdiDate();
  // ⚠️ 취소 signData 규칙도 공식 확정 필요(승인과 동일 가정 — tid+amount+ediDate+secretKey).
  const amountForSign = options.cancelAmt ?? 0;
  const signData = buildApproveSignData(tid, amountForSign, ediDate);

  const headers: Record<string, string> = {
    Authorization: getNicepayAuthorizationHeader(),
    'Content-Type': 'application/json',
  };
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const response = await fetch(`${getApiBase()}/v1/payments/${encodeURIComponent(tid)}/cancel`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      reason: options.reason,
      ediDate,
      signData,
      ...(options.orderId ? { orderId: options.orderId } : {}),
      ...(typeof options.cancelAmt === 'number' && options.cancelAmt > 0
        ? { cancelAmt: options.cancelAmt }
        : {}),
    }),
  });

  return parseNicepayResponse(response, '결제 취소 실패');
}
