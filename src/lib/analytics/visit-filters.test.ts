import assert from 'node:assert/strict';
import {
  clientIpFromHeaders,
  isBotUserAgent,
  isExcludedAnalyticsIp,
  shouldSkipVisitAnalytics,
} from './visit-filters';

declare const test: (name: string, fn: () => void) => void;

test('shouldSkipVisitAnalytics: /admin 경로는 제외', () => {
  assert.equal(
    shouldSkipVisitAnalytics({
      path: '/admin/analytics',
      host: 'ganjisaju.kr',
      siteUrl: 'https://ganjisaju.kr',
    }),
    'admin_path'
  );
});

test('shouldSkipVisitAnalytics: Vercel preview/development 배포는 제외', () => {
  assert.equal(
    shouldSkipVisitAnalytics({
      path: '/',
      host: 'ganjisaju.kr',
      siteUrl: 'https://ganjisaju.kr',
      deploymentEnv: 'preview',
    }),
    'non_production_deployment'
  );
});

test('shouldSkipVisitAnalytics: canonical 운영 host만 집계', () => {
  assert.equal(
    shouldSkipVisitAnalytics({
      path: '/',
      host: 'ganjisaju.kr',
      siteUrl: 'https://ganjisaju.kr',
      deploymentEnv: 'production',
    }),
    null
  );
  assert.equal(
    shouldSkipVisitAnalytics({
      path: '/',
      host: 'ganji-saju-git-feature.vercel.app',
      siteUrl: 'https://ganjisaju.kr',
      deploymentEnv: 'production',
    }),
    'non_canonical_host'
  );
  assert.equal(
    shouldSkipVisitAnalytics({
      path: '/',
      host: 'localhost:3000',
      siteUrl: 'https://ganjisaju.kr',
    }),
    'non_canonical_host'
  );
});

test('isExcludedAnalyticsIp: exact IPv4와 CIDR 제외 규칙 지원', () => {
  assert.equal(isExcludedAnalyticsIp('203.0.113.10', '203.0.113.10'), true);
  assert.equal(isExcludedAnalyticsIp('203.0.113.11', '203.0.113.10'), false);
  assert.equal(isExcludedAnalyticsIp('10.2.3.4', '192.168.0.0/16,10.0.0.0/8'), true);
  assert.equal(isExcludedAnalyticsIp('172.16.0.1', '192.168.0.0/16,10.0.0.0/8'), false);
  assert.equal(isExcludedAnalyticsIp('2001:db8::1', '2001:db8::1'), true);
});

test('clientIpFromHeaders: x-forwarded-for 첫 IP 우선', () => {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.10, 198.51.100.2',
    'x-real-ip': '198.51.100.3',
  });
  assert.equal(clientIpFromHeaders(headers), '203.0.113.10');
});

// 2026-07-10 — 봇 필터. site_visits 2,540행이 전부 서로 다른 vid 에 page_views=1 이었고,
//   진입 경로가 /zodiac·/star-sign·/dialogue 각 57, /help·/support/faq 각 56 으로 균일했다.
//   사이트맵을 훑는 크롤러다. 봇을 사람으로 세면 방문 지표가 통째로 무의미해진다.
//   UA 는 서버(/api/visit)만 알 수 있으므로 userAgent 는 선택 필드다(클라는 미전달).

test('isBotUserAgent: 검색엔진·SEO 크롤러', () => {
  for (const ua of [
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
    'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)',
    'Mozilla/5.0 (compatible; SemrushBot/7~bl)',
    'Mozilla/5.0 (compatible; YandexBot/3.0)',
    'Baiduspider/2.0',
    'Mozilla/5.0 (compatible; PetalBot;+https://webmaster.petalsearch.com/site/petalbot)',
  ]) {
    assert.equal(isBotUserAgent(ua), true, ua);
  }
});

test('isBotUserAgent: headless 브라우저·자동화 도구 (JS 를 실행해 비콘을 쏜다)', () => {
  for (const ua of [
    'Mozilla/5.0 (X11; Linux x86_64) HeadlessChrome/120.0.0.0',
    'Mozilla/5.0 Chrome-Lighthouse',
    'Mozilla/5.0 (Windows NT 10.0) Playwright/1.40',
    'node-fetch/1.0',
    'python-requests/2.31.0',
    'curl/8.4.0',
    'Go-http-client/2.0',
  ]) {
    assert.equal(isBotUserAgent(ua), true, ua);
  }
});

test('isBotUserAgent: 링크 미리보기 봇 (SNS 공유 시 자동 접속)', () => {
  assert.equal(isBotUserAgent('facebookexternalhit/1.1'), true);
  assert.equal(isBotUserAgent('Twitterbot/1.0'), true);
  assert.equal(isBotUserAgent('WhatsApp/2.19'), true);
});

test('isBotUserAgent: 진짜 사람 브라우저는 false', () => {
  for (const ua of [
    // iOS Safari
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    // Android Chrome
    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    // 인스타그램 인앱 브라우저 — 주요 사람 유입 경로다. 절대 봇으로 잡으면 안 된다.
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Instagram 302.0.0.23.113',
    // 카카오톡 인앱
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 KAKAOTALK 10.3.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ]) {
    assert.equal(isBotUserAgent(ua), false, ua);
  }
});

test('isBotUserAgent: UA 없음/빈 문자열은 봇 취급 (정상 브라우저는 항상 보낸다)', () => {
  assert.equal(isBotUserAgent(null), true);
  assert.equal(isBotUserAgent(undefined), true);
  assert.equal(isBotUserAgent('   '), true);
});

test('shouldSkipVisitAnalytics: 봇 UA 는 bot_user_agent 로 제외', () => {
  assert.equal(
    shouldSkipVisitAnalytics({ path: '/', userAgent: 'Googlebot/2.1' }),
    'bot_user_agent'
  );
});

test('shouldSkipVisitAnalytics: userAgent 미전달(클라이언트)이면 봇 검사를 건너뛴다', () => {
  assert.equal(shouldSkipVisitAnalytics({ path: '/' }), null, '클라는 UA 를 모른다');
});
