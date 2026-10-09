import assert from 'node:assert/strict';
import {
  evaluateLlmQuotaAlert,
  shouldHoldPaymentsForLlm,
  kstDateKey,
  parseMonthlyBudgetUsd,
  type EvaluateLlmQuotaAlertInput,
} from './llm-quota-alert';
import { aggregateByDay, type LlmRunRow } from './llm-cost-stats';

// 2026-08-31 — 8/31 한도 장애 재발 감지 가드 + "긴급은 지금 막혀 있을 때만" 규칙.

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const day = (date: string, quotaFallbacks: number, costUsd = 0) => ({
  date,
  calls: 10,
  costUsd,
  distinctUsers: 3,
  quotaFallbacks,
});

const base = (over: Partial<EvaluateLlmQuotaAlertInput> = {}): EvaluateLlmQuotaAlertInput => ({
  daily: [day('2026-08-31', 0)],
  monthSpendUsd: 1,
  budgetUsd: null,
  todayKey: '2026-08-31',
  quotaFailsInActiveWindow: 0,
  lastQuotaFailAt: null,
  lastSuccessAt: null,
  ...over,
});

test('최근 2시간 안에 한도 실패가 있으면 critical(지금 막혀 있음)', () => {
  const a = evaluateLlmQuotaAlert(
    base({
      daily: [day('2026-08-31', 4)],
      quotaFailsInActiveWindow: 4,
      lastQuotaFailAt: '2026-08-31T02:50:00Z',
      lastSuccessAt: '2026-08-31T01:00:00Z',
    })
  );
  assert.equal(a.level, 'critical');
  assert.equal(a.activeNow, true);
  assert.ok(a.headline.includes('지금 막혀 있음'));
});

test('🔴 결제로 복구된 뒤엔 critical 이 아니다 — 실패 뒤 성공 호출이 있으면 warn(복구됨)', () => {
  // 2026-08-31 실제 상황: 어젯밤 415건 실패 → 아침에 결제 → 정상. 첫 판정이 "긴급 415건" 이었다.
  const a = evaluateLlmQuotaAlert(
    base({
      daily: [day('2026-08-30', 322), day('2026-08-31', 93)],
      quotaFailsInActiveWindow: 0,
      lastQuotaFailAt: '2026-08-30T15:30:00Z', // KST 08-31 00:30
      lastSuccessAt: '2026-08-31T02:00:00Z', // KST 08-31 11:00 — 복구 후 성공
    })
  );
  assert.equal(a.level, 'warn');
  assert.equal(a.activeNow, false);
  assert.equal(a.recentQuotaFallbacks, 415);
  assert.ok(a.headline.includes('복구됨'), a.headline);
});

test('실패 뒤 호출 자체가 없으면 warn(확인 필요) — 복구를 단정하지 않는다', () => {
  const a = evaluateLlmQuotaAlert(
    base({
      daily: [day('2026-08-31', 5)],
      quotaFailsInActiveWindow: 0,
      lastQuotaFailAt: '2026-08-30T20:00:00Z',
      lastSuccessAt: '2026-08-30T10:00:00Z', // 실패보다 앞 — 복구 증거 없음
    })
  );
  assert.equal(a.level, 'warn');
  assert.ok(a.headline.includes('확인 필요'), a.headline);
});

test('월 경계 — daily 에 어제가 없어도 원본 최신 실패 시각으로 이력을 잡는다', () => {
  const a = evaluateLlmQuotaAlert(
    base({
      daily: [day('2026-09-01', 0)],
      todayKey: '2026-09-01',
      quotaFailsInActiveWindow: 0,
      lastQuotaFailAt: '2026-08-31T13:00:00Z', // KST 08-31 22:00 = 어제
      lastSuccessAt: '2026-08-31T20:00:00Z',
    })
  );
  assert.equal(a.level, 'warn');
  assert.equal(a.lastQuotaFallbackDate, '2026-08-31');
});

test('예산 80% 이상이면 warn, 100% 이상이면 critical', () => {
  const at80 = evaluateLlmQuotaAlert(base({ monthSpendUsd: 80, budgetUsd: 100 }));
  assert.equal(at80.level, 'warn');
  assert.equal(at80.budgetRatio, 0.8);
  const over = evaluateLlmQuotaAlert(base({ monthSpendUsd: 120, budgetUsd: 100 }));
  assert.equal(over.level, 'critical');
});

test('예산 초과는 복구된 이력보다 우선한다', () => {
  const a = evaluateLlmQuotaAlert(
    base({
      daily: [day('2026-08-31', 3)],
      monthSpendUsd: 120,
      budgetUsd: 100,
      lastQuotaFailAt: '2026-08-31T00:00:00Z',
      lastSuccessAt: '2026-08-31T01:00:00Z',
    })
  );
  assert.equal(a.level, 'critical');
  assert.ok(a.headline.includes('예산'));
});

test('예산 미설정이면 지출만으로는 경보하지 않는다', () => {
  const a = evaluateLlmQuotaAlert(base({ monthSpendUsd: 9999 }));
  assert.equal(a.level, 'ok');
  assert.equal(a.budgetRatio, null);
  assert.ok(a.detail.includes('예산 미설정'));
});

test("ok 는 '여유 있음' 이 아니라 '신호 없음' 이라고 말한다", () => {
  const a = evaluateLlmQuotaAlert(base({ budgetUsd: 100 }));
  assert.equal(a.level, 'ok');
  assert.ok(a.detail.includes('실제 잔액은 조회할 수 없습니다'));
});

test('집계 행이 없으면 noData — 텔레메트리 단절을 정상으로 읽지 않는다', () => {
  const a = evaluateLlmQuotaAlert(base({ daily: [], monthSpendUsd: 0 }));
  assert.equal(a.level, 'ok');
  assert.equal(a.noData, true);
  assert.ok(a.detail.includes('텔레메트리'));
});

test('aggregateByDay 가 quota_exceeded fallback 만 센다', () => {
  const rows: LlmRunRow[] = [
    { created_at: '2026-08-31T01:00:00Z', feature: 'chat', source: 'fallback', fallback_reason: 'quota_exceeded', input_tokens: null, output_tokens: null, cost_usd: 0, user_id_hash: 'u1' },
    { created_at: '2026-08-31T02:00:00Z', feature: 'chat', source: 'fallback', fallback_reason: 'openai_error', input_tokens: null, output_tokens: null, cost_usd: 0, user_id_hash: 'u2' },
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

// 2026-10-09 P1 — LLM 장애(10/9 크레딧 소진 9시간) 중에도 결제가 접수되던 문제. 결제 보류 판정.
test('결제 보류: 마지막 한도 실패가 30분 안이고 그 뒤 성공이 없으면 보류', () => {
  const now = new Date('2026-10-09T05:00:00Z');
  assert.equal(shouldHoldPaymentsForLlm({ lastQuotaFailAt: '2026-10-09T04:45:00Z', lastSuccessAt: '2026-10-08T20:00:00Z' }, now), true);
  assert.equal(shouldHoldPaymentsForLlm({ lastQuotaFailAt: '2026-10-09T04:45:00Z', lastSuccessAt: null }, now), true);
});

test('결제 보류 해제: 실패 뒤 성공 호출(복구) · 30분 지난 실패 · 실패 없음 · 신호 조회 실패(null)', () => {
  const now = new Date('2026-10-09T05:00:00Z');
  assert.equal(shouldHoldPaymentsForLlm({ lastQuotaFailAt: '2026-10-09T04:45:00Z', lastSuccessAt: '2026-10-09T04:50:00Z' }, now), false);
  assert.equal(shouldHoldPaymentsForLlm({ lastQuotaFailAt: '2026-10-09T04:29:00Z', lastSuccessAt: null }, now), false);
  assert.equal(shouldHoldPaymentsForLlm({ lastQuotaFailAt: null, lastSuccessAt: null }, now), false);
  // 조회 실패로 결제를 막지 않는다(fail-open) — 정상 시간대 매출을 지키는 쪽.
  assert.equal(shouldHoldPaymentsForLlm(null, now), false);
});

test('prepare 는 주문을 만들기 전에 LLM 결제 보류를 확인하고 503 으로 멈춘다', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const src = fs.readFileSync(path.resolve(__dirname, '../../app/api/payments/prepare/route.ts'), 'utf8');
  const hold = src.indexOf('isLlmPaymentHoldActive(');
  assert.ok(hold > 0, 'prepare 가 isLlmPaymentHoldActive 를 호출해야 한다');
  assert.ok(hold < src.indexOf('createPaymentOrder('), '보류 판정은 주문 생성보다 앞이어야 한다');
  assert.match(src.slice(hold, hold + 800), /status:\s*503/);
  assert.match(src.slice(hold, hold + 800), /reason:\s*'llm_outage_hold'/);
});
