import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuReport } from '@/domain/saju/report';
import {
  getTopicInterpretationRule,
  selectEvidenceCard,
} from '@/domain/saju/report/interpretation-rule-table';
import { parseBirthInputDraft } from '@/domain/saju/validators/birth-input';
import {
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from './build-today-fortune';

declare const test: (name: string, fn: () => void) => void;

function createSampleInput(
  overrides: Partial<{
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    gender: string;
  }> = {}
) {
  const parsed = parseBirthInputDraft(
    {
      year: '1982',
      month: '1',
      day: '29',
      hour: '8',
      minute: '45',
      gender: 'male',
      ...overrides,
      birthLocationCode: 'seoul',
      birthLocationLabel: '서울특별시',
      birthLatitude: '37.5665',
      birthLongitude: '126.9780',
      unknownTime: false,
      jasiMethod: 'unified',
      solarTimeMode: 'standard',
    },
    { requireGender: false }
  );

  if (!parsed.ok) {
    throw new Error('sample birth input should be valid');
  }

  return parsed.input;
}

test('today fortune premium actions reuse evidence practical actions instead of only fixed copy', () => {
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);
  const result = buildTodayFortunePremiumResult(input, sajuData, 'money_spend');
  const report = buildSajuReport(input, sajuData, 'wealth');
  const rule = getTopicInterpretationRule('wealth');
  const leadCard = selectEvidenceCard(report.evidenceCards, rule.evidencePriority);
  const cautionCard = selectEvidenceCard(report.evidenceCards, rule.cautionPriority);

  assert.equal(result.recommendedActions.length, 3);
  assert.equal(result.avoidActions.length, 3);
  assert.ok(
    leadCard?.practicalActions?.some((action) =>
      result.recommendedActions.some((line) => line.includes(action))
    )
  );
  assert.ok(
    cautionCard?.practicalActions?.some((action) =>
      result.avoidActions.some((line) => line.includes(action))
    )
  );
});

test('today fortune premium windows and scenarios carry grounded current-luck cues', () => {
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);
  const result = buildTodayFortunePremiumResult(input, sajuData, 'work_meeting');
  const currentLuckFact = [
    sajuData.currentLuck?.currentMajorLuck?.ganzi
      ? `${sajuData.currentLuck.currentMajorLuck.ganzi} 대운`
      : null,
    sajuData.currentLuck?.saewoon?.ganzi
      ? `${sajuData.currentLuck.saewoon.ganzi} 세운`
      : null,
    sajuData.currentLuck?.wolwoon?.ganzi
      ? `${sajuData.currentLuck.wolwoon.ganzi} 월운`
      : null,
  ]
    .filter(Boolean)
    .join(' / ');

  assert.ok(result.favorableWindows.every((item) => item.title.includes('좋아')));
  assert.ok(result.cautionWindows.every((item) => item.title.includes('·')));
  assert.ok(result.favorableWindows.every((item) => !/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]시/.test(item.title)));
  assert.ok(result.cautionWindows.every((item) => !/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]시/.test(item.title)));
  assert.doesNotMatch(
    [...result.favorableWindows, ...result.cautionWindows].map((item) => `${item.title} ${item.body}`).join(' '),
    /기운|보완 힌트|선택 힌트/
  );
  assert.deepEqual(
    result.scenarios.map((item) => item.title),
    ['오늘 미팅을 바로 진행할 때', '한 번 더 조율하고 진행할 때']
  );

  if (currentLuckFact) {
    const combined = [
      ...result.favorableWindows.map((item) => item.body),
      ...result.cautionWindows.map((item) => item.body),
      ...result.scenarios.map((item) => `${item.better} ${item.watch}`),
    ].join(' ');

    assert.doesNotMatch(combined, /대운|세운|월운/);
    assert.match(combined, /확인|조율|진행|정리|시작/);
  }
});

test('today fortune free result keeps grounding public and action-oriented', () => {
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);
  const result = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'relationship_conflict',
    sourceSessionId: 'sample-reading',
    calendarType: 'solar',
    timeRule: 'standard',
  });

  assert.ok(result.groundingSummary.primaryConcept.length > 0);
  assert.ok(result.groundingSummary.factLines.length >= 3);
  assert.ok(result.groundingSummary.evidenceLines.length >= 2);
  assert.match(result.reasonSnippet.body, /오늘|먼저|챙기|말|정리|기준/);
  assert.doesNotMatch(result.reasonSnippet.body, /강약|격국|용신|대운|세운|월운|기운|공식 달력/);
  assert.doesNotMatch(result.reasonSnippet.body, /중화은/);
  assert.doesNotMatch(result.reasonSnippet.body, /66점로/);
  assert.doesNotMatch(result.groundingSummary.factLines.join(' '), /[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]|\([가-힣]+\)\([가-힣]+\)/);
  assert.doesNotMatch(result.groundingSummary.evidenceLines.join(' '), /을\(를\)|강약|격국|용신|공망|신살/);
});

test('today fortune free result changes visible copy for different birth data', () => {
  const firstInput = createSampleInput();
  const secondInput = createSampleInput({
    year: '1977',
    month: '4',
    day: '25',
    hour: '8',
    minute: '45',
    gender: 'female',
  });
  const firstData = calculateSajuDataV1(firstInput);
  const secondData = calculateSajuDataV1(secondInput);
  const firstResult = buildTodayFortuneFreeResult(firstInput, firstData, {
    concernId: 'general',
    sourceSessionId: 'first-reading',
    calendarType: 'solar',
    timeRule: 'standard',
  });
  const secondResult = buildTodayFortuneFreeResult(secondInput, secondData, {
    concernId: 'general',
    sourceSessionId: 'second-reading',
    calendarType: 'solar',
    timeRule: 'standard',
  });

  assert.notEqual(firstResult.oneLine.headline, secondResult.oneLine.headline);
  assert.notEqual(firstResult.reasonSnippet.body, secondResult.reasonSnippet.body);
  assert.notDeepEqual(
    firstResult.scores.map((score) => score.summary),
    secondResult.scores.map((score) => score.summary)
  );
});

test('today fortune one-line body does not repeat the same grounding sentence twice', () => {
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);
  const result = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'money_spend',
    sourceSessionId: 'sample-reading',
    calendarType: 'solar',
    timeRule: 'standard',
  });

  assert.doesNotMatch(result.oneLine.body, /용신 메모:/);
  assert.doesNotMatch(result.oneLine.body, /보완 후보로 봅니다/);
});

test('today fortune relationship one-line body does not repeat the same 합충 snippet twice', () => {
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);
  const result = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'relationship_conflict',
    sourceSessionId: 'sample-reading',
    calendarType: 'solar',
    timeRule: 'standard',
  });

  const needle = '관계와 이동의 압력이 함께 들어옵니다.';
  const count = result.oneLine.body.split(needle).length - 1;

  assert.ok(count <= 1);
});

test('today fortune time windows vary their body copy across different ranges', () => {
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input, { calculatedAt: '2026-04-27T12:00:00+09:00' });
  const result = buildTodayFortunePremiumResult(input, sajuData, 'relationship_conflict');

  assert.equal(result.favorableWindows.length, 2);
  assert.equal(result.cautionWindows.length, 2);
  assert.ok(result.favorableWindows.every((item) => !/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]시/.test(item.title)));
  assert.ok(result.cautionWindows.every((item) => !/[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]시/.test(item.title)));
  assert.ok(result.favorableWindows.every((item) => item.title.includes('·')));
  assert.ok(result.cautionWindows.every((item) => item.title.includes('·')));
  assert.notEqual(result.favorableWindows[0]?.range, result.favorableWindows[1]?.range);
  assert.notEqual(result.cautionWindows[0]?.range, result.cautionWindows[1]?.range);
  assert.notEqual(result.favorableWindows[0]?.body, result.favorableWindows[1]?.body);
  assert.notEqual(result.cautionWindows[0]?.body, result.cautionWindows[1]?.body);
});

test('today fortune opportunity and risk copy stays concise and grounded', () => {
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);
  const result = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'money_spend',
    sourceSessionId: 'sample-reading',
    calendarType: 'solar',
    timeRule: 'standard',
  });

  assert.notEqual(result.opportunity.title, result.risk.title);
  assert.doesNotMatch(result.opportunity.body, /^[^.!?]+점 기준입니다\./);
  assert.doesNotMatch(result.risk.body, /^[^.!?]+점 기준입니다\./);
  assert.doesNotMatch(`${result.opportunity.body} ${result.risk.body}`, /대운|세운|월운|용신|격국|기운/);
  assert.match(result.opportunity.body, /확인|챙길|끝내|정리|보내|적어/);
  assert.match(result.risk.body, /피|미루|줄이|확인/);
});
