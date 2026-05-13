import type {
  CompatibilityPersonalityFacts,
  CompatibilitySajuFacts,
  CompatibilityScores,
} from './compatibility.types';
import { FORBIDDEN_REPORT_PHRASES, RECOMMENDED_REPORT_PHRASES } from './guardrails';
import { PERSONALITY_COMPATIBILITY_SAFETY_NOTE } from './reportCopy';
import {
  PERSONALITY_COMPATIBILITY_REPORT_SCHEMA,
  PERSONALITY_COMPATIBILITY_REPORT_SCHEMA_VERSION,
  PERSONALITY_COMPATIBILITY_REPORT_SECTIONS,
  type PersonalityCompatibilityReportSectionKey,
  normalizeRequestedReportSections,
} from './reportSchema';

export const PERSONALITY_COMPATIBILITY_PROMPT_VERSION =
  'compatibility-personality-report-prompt-v1' as const;

export interface BuildPersonalityCompatibilityReportPromptInput {
  relationship_type: string;
  question_type: string;
  saju_facts: CompatibilitySajuFacts | Record<string, unknown>;
  personality_facts: CompatibilityPersonalityFacts | Record<string, unknown>;
  score_json: CompatibilityScores | Record<string, unknown>;
  requested_sections: readonly string[];
}

export interface PersonalityCompatibilityReportPrompt {
  promptVersion: typeof PERSONALITY_COMPATIBILITY_PROMPT_VERSION;
  schemaVersion: typeof PERSONALITY_COMPATIBILITY_REPORT_SCHEMA_VERSION;
  requestedSections: PersonalityCompatibilityReportSectionKey[];
  instructions: string;
  input: string;
}

function buildRequestedSectionInstructions(
  requestedSections: readonly PersonalityCompatibilityReportSectionKey[]
): string[] {
  return requestedSections.map((sectionKey) => {
    const section = PERSONALITY_COMPATIBILITY_REPORT_SECTIONS[sectionKey];
    return `- ${section.key}: ${section.title} / ${section.description} / outputShape=${section.outputShape}`;
  });
}

export function buildPersonalityCompatibilityReportPrompt(
  input: BuildPersonalityCompatibilityReportPromptInput
): PersonalityCompatibilityReportPrompt {
  const requestedSections = normalizeRequestedReportSections(input.requested_sections);
  const promptInput = {
    schema_version: PERSONALITY_COMPATIBILITY_REPORT_SCHEMA_VERSION,
    relationship_type: input.relationship_type,
    question_type: input.question_type,
    saju_facts: input.saju_facts,
    personality_facts: input.personality_facts,
    score_json: input.score_json,
    requested_sections: requestedSections,
  };

  return {
    promptVersion: PERSONALITY_COMPATIBILITY_PROMPT_VERSION,
    schemaVersion: PERSONALITY_COMPATIBILITY_REPORT_SCHEMA_VERSION,
    requestedSections,
    instructions: [
      '당신은 달빛 성향궁합 리포트를 작성하는 한국어 관계 해석 에디터입니다.',
      '이번 단계에서는 제공된 JSON을 바탕으로 리포트 문안만 작성합니다. 외부 도구, API 호출, 추가 계산은 수행하지 않습니다.',
      'saju_facts는 이미 기존 사주 엔진에서 계산된 입력 facts입니다. 사주 계산 자체를 새로 만들거나 누락된 사주 정보를 추정하지 않습니다.',
      'personality_facts는 16유형 성향 및 성향 체크 입력입니다. 성향을 의학적·심리학적 판정처럼 말하지 않습니다.',
      'score_json의 attractionScore, stabilityScore, communicationScore, recoveryScore는 높을수록 긍정적인 흐름입니다.',
      'score_json의 conflictRiskScore는 높을수록 갈등 위험이 큰 값입니다. totalScore를 설명할 때는 이 점을 쉬운 말로 풀어줍니다.',
      'relationship_type과 question_type에 맞춰 같은 facts라도 연애, 결혼, 친구, 가족, 일 관계의 해석 초점을 다르게 둡니다.',
      '무료 리포트는 freeReport 구조를 따르고, 유료 섹션은 lockedSections에 teaser와 ctaLabel만 둡니다.',
      '유료 리포트는 paidReport 구조를 따르고, requested_sections에 포함된 섹션을 sections 안에 모두 작성합니다.',
      '응답은 JSON 객체 하나만 반환합니다. Markdown, 코드블록, 부연 설명 문장을 붙이지 않습니다.',
      '출력 스키마는 아래 report_schema를 따릅니다.',
      JSON.stringify(PERSONALITY_COMPATIBILITY_REPORT_SCHEMA, null, 2),
      'requested_sections:',
      ...buildRequestedSectionInstructions(requestedSections),
      '문체 규칙:',
      '- 일반 사용자가 바로 이해할 수 있는 생활 언어로 씁니다.',
      '- 명리 전문용어, 내부 메타데이터, evidence_json, engine version, rule version은 본문에 직접 노출하지 않습니다.',
      '- MBTI와 오행을 1:1로 단순 대응시키지 않습니다. 두 입력은 서로 다른 관찰 축으로만 함께 해석합니다.',
      '- 관계 결과를 예언처럼 확정하지 말고, 관찰 가능한 경향과 도움이 되는 행동으로 씁니다.',
      '- 의료, 법률, 투자, 위기 상황 판단을 대신하지 않는다는 안내를 safetyNote에 포함합니다.',
      '- safetyNote에는 다음 문구를 그대로 포함합니다.',
      PERSONALITY_COMPATIBILITY_SAFETY_NOTE,
      '금지 표현:',
      JSON.stringify(FORBIDDEN_REPORT_PHRASES),
      '권장 표현:',
      JSON.stringify(RECOMMENDED_REPORT_PHRASES),
      '각 섹션 작성 규칙:',
      '- headline은 짧고 부드럽게 작성합니다.',
      '- summary는 2~3문장으로 두 사람의 현재 관계 결을 요약합니다.',
      '- highlights는 3개로 작성하고 서로 같은 말을 반복하지 않습니다.',
      '- sections의 paragraph body는 2~4문장으로 작성합니다.',
      '- practicalActions.items는 3~5개로 작성하고 오늘 바로 시도할 수 있는 행동으로 씁니다.',
      '- lockedSections는 잠긴 유료 섹션의 teaser만 보여주고 결론을 과하게 공개하지 않습니다.',
    ].join('\n'),
    input: JSON.stringify(promptInput, null, 2),
  };
}
