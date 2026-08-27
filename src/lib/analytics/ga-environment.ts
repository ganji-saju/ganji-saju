// 2026-08-27 — 🔴 스테이징·프리뷰가 **프로덕션 GA4 속성으로 전송**하고 있었다.
//
//   측정 ID(G-F6BP90L8E2)는 layout.tsx 에 하드코딩이고 서버 전송 env(GA4_MEASUREMENT_ID·
//   GA4_API_SECRET)도 Preview 에 그대로 있다. 환경 게이트가 **어디에도 없었다.**
//   그 결과 스테이징 테스트 결제가 프로덕션 매출 리포트에 섞여 들어갔다
//   (2026-08-27 실측: 990원 여러 건 · 궁합 3,300 · 번들 9,900 이 테스트로 유입).
//
//   대응을 두 갈래로 나눈다 — 테스트 가능성과 데이터 무결성 중 하나를 버리지 않기 위해서다.
//     · **매출(서버 Measurement Protocol)** → 비프로덕션에서 **전송 자체를 막는다.**
//       가짜 매출은 되돌릴 수 없다. GA4 는 과거 데이터를 지울 수단이 사실상 없다.
//     · **화면 이벤트(클라이언트 dataLayer/gtag)** → 계속 보내되 `traffic_type: 'internal'`
//       을 붙인다. GTM 미리보기·Tag Assistant 로 스테이징에서 퍼널을 검증할 수 있어야 하고,
//       GA4 쪽은 데이터 필터로 internal 을 제외하면 리포트가 깨끗해진다.
//
//   ⚠️ GA4 관리 → 데이터 스트림 → 내부 트래픽 정의에 `traffic_type = internal` 필터를
//      **활성** 해야 제외가 실제로 적용된다. 코드만으론 태깅까지다.

/** 프로덕션 배포인가(서버). Vercel 이 주입하는 VERCEL_ENV 가 정본. */
export function isProductionAnalyticsServer(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

/**
 * 프로덕션 화면인가(브라우저).
 *   env 대신 **호스트**로 판정한다 — NEXT_PUBLIC_VERCEL_ENV 는 빌드 시점에 구워져
 *   프리뷰를 프로덕션 도메인에 붙이는 등의 경우에 어긋날 수 있다. 지금 보고 있는 주소가 진실이다.
 */
export function isProductionAnalyticsHost(): boolean {
  if (typeof window === 'undefined') return isProductionAnalyticsServer();
  const host = window.location.hostname;
  return host === 'ganjisaju.kr' || host === 'www.ganjisaju.kr';
}

/** 비프로덕션 이벤트에 붙는 표식. GA4 데이터 필터가 이 값을 보고 제외한다. */
export const INTERNAL_TRAFFIC_TYPE = 'internal';

/** 이벤트 파라미터에 섞어 넣을 표식(프로덕션이면 빈 객체). */
export function trafficTypeParams(): Record<string, string> {
  return isProductionAnalyticsHost() ? {} : { traffic_type: INTERNAL_TRAFFIC_TYPE };
}
