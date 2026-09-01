// 카카오 발송(Solapi) 설정 — 전부 환경변수. 미설정 시 발송은 no-op(로그만 'failed:not_configured').
// 키/템플릿코드가 준비되기 전에도 앱은 안전하게 동작한다.

export const kakaoConfig = {
  apiKey: process.env.SOLAPI_API_KEY ?? '',
  apiSecret: process.env.SOLAPI_API_SECRET ?? '',
  /** 발신프로필(연동된 카카오 채널) ID */
  pfId: process.env.SOLAPI_KAKAO_PFID ?? '',
  /** SMS 대체발송용 발신번호(사전 등록된 번호) */
  sender: process.env.SOLAPI_SENDER ?? '',
  /** 대행사 webhook 서명 검증 시크릿(설정 시에만 검증) */
  webhookSecret: process.env.SOLAPI_WEBHOOK_SECRET ?? '',
  /** 알림톡 승인 템플릿 코드(대행사 콘솔에서 심의 승인 후 발급) */
  templates: {
    paymentComplete: process.env.KAKAO_TPL_PAYMENT_COMPLETE ?? '',
    subscriptionExpiring: process.env.KAKAO_TPL_SUBSCRIPTION_EXPIRING ?? '',
  },
} as const;

/** 알림톡 발송에 필요한 최소 설정(키·시크릿·발신프로필)이 모두 있는지. */
export function isKakaoSendConfigured(): boolean {
  return Boolean(kakaoConfig.apiKey && kakaoConfig.apiSecret && kakaoConfig.pfId);
}

/**
 * 결제 완료 알림톡이 **실제로 나갈 수 있는** 상태인지.
 *
 * 🔴 2026-09-01 — 키만 보고 판단하면 안 된다. 발송 트리거가
 *   `if (kakaoConfig.templates.paymentComplete)` 라 템플릿 코드가 비면 호출조차 안 된다.
 *   실제로 프로덕션은 `kakao_message_log` 0행(실결제 35건인데도)이었는데 설정 화면은
 *   "알림톡으로 받을 수 있어요" 라고 약속하며 휴대폰 번호 34건을 수집하고 있었다.
 *   사용자에게 약속을 보일지는 **이 함수 하나로** 결정한다.
 *
 * ⚠️ 서버 컴포넌트에서 읽으므로 값은 **빌드/배포 시점**에 고정된다 — env 를 채우면
 *   재배포해야 반영된다(Vercel env 공통 함정).
 */
export function isKakaoAlimtalkLive(
  config: { templates: { paymentComplete: string } } = kakaoConfig
): boolean {
  return isKakaoSendConfigured() && Boolean(config.templates.paymentComplete);
}
