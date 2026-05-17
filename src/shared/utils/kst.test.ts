// Phase 2 (2026-05-18): KST 유틸 통합 + 자정 경계 케이스.
import assert from 'node:assert/strict';
import {
  KST_LOCALE,
  KST_TIMEZONE,
  formatKoreanDate,
  getDailyVersion,
  getKstDateKey,
  getKstNow,
  getKstParts,
  getKstStartOfDay,
} from './kst';

declare const test: (name: string, fn: () => void) => void;

test('KST_TIMEZONE = Asia/Seoul / KST_LOCALE = ko-KR', () => {
  assert.equal(KST_TIMEZONE, 'Asia/Seoul');
  assert.equal(KST_LOCALE, 'ko-KR');
});

test('getKstNow — Date 객체 반환', () => {
  const now = getKstNow();
  assert.ok(now instanceof Date);
  assert.ok(!Number.isNaN(now.getTime()));
});

test('getKstDateKey — UTC 자정 = KST 09:00 → 같은 날', () => {
  // UTC 2026-05-18T00:00 = KST 2026-05-18T09:00
  const utc = new Date('2026-05-18T00:00:00Z');
  assert.equal(getKstDateKey(utc), '2026-05-18');
});

test('getKstDateKey — UTC 14:59 = KST 23:59 → 같은 날 (KST drift 경계 직전)', () => {
  const utc = new Date('2026-05-17T14:59:59Z');
  assert.equal(getKstDateKey(utc), '2026-05-17');
});

test('getKstDateKey — UTC 15:00 = KST 다음날 00:00 (KST drift 경계 직후)', () => {
  const utc = new Date('2026-05-17T15:00:00Z');
  assert.equal(getKstDateKey(utc), '2026-05-18');
});

test('getKstDateKey — UTC 20:00 = KST 다음날 05:00 (drift window 안)', () => {
  // 본 시간대에서 raw new Date().getDate() 는 UTC 의 17 을 반환 (잘못)
  // getKstDateKey 는 KST 의 18 을 반환 (정답)
  const utc = new Date('2026-05-17T20:00:00Z');
  assert.equal(getKstDateKey(utc), '2026-05-18');
});

test('getKstDateKey — 연도 경계 (UTC 12-31T15:00 = KST 01-01T00:00)', () => {
  const utc = new Date('2026-12-31T15:00:00Z');
  assert.equal(getKstDateKey(utc), '2027-01-01');
});

test('getKstParts — UTC 자정 = KST 09:00 (월요일)', () => {
  // 2026-05-18 KST 09:00 → year=2026, month=5, day=18, hour=9, weekday=1(월)
  const utc = new Date('2026-05-18T00:00:00Z');
  const parts = getKstParts(utc);
  assert.equal(parts.year, 2026);
  assert.equal(parts.month, 5);
  assert.equal(parts.day, 18);
  assert.equal(parts.hour, 9);
  assert.equal(parts.minute, 0);
  assert.equal(parts.weekday, 1); // 2026-05-18 = 월요일
});

test('getKstParts — UTC 15:00 = KST 다음날 자정 (드리프트 직후)', () => {
  const utc = new Date('2026-05-17T15:00:00Z');
  const parts = getKstParts(utc);
  assert.equal(parts.year, 2026);
  assert.equal(parts.month, 5);
  assert.equal(parts.day, 18);
  assert.equal(parts.hour, 0);
  assert.equal(parts.minute, 0);
});

test('getKstParts — UTC 14:59 = KST 23:59 (같은 날)', () => {
  const utc = new Date('2026-05-17T14:59:00Z');
  const parts = getKstParts(utc);
  assert.equal(parts.day, 17);
  assert.equal(parts.hour, 23);
  assert.equal(parts.minute, 59);
});

test('getKstParts — month 는 1-indexed (Date.getMonth() 와 다름)', () => {
  const utc = new Date('2026-01-01T00:00:00Z'); // KST 2026-01-01T09:00
  assert.equal(getKstParts(utc).month, 1);
  const utc12 = new Date('2026-12-15T03:00:00Z'); // KST 2026-12-15T12:00
  assert.equal(getKstParts(utc12).month, 12);
});

test('getKstStartOfDay — KST 자정 instant 반환', () => {
  // UTC 2026-05-17T15:00:00Z = KST 2026-05-18 자정
  const someTime = new Date('2026-05-17T20:30:00Z');
  const startOfDay = getKstStartOfDay(someTime);
  // KST 2026-05-18 자정 = UTC 2026-05-17T15:00:00.000Z
  assert.equal(startOfDay.toISOString(), '2026-05-17T15:00:00.000Z');
});

test('getKstStartOfDay — KST 23:59 시점 → 당일 KST 자정', () => {
  const utc = new Date('2026-05-17T14:59:00Z'); // KST 2026-05-17 23:59
  const startOfDay = getKstStartOfDay(utc);
  // KST 2026-05-17 자정 = UTC 2026-05-16T15:00:00.000Z
  assert.equal(startOfDay.toISOString(), '2026-05-16T15:00:00.000Z');
});

test('formatKoreanDate — 기본 (long + weekday)', () => {
  // 2026-05-18 KST = 월요일
  const date = new Date('2026-05-18T03:00:00Z');
  assert.equal(formatKoreanDate(date), '2026년 5월 18일 (월)');
});

test('formatKoreanDate — weekday false', () => {
  const date = new Date('2026-05-18T03:00:00Z');
  assert.equal(formatKoreanDate(date, { weekday: false }), '2026년 5월 18일');
});

test('formatKoreanDate — short / numeric style', () => {
  const date = new Date('2026-05-18T03:00:00Z');
  assert.equal(formatKoreanDate(date, { style: 'short', weekday: false }), '5월 18일');
  assert.equal(formatKoreanDate(date, { style: 'numeric', weekday: false }), '2026.05.18');
});

test('getDailyVersion — getKstDateKey 와 동일', () => {
  const date = new Date('2026-05-17T20:00:00Z');
  assert.equal(getDailyVersion(date), getKstDateKey(date));
  assert.equal(getDailyVersion(date), '2026-05-18');
});

test('drift 케이스 — Vercel UTC 서버에서 KST 05:00 시점 raw vs KST 차이', () => {
  // 실제 Phase 1 CI 실패 시점 = UTC 2026-05-17 20:36:53 = KST 2026-05-18 05:36:53
  // raw new Date(utc).getDate() = 17 (UTC), getKstParts(utc).day = 18 (KST) → 차이 1일
  const utc = new Date('2026-05-17T20:36:53Z');
  // raw UTC 사용 시 (잘못된 동작)
  assert.equal(utc.getUTCDate(), 17);
  assert.equal(utc.getUTCMonth() + 1, 5);
  // KST 사용 시 (올바른 동작)
  const parts = getKstParts(utc);
  assert.equal(parts.day, 18);
  assert.equal(parts.month, 5);
});
