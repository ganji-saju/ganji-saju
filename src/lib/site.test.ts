// Phase 1 (2026-05-18): canonical 도메인 = https://ganjisaju.kr 반전 검증.
import assert from 'node:assert/strict';
import {
  CANONICAL_REDIRECT_STATUS,
  CANONICAL_SITE_URL,
  DEFAULT_DESCRIPTION,
  SITE_CONFIG,
  SITE_NAME,
  getCanonicalUrl,
  getSiteUrl,
  isCanonicalHost,
  isCanonicalRedirectExemptPath,
  shouldRedirectHost,
} from './site';

declare const test: (name: string, fn: () => void) => void;

test('SITE_CONFIG canonical = https://ganjisaju.kr / 간지사주 (apex 복귀)', () => {
  // 2026-05-18: Vercel 대시보드에서 ganjisaju.kr 을 primary 로 설정 + alias 모두 canonical
  // apex 로 변경 완료. PR #221 의 사용자 directive 원안 (canonical = apex) 복귀.
  assert.equal(SITE_CONFIG.canonicalHost, 'ganjisaju.kr');
  assert.equal(SITE_CONFIG.canonicalOrigin, 'https://ganjisaju.kr');
  assert.equal(SITE_CONFIG.serviceName, '간지사주');
  assert.equal(SITE_CONFIG.defaultLocale, 'ko-KR');
  assert.equal(SITE_CONFIG.timezone, 'Asia/Seoul');
  assert.equal(SITE_NAME, '간지사주');
  assert.equal(CANONICAL_SITE_URL, 'https://ganjisaju.kr');
  assert.equal(CANONICAL_REDIRECT_STATUS, 301);
});

test('DEFAULT_DESCRIPTION 에 간지사주 브랜드명 포함, 달빛인생 잔존 없음', () => {
  assert.ok(DEFAULT_DESCRIPTION.includes('간지사주'));
  assert.ok(!DEFAULT_DESCRIPTION.includes('달빛인생'));
});

test('getCanonicalUrl — 절대 경로 + canonical 도메인', () => {
  assert.equal(getCanonicalUrl('/today-fortune'), 'https://ganjisaju.kr/today-fortune');
  assert.equal(getCanonicalUrl('/'), 'https://ganjisaju.kr/');
});

test('getCanonicalUrl — 선두 / 없으면 자동 prefix', () => {
  assert.equal(getCanonicalUrl('today-fortune'), 'https://ganjisaju.kr/today-fortune');
});

test('getCanonicalUrl — query / hash 보존', () => {
  assert.equal(getCanonicalUrl('/saju/abc?q=1&n=2'), 'https://ganjisaju.kr/saju/abc?q=1&n=2');
  assert.equal(getCanonicalUrl('/saju/abc#section'), 'https://ganjisaju.kr/saju/abc#section');
});

test('isCanonicalHost — apex ganjisaju.kr 만 true', () => {
  assert.equal(isCanonicalHost('ganjisaju.kr'), true);
  assert.equal(isCanonicalHost('www.ganjisaju.kr'), false);
  assert.equal(isCanonicalHost('xn--s39at50bo6fmwa.kr'), false);
  assert.equal(isCanonicalHost('localhost'), false);
});

test('shouldRedirectHost — canonical (apex) / localhost 는 false', () => {
  assert.equal(shouldRedirectHost('ganjisaju.kr'), false);
  assert.equal(shouldRedirectHost('localhost'), false);
  assert.equal(shouldRedirectHost('127.0.0.1'), false);
});

// 2026-07-10 — Vercel Cron 은 프로덕션 배포의 *.vercel.app URL 로 호출되는데,
//   canonical redirect(301)가 그걸 ganjisaju.kr 로 튕겼다. 크론은 리다이렉트를 따라가지
//   않으므로 **모든 크론 핸들러가 한 번도 실행되지 않았다**(알림·결제대사·지표롤업·요약갱신).
//   API 경로는 SEO 정규화 대상이 아니므로 canonical redirect 에서 제외한다.
test('isCanonicalRedirectExemptPath — /api/* 는 canonical redirect 대상에서 제외', () => {
  assert.equal(isCanonicalRedirectExemptPath('/api/admin/metrics/rollup'), true);
  assert.equal(isCanonicalRedirectExemptPath('/api/admin/users/summary/refresh'), true);
  assert.equal(isCanonicalRedirectExemptPath('/api/payments/reconcile'), true);
  assert.equal(isCanonicalRedirectExemptPath('/api/notifications/dispatch'), true);
});

test('isCanonicalRedirectExemptPath — 페이지 경로는 계속 정규화한다', () => {
  assert.equal(isCanonicalRedirectExemptPath('/'), false);
  assert.equal(isCanonicalRedirectExemptPath('/today-fortune'), false);
  assert.equal(isCanonicalRedirectExemptPath('/saju/new'), false);
});

test('isCanonicalRedirectExemptPath — /api 를 접두사로 가진 페이지는 제외하지 않는다', () => {
  assert.equal(isCanonicalRedirectExemptPath('/apidocs'), false, '세그먼트 경계로만 매칭');
  assert.equal(isCanonicalRedirectExemptPath('/api'), false, '/api 단독은 라우트가 아니다');
});

test('shouldRedirectHost — www.ganjisaju.kr 는 true (www → apex 통일)', () => {
  // Vercel 대시보드 자체에서도 동일하게 apex 처리 — 본 entry 는 defense-in-depth.
  assert.equal(shouldRedirectHost('www.ganjisaju.kr'), true);
});

test('shouldRedirectHost — 한글 punycode (간지사주.kr) 는 true', () => {
  assert.equal(shouldRedirectHost('간지사주.kr'), true);
  assert.equal(shouldRedirectHost('www.간지사주.kr'), true);
  assert.equal(shouldRedirectHost('xn--s39at50bo6fmwa.kr'), true);
  assert.equal(shouldRedirectHost('www.xn--s39at50bo6fmwa.kr'), true);
});

test('shouldRedirectHost — Vercel 자동 도메인 (*.vercel.app) 는 true', () => {
  assert.equal(shouldRedirectHost('ganji-saju.vercel.app'), true);
  assert.equal(shouldRedirectHost('ganji-saju-ganji-sajus-projects.vercel.app'), true);
  assert.equal(shouldRedirectHost('foo.vercel.app'), true);
});

test('shouldRedirectHost — 그 외 호스트 는 false (기본 안전)', () => {
  // Vercel 자동/legacy 가 아닌 임의 호스트는 redirect 대상 아님 (안전 기본값).
  assert.equal(shouldRedirectHost('example.com'), false);
});

test('getSiteUrl — env 미설정 시 fallback = canonical', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  delete process.env.VERCEL_URL;
  try {
    assert.equal(getSiteUrl(), 'https://ganjisaju.kr');
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_SITE_URL = previous;
  }
});

test('getSiteUrl — env = legacy 도메인이면 거부 후 fallback', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://xn--s39at50bo6fmwa.kr';
  try {
    // legacy → normalizeSiteUrl 이 null 반환 → fallback canonical
    assert.equal(getSiteUrl(), 'https://ganjisaju.kr');
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_SITE_URL = previous;
    else delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});

test('getSiteUrl — env = canonical (apex ganjisaju.kr) 그대로 사용', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://ganjisaju.kr';
  try {
    assert.equal(getSiteUrl(), 'https://ganjisaju.kr');
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_SITE_URL = previous;
    else delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});

test('getSiteUrl — env = www.ganjisaju.kr 는 LEGACY 거부 후 fallback', () => {
  // www 가 LEGACY 가 되었으므로 env 로 입력해도 normalizeSiteUrl 이 null 반환.
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.ganjisaju.kr';
  try {
    assert.equal(getSiteUrl(), 'https://ganjisaju.kr');
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_SITE_URL = previous;
    else delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});

test('getSiteUrl — env = Vercel 자동 도메인이면 거부 후 fallback', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://ganji-saju.vercel.app';
  try {
    assert.equal(getSiteUrl(), 'https://ganjisaju.kr');
  } finally {
    if (previous !== undefined) process.env.NEXT_PUBLIC_SITE_URL = previous;
    else delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});
