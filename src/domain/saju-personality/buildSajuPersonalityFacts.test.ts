import assert from 'node:assert/strict';
import { buildSajuPersonalityFacts } from '@/domain/saju-personality';
import type { SajuDataV1 } from '@/domain/saju/engine/saju-data-v1';
import type { PersonalityCheckAnswer } from '@/domain/personality';

declare const test: (name: string, fn: () => void) => void;

const enfjLikeAnswers: PersonalityCheckAnswer[] = [
  { questionId: 'energy-after-meeting', value: 'talk-reset' },
  { questionId: 'conversation-start', value: 'open-first' },
  { questionId: 'information-focus', value: 'meaning-next' },
  { questionId: 'advice-style', value: 'bigger-direction' },
  { questionId: 'decision-standard', value: 'heart-standard' },
  { questionId: 'conflict-response', value: 'check-feeling' },
  { questionId: 'schedule-comfort', value: 'planned' },
  { questionId: 'unfinished-task', value: 'finish-first' },
];

const mockChart = {
  schemaVersion: 'saju-data/v1',
  input: {
    calendar: 'solar',
    timezone: 'Asia/Seoul',
    location: null,
    birth: {
      year: 1991,
      month: 3,
      day: 12,
      hour: null,
      minute: null,
    },
    gender: 'female',
    hourKnown: false,
  },
  metadata: {
    source: 'legacy-typescript',
    engineVersion: 'test-engine',
    ruleSetVersion: 'moonlight-rules/v1',
    calculatedAt: '2026-05-11T00:00:00.000Z',
    completeness: 'complete',
    pendingSections: [],
  },
  pillars: {
    year: {
      stem: '辛',
      branch: '未',
      ganzi: '辛未',
      stemElement: '금',
      branchElement: '토',
      yinYang: '음',
      stemTenGod: null,
      hiddenStems: [],
    },
    month: {
      stem: '辛',
      branch: '卯',
      ganzi: '辛卯',
      stemElement: '금',
      branchElement: '목',
      yinYang: '음',
      stemTenGod: null,
      hiddenStems: [],
    },
    day: {
      stem: '甲',
      branch: '子',
      ganzi: '甲子',
      stemElement: '목',
      branchElement: '수',
      yinYang: '양',
      stemTenGod: null,
      hiddenStems: [],
    },
    hour: null,
  },
  dayMaster: {
    stem: '甲',
    element: '목',
    yinYang: '양',
    metaphor: '큰 나무',
    description: '곧게 자라는 큰 나무처럼 방향을 세우는 기질입니다.',
  },
  fiveElements: {
    byElement: {
      목: { count: 3, score: 3.2, percentage: 34, state: 'strong' },
      화: { count: 1, score: 1, percentage: 11, state: 'balanced' },
      토: { count: 2, score: 2, percentage: 22, state: 'balanced' },
      금: { count: 1, score: 0.8, percentage: 9, state: 'weak' },
      수: { count: 2, score: 2.2, percentage: 24, state: 'balanced' },
    },
    dominant: '목',
    weakest: '금',
    totalCount: 9,
    totalScore: 9.2,
  },
  tenGods: null,
  strength: {
    level: '중화',
    score: 54,
    rationale: ['목 기운이 선명하지만 전체 흐름은 한쪽으로 크게 치우치지 않습니다.'],
  },
  pattern: null,
  yongsin: {
    primary: { type: 'element', value: '수', label: '수' },
    secondary: [{ type: 'element', value: '화', label: '화' }],
    kiyshin: [{ type: 'element', value: '금', label: '금' }],
    method: '조후용신',
    rationale: [],
    plainSummary: '생각을 식히고 흐름을 부드럽게 만드는 단서가 도움이 됩니다.',
    technicalSummary: '',
  },
  majorLuck: null,
  currentLuck: {
    currentMajorLuck: null,
    saewoon: {
      ganzi: '丙午',
      year: 2026,
      month: null,
      notes: ['올해는 표현과 실행의 온도를 조절하는 흐름을 참고합니다.'],
    },
    wolwoon: null,
  },
  extensions: null,
} as SajuDataV1;

test('buildSajuPersonalityFacts extracts personal facts from an existing saju chart', () => {
  const result = buildSajuPersonalityFacts({
    saju: mockChart,
    personalityProfile: {
      typeCode: 'ENFJ',
      source: 'self_reported',
      confidence: 0.82,
    },
    lifeArea: 'work',
  });

  assert.equal(result.sajuFacts.dayMaster, '甲');
  assert.deepEqual(result.sajuFacts.primaryElements?.slice(0, 2), ['목', '수']);
  assert.ok(result.sajuFacts.cautionSignals?.some((signal) => signal.key === 'saju:unknown-hour'));
  assert.equal(result.personalityFacts.typeCode, 'ENFJ');
  assert.equal(result.fusionFacts.lifeArea, 'work');
  assert.equal(result.fusionFacts.executionPattern.key, 'executionPattern');
  assert.match(result.fusionFacts.growthPattern.summary, /일/);
});

test('buildSajuPersonalityFacts can infer personality facts from the 8-question check', () => {
  const result = buildSajuPersonalityFacts({
    saju: mockChart,
    personalityProfile: {
      answers: enfjLikeAnswers,
    },
    lifeArea: 'relationships',
  });

  assert.equal(result.personalityFacts.typeCode, 'ENFJ');
  assert.equal(result.personalityFacts.source, 'moonlight_check');
  assert.deepEqual(result.personalityFacts.axisScores, {
    IE: 3,
    SN: 3,
    TF: 3,
    JP: -3,
  });
  assert.equal(result.fusionFacts.relationshipPattern.key, 'relationshipPattern');
  assert.ok(result.fusionFacts.relationshipPattern.signals.length > 0);
});

test('buildSajuPersonalityFacts accepts prebuilt facts without using compatibility facts', () => {
  const result = buildSajuPersonalityFacts({
    saju: {
      dayMaster: '丁',
      primaryElements: ['화'],
      strengthSignals: [
        {
          key: 'saju:day-master',
          label: '일간 丁',
          description: '작은 불씨처럼 집중하는 결입니다.',
          source: 'saju',
          confidence: 0.8,
        },
      ],
      cautionSignals: [],
    },
    personalityProfile: {
      typeCode: 'ISTJ',
      source: 'self_reported',
      confidence: 0.7,
      axisScores: {
        IE: -2,
        SN: -1,
        TF: -2,
        JP: -1,
      },
    },
    lifeArea: 'today',
  });

  assert.equal(result.fusionFacts.energyPattern.key, 'energyPattern');
  assert.equal(result.fusionFacts.expressionPattern.key, 'expressionPattern');
  assert.equal(result.fusionFacts.decisionPattern.key, 'decisionPattern');
  assert.equal(result.fusionFacts.executionPattern.key, 'executionPattern');
  assert.equal(result.fusionFacts.relationshipPattern.key, 'relationshipPattern');
  assert.equal(result.fusionFacts.growthPattern.key, 'growthPattern');
  assert.equal(result.fusionFacts.cautionPattern.key, 'cautionPattern');
  assert.equal('relationshipType' in result.fusionFacts, false);
});
