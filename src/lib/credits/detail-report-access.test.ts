import assert from 'node:assert/strict';
import {
  DETAIL_REPORT_ACCESS_KIND,
  DETAIL_REPORT_DAILY_ACCESS_KIND,
  TODAY_FORTUNE_PREMIUM_ACCESS_KIND,
  getKoreaAccessDay,
  getTodayFortunePremiumAccessMetadata,
  kstDayRangeIso,
  validateCreditUsePayload,
} from './detail-report-access';

declare const test: (name: string, fn: () => void) => void;

// 2026-06-05 today-detail 일일 만료 — KST 날짜 구간 + dayKey 메타데이터(일일 dedup).
test('kstDayRangeIso: KST 일자 → [00:00, 24:00) KST 의 UTC ISO 구간', () => {
  const range = kstDayRangeIso('2026-06-05');
  assert.ok(range, 'range 가 null 이면 안 됨');
  // KST 00:00 = 전날 UTC 15:00
  assert.equal(range!.startIso, '2026-06-04T15:00:00.000Z');
  assert.equal(range!.endIso, '2026-06-05T15:00:00.000Z');
});

test('kstDayRangeIso: 잘못된 형식 → null', () => {
  assert.equal(kstDayRangeIso('not-a-date'), null);
  assert.equal(kstDayRangeIso(''), null);
});

test('getTodayFortunePremiumAccessMetadata: dayKey 주면 메타데이터에 포함(일일 dedup), 없으면 생략(legacy 호환)', () => {
  const withDay = getTodayFortunePremiumAccessMetadata('sid-1', 'rk-1', '2026-06-05');
  assert.equal(withDay.kind, TODAY_FORTUNE_PREMIUM_ACCESS_KIND);
  assert.equal(withDay.readingKey, 'rk-1');
  assert.equal((withDay as { dayKey?: string }).dayKey, '2026-06-05');

  const without = getTodayFortunePremiumAccessMetadata('sid-1', 'rk-1');
  assert.equal('dayKey' in without, false);
});

test('detail report credit payload requires a slug before charging', () => {
  const result = validateCreditUsePayload({
    feature: 'detail_report',
  });

  assert.deepEqual(result, {
    ok: false,
    error: '상세 해석을 열 결과가 필요합니다.',
  });
});

test('detail report credit payload trims slug used for daily reuse', () => {
  const result = validateCreditUsePayload({
    feature: 'detail_report',
    slug: '  1982-1-29-8-male  ',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.payload.feature, 'detail_report');
  assert.equal(result.payload.slug, '1982-1-29-8-male');
});

test('credit payload rejects unsupported feature names', () => {
  const result = validateCreditUsePayload({
    feature: 'not_a_feature',
    slug: '1982-1-29-8-male',
  });

  assert.deepEqual(result, {
    ok: false,
    error: '지원하지 않는 기능입니다.',
  });
});

test('daily detail report access key uses Korea calendar day', () => {
  const utcAfternoon = new Date('2026-04-18T16:30:00.000Z');

  assert.equal(getKoreaAccessDay(utcAfternoon), '2026-04-19');
  assert.equal(DETAIL_REPORT_ACCESS_KIND, 'detail_report_access');
  assert.equal(DETAIL_REPORT_DAILY_ACCESS_KIND, 'detail_report_daily_access');
  assert.equal(TODAY_FORTUNE_PREMIUM_ACCESS_KIND, 'today_fortune_premium_access');
});
