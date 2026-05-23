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

// 2026-05-23 Fix B 회귀 가드 — 추상 오행 단서(표현/기준/생각/새 시작/정리)를
//   "쓰면/살린 …" 처럼 배치형 목적어로 넣어 어색했던 템플릿을 "…쪽" 강점/측면
//   표현으로 자연화. 어느 단서가 와도 "쪽" 으로 자연스럽게 읽혀야 한다.
test('Fix B: 재물·직장·관계 액션이 추상 단서를 "쪽" 강점으로 자연스럽게 서술한다', () => {
  // 입력별 supportLabel(오행 단서)이 달라지므로 5개 오행 단서 후보를 모두 커버하는
  //   대표 입력 몇 개로 "쪽" 패턴과 어색한 옛 문구 부재를 검증.
  const inputs: BirthInput[] = [
    { year: 1982, month: 1, day: 29, hour: 8, gender: 'male' },
    { year: 1990, month: 7, day: 15, hour: 14, gender: 'female' },
    { year: 1975, month: 11, day: 3, hour: 22, gender: 'male' },
  ];

  for (const input of inputs) {
    const data = normalizeToSajuDataV1(input, null);
    const wealth = buildSajuReport(input, data, 'wealth').primaryAction.description;
    const career = buildSajuReport(input, data, 'career').primaryAction.description;
    const relationship = buildSajuReport(input, data, 'relationship').primaryAction.description;

    // 새 자연화 패턴: "… 쪽 강점", "… 쪽을 업무에", "… 쪽을 살린"
    assert.match(wealth, /쪽 강점이 살아날수록 돈의 흐름이 안정됩니다/);
    assert.match(career, /쪽을 업무에 살리면 일의 순서가 또렷해집니다/);
    assert.match(relationship, /관계는 .*쪽을 살린 짧은 확인이 좋습니다/);

    // 옛 어색한 배치형 목적어 표현은 완전히 사라져야 한다.
    for (const text of [wealth, career, relationship]) {
      assert.doesNotMatch(text, /돈의 흐름에 쓰면/);
      assert.doesNotMatch(text, /업무에 쓰면/);
      // 옛 패턴은 단서 바로 뒤에 "을/를 살린" (쪽 없이) — "쪽을 살린" 은 새 패턴이라 OK.
      assert.doesNotMatch(text, /(?<!쪽)[을를] 살린 짧은 확인/u);
    }
  }
});

test('summary and action copy now reference computed evidence instead of generic prose only', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const combined = [report.summaryHighlights.join(' '), report.primaryAction.description, report.cautionAction.description].join(' ');

  assert.match(combined, /새 시작|표현|정리|기준|생각|관계|돈|업무|말/);
  assert.doesNotMatch(combined, /점 기준입니다|강약|격국|용신|합충|공망|신살/);
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
