import assert from 'node:assert/strict';
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
  assert.equal(audit.premiumResultSummary.coinCost, 10);
  assert.equal(audit.analytics.missingEvents.length, 0);
  assert.ok(audit.checks.some((check) => check.key === 'today-grounding-kasi' && check.ok));
  assert.ok(audit.checks.some((check) => check.key === 'today-safety-wealth'));
  assert.equal(
    audit.checks.find((check) => check.key === 'today-safety-health')?.ok,
    true
  );
  assert.ok(audit.unknownBirthTimePreview?.reasonSnippet.length);
});
