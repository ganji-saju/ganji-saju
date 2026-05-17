// Phase 1 (2026-05-18): canonical 도메인 = https://ganjisaju.kr 반전 검증.
import assert from 'node:assert/strict';
import {
  CANONICAL_SITE_URL,
  DEFAULT_DESCRIPTION,
  SITE_CONFIG,
  SITE_NAME,
  getCanonicalUrl,
  getSiteUrl,
  isCanonicalHost,
  shouldRedirectHost,
} from './site';

declare const test: (name: string, fn: () => void) => void;

test('SITE_CONFIG canonical = https://ganjisaju.kr / 간지사주', () => {
  assert.equal(SITE_CONFIG.canonicalHost, 'ganjisaju.kr');
  assert.equal(SITE_CONFIG.canonicalOrigin, 'https://ganjisaju.kr');
  assert.equal(SITE_CONFIG.serviceName, '간지사주');
  assert.equal(SITE_CONFIG.defaultLocale, 'ko-KR');
  assert.equal(SITE_CONFIG.timezone, 'Asia/Seoul');
  assert.equal(SITE_NAME, '간지사주');
  assert.equal(CANONICAL_SITE_URL, 'https://ganjisaju.kr');
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

test('isCanonicalHost — ganjisaju.kr 만 true', () => {
  assert.equal(isCanonicalHost('ganjisaju.kr'), true);
  assert.equal(isCanonicalHost('www.ganjisaju.kr'), false);
  assert.equal(isCanonicalHost('xn--s39at50bo6fmwa.kr'), false);
  assert.equal(isCanonicalHost('localhost'), false);
});

test('shouldRedirectHost — canonical / localhost 는 false', () => {
  assert.equal(shouldRedirectHost('ganjisaju.kr'), false);
  assert.equal(shouldRedirectHost('localhost'), false);
  assert.equal(shouldRedirectHost('127.0.0.1'), false);
});

test('shouldRedirectHost — www.ganjisaju.kr 는 true (non-www 통일)', () => {
  assert.equal(shouldRedirectHost('www.ganjisaju.kr'), true);
});

test('shouldRedirectHost — 한글 punycode (간지사주.kr) 는 true', () => {
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

test('getSiteUrl — env = canonical 도메인 그대로 사용', () => {
  const previous = process.env.NEXT_PUBLIC_SITE_URL;
  process.env.NEXT_PUBLIC_SITE_URL = 'https://ganjisaju.kr';
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
