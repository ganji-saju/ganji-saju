import assert from 'node:assert/strict';
import { hasForbiddenReportPhrase } from '@/domain/compatibility-personality';
import type { PersonalityCompatibilityInputPayload } from './personality-compatibility-input-storage';
import {
  buildPersonalityCompatibilityFreeResult,
  buildPersonalityCompatibilityReportScopeKey,
} from './personality-compatibility-result-builder';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

const SAMPLE_PAYLOAD: PersonalityCompatibilityInputPayload = {
  version: 1,
  relationshipType: 'dating',
  questionKey: 'fit',
  questionLabel: '이 사람과 잘 맞는지',
  self: {
    name: '나',
    birthInput: {
      year: 1994,
      month: 5,
      day: 10,
      unknownTime: true,
      gender: 'female',
    },
    birthSummary: '양력 1994.05.10 · 시간 미입력 · 여성',
    personality: {
      typeCode: 'ENFP',
      source: 'self_reported',
      confidence: 0.65,
    },
  },
  partner: {
    name: '상대',
    birthInput: {
      year: 1992,
      month: 11,
      day: 3,
      unknownTime: true,
      gender: 'male',
    },
    birthSummary: '양력 1992.11.03 · 시간 미입력 · 남성',
    personality: {
      typeCode: 'ISTJ',
      source: 'self_reported',
      confidence: 0.65,
    },
  },
  createdAt: '2026-05-11T00:00:00.000Z',
};

test('personality compatibility free result exposes required preview sections', () => {
  const result = buildPersonalityCompatibilityFreeResult(SAMPLE_PAYLOAD);

  assert.equal(result.score.conflictRiskMeaning, 'higher_means_more_conflict_risk');
  assert.deepEqual(
    result.axisSummaries.map((axis) => axis.label),
    ['끌림', '안정', '소통', '갈등', '회복']
  );
  assert.equal(result.paragraphs.length, 3);
  assert.equal(result.paidSections.length, 5);
  assert.deepEqual(
    result.lockedSections.map((section) => section.title),
    [
      '반복 갈등의 진짜 원인',
      '상대가 부담을 느끼는 말투',
      '오늘 먼저 연락해도 되는지',
      '관계 회복 문장',
      '장기 관계 가능성',
    ]
  );
  assert.ok(result.keywords.length >= 4);

  const visibleCopy = [
    result.headline,
    ...result.axisSummaries.map((axis) => `${axis.label} ${axis.caption}`),
    ...result.keywords,
    ...result.paragraphs,
    ...result.lockedSections.flatMap((section) => [section.title, section.teaser]),
    ...result.paidSections.flatMap((section) => [section.title, section.body]),
    result.safetyNote,
  ].join('\n');

  assert.equal(hasForbiddenReportPhrase(visibleCopy), false);
});

test('personality compatibility report scope is stable without storing names in the key', () => {
  const first = buildPersonalityCompatibilityReportScopeKey(SAMPLE_PAYLOAD);
  const second = buildPersonalityCompatibilityReportScopeKey({
    ...SAMPLE_PAYLOAD,
    self: {
      ...SAMPLE_PAYLOAD.self,
      name: '다른 별명',
    },
    partner: {
      ...SAMPLE_PAYLOAD.partner,
      name: '새 별명',
    },
  });

  assert.match(first, /^personality-compatibility:[a-z0-9]+$/);
  assert.equal(first, second);
});
