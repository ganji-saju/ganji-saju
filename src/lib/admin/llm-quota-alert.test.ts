import assert from 'node:assert/strict';
import {
  evaluateLlmQuotaAlert,
  kstDateKey,
  parseMonthlyBudgetUsd,
} from './llm-quota-alert';
import { aggregateByDay, type LlmRunRow } from './llm-cost-stats';

// 2026-08-31 — 8/31 한도 장애 재발 감지 가드.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const day = (date: string, quotaFallbacks: number, costUsd = 0) => ({
  date,
  calls: 10,
  costUsd,
  distinctUsers: 3,
  quotaFallbacks,
});

test('오늘/어제 한도 실패가 있으면 critical', () => {
  const a = evaluateLlmQuotaAlert({
    daily: [day('2026-08-29', 0), day('2026-08-31', 4)],
    monthSpendUsd: 1,
    budgetUsd: null,
    todayKey: '2026-08-31',
  });
  assert.equal(a.level, 'critical');
  assert.equal(a.recentQuotaFallbacks, 4);
  assert.equal(a.lastQuotaFallbackDate, '2026-08-31');
});

test('어제 실패도 critical (달 경계 포함)', () => {
  const a = evaluateLlmQuotaAlert({
    daily: [day('2026-07-31', 2)],
    monthSpendUsd: 1,
    budgetUsd: null,
    todayKey: '2026-08-01',
  });
  assert.equal(a.level, 'critical');
  assert.equal(a.recentQuotaFallbacks, 2);
});

test('이번 달 이력만 있고 최근 이틀은 정상이면 warn', () => {
  const a = evaluateLlmQuotaAlert({
    daily: [day('2026-08-03', 7), day('2026-08-31', 0)],
    monthSpendUsd: 1,
    budgetUsd: null,
    todayKey: '2026-08-31',
  });
  assert.equal(a.level, 'warn');
  assert.equal(a.recentQuotaFallbacks, 0);
  assert.equal(a.lastQuotaFallbackDate, '2026-08-03');
});

test('예산 80% 이상이면 warn, 100% 이상이면 critical', () => {
  const at80 = evaluateLlmQuotaAlert({
    daily: [day('2026-08-31', 0)],
    monthSpendUsd: 80,
    budgetUsd: 100,
    todayKey: '2026-08-31',
  });
  assert.equal(at80.level, 'warn');
  assert.equal(at80.budgetRatio, 0.8);

  const over = evaluateLlmQuotaAlert({
    daily: [day('2026-08-31', 0)],
    monthSpendUsd: 120,
    budgetUsd: 100,
    todayKey: '2026-08-31',
  });
  assert.equal(over.level, 'critical');
});

test('예산 미설정이면 지출만으로는 경보하지 않는다', () => {
  const a = evaluateLlmQuotaAlert({
    daily: [day('2026-08-31', 0)],
    monthSpendUsd: 9999,
    budgetUsd: null,
    todayKey: '2026-08-31',
  });
  assert.equal(a.level, 'ok');
  assert.equal(a.budgetRatio, null);
  assert.ok(a.detail.includes('예산 미설정'));
});

test("ok 는 '여유 있음' 이 아니라 '신호 없음' 이라고 말한다", () => {
  // 벤더 계정의 실제 잔액은 조회할 수 없다 — 화면이 안심시키면 안 된다.
  const a = evaluateLlmQuotaAlert({
    daily: [day('2026-08-31', 0)],
    monthSpendUsd: 1,
    budgetUsd: 100,
    todayKey: '2026-08-31',
  });
  assert.equal(a.level, 'ok');
  assert.ok(a.detail.includes('실제 잔액은 조회할 수 없습니다'));
});

test('집계 행이 없으면 noData — 텔레메트리 단절을 정상으로 읽지 않는다', () => {
  const a = evaluateLlmQuotaAlert({
    daily: [],
    monthSpendUsd: 0,
    budgetUsd: null,
    todayKey: '2026-08-31',
  });
  assert.equal(a.level, 'ok');
  assert.equal(a.noData, true);
  assert.ok(a.detail.includes('텔레메트리'));
});

test('aggregateByDay 가 quota_exceeded fallback 만 센다', () => {
  const rows: LlmRunRow[] = [
    { created_at: '2026-08-31T01:00:00Z', feature: 'chat', source: 'fallback', fallback_reason: 'quota_exceeded', input_tokens: null, output_tokens: null, cost_usd: 0, user_id_hash: 'u1' },
    // 다른 사유의 fallback 은 한도가 아니다 — 세면 오탐이 된다.
    { created_at: '2026-08-31T02:00:00Z', feature: 'chat', source: 'fallback', fallback_reason: 'openai_error', input_tokens: null, output_tokens: null, cost_usd: 0, user_id_hash: 'u2' },
    // 정상 호출.
    { created_at: '2026-08-31T03:00:00Z', feature: 'chat', source: 'openai', fallback_reason: null, input_tokens: 10, output_tokens: 10, cost_usd: 0.001, user_id_hash: 'u3' },
  ];
  const days = aggregateByDay(rows);
  assert.equal(days.length, 1);
  assert.equal(days[0].calls, 3);
  assert.equal(days[0].quotaFallbacks, 1);
});

test('parseMonthlyBudgetUsd — 빈값·0·문자는 미설정', () => {
  assert.equal(parseMonthlyBudgetUsd('50'), 50);
  assert.equal(parseMonthlyBudgetUsd(' 12.5 '), 12.5);
  assert.equal(parseMonthlyBudgetUsd(undefined), null);
  assert.equal(parseMonthlyBudgetUsd(''), null);
  assert.equal(parseMonthlyBudgetUsd('0'), null);
  assert.equal(parseMonthlyBudgetUsd('abc'), null);
});

test('kstDateKey — UTC 15시 이후는 KST 다음날', () => {
  assert.equal(kstDateKey(new Date('2026-08-30T14:59:00Z')), '2026-08-30');
  assert.equal(kstDateKey(new Date('2026-08-30T15:00:00Z')), '2026-08-31');
});
