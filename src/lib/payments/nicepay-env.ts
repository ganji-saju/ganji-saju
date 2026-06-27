// 2026-06-27 — 나이스페이 sandbox/live 단일 토글. 서버(nicepay.ts)·클라이언트(nicepay-checkout)
//   공유 헬퍼. 전환은 **NEXT_PUBLIC_NICEPAY_MODE=sandbox|live 하나**만 바꾸면 API_BASE·clientKey 자동 선택.
//   ⚠️ secretKey 는 여기 두지 않는다 — NEXT_PUBLIC_ 가 아니므로 클라이언트 번들에 노출되면 안 됨.
//      secretKey 의 MODE 분기는 서버 전용 nicepay.ts(getSecretKey)에서 처리.
//   하위호환: MODE 별 키가 없으면 기존 단일 키(NICEPAY_API_BASE / NEXT_PUBLIC_NICEPAY_CLIENT_KEY) 폴백.

export type NicepayMode = 'sandbox' | 'live';

/** NEXT_PUBLIC 이라 서버·클라이언트 모두에서 동일하게 읽힌다. 미설정/오타 시 live(안전 기본). */
export function getNicepayMode(): NicepayMode {
  return process.env.NEXT_PUBLIC_NICEPAY_MODE === 'sandbox' ? 'sandbox' : 'live';
}

/** 승인/취소/조회 호스트. 명시적 NICEPAY_API_BASE 가 있으면 우선(하위호환), 없으면 MODE 로 결정. */
export function getNicepayApiBase(): string {
  const explicit = process.env.NICEPAY_API_BASE?.replace(/\/$/, '');
  if (explicit) return explicit;
  return getNicepayMode() === 'sandbox'
    ? 'https://sandbox-api.nicepay.co.kr'
    : 'https://api.nicepay.co.kr';
}

/** 결제창·서버 Basic 인가 공용 clientKey. MODE 별 키 → 없으면 기존 단일 키 폴백.
 *  ⚠️ env 복사 시 trailing 탭/공백/개행이 딸려오면 Basic 인증 U116 → 반드시 trim. */
export function getNicepayClientKey(): string {
  const modeKey =
    getNicepayMode() === 'sandbox'
      ? process.env.NEXT_PUBLIC_NICEPAY_SANDBOX_CLIENT_KEY
      : process.env.NEXT_PUBLIC_NICEPAY_LIVE_CLIENT_KEY;
  const key = (modeKey ?? process.env.NEXT_PUBLIC_NICEPAY_CLIENT_KEY)?.trim();
  if (!key) {
    throw new Error(
      '나이스페이 clientKey 가 없습니다. NEXT_PUBLIC_NICEPAY_MODE 에 맞는 키' +
        '(NEXT_PUBLIC_NICEPAY_SANDBOX/LIVE_CLIENT_KEY) 또는 NEXT_PUBLIC_NICEPAY_CLIENT_KEY 를 설정하세요.'
    );
  }
  return key;
}
