import assert from 'node:assert/strict';
import { loadSajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { SajuDataV2 } from '@/domain/saju/engine/saju-data-v2-upgrade';
import type { TenGodCode } from '@/domain/saju/engine/saju-data-v1';
import type { BirthInput } from '@/lib/saju/types';
import { CLASSIC_READING_RULE_SOURCES, selectClassicReadingRules } from './classic-reading-rules';

declare const test: (name: string, fn: () => void) => void;

const input = (year: number, month: number, day: number): BirthInput =>
  ({ year, month, day, hour: 14, minute: 30, gender: 'female' });
const dataFor = (birth: BirthInput) => loadSajuDataV2(birth, null, { now: '2026-09-18T00:00:00Z' });
const cases = [
  { birth: input(1984, 2, 10), id: 'qt-early-spring-jia-warmth' },
  { birth: input(1980, 6, 22), id: 'qt-summer-bing-ren-moderation' },
  { birth: input(1984, 12, 15), id: 'qt-winter-gui-bing-support' },
  { birth: input(1980, 5, 15), id: 'dt-shangguan-zhengguan-context' },
  { birth: input(1980, 4, 15), id: 'dt-wealth-types-and-output' },
  { birth: input(1980, 1, 15), id: 'sm-pressure-and-resource' },
  { birth: input(1980, 1, 15), id: 'dt-mixed-authority-is-conditional' },
  { birth: input(1982, 7, 15), id: 'sm-month-before-fixed-pattern' },
  { birth: input(1980, 1, 15), id: 'sm-balance-before-good-bad' },
];
const hasRule = (data: SajuDataV2, id: string) => selectClassicReadingRules(data).some((rule) => rule.id === id);

// These omissions simulate incomplete older engine snapshots. We deliberately
// do not recompute missing facts in the selector or infer them from totals.
function omitGods(data: SajuDataV2, omitted: TenGodCode[]): SajuDataV2 {
  const copy = structuredClone(data);
  for (const pillar of Object.values(copy.pillars)) {
    if (!pillar) continue;
    if (pillar.stemTenGod && omitted.includes(pillar.stemTenGod)) pillar.stemTenGod = null;
    for (const hidden of pillar.hiddenStems) {
      if (hidden.tenGod && omitted.includes(hidden.tenGod)) hidden.tenGod = null;
    }
  }
  return copy;
}

test('classic rule sources identify nine short anchors, canonical works and fixed chapter revisions', () => {
  assert.equal(CLASSIC_READING_RULE_SOURCES.length, 9);
  assert.equal(new Set(CLASSIC_READING_RULE_SOURCES.map((rule) => rule.id)).size, 9);
  assert.deepEqual(new Set(CLASSIC_READING_RULE_SOURCES.map((rule) => rule.workSlug)),
    new Set(['ditian-sui', 'qiongtong-baojian', 'sanming-tonghui']));
  for (const source of CLASSIC_READING_RULE_SOURCES) {
    const url = new URL(source.sourceUrl);
    assert.equal(url.hostname, 'zh.wikisource.org');
    assert.ok(source.originalAnchor.length >= 10 && source.originalAnchor.length <= 30);
    assert.doesNotMatch(source.originalAnchor, /[\u3000\n\t]/);
    assert.doesNotMatch(source.sourceTitle, /사구전서|전문가 검수|정확도/);
    const revisions = { 'ditian-sui': '844363', 'qiongtong-baojian': '2294674', 'sanming-tonghui': '761707' };
    assert.equal(url.searchParams.get('oldid'), revisions[source.workSlug]);
    if (source.workSlug === 'ditian-sui') assert.equal(url.searchParams.get('title'), '滴天髓/06');
  }
});

test('classic rules match nine source perspectives using actual synthetic birth charts', () => {
  for (const { birth, id } of cases) {
    const data = dataFor(birth);
    const before = structuredClone(data);
    const rules = selectClassicReadingRules(data);
    assert.ok(rules.length >= 1 && rules.length <= 4);
    assert.ok(rules.some((rule) => rule.id === id), `${birth.year}-${birth.month}-${birth.day}: ${id}`);
    for (const rule of rules) {
      assert.match(rule.meaning, /^편집 해설:/);
      assert.match(rule.application, /^편집 적용:/);
      assert.ok(rule.matchedFacts.length >= 2);
      assert.match(rule.matchedFacts.join(' '), /일간 .*월지/);
      assert.match(rule.limits.join(' '), /실증 근거가 아닙니다/);
      assert.doesNotMatch([rule.meaning, rule.application, ...rule.matchedFacts, ...rule.limits].join(' '), /[\u3400-\u9fff]/);
    }
    assert.deepEqual(data, before);
  }
  const first = selectClassicReadingRules(dataFor(input(1980, 1, 15))).map((rule) => rule.id);
  const second = selectClassicReadingRules(dataFor(input(1984, 2, 10))).map((rule) => rule.id);
  assert.notDeepEqual(first, second);
});

test('classic wealth and relationship rules require every named factor, not aggregate totals alone', () => {
  const money = dataFor(input(1980, 4, 15));
  assert.ok(hasRule(money, 'dt-wealth-types-and-output'));
  assert.ok(!hasRule(omitGods(money, ['정재']), 'dt-wealth-types-and-output'));
  assert.ok(!hasRule(omitGods(money, ['식신', '상관']), 'dt-wealth-types-and-output'));
  const relationship = dataFor(input(1980, 5, 15));
  assert.ok(hasRule(relationship, 'dt-shangguan-zhengguan-context'));
  assert.ok(!hasRule(omitGods(relationship, ['정재', '편재']), 'dt-shangguan-zhengguan-context'));
  assert.ok(!hasRule({ ...relationship, strength: null }, 'dt-shangguan-zhengguan-context'));
});

test('classic seasonal rules do not migrate to a different month or unsupported strength', () => {
  for (const { birth, id } of cases.slice(0, 3)) {
    const data = dataFor(birth);
    const otherMonth = { ...data, pillars: { ...data.pillars, month: { ...data.pillars.month, branch: '酉' as const } } };
    assert.ok(!hasRule(otherMonth, id));
  }
  const summer = dataFor(input(1980, 6, 22));
  assert.ok(!hasRule({ ...summer, strength: { ...summer.strength!, level: '신약' } }, 'qt-summer-bing-ren-moderation'));
  const certain = dataFor(input(1982, 7, 15));
  assert.ok(!hasRule({ ...certain, pattern: { ...certain.pattern!, confidence: '확정' } }, 'sm-month-before-fixed-pattern'));
});

test('unknown birth time excludes a stale hour and its ten-god totals from classic matches', () => {
  const known = dataFor(input(1980, 5, 15));
  const unknown = dataFor({ ...input(1980, 5, 15), hour: undefined, minute: undefined, unknownTime: true });
  const expected = selectClassicReadingRules(unknown);
  const ghost = { ...unknown, pillars: { ...unknown.pillars, hour: known.pillars.hour }, tenGods: known.tenGods };
  assert.deepEqual(selectClassicReadingRules(ghost), expected);
  assert.ok(!hasRule(ghost, 'dt-shangguan-zhengguan-context'), 'the only 정관 is in the unavailable hour');
  for (const rule of expected) {
    assert.doesNotMatch(rule.matchedFacts.join(' '), /시주/);
    assert.match(rule.limits.join(' '), /출생시각 미상/);
  }
});

test('daily and yearly classic evidence stays natal and carries an explicit time-scope limit', () => {
  const data = dataFor(input(1984, 2, 10));
  const natal = selectClassicReadingRules(data);
  assert.deepEqual(selectClassicReadingRules({ ...data, currentLuck: null, majorLuck: [] }), natal);
  for (const scope of ['daily', 'yearly'] as const) {
    const scoped = selectClassicReadingRules(data, scope);
    assert.deepEqual(scoped.map(({ id, application, matchedFacts }) => ({ id, application, matchedFacts })),
      natal.map(({ id, application, matchedFacts }) => ({ id, application, matchedFacts })));
    for (const rule of scoped) assert.match(rule.limits.at(-1)!, scope === 'daily' ? /오늘 일진/ : /특정 연도/);
  }
});

test('a valid natal chart always has a principle whose application responds to the computed strength', () => {
  const data = dataFor(input(1980, 1, 15));
  const allGods: TenGodCode[] = ['비견', '겁재', '식신', '상관', '정재', '편재', '정관', '편관', '정인', '편인'];
  const partial = { ...omitGods(data, allGods), pattern: null };
  const applications = new Set<string>();
  for (const level of ['신강', '신약', '중화', null] as const) {
    const chart = { ...partial, strength: level ? { ...data.strength!, level } : null };
    const rules = selectClassicReadingRules(chart);
    assert.equal(rules.length, 1);
    assert.equal(rules[0].id, 'sm-balance-before-good-bad');
    applications.add(rules[0].application);
    if (!level) assert.match(rules[0].application, /결론을 보류/);
  }
  assert.equal(applications.size, 4);
});
