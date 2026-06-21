// 2026-06-21 보안 — Toss 웹훅 HMAC-SHA256 서명 검증(정식).
//
// Toss 공식 스킴(docs.tosspayments.com/reference/using-api/webhook-events):
//   - 헤더 `tosspayments-webhook-signature` = "v1:{base64sig1},{base64sig2}"
//   - 헤더 `tosspayments-webhook-transmission-time` = 발송 시각
//   - 서명 대상 문자열 = `{원본 요청 body}:{transmission-time}`
//   - 보안 키(Toss 대시보드의 별도 웹훅 보안 키, API 시크릿과 다름)로 HMAC-SHA256 → base64
//   - v1: 뒤 2개 서명 중 "하나라도" 일치하면 정상(키 회전 대비 2개 제공).
//
// ⚠️ 적용 범위: Toss 는 지급대행 등 일부 웹훅 타입에만 서명을 붙인다. 일반 결제 상태
// 웹훅(PAYMENT_STATUS_CHANGED)에는 서명 헤더가 없을 수 있으므로, 라우트에서는 "헤더가
// 있을 때만" 이 검증을 강제하고, 없으면 기존 Toss API 재조회(getPayment)로 진위를
// 보장한다(무결성 backstop). 따라서 정상 웹훅을 절대 거절하지 않는다.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface TossWebhookSignatureInput {
  /** 원본 요청 body(raw text — JSON.parse 전). HMAC 은 정확한 바이트열에 대해 계산해야 한다. */
  rawBody: string;
  /** `tosspayments-webhook-signature` 헤더 값. */
  signatureHeader: string | null | undefined;
  /** `tosspayments-webhook-transmission-time` 헤더 값. */
  transmissionTime: string | null | undefined;
  /** Toss 대시보드 웹훅 보안 키. */
  securityKey: string | null | undefined;
}

/** "v1:a,b" → ["a","b"]. v1: 접두 없으면 전체를 콤마 분리. */
function parseSignatureHeader(header: string): string[] {
  const body = header.startsWith('v1:') ? header.slice(3) : header;
  return body
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** base64 두 값을 길이 검사 후 상수시간 비교(타이밍 공격 방지). */
function safeEqualBase64(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'base64');
    const bufB = Buffer.from(b, 'base64');
    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Toss 웹훅 서명을 검증한다. 입력 중 하나라도 비면 false(검증 불가 = 통과 아님).
 * 라우트는 이 함수가 false 이고 서명 헤더가 "존재"했을 때만 401 로 거절한다.
 */
export function verifyTossWebhookSignature(input: TossWebhookSignatureInput): boolean {
  const { rawBody, signatureHeader, transmissionTime, securityKey } = input;
  if (!signatureHeader || !transmissionTime || !securityKey) return false;

  const expected = createHmac('sha256', securityKey)
    .update(`${rawBody}:${transmissionTime}`)
    .digest('base64');

  return parseSignatureHeader(signatureHeader).some((sig) => safeEqualBase64(sig, expected));
}
