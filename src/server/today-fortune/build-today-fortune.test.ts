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
// 2026-05-16 PR #183 — 사주 페이지 ↔ 오늘 운세 페이지 6 영역 score 일치 invariant.
import { computeSajuAreaScores } from '@/lib/today-fortune/compute-saju-area-scores';
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

function visibleFreeResultText(result: ReturnType<typeof buildTodayFortuneFreeResult>) {
  return [
    result.oneLine.headline,
    result.oneLine.body,
    result.reasonSnippet.title,
    result.reasonSnippet.body,
    result.opportunity.title,
    result.opportunity.body,
    result.risk.title,
    result.risk.body,
    result.nextAction.copy,
    result.groundingSummary.primaryConcept,
    ...result.groundingSummary.factLines,
    ...result.groundingSummary.evidenceLines,
    ...result.scores.map((score) => `${score.label} ${score.summary}`),
  ].join(' ');
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

test('today fortune free visible copy avoids legacy word choices', () => {
  const { input, calendarType, timeRule } = createUnifiedSample();
  const sajuData = calculateSajuDataV1(input);
  const concerns = [
    'general',
    'love_contact',
    'money_spend',
    'work_meeting',
    'relationship_conflict',
    'energy_health',
  ] as const;

  for (const concernId of concerns) {
    const result = buildTodayFortuneFreeResult(input, sajuData, {
      concernId,
      sourceSessionId: `sample-${concernId}`,
      calendarType,
      timeRule,
      now: new Date('2026-05-27T03:00:00Z'),
    });
    const text = visibleFreeResultText(result);
    assert.doesNotMatch(text, /표현|기준/, `${concernId} legacy word remains: ${text}`);
  }
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
  assert.match(result.reasonSnippet.body, /오늘|먼저|챙기|말|정리|선택|원칙/);
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
    /정리을|정리이|말를|말가|시작를|시작가|원칙를|원칙가|선택를|선택가|생각를|생각가/
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
  // 2026-05-18: getTodayPillarSnapshot 가 stored calculatedAt 이 아닌 실제 "오늘" 을 사용하므로
  //   다른 날 시뮬레이션은 options.now 로 fixed Date 주입 (테스트 전용).
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);

  const mondayResult = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'daily-seed-mon',
    calendarType: 'solar',
    timeRule: 'standard',
    now: new Date('2026-05-11T00:00:00+09:00'),
  });
  const fridayResult = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'daily-seed-fri',
    calendarType: 'solar',
    timeRule: 'standard',
    now: new Date('2026-05-15T00:00:00+09:00'),
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

test('today fortune premium changes across different calendar dates (daily premium regression)', () => {
  // 2026-05-15: 전/550원 결제 후 자세히 보기 화면도 매일 다르게 흐르도록 — 회귀 가드.
  // 2026-05-18: getTodayPillarSnapshot 가 실제 "오늘" 사용 → options.now 로 fixed Date 주입.
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);

  const premA = buildTodayFortunePremiumResult(input, sajuData, 'general', null, null, {
    now: new Date('2026-05-11T00:00:00+09:00'),
  });
  const premB = buildTodayFortunePremiumResult(input, sajuData, 'general', null, null, {
    now: new Date('2026-05-15T00:00:00+09:00'),
  });

  assert.equal(premA.dateKey, '2026-05-11');
  assert.equal(premB.dateKey, '2026-05-15');

  const sameRecommend =
    JSON.stringify(premA.recommendedActions) === JSON.stringify(premB.recommendedActions);
  const sameAvoid = JSON.stringify(premA.avoidActions) === JSON.stringify(premB.avoidActions);
  const sameFav =
    JSON.stringify(premA.favorableWindows.map((w) => w.range)) ===
    JSON.stringify(premB.favorableWindows.map((w) => w.range));
  const sameScenario =
    JSON.stringify(premA.scenarios.map((s) => `${s.better}|${s.watch}`)) ===
    JSON.stringify(premB.scenarios.map((s) => `${s.better}|${s.watch}`));

  assert.ok(
    !sameRecommend || !sameAvoid || !sameFav || !sameScenario,
    `자세히 보기가 다른 날짜에 완전히 동일하면 안 됩니다. recommend=${sameRecommend}, avoid=${sameAvoid}, windows=${sameFav}, scenarios=${sameScenario}`
  );
});

test('today fortune free body changes across different calendar dates (daily body variants)', () => {
  // 2026-05-15: 본문(oneLine.body) 이 며칠째 같은 문장으로 나오던 회귀 방지.
  // 2026-05-18: getTodayPillarSnapshot 가 실제 "오늘" 사용 → options.now 로 fixed Date 주입.
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);

  const bodyA = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'daily-body-a',
    calendarType: 'solar',
    timeRule: 'standard',
    now: new Date('2026-05-11T00:00:00+09:00'),
  }).oneLine.body;
  const bodyB = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'daily-body-b',
    calendarType: 'solar',
    timeRule: 'standard',
    now: new Date('2026-05-15T00:00:00+09:00'),
  }).oneLine.body;
  const bodyC = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'daily-body-c',
    calendarType: 'solar',
    timeRule: 'standard',
    now: new Date('2026-05-19T00:00:00+09:00'),
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

// PR #165/#166 회귀 잠금 — 점수·이름 single source of truth.
// 운영 검증 핵심 invariant: banner(scores.overall) == breakdown 카드(iljinScore.totalScore).
// 영역별 점수는 [48,92] UX clamp 적용을 유지하므로 평균이 target 과 ±1 일치하는 것은
// boundary 에선 약간 어긋날 수 있다 — 사용자 표시면 모순은 없으니 회귀 contract 에 포함하지 않는다.
test('today fortune unifies scores.overall with iljinScore.totalScore (PR #165)', () => {
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);
  const result = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'unify-scores-source',
    calendarType: 'solar',
    timeRule: 'standard',
  });

  // 시간 입력이 있는 샘플이라 iljinScore 가 계산돼야 한다.
  assert.ok(result.iljinScore, 'iljinScore 가 시간 입력 케이스에서 null 이면 안 됩니다');

  const overall = result.scores.find((s) => s.key === 'overall');
  assert.ok(overall, 'overall 점수 카드가 반드시 존재해야 합니다');
  assert.equal(
    overall.score,
    result.iljinScore!.totalScore,
    'scores.overall 은 iljinScore.totalScore 와 같아야 합니다 (single source of truth)'
  );
});

test('today fortune surfaces user-provided name on result.userName (PR #166)', () => {
  const input = createSampleInput();
  const named = { ...input, name: '김영민' };
  const sajuData = calculateSajuDataV1(named);
  const result = buildTodayFortuneFreeResult(named, sajuData, {
    concernId: 'general',
    sourceSessionId: 'username-source',
    calendarType: 'solar',
    timeRule: 'standard',
  });

  assert.equal(result.userName, '김영민');

  const blank = { ...input, name: '   ' };
  const blankResult = buildTodayFortuneFreeResult(blank, sajuData, {
    concernId: 'general',
    sourceSessionId: 'username-blank-source',
    calendarType: 'solar',
    timeRule: 'standard',
  });
  assert.equal(blankResult.userName, null, '공백만 입력된 이름은 null 로 정규화');
});

// 2026-05-16 PR #183 — 사주 메인/상세 페이지의 computeSajuAreaScores 결과가
// 오늘 운세 페이지의 buildTodayFortuneFreeResult.scores 와 6 영역 모두 정확 일치.
//
// 사용자 보고 (#179-#181): "총운 직장운 재물운 연애운 관계운 컨디션 6 항목이
// 3 페이지에서 모두 같은 값". 이 invariant 가 깨지면 사용자 신뢰 폭격.
test('saju area scores match today-fortune free result scores 1:1 (PR #181 invariant)', () => {
  const input = createSampleInput();
  const sajuData = calculateSajuDataV1(input);
  const todayResult = buildTodayFortuneFreeResult(input, sajuData, {
    concernId: 'general',
    sourceSessionId: 'area-invariant-check',
    calendarType: 'solar',
    timeRule: 'standard',
  });
  const sajuAreaScores = computeSajuAreaScores(input, sajuData);

  assert.equal(
    sajuAreaScores.length,
    6,
    '사주 페이지 area scores 는 6 영역 (overall/career/wealth/love/relationship/condition)'
  );

  for (const sajuArea of sajuAreaScores) {
    const matchingToday = todayResult.scores.find((s) => s.key === sajuArea.key);
    assert.ok(
      matchingToday,
      `today-fortune scores 에 '${sajuArea.key}' 키가 있어야 합니다 (사주 페이지와 항목 일치)`
    );
    assert.equal(
      sajuArea.score,
      matchingToday.score,
      `${sajuArea.key}: 사주 페이지=${sajuArea.score}, 오늘 운세=${matchingToday.score} — 두 페이지 점수 정확 일치 필수`
    );
  }
});

// 2026-05-18 — root cause regression test: stored sajuData (saju 페이지) vs fresh
// sajuData (today-fortune POST API) 의 metadata.calculatedAt 차이로 두 페이지의
// "오늘 점수" 가 갈라지는 것을 차단.
//
// 배경 (E2E saju.spec.ts:157 가 KST 자정 후 fail 한 이유):
//   - 사용자가 reading 을 생성하면 sajuData.metadata.calculatedAt = 그 시점 timestamp 로
//     저장된다. 다음날 KST 자정을 넘기면 stored calculatedAt 의 KST 일자 != 오늘 KST 일자.
//   - getTodayPillarSnapshot 이 calculatedAt 을 "오늘" 로 사용하면 stored sajuData (saju
//     페이지) 와 fresh sajuData (today-fortune API) 가 다른 todayPillar → 점수 불일치.
//   - 의도 (코멘트): "매일 다르게 흐르도록 ... 오늘 ganzi" — calculatedAt 이 아닌
//     실제 오늘이 기준이어야 함.
test('computeSajuAreaScores 는 stored sajuData 와 fresh sajuData 에 대해 동일 today 점수 (KST 자정 후 회귀 차단)', () => {
  const input = createSampleInput();

  // fresh sajuData — 방금 만든 것 (today-fortune API 패턴)
  const freshSajuData = calculateSajuDataV1(input);

  // stored sajuData — saved reading 시뮬레이션 (saju 페이지 패턴). calculatedAt 을 과거로.
  const storedSajuData = calculateSajuDataV1(input);
  storedSajuData.metadata = {
    ...storedSajuData.metadata,
    calculatedAt: '2025-01-15T00:00:00.000Z', // 1년+ 전 임의 시점
  };

  const freshScores = computeSajuAreaScores(input, freshSajuData);
  const storedScores = computeSajuAreaScores(input, storedSajuData);

  for (const fresh of freshScores) {
    const stored = storedScores.find((s) => s.key === fresh.key);
    assert.ok(stored, `stored scores 에 ${fresh.key} 존재 필수`);
    assert.equal(
      fresh.score,
      stored.score,
      `${fresh.key}: stored sajuData=${stored.score} (calculatedAt=2025-01-15) vs fresh sajuData=${fresh.score} ` +
        `— 두 sajuData 의 calculatedAt 이 달라도 동일 "오늘" 으로 계산되어야 합니다. ` +
        `(E2E saju.spec.ts:157 root cause regression)`
    );
  }
});
