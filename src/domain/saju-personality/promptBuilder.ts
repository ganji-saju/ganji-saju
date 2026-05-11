import type {
  FusionFacts,
  PersonalityFacts,
  SajuPersonalityFacts,
  SajuPersonalityLifeArea,
  SajuPersonalityReportSectionKey,
  SajuPersonalityReportType,
  SajuPersonalityScores,
} from './sajuPersonality.types';
import { FORBIDDEN_REPORT_PHRASES, RECOMMENDED_REPORT_PHRASES } from './guardrails';
import { SAJU_PERSONALITY_SAFETY_NOTE } from './reportCopy';
import {
  normalizeRequestedReportSections,
  SAJU_PERSONALITY_REPORT_SCHEMA,
  SAJU_PERSONALITY_REPORT_SCHEMA_VERSION,
  SAJU_PERSONALITY_REPORT_SECTIONS,
} from './reportSchema';

export const SAJU_PERSONALITY_PROMPT_VERSION = 'saju-personality-report-prompt-v1' as const;

export interface BuildSajuPersonalityReportPromptInput {
  life_area: SajuPersonalityLifeArea | string;
  report_type?: SajuPersonalityReportType;
  saju_facts: SajuPersonalityFacts | Record<string, unknown>;
  personality_facts: PersonalityFacts | Record<string, unknown>;
  fusion_facts: FusionFacts | Record<string, unknown>;
  score_json: SajuPersonalityScores | Record<string, unknown>;
  requested_sections: readonly string[];
}

export interface SajuPersonalityReportPrompt {
  promptVersion: typeof SAJU_PERSONALITY_PROMPT_VERSION;
  schemaVersion: typeof SAJU_PERSONALITY_REPORT_SCHEMA_VERSION;
  requestedSections: SajuPersonalityReportSectionKey[];
  instructions: string;
  input: string;
}

function buildRequestedSectionInstructions(
  requestedSections: readonly SajuPersonalityReportSectionKey[]
): string[] {
  return requestedSections.map((sectionKey) => {
    const section = SAJU_PERSONALITY_REPORT_SECTIONS[sectionKey];
    return `- ${section.key}: ${section.title} / ${section.description} / outputShape=${section.outputShape}`;
  });
}

export function buildSajuPersonalityReportPrompt(
  input: BuildSajuPersonalityReportPromptInput
): SajuPersonalityReportPrompt {
  const requestedSections = normalizeRequestedReportSections(input.requested_sections);
  const promptInput = {
    schema_version: SAJU_PERSONALITY_REPORT_SCHEMA_VERSION,
    prompt_version: SAJU_PERSONALITY_PROMPT_VERSION,
    report_type: input.report_type ?? 'free',
    life_area: input.life_area,
    saju_facts: input.saju_facts,
    personality_facts: input.personality_facts,
    fusion_facts: input.fusion_facts,
    score_json: input.score_json,
    requested_sections: requestedSections,
  };

  return {
    promptVersion: SAJU_PERSONALITY_PROMPT_VERSION,
    schemaVersion: SAJU_PERSONALITY_REPORT_SCHEMA_VERSION,
    requestedSections,
    instructions: [
      '당신은 달빛 성향사주 리포트를 작성하는 한국어 자기이해 해석 에디터입니다.',
      '이번 단계에서는 제공된 JSON을 바탕으로 리포트 문안만 작성합니다. 외부 도구, API 호출, 추가 계산은 수행하지 않습니다.',
      'saju_facts는 이미 기존 사주 엔진에서 계산된 입력 facts입니다. 사주 계산 자체를 새로 만들거나 누락된 생년월일시를 추정하지 않습니다.',
      'personality_facts는 16유형 성향 및 성향 체크 입력입니다. 성향을 의학적·심리학적 판정처럼 말하지 않습니다.',
      'fusion_facts는 사주 facts와 성향 facts를 결합해 만든 개인 해석 단서입니다. 두 입력을 단순 대응시키지 말고 서로 다른 관찰 축으로 함께 해석합니다.',
      'score_json의 6축 점수는 좋고 나쁨이 아니라 자기이해 선명도와 특성 강도를 나타내는 참고 지표입니다.',
      'totalClarityScore는 사주 facts와 성향 facts가 얼마나 일관된 방향을 가리키는지 보여주는 값입니다. 이 점수만으로 사용자를 단정하지 않습니다.',
      'life_area에 맞춰 같은 facts라도 기본 성향, 연애, 인간관계, 일, 돈/성취, 올해, 오늘의 초점을 다르게 둡니다.',
      '무료 리포트는 freeReport 구조를 따르고, 유료 섹션은 lockedSections에 teaser와 ctaLabel만 둡니다.',
      '유료 리포트는 paidReport 구조를 따르고, requested_sections에 포함된 섹션을 sections 안에 모두 작성합니다.',
      '응답은 JSON 객체 하나만 반환합니다. Markdown, 코드블록, 부연 설명 문장을 붙이지 않습니다.',
      '출력 스키마는 아래 report_schema를 따릅니다.',
      JSON.stringify(SAJU_PERSONALITY_REPORT_SCHEMA, null, 2),
      'requested_sections:',
      ...buildRequestedSectionInstructions(requestedSections),
      '문체 규칙:',
      '- 일반 사용자가 바로 이해할 수 있는 생활 언어로 씁니다.',
      '- 명리 전문용어, 내부 메타데이터, evidence_json, engine version, rule version은 본문에 직접 노출하지 않습니다.',
      '- 16유형 성향과 오행을 1:1로 단순 대응시키지 않습니다.',
      '- 결과를 예언처럼 확정하지 말고, 관찰 가능한 경향과 도움이 될 수 있는 행동으로 씁니다.',
      '- 건강, 법률, 투자, 직업 선택을 대신 판단하지 않습니다.',
      '- safetyNote에는 다음 문구를 그대로 포함합니다.',
      SAJU_PERSONALITY_SAFETY_NOTE,
      '금지 표현:',
      JSON.stringify(FORBIDDEN_REPORT_PHRASES),
      '권장 표현:',
      JSON.stringify(RECOMMENDED_REPORT_PHRASES),
      '무료 섹션 작성 규칙:',
      '- headline은 짧고 부드럽게 작성합니다.',
      '- keywords는 정확히 3개를 작성합니다.',
      '- scoreSummary는 6축 점수가 자기이해 지표임을 분명히 설명합니다.',
      '- shortSajuReading과 shortPersonalityReading은 각각 2~3문장으로 작성합니다.',
      '- lockedCta는 결론을 과하게 공개하지 않고 깊이보기에서 열리는 항목을 안내합니다.',
      '유료 섹션 작성 규칙:',
      '- paidReport의 paragraph body는 2~5문장으로 작성합니다.',
      '- strengths.items는 3개로 작성하고 각각 실천 가능한 활용 방향을 포함합니다.',
      '- todayAction.items는 3개로 작성하고 오늘 바로 해볼 수 있는 짧은 문장으로 씁니다.',
      '- fatiguePattern은 겁주거나 낙인찍지 말고 조절하면 좋을 신호로 풀이합니다.',
    ].join('\n'),
    input: JSON.stringify(promptInput, null, 2),
  };
}
