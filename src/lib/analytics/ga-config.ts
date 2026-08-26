// 2026-08-26 — GA4 서버 전송 설정. 값이 없으면 **조용히 no-op** 이어야 한다:
//   계측이 안 붙었다고 결제가 막히면 안 된다(결제 > 계측).
//
//   ⚠️ GA4_API_SECRET 은 서버 전용이다. NEXT_PUBLIC_ 접두어를 붙이면 브라우저 번들에 실려
//   제3자가 임의 이벤트를 주입해 매출 데이터를 오염시킬 수 있다.
//   ⚠️ 값 끝의 공백·개행 트랩: 이 프로젝트에서 나이스페이 clientKey 끝 탭 하나로 결제가
//   통째로 죽은 적이 있다(#U116). 읽는 쪽에서 항상 trim 한다.

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export const GA4_MEASUREMENT_ID: string | null =
  readEnv('GA4_MEASUREMENT_ID') ?? readEnv('NEXT_PUBLIC_GA_MEASUREMENT_ID');
export const GA4_API_SECRET: string | null = readEnv('GA4_API_SECRET');

/** 서버 전송(Measurement Protocol)이 가능한 상태인가. */
export const hasGa4ServerEnv: boolean = Boolean(GA4_MEASUREMENT_ID && GA4_API_SECRET);
