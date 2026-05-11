import assert from 'node:assert/strict';
import {
  calculatePersonalityAxisScores,
  estimatePersonalityType,
  getAxisCommunicationRules,
  getPersonalityTypeProfile,
  isPersonalityTypeCode,
  PERSONALITY_SELF_CHECK_QUESTIONS,
} from '@/domain/personality';
import type { PersonalityCheckAnswer } from './personality.types';

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

test('personality self check has exactly two questions for each axis', () => {
  assert.equal(PERSONALITY_SELF_CHECK_QUESTIONS.length, 8);

  const axisCounts = PERSONALITY_SELF_CHECK_QUESTIONS.reduce<Record<string, number>>(
    (counts, question) => {
      counts[question.axis] = (counts[question.axis] ?? 0) + 1;
      return counts;
    },
    {}
  );

  assert.deepEqual(axisCounts, {
    IE: 2,
    SN: 2,
    TF: 2,
    JP: 2,
  });
});

test('estimatePersonalityType returns type code, confidence, and missing question IDs', () => {
  const result = estimatePersonalityType(enfjLikeAnswers);

  assert.equal(result.typeCode, 'ENFJ');
  assert.equal(result.answeredCount, 8);
  assert.deepEqual(result.missingQuestionIds, []);
  assert.ok(result.confidence >= 0.9);
  assert.deepEqual(result.axisScores, {
    IE: 3,
    SN: 3,
    TF: 3,
    JP: -3,
  });
});

test('estimatePersonalityType ignores unknown answers and lowers confidence', () => {
  const result = estimatePersonalityType([
    { questionId: 'energy-after-meeting', value: 'quiet-reset' },
    { questionId: 'unknown', value: 'talk-reset' },
    { questionId: 'decision-standard', value: 'not-real' },
  ]);

  assert.equal(result.answeredCount, 1);
  assert.ok(result.missingQuestionIds.includes('conversation-start'));
  assert.ok(result.confidence < 0.55);
});

test('personality profile lookup stays simple and non-diagnostic', () => {
  assert.equal(isPersonalityTypeCode('ENFJ'), true);
  assert.equal(isPersonalityTypeCode('ABCD'), false);

  const profile = getPersonalityTypeProfile('ENFJ');
  assert.match(profile.title, /이끄는형/);
  assert.doesNotMatch(
    `${profile.title} ${profile.communicationStyle} ${profile.relationshipHint} ${profile.caution}`,
    /공식|검사|진단/
  );
});

test('communication rules expose both poles for each axis', () => {
  const [thinking, feeling] = getAxisCommunicationRules('TF');

  assert.equal(thinking.pole, 'T');
  assert.equal(feeling.pole, 'F');
  assert.match(feeling.prefers, /마음|관계|배려/);
});

test('calculatePersonalityAxisScores can be used independently', () => {
  assert.deepEqual(calculatePersonalityAxisScores(enfjLikeAnswers), {
    IE: 3,
    SN: 3,
    TF: 3,
    JP: -3,
  });
});
