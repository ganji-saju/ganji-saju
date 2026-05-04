import assert from 'node:assert/strict';
import { normalizeToSajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import {
  FOCUS_TOPIC_OPTIONS,
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

  assert.match(report.dayMasterSummary, /타고난 기질/);
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

test('summary and action copy now reference computed evidence instead of generic prose only', () => {
  const data = normalizeToSajuDataV1(birthInput, null);
  const report = buildSajuReport(birthInput, data, 'today');
  const combined = [report.summaryHighlights.join(' '), report.primaryAction.description, report.cautionAction.description].join(' ');

  assert.match(combined, /중화|火 \(화\)|묶이거나 부딪히는/);
});
