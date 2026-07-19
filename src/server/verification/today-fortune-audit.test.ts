import assert from 'node:assert/strict';
import { getFeatureCost } from '@/lib/credits/costs';
import { getTodayFortuneVerificationAudit } from './today-fortune-audit';

declare const test: (name: string, fn: () => Promise<void>) => void;

test('today fortune verification audit exposes free/premium structure and safety coverage', async () => {
  const audit = await getTodayFortuneVerificationAudit({
    slug: '1982-1-29-8-male',
    concernId: 'money_spend',
    counselorId: 'female',
  });

  assert.equal(audit.status, 'ready');

  if (audit.status !== 'ready') {
    throw new Error('today fortune audit should be ready');
  }

  assert.equal(audit.concernCoverage.primaryVisibleCount, 4);
  assert.equal(audit.concernCoverage.totalCount, 6);
  assert.equal(audit.freeResultSummary.scoreCount, 6);
  assert.equal(audit.premiumResultSummary.coinCost, getFeatureCost('detail_report'));
  // 2026-07-19 — 기존엔 checks[].ok 를 단언하지 않아 "테스트 green / 검증페이지 red" 가
  //   은폐됐다(coinCost === 1 stale 단언이 2026-06-26 이후 계속 실패 중이었음).
  //   두 shape 체크의 ok 를 직접 단언해 같은 회귀가 다시 숨지 않게 한다.
  assert.ok(
    audit.checks.some((check) => check.key === 'today-free-result-shape' && check.ok),
    '무료 결과 카드 구조 체크가 통과해야 한다'
  );
  assert.ok(
    audit.checks.some((check) => check.key === 'today-premium-result-shape' && check.ok),
    '심화 결과 구조 체크가 통과해야 한다'
  );
  assert.equal(audit.analytics.missingEvents.length, 0);
  assert.ok(audit.checks.some((check) => check.key === 'today-grounding-kasi' && check.ok));
  assert.ok(audit.checks.some((check) => check.key === 'today-safety-wealth'));
  assert.equal(
    audit.checks.find((check) => check.key === 'today-safety-health')?.ok,
    true
  );
  assert.ok(audit.unknownBirthTimePreview?.reasonSnippet.length);
});
