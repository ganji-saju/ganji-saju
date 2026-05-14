import assert from 'node:assert/strict';
import { calculateSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import { buildSajuReport } from '@/domain/saju/report';
import {
  getTopicInterpretationRule,
  selectEvidenceCard,
} from '@/domain/saju/report/interpretation-rule-table';
import { parseBirthInputDraft } from '@/domain/saju/validators/birth-input';
import { resolveUnifiedBirthInput } from '@/lib/saju/unified-birth-entry';
import {
  buildTodayFortuneFreeResult,
  buildTodayFortunePremiumResult,
} from './build-today-fortune';
import type {
  TodayCalendarType,
  TodayTimeRule,
} from '@/lib/today-fortune/types';

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

function createUnifiedSample(
  overrides: Partial<{
    calendarType: TodayCalendarType;
    timeRule: TodayTimeRule;
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    gender: string;
    birthLocationCode: string;
    birthLocationLabel: string;
    birthLatitude: string;
    birthLongitude: string;
  }> = {}
) {
  const draft = {
    calendarType: 'solar' as TodayCalendarType,
    timeRule: 'standard' as TodayTimeRule,
    year: '1982',
    month: '1',
    day: '29',
    hour: '8',
    minute: '45',
    unknownBirthTime: false,
    gender: 'male',
    birthLocationCode: 'custom',
    birthLocationLabel: '서울특별시',
    birthLatitude: '37.5665',
    birthLongitude: '126.9780',
    ...overrides,
  };
  const parsed = resolveUnifiedBirthInput(draft, { requireGender: false });

  if (!parsed.ok) {
    throw new Error(`unified sample birth input should be valid: ${parsed.error}`);
  }

  return {
    input: parsed.input,
    calendarType: draft.calendarType,
    timeRule: draft.timeRule,
  };
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

test('today fortune free result reflects time calendar and location differences in visible copy', () => {
  const first = createUnifiedSample();
  const second = createUnifiedSample({
    calendarType: 'lunar',
    timeRule: 'trueSolarTime',
    hour: '22',
    minute: '10',
    gender: 'female',
    birthLocationLabel: '부산광역시',
    birthLatitude: '35.1796',
    birthLongitude: '129.0756',
  });
  const firstData = calculateSajuDataV1(first.input);
  const secondData = calculateSajuDataV1(second.input);
  const firstResult = buildTodayFortuneFreeResult(first.input, firstData, {
    concernId: 'general',
    sourceSessionId: 'solar-seoul-morning',
    calendarType: first.calendarType,
    timeRule: first.timeRule,
  });
  const secondResult = buildTodayFortuneFreeResult(second.input, secondData, {
    concernId: 'general',
    sourceSessionId: 'lunar-busan-night',
    calendarType: second.calendarType,
    timeRule: second.timeRule,
  });

  assert.notEqual(firstResult.oneLine.body, secondResult.oneLine.body);
  assert.notEqual(firstResult.opportunity.body, secondResult.opportunity.body);
  assert.notEqual(firstResult.risk.body, secondResult.risk.body);
  assert.notEqual(
    firstResult.groundingSummary.factLines.join(' / '),
    secondResult.groundingSummary.factLines.join(' / ')
  );
  assert.match(secondResult.oneLine.body, /음력|부산|출생지|시간|밤|저녁/);
});

test('today fortune public labels use natural Korean particles', () => {
  const samples = [
    createUnifiedSample({ year: '1982', month: '1', day: '29', hour: '8', minute: '45' }),
    createUnifiedSample({ year: '1977', month: '4', day: '25', hour: '22', minute: '10' }),
    createUnifiedSample({ year: '1995', month: '6', day: '15', hour: '13', minute: '30' }),
    createUnifiedSample({ year: '2001', month: '11', day: '7', hour: '2', minute: '5' }),
  ];
  const combined = samples
    .map((sample) => {
      const sajuData = calculateSajuDataV1(sample.input);
      const result = buildTodayFortuneFreeResult(sample.input, sajuData, {
        concernId: 'general',
        sourceSessionId: `particle-${sample.input.year}-${sample.input.month}-${sample.input.day}`,
        calendarType: sample.calendarType,
        timeRule: sample.timeRule,
      });

      return [
        result.oneLine.headline,
        result.oneLine.body,
        result.reasonSnippet.body,
        result.opportunity.title,
        result.opportunity.body,
        result.risk.title,
        result.risk.body,
        ...result.scores.map((score) => score.summary),
        ...result.groundingSummary.evidenceLines,
      ].join(' ');
    })
    .join(' ');

  assert.doesNotMatch(
    combined,
    /정리을|정리이|표현를|표현가|시작를|시작가|기준를|기준가|생각를|생각가/
  );
  assert.doesNotMatch(combined, /정돈형|생각형|점검형|준비형|연락형|집중형|조율형|확인형|마무리형|휴식형/);
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

test('today fortune free result changes across different calendar dates (daily seed regression)', () => {
  // 2026-05-15: 같은 사용자 + 같은 concern 인데 며칠째 동일 점수/카피가 나오던 버그 회귀 방지.
  // calculatedAt 만 바꿔도 시드(signatureSeed)와 점수(dailyDelta)가 흔들려 결과가 달라져야 한다.
  const input = createSampleInput();
  const dataMonday = calculateSajuDataV1(input, { calculatedAt: '2026-05-11T09:00:00+09:00' });
  const dataFriday = calculateSajuDataV1(input, { calculatedAt: '2026-05-15T09:00:00+09:00' });

  const mondayResult = buildTodayFortuneFreeResult(input, dataMonday, {
    concernId: 'general',
    sourceSessionId: 'daily-seed-mon',
    calendarType: 'solar',
    timeRule: 'standard',
  });
  const fridayResult = buildTodayFortuneFreeResult(input, dataFriday, {
    concernId: 'general',
    sourceSessionId: 'daily-seed-fri',
    calendarType: 'solar',
    timeRule: 'standard',
  });

  assert.equal(mondayResult.dateKey, '2026-05-11');
  assert.equal(fridayResult.dateKey, '2026-05-15');
  // 두 결과 중 하나는 반드시 달라야 한다 (headline 후보 3종 / score delta 합쳐 동률 확률 매우 낮음).
  const sameHeadline = mondayResult.oneLine.headline === fridayResult.oneLine.headline;
  const sameScores =
    JSON.stringify(mondayResult.scores.map((s) => s.score)) ===
    JSON.stringify(fridayResult.scores.map((s) => s.score));
  const sameReason = mondayResult.reasonSnippet.body === fridayResult.reasonSnippet.body;
  assert.ok(
    !sameHeadline || !sameScores || !sameReason,
    `오늘운세가 다른 날짜에 완전히 동일하게 나오면 안 됩니다. headline=${sameHeadline}, scores=${sameScores}, reason=${sameReason}`
  );
});

test('today fortune free body changes across different calendar dates (daily body variants)', () => {
  // 2026-05-15: 본문(oneLine.body) 이 며칠째 같은 문장으로 나오던 회귀 방지.
  // headline·점수 외에 본문 자체도 일진 시그널 + concernLine variant 로 매일 흐트러져야 한다.
  const input = createSampleInput();
  const dataA = calculateSajuDataV1(input, { calculatedAt: '2026-05-11T09:00:00+09:00' });
  const dataB = calculateSajuDataV1(input, { calculatedAt: '2026-05-15T09:00:00+09:00' });
  const dataC = calculateSajuDataV1(input, { calculatedAt: '2026-05-19T09:00:00+09:00' });

  const bodyA = buildTodayFortuneFreeResult(input, dataA, {
    concernId: 'general',
    sourceSessionId: 'daily-body-a',
    calendarType: 'solar',
    timeRule: 'standard',
  }).oneLine.body;
  const bodyB = buildTodayFortuneFreeResult(input, dataB, {
    concernId: 'general',
    sourceSessionId: 'daily-body-b',
    calendarType: 'solar',
    timeRule: 'standard',
  }).oneLine.body;
  const bodyC = buildTodayFortuneFreeResult(input, dataC, {
    concernId: 'general',
    sourceSessionId: 'daily-body-c',
    calendarType: 'solar',
    timeRule: 'standard',
  }).oneLine.body;

  // 3개 본문이 모두 다른 것까지는 보장하지 않지만, 최소 1쌍은 달라야 한다.
  const uniqueBodies = new Set([bodyA, bodyB, bodyC]);
  assert.ok(
    uniqueBodies.size >= 2,
    `오늘운세 본문이 3일치 모두 동일하면 안 됩니다. bodies=${JSON.stringify(Array.from(uniqueBodies))}`
  );
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
