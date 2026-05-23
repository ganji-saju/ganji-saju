import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  FOCUS_TOPIC_OPTIONS,
  buildPunchReading,
  buildSajuReport,
  normalizeFocusTopic,
} from '@/domain/saju/report';
import type { BirthInput } from '@/lib/saju/types';

declare const test: (name: string, fn: () => void) => void;

const birthInput: BirthInput = {
  year: 1982,
  month: 1,
  day: 29,
  hour: 8,
  gender: 'male',
};

test('report topic options include relationship as a first-class tab', () => {
  assert.deepEqual(
    FOCUS_TOPIC_OPTIONS.map((option) => option.key),
    ['today', 'love', 'wealth', 'career', 'relationship']
  );
});

test('normalizeFocusTopic falls back to today for unknown topics', () => {
  assert.equal(normalizeFocusTopic('relationship'), 'relationship');
  assert.equal(normalizeFocusTopic('unknown-topic'), 'today');
  assert.equal(normalizeFocusTopic(), 'today');
});

test('each report topic maps to its matching focused score key', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const expected = {
    today: 'overall',
    love: 'love',
    wealth: 'wealth',
    career: 'career',
    relationship: 'relationship',
  } as const;

  for (const [topic, scoreKey] of Object.entries(expected)) {
    const report = buildSajuReport(birthInput, data, topic);

    assert.equal(report.focusTopic, topic);
    assert.equal(report.focusScoreKey, scoreKey);
    assert.ok(report.scores.some((score) => score.key === scoreKey));
  }
});

test('relationship topic uses relationship-specific copy instead of love copy', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'relationship');

  assert.equal(report.focusLabel, '관계');
  assert.match(report.primaryAction.title, /관계/);
  assert.match(report.cautionAction.title, /관계/);
  assert.ok(report.summaryHighlights.some((summary) => /관계|거리감|말의 순서/.test(summary)));
});

test('day master summary is separated from topic highlight cards', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'love');

  // 2026-05-16 — PR 47e533a 에서 "타고난 기질" → "내 핵심 기질" 로 친근화됐는데
  //   테스트가 이전 라벨로 남아 CI 가 계속 실패하던 회귀. 현재 라벨에 맞춰 보정.
  assert.match(report.dayMasterSummary, /핵심 기질/);
  assert.ok(report.summary.includes(report.dayMasterSummary));
  assert.ok(report.summaryHighlights.every((summary) => !summary.startsWith(report.dayMasterSummary)));
});

test('evidence cards expose computed facts, source, confidence, and topic mapping', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');

  assert.ok(report.evidenceCards.length >= 6);
  assert.ok(
    report.evidenceCards.every((card) => {
      return (
        card.computed.dayMaster === data.dayMaster.stem &&
        card.source.length > 0 &&
        ['확정', '보통', '참고'].includes(card.confidence) &&
        card.topicMapping.length > 0
      );
    })
  );

  const relationCard = report.evidenceCards.find((card) => card.key === 'relations');
  assert.ok(relationCard?.topicMapping.includes('relationship'));
  assert.ok(relationCard?.source.includes('orrery-reference'));
});

test('yongsin evidence card keeps technical memo out of the main reading flow', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const yongsinCard = report.evidenceCards.find((card) => card.key === 'yongsin');

  assert.ok(yongsinCard);
  assert.doesNotMatch(yongsinCard.body, /메모:/);
  assert.doesNotMatch(yongsinCard.plainSummary ?? '', /메모:/);
  assert.ok(yongsinCard.body.length > 0);
  assert.ok(yongsinCard.explainers?.some((item) => item.meaning.length > 0));
  assert.ok((yongsinCard.practicalActions?.length ?? 0) >= 2);
  assert.ok(yongsinCard.details.some((detail) => detail.includes('후보')));
});

test('core evidence cards keep user-facing body, explainers, and practical actions', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const targetKeys = ['strength', 'pattern', 'relations', 'gongmang', 'specialSals'] as const;

  for (const key of targetKeys) {
    const card = report.evidenceCards.find((item) => item.key === key);

    assert.ok(card, `${key} card should exist`);
    assert.ok(card.body.length > 0, `${key} should have a readable body`);
    assert.doesNotMatch(card.body, /메모:/, `${key} should not expose memo labels`);
    assert.ok((card.explainers?.length ?? 0) > 0, `${key} should keep optional explainers`);
    assert.ok((card.practicalActions?.length ?? 0) > 0, `${key} should include practical actions`);
  }
});

test('timeline gives monthly and major luck as interpreted guidance', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const monthly = report.timeline.find((item) => item.label === '이번 달');
  const major = report.timeline.find((item) => item.label === '대운 흐름');

  assert.ok(monthly, 'monthly timeline item should exist');
  assert.ok(major, 'major luck timeline item should exist');
  assert.match(monthly.body, /이번 달|흐름/);
  assert.ok((monthly.points?.length ?? 0) >= 2);
  assert.match(major.body, /긴 흐름|구간/);
  assert.ok((major.points?.length ?? 0) >= 2);
});

test('focus actions change by selected topic', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const reports = FOCUS_TOPIC_OPTIONS.map((option) => buildSajuReport(birthInput, data, option.key));
  const actionBodies = new Set(
    reports.map((report) => `${report.focusTopic}:${report.primaryAction.description}:${report.cautionAction.description}`)
  );

  assert.equal(actionBodies.size, FOCUS_TOPIC_OPTIONS.length);
  assert.match(buildSajuReport(birthInput, data, 'love').primaryAction.description, /연애|상대|표현/);
  assert.match(buildSajuReport(birthInput, data, 'wealth').primaryAction.description, /정산|고정비|금액/);
  assert.match(buildSajuReport(birthInput, data, 'career').primaryAction.description, /직장|보고|업무|성과/);
  assert.match(buildSajuReport(birthInput, data, 'relationship').primaryAction.description, /관계|말의 순서|확인/);
});

// 2026-05-23 오행 단서 → "X 기운" 표준 교체 회귀 가드 (naming-policy §2).
//   추상 단서(표현/기준/생각/새 시작/정리) + "…쪽" 자연화 패턴을 폐기하고,
//   사이트 표준 "목/화/토/금/수 기운"으로 일관 표기. 어느 기운이 와도 "X 기운"이
//   조사와 자연스럽게 붙고("기운이/기운을"), 추상 단서나 잉여 "쪽"이 없어야 한다.
test('오행 단서가 표준 "X 기운"으로 자연스럽게 서술된다 (재물·직장·관계 액션)', () => {
  // 입력별 supportLabel(우세/보강 기운)이 달라지므로 오행 후보를 두루 커버하는
  //   대표 입력 몇 개로 "X 기운" 패턴과 옛 추상 단서·잉여 "쪽" 부재를 검증.
  const inputs: BirthInput[] = [
    { year: 1982, month: 1, day: 29, hour: 8, gender: 'male' },
    { year: 1990, month: 7, day: 15, hour: 14, gender: 'female' },
    { year: 1975, month: 11, day: 3, hour: 22, gender: 'male' },
  ];

  const GIUN = /[목화토금수] 기운/u;

  for (const input of inputs) {
    const data = normalizeToSajuDataV1(input, null);
    const wealth = buildSajuReport(input, data, 'wealth').primaryAction.description;
    const career = buildSajuReport(input, data, 'career').primaryAction.description;
    const relationship = buildSajuReport(input, data, 'relationship').primaryAction.description;

    // 새 표준 패턴: "X 기운이 살아날수록", "X 기운을 업무에", "X 기운을 살린".
    assert.match(wealth, /[목화토금수] 기운이 살아날수록 돈의 흐름이 안정됩니다/u);
    assert.match(career, /[목화토금수] 기운을 업무에 살리면 일의 순서가 또렷해집니다/u);
    assert.match(relationship, /관계는 [목화토금수] 기운을 살린 짧은 확인이 좋습니다/u);

    for (const text of [wealth, career, relationship]) {
      // 본문에 "X 기운" 표준 표기가 실제로 등장해야 한다.
      assert.match(text, GIUN);
      // 옛 추상 단서를 오행 대체어로 쓰던 어색한 배치형 목적어는 사라져야 한다.
      assert.doesNotMatch(text, /돈의 흐름에 쓰면/);
      assert.doesNotMatch(text, /업무에 쓰면/);
      // 단서 뒤 잉여 "쪽"(예: "기준 쪽", "표현 쪽") 패턴 부재.
      assert.doesNotMatch(text, /기운 쪽/u);
      // "목의 기운" 형(조사 의)·추상명사화 단서 금지.
      assert.doesNotMatch(text, /[목화토금수]의\s*기운/u);
    }
  }
});

test('summary and action copy now reference computed evidence instead of generic prose only', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const combined = [report.summaryHighlights.join(' '), report.primaryAction.description, report.cautionAction.description].join(' ');

  // 오행은 표준 "X 기운" 표기를 쓴다 (naming-policy §2).
  assert.match(combined, /[목화토금수] 기운/u);
  assert.doesNotMatch(combined, /점 기준입니다|강약|격국|용신|합충|공망|신살/);
});

// 2026-05-23 naming-policy §2 회귀 가드 — 오행 풀이 전반에서 추상 단서·금지형 부재.
//   토픽 본문(요약·액션·인사이트·타임라인)을 합쳐 "X 기운"이 등장하고, 옛 추상
//   단서(정리/기준/표현/생각/새 시작)를 오행 대체어로 쓰던 흔적("정리를"·"기준을"
//   ·"표현을" 단독 목적어)·"목의 기운" 형이 없어야 한다.
test('오행 풀이는 "X 기운" 표준만 쓰고 추상 단서·금지형이 없다', () => {
  const inputs: BirthInput[] = [
    { year: 1982, month: 1, day: 29, hour: 8, gender: 'male' },
    { year: 1990, month: 7, day: 15, hour: 14, gender: 'female' },
    { year: 1975, month: 11, day: 3, hour: 22, gender: 'male' },
  ];

  for (const input of inputs) {
    const data = normalizeToSajuDataV1(input, null);
    for (const topic of FOCUS_TOPIC_OPTIONS.map((option) => option.key)) {
      const report = buildSajuReport(input, data, topic);
      const text = [
        report.headline,
        report.summaryHighlights.join(' '),
        report.primaryAction.description,
        report.cautionAction.description,
        report.insights.map((insight) => `${insight.title} ${insight.body}`).join(' '),
        report.timeline.map((item) => `${item.headline} ${item.body}`).join(' '),
        report.scores.map((score) => score.summary).join(' '),
      ].join(' ');

      // 표준 "X 기운" 표기가 본문에 등장.
      assert.match(text, /[목화토금수] 기운/u, `${topic}: "X 기운" 표기 부재`);
      // "목의 기운" 형(조사 의) 금지.
      assert.doesNotMatch(text, /[목화토금수]의\s*기운/u, `${topic}: "X의 기운" 금지형`);
      // 옛 추상 단서를 오행 대체어로 쓰던 어색한 표현 부재.
      assert.doesNotMatch(text, /정리를 돈의 흐름에/u, `${topic}: 옛 "정리를 …" 잔존`);
      assert.doesNotMatch(text, /[목화토금수]?\s*기운 쪽/u, `${topic}: 잉여 "기운 쪽"`);
      // 추상명사화(표현의 기운/생각의 기운 등) 금지 — naming-policy §3.
      assert.doesNotMatch(text, /(표현|생각|절제|직관|돌봄)의\s*기운/u, `${topic}: 십성 추상명사화`);
    }
  }
});

test('free punch and score summaries change across different saju inputs', () => {
  const firstData = normalizeToSajuDataV1(birthInput, null);
  const secondInput: BirthInput = {
    year: 1977,
    month: 6,
    day: 11,
    hour: 23,
    gender: 'female',
  };
  const secondData = normalizeToSajuDataV1(secondInput, null);
  const firstReport = buildSajuReport(birthInput, firstData, 'today');
  const secondReport = buildSajuReport(secondInput, secondData, 'today');

  assert.notEqual(firstReport.headline, secondReport.headline);
  assert.notDeepEqual(
    firstReport.scores.map((score) => score.summary),
    secondReport.scores.map((score) => score.summary)
  );
  assert.notEqual(
    buildPunchReading(firstReport).verdict,
    buildPunchReading(secondReport).verdict
  );
});
