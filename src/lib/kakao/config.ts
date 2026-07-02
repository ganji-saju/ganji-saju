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
