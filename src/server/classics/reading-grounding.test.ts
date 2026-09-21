import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { selectClassicReadingRules } from '@/domain/saju/report/classic-reading-rules';
import { getClassicReadingGrounding, readingGroundingFingerprint } from './reading-grounding';
import type { ClassicEvidenceItem } from './evidence';

declare const test: (name: string, fn: () => void | Promise<void>) => void;

const data = () => calculateSajuDataV1({ year: 1982, month: 1, day: 29, hour: 8, minute: 45, gender: 'male' });

test('classic reading uses the matching original but never substitutes an unreviewed generic summary', async () => {
  const chart = data();
  const rules = selectClassicReadingRules(chart);
  assert.ok(rules.length > 0, 'a calculated natal chart has source-grounded interpretation principles');
  let calls = 0;
  const grounding = await getClassicReadingGrounding(chart, 'natal', async ({ workSlug, anchor }) => {
    calls++;
    const item = {
      work: { slug: workSlug },
      passage: { id: `source-${calls}`, originalZh: `문맥 ${anchor} 문맥`, commentaryKo: '미검수 공통 요약', literalKo: null },
      provenance: { sourceUrl: 'https://zh.wikisource.org/wiki/source', sourceRef: 'title=source',
        license: 'CC BY-SA 4.0', verificationStatus: 'provisional', publicReleaseStatus: 'live' },
    } as ClassicEvidenceItem;
    return { concept: anchor, count: 1, items: [item], status: 'ready', setupRequired: false };
  });
  assert.equal(calls, rules.length);
  assert.ok(calls <= 4);
  assert.equal(grounding.status, 'retrieved');
  assert.ok(grounding.items.every((item) => item.origin === 'corpus' && item.passageId));
  assert.doesNotMatch(JSON.stringify(grounding), /미검수 공통 요약/);
  assert.deepEqual(grounding.items[0].matchedFacts, rules[0].matchedFacts);
  assert.deepEqual(grounding.items[0].limits, rules[0].limits);
});

test('missing, unrelated and blocked originals never become retrieved evidence or poison the reading', async () => {
  const chart = data();
  for (const invalid of ['failure', 'unrelated', 'blocked']) {
    const grounding = await getClassicReadingGrounding(chart, 'daily', async ({ workSlug, anchor }) => {
      if (invalid === 'failure') throw new Error('DB unavailable');
      return { concept: anchor, count: 1, status: 'ready', setupRequired: false, items: [{
        work: { slug: workSlug }, passage: { id: 'invalid', originalZh: invalid === 'unrelated' ? '無關原文' : anchor },
        provenance: { sourceUrl: 'https://zh.wikisource.org', sourceRef: 'source', license: 'PD',
          verificationStatus: invalid === 'blocked' ? 'blocked' : 'provisional', publicReleaseStatus: 'live' },
      } as ClassicEvidenceItem] };
    });
    assert.equal(grounding.status, 'unavailable');
    assert.ok(grounding.items.every((item) => item.origin === 'curated-reference' && item.passageId === null));
  }
});

test('changes to source contents, application conditions or availability invalidate the prose cache', async () => {
  const grounding = await getClassicReadingGrounding(data(), 'natal', async ({ anchor }) => ({
    concept: anchor, count: 0, items: [], status: 'ready', setupRequired: false,
  }));
  const initial = readingGroundingFingerprint(grounding);
  assert.equal(initial, readingGroundingFingerprint(structuredClone(grounding)));
  for (const field of ['original', 'application'] as const) {
    const changed = structuredClone(grounding);
    changed.items[0][field] += ' 변경';
    assert.notEqual(initial, readingGroundingFingerprint(changed));
  }
  const changed = { ...grounding, status: 'retrieved' as const };
  assert.notEqual(initial, readingGroundingFingerprint(changed));
});
