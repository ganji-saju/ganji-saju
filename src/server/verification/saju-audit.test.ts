import assert from 'node:assert/strict';
import { getSajuVerificationAudit } from './saju-audit';

declare const test: (name: string, fn: () => Promise<void>) => void;

test('saju verification audit exposes calculation trace for deterministic slug', async () => {
  const audit = await getSajuVerificationAudit({
    slug: '1982-1-29-8-male',
    topic: 'career',
  });

  assert.equal(audit.status, 'ready');

  if (audit.status !== 'ready') {
    throw new Error('audit should be ready');
  }

  assert.equal(audit.readingSource, 'deterministic-slug');
  assert.equal(audit.topic, 'career');
  assert.ok(audit.calculation.pillars.year.ganzi);
  assert.ok(audit.calculation.strength?.rationale.length);
  assert.ok(audit.calculation.yongsin?.rationale.length);
  assert.ok(audit.report.evidenceCards.length > 0);
  assert.ok(audit.checks.some((check) => check.key === 'legacy-classical-citation-layer'));
  assert.ok(audit.checks.some((check) => check.key === 'similarity-prompt-divergence'));
  assert.ok(audit.checks.some((check) => check.key === 'similarity-personalization-divergence'));
  assert.ok(audit.outputSimilarity);
  assert.equal(audit.outputSimilarity.samples[0].slug, '1982-1-29-8-male');
  assert.equal(audit.outputSimilarity.samples[1].input.hour, 22);
  assert.ok(
    audit.outputSimilarity.differences.some((difference) => difference.startsWith('시주 '))
  );
  assert.equal(audit.outputSimilarity.checks.promptDiverges, true);
  assert.equal(audit.outputSimilarity.checks.personalizationDiverges, true);
});
