import assert from 'node:assert/strict';
import {
  clientIpFromHeaders,
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
