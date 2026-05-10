import assert from 'node:assert/strict';
import {
  applyReportGuardrails,
  findForbiddenReportPhrases,
  hasForbiddenReportPhrase,
} from './guardrails';
import { buildPersonalityCompatibilityReportPrompt } from './promptBuilder';
import {
  FREE_REPORT_DEFAULT_COPY,
  PERSONALITY_COMPATIBILITY_SAFETY_NOTE,
} from './reportCopy';
import {
  FREE_REPORT_SECTION_KEYS,
  LOCKED_REPORT_SECTION_KEYS,
  PAID_REPORT_SECTION_KEYS,
  PERSONALITY_COMPATIBILITY_REPORT_SCHEMA,
} from './reportSchema';

declare const test: (name: string, fn: () => Promise<void> | void) => void;

test('personality compatibility report schema separates free, paid, and locked sections', () => {
  assert.deepEqual(FREE_REPORT_SECTION_KEYS, [
    'overview',
    'scoreSummary',
    'attraction',
    'stability',
  ]);
  assert.deepEqual(PAID_REPORT_SECTION_KEYS, [
    'communication',
    'conflictPattern',
    'recovery',
    'practicalActions',
    'questionAdvice',
  ]);
  assert.deepEqual(LOCKED_REPORT_SECTION_KEYS, PAID_REPORT_SECTION_KEYS);
  assert.equal(PERSONALITY_COMPATIBILITY_REPORT_SCHEMA.sections.overview.access, 'free');
  assert.equal(PERSONALITY_COMPATIBILITY_REPORT_SCHEMA.sections.communication.access, 'paid');
});

test('personality compatibility prompt builder emits schema-grounded prompt input only', () => {
  const prompt = buildPersonalityCompatibilityReportPrompt({
    relationship_type: 'dating',
    question_type: 'conflict',
    saju_facts: {
      overallScore: 78,
      supportSignals: ['branch-harmony'],
    },
    personality_facts: {
      selfType: 'ENFJ',
      partnerType: 'INFP',
    },
    score_json: {
      attractionScore: 80,
      stabilityScore: 72,
      communicationScore: 68,
      conflictRiskScore: 34,
      recoveryScore: 76,
      totalScore: 72,
    },
    requested_sections: ['overview', 'communication', 'unknown-section'],
  });
  const input = JSON.parse(prompt.input) as {
    relationship_type: string;
    question_type: string;
    requested_sections: string[];
    score_json: { conflictRiskScore: number };
  };

  assert.equal(prompt.promptVersion, 'compatibility-personality-report-prompt-v1');
  assert.equal(input.relationship_type, 'dating');
  assert.equal(input.question_type, 'conflict');
  assert.deepEqual(input.requested_sections, ['overview', 'communication']);
  assert.equal(input.score_json.conflictRiskScore, 34);
  assert.match(prompt.instructions, /report_schema/);
  assert.match(prompt.instructions, /conflictRiskScore는 높을수록 갈등 위험이 큰 값/);
  assert.match(prompt.instructions, /의료, 법률, 투자/);
  assert.match(prompt.instructions, /16유형 성향/);
});

test('personality compatibility guardrails detect and soften forbidden phrases', () => {
  const unsafeText =
    '공식 MBTI 검사 결과로 보면 두 사람은 무조건 헤어진다. 이 관계는 최악으로 파멸에 가깝다.';
  const result = applyReportGuardrails(unsafeText);

  assert.equal(hasForbiddenReportPhrase(unsafeText), true);
  assert.equal(result.changed, true);
  assert.ok(result.violationsBefore.length >= 4);
  assert.deepEqual(result.violationsAfter, []);
  assert.equal(findForbiddenReportPhrases(result.text).length, 0);
  assert.match(result.text, /16유형 성향 체크/);
  assert.match(result.text, /가능성이 있습니다/);
});

test('personality compatibility default report copy stays user-facing and guarded', () => {
  const visibleCopy = [
    FREE_REPORT_DEFAULT_COPY.headline,
    FREE_REPORT_DEFAULT_COPY.summary,
    FREE_REPORT_DEFAULT_COPY.scoreSummary,
    ...FREE_REPORT_DEFAULT_COPY.highlights,
    PERSONALITY_COMPATIBILITY_SAFETY_NOTE,
  ].join('\n');

  assert.equal(hasForbiddenReportPhrase(visibleCopy), false);
  assert.doesNotMatch(visibleCopy, /facts|evidence_json|engine version|rule version/i);
  assert.match(visibleCopy, /참고용 자기이해 콘텐츠/);
  assert.match(visibleCopy, /의료·법률·투자 판단을 대신하지 않습니다/);
});
