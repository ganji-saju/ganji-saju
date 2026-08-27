import assert from 'node:assert/strict';
import {
  INTERNAL_TRAFFIC_TYPE,
  isProductionAnalyticsServer,
  trafficTypeParams,
} from './ga-environment';

declare const test: (name: string, fn: () => void) => void;

function withVercelEnv<T>(value: string | undefined, fn: () => T): T {
  const prev = process.env.VERCEL_ENV;
  if (value === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = value;
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prev;
  }
}

// 🔴 2026-08-27 — 스테이징 테스트 결제가 프로덕션 GA4 매출에 섞여 들어갔다.
//   측정 ID 가 하드코딩이고 서버 전송 env 도 Preview 에 있는데 **환경 게이트가 없었다.**
//   가짜 매출은 되돌릴 수 없다(GA4 는 과거 데이터를 지울 수단이 사실상 없다).
test('GA4 환경 게이트: 프로덕션 배포에서만 참', () => {
  assert.equal(withVercelEnv('production', isProductionAnalyticsServer), true);
  assert.equal(withVercelEnv('preview', isProductionAnalyticsServer), false);
  assert.equal(withVercelEnv('development', isProductionAnalyticsServer), false);
});

// 미설정(로컬)은 프로덕션이 아니다 — 기본값이 '보낸다' 면 사고가 조용히 반복된다.
test('GA4 환경 게이트: VERCEL_ENV 미설정이면 프로덕션이 아니다', () => {
  assert.equal(withVercelEnv(undefined, isProductionAnalyticsServer), false);
});

// 화면 이벤트는 막지 않고 표식만 붙인다 — GTM 미리보기로 퍼널을 검증할 수 있어야 한다.
test('GA4 환경 게이트: 비프로덕션 이벤트에는 traffic_type=internal 이 붙는다', () => {
  assert.deepEqual(withVercelEnv('preview', trafficTypeParams), {
    traffic_type: INTERNAL_TRAFFIC_TYPE,
  });
  assert.deepEqual(withVercelEnv('production', trafficTypeParams), {});
});
