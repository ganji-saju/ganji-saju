import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

declare const test: (name: string, fn: () => void) => void;

// 2026-07-19 — CSP 허용목록 회귀 가드.
//
// 배경: CSP 인벤토리가 2026-06-21 토스 시절에 작성된 뒤 갱신되지 않았다. 그동안 PG 가
//   나이스페이로 바뀌고, 카카오 공유 SDK·구글 광고 전환이 붙었다. report-only 라 아무도
//   못 느꼈지만 **CSP_MODE=enforce 로 켜는 순간 결제가 통째로 죽는 상태**였다
//   (form-action·script-src 에 pay.nicepay.co.kr 이 없어 결제창 제출과 SDK 로드가 차단).
//
// 그래서 "프로덕션에서 실제로 관측된 위반 출처"를 테스트로 고정한다.
// 여기 걸리면 enforce 승격 시 그 기능이 죽는다는 뜻이다.
const CONFIG = fs.readFileSync(path.join(process.cwd(), 'next.config.ts'), 'utf8');

function directive(name: string): string {
  const match = CONFIG.match(new RegExp(`"${name} ([^"]*)"`));
  assert.ok(match, `CSP 에 ${name} 지시어가 있어야 함`);
  return match[1];
}

test('CSP: 결제(PG) 출처가 form-action·script-src·frame-src 에 모두 있다', () => {
  // 셋 중 하나만 빠져도 결제가 깨진다 — form-action 은 결제창 제출, script-src 는 SDK 로드.
  for (const name of ['form-action', 'script-src', 'frame-src']) {
    assert.ok(
      directive(name).includes('nicepay.co.kr'),
      `${name} 에 nicepay 가 없다 — enforce 승격 시 결제 불가`
    );
  }
});

test('CSP: 카카오 공유 SDK 출처 허용', () => {
  assert.ok(
    directive('script-src').includes('t1.kakaocdn.net'),
    'script-src 에 t1.kakaocdn.net 이 없다 — 카카오 공유 버튼이 죽는다'
  );
});

test('CSP: GA4 비콘 apex 도메인을 와일드카드에 맡기지 않는다', () => {
  // ⚠️ CSP 와일드카드는 서브도메인 한 단계용이라 `*.analytics.google.com` 은
  //   apex `analytics.google.com` 을 매치하지 않는다. 실제로 이 한 줄 때문에
  //   프로덕션에서 위반 76건이 쌓였다.
  const connect = directive('connect-src');
  assert.ok(
    connect.includes('https://analytics.google.com'),
    'connect-src 에 analytics.google.com(apex)이 명시돼야 한다'
  );
});

test('CSP: 관측된 광고 전환 출처 허용', () => {
  const connect = directive('connect-src');
  for (const host of ['stats.g.doubleclick.net', 'www.google.com', 'www.google.co.kr']) {
    assert.ok(connect.includes(host), `connect-src 에 ${host} 가 없다`);
  }
});

test('CSP: report-uri 는 유지된다(enforce 승격 전 관찰 경로)', () => {
  assert.ok(CONFIG.includes('report-uri /api/csp-report'), 'report-uri 가 사라지면 관찰이 끊긴다');
});

// 2026-08-27 — 광고 전환 픽셀 4채널(Meta·카카오·네이버·Google Ads).
//   GTM 컨테이너가 태그로 주입하므로 코드에는 스크립트가 없다. 그래서 **CSP 에서 조용히 빠지기
//   쉽다** — 지금은 Report-Only 라 통과하지만 CSP_MODE=enforce 로 켜는 순간 전환 추적이
//   통째로 죽고, 죽어도 화면은 멀쩡해 아무도 못 느낀다(위 결제 사고와 같은 구조).
test('CSP: 광고 전환 픽셀 4채널 출처가 script-src 에 있다', () => {
  const scriptSrc = directive('script-src');
  for (const [channel, origin] of [
    ['Meta 픽셀', 'https://connect.facebook.net'],
    ['카카오 픽셀', 'https://t1.daumcdn.net'],
    ['네이버 공통측정', 'https://wcs.naver.net'],
    ['Google Ads 전환', 'https://www.googleadservices.com'],
  ] as const) {
    assert.ok(scriptSrc.includes(origin), `${channel}(${origin}) 이 script-src 에 없다`);
  }
});

test('CSP: 픽셀 비콘 수신 출처가 connect-src 에 있다', () => {
  const connectSrc = directive('connect-src');
  for (const [channel, origin] of [
    ['Meta', 'https://www.facebook.com'],
    ['카카오', 'https://analytics.kakao.com'],
    ['네이버', 'https://wcs.naver.com'],
    ['Google Ads', 'https://googleads.g.doubleclick.net'],
  ] as const) {
    assert.ok(connectSrc.includes(origin), `${channel}(${origin}) 이 connect-src 에 없다`);
  }
});

test('CSP: 전환 확인 iframe(Meta·Google Ads) 출처가 frame-src 에 있다', () => {
  const frameSrc = directive('frame-src');
  assert.ok(frameSrc.includes('https://www.facebook.com'));
  assert.ok(frameSrc.includes('https://td.doubleclick.net'));
});
