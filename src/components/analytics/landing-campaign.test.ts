// 2026-08-26 회귀 가드 — 랜딩 캠페인 보관.
//   실제 증상: UTM 링크로 들어왔는데 GA4 가 (direct) 로 찍었다. 동의 기본이 denied 라
//   첫 page_view 가 저장소 없이 나가고, '동의' 를 누른 뒤 세션이 시작될 땐 캠페인이 없었다.
import assert from 'node:assert/strict';
import { extractCampaignQuery } from './landing-campaign';

declare const test: (name: string, fn: () => void) => void;

test('캠페인 추출: utm 5종 + 광고 클릭 ID 를 남긴다', () => {
  const q = extractCampaignQuery(
    '?utm_source=test&utm_medium=video&utm_campaign=track_check&utm_content=clip07&utm_term=saju'
  );
  const p = new URLSearchParams(q);
  assert.equal(p.get('utm_source'), 'test');
  assert.equal(p.get('utm_medium'), 'video');
  assert.equal(p.get('utm_campaign'), 'track_check');
  assert.equal(p.get('utm_content'), 'clip07');
  assert.equal(p.get('utm_term'), 'saju');
});

test('캠페인 추출: gclid·fbclid 도 캠페인 신호다', () => {
  assert.ok(extractCampaignQuery('?gclid=abc123').includes('gclid=abc123'));
  assert.ok(extractCampaignQuery('?fbclid=xyz').includes('fbclid=xyz'));
  assert.ok(extractCampaignQuery('?gbraid=g1').includes('gbraid=g1'));
});

test('캠페인 추출: 민감 파라미터는 절대 딸려오지 않는다', () => {
  // 이 앱의 공유 URL 은 쿼리에 이름(n)·생년월일(d)을 담는다. 캠페인 보관에 섞이면
  // sessionStorage 를 거쳐 GA 로 새어 나간다.
  const q = extractCampaignQuery('?utm_source=test&n=%ED%99%8D%EA%B8%B8%EB%8F%99&d=1988-3-12&a=1');
  assert.equal(q, '?utm_source=test');
  assert.ok(!q.includes('n='));
  assert.ok(!q.includes('d='));
});

test('캠페인 추출: 캠페인이 없으면 빈 문자열 — 빈 ? 를 만들지 않는다', () => {
  assert.equal(extractCampaignQuery(''), '');
  assert.equal(extractCampaignQuery('?'), '');
  assert.equal(extractCampaignQuery('?concern=general'), '');
});

test('캠페인 추출: 값이 빈 파라미터는 무시 — utm_source= 만 있는 링크가 소스를 덮지 않게', () => {
  assert.equal(extractCampaignQuery('?utm_source=&utm_medium=video'), '?utm_medium=video');
});
