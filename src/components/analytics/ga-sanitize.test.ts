import assert from 'node:assert/strict';
import { sanitizePath, sanitizeQuery } from './ga-sanitize';

declare const test: (name: string, fn: () => void) => void;

test('sanitizePath redacts 사주 결과 슬러그(생년월일·성별·키해시)', () => {
  assert.equal(sanitizePath('/saju/1988-3-12-9-female-key3xf9a2b'), '/saju/redacted');
  assert.equal(sanitizePath('/saju/1990-7-4-unknown_time-male-keyabcd12'), '/saju/redacted');
});

test('sanitizePath redacts 궁합 공유 슬러그(두 사람 생년월일)', () => {
  assert.equal(
    sanitizePath('/compatibility/share/couple--1988-3-12-9-female-keyaa11--1990-7-4-male-keybb22'),
    '/compatibility/share/redacted'
  );
});

test('sanitizePath redacts 오늘의운세 공유 슬러그', () => {
  assert.equal(
    sanitizePath('/today-fortune/share/1988-3-12-9-female-keycc33'),
    '/today-fortune/share/redacted'
  );
});

test('sanitizePath 콘텐츠 슬러그(꿈·별자리·띠)는 보존 — 민감정보 아님', () => {
  assert.equal(sanitizePath('/dream/snake'), '/dream/snake');
  assert.equal(sanitizePath('/zodiac/aries'), '/zodiac/aries');
  assert.equal(sanitizePath('/'), '/');
  assert.equal(sanitizePath('/saju/new'), '/saju/new'); // 입력 단계는 슬러그 아님
});

test('sanitizeQuery 이름·생일 파라미터(a·b·n·d·c) 제거', () => {
  assert.equal(sanitizeQuery('?a=지현&b=엄마&n=지현&d=2026-07-06&c=money'), '');
});

test('sanitizeQuery utm·유입 파라미터는 유지(어트리뷰션 보존)', () => {
  assert.equal(
    sanitizeQuery('?utm_source=naver&utm_medium=cpc&n=지현'),
    '?utm_source=naver&utm_medium=cpc'
  );
  assert.equal(sanitizeQuery('?gclid=abc&a=지현'), '?gclid=abc');
});

test('sanitizeQuery 빈 쿼리 처리', () => {
  assert.equal(sanitizeQuery(''), '');
  assert.equal(sanitizeQuery('?'), '');
});
