export const FORBIDDEN_REPORT_PHRASES = [
  '공식 MBTI 검사',
  'MBTI 진단',
  'MBTI 심리검사',
  '무조건',
  '반드시',
  '절대',
  '최악',
  '파멸',
  '헤어진다',
  '결혼한다',
  '재회한다',
] as const;

export const RECOMMENDED_REPORT_PHRASES = [
  '16유형 성향',
  '성향 체크',
  '참고용 자기이해 콘텐츠',
  '가능성이 있습니다',
  '경향이 있습니다',
  '이런 방식이 도움이 됩니다',
] as const;

export interface ReportGuardrailViolation {
  phrase: (typeof FORBIDDEN_REPORT_PHRASES)[number];
  index: number;
}

export interface ReportGuardrailResult {
  text: string;
  changed: boolean;
  violationsBefore: ReportGuardrailViolation[];
  violationsAfter: ReportGuardrailViolation[];
}

const REPORT_PHRASE_REPLACEMENTS: Record<(typeof FORBIDDEN_REPORT_PHRASES)[number], string> = {
  '공식 MBTI 검사': '16유형 성향 체크',
  'MBTI 진단': '16유형 성향 참고',
  'MBTI 심리검사': '성향 체크',
  무조건: '상황에 따라',
  반드시: '가능하면',
  절대: '되도록',
  최악: '부담이 큰 흐름',
  파멸: '크게 흔들리는 흐름',
  헤어진다: '관계가 멀어질 가능성이 있습니다',
  결혼한다: '함께 미래를 논의할 가능성이 있습니다',
  재회한다: '다시 대화를 열 가능성이 있습니다',
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceAllPhrases(text: string, replacements: Record<string, string>): string {
  return Object.entries(replacements).reduce(
    (nextText, [phrase, replacement]) =>
      nextText.replace(new RegExp(escapeRegExp(phrase), 'gi'), replacement),
    text
  );
}

export function findForbiddenReportPhrases(text: string): ReportGuardrailViolation[] {
  return FORBIDDEN_REPORT_PHRASES.flatMap((phrase) => {
    const violations: ReportGuardrailViolation[] = [];
    const pattern = new RegExp(escapeRegExp(phrase), 'gi');
    let match = pattern.exec(text);

    while (match) {
      violations.push({
        phrase,
        index: match.index,
      });
      match = pattern.exec(text);
    }

    return violations;
  }).sort((left, right) => left.index - right.index);
}

export function hasForbiddenReportPhrase(text: string): boolean {
  return findForbiddenReportPhrases(text).length > 0;
}

export function preventOfficialMbtiCopy(text: string): string {
  return replaceAllPhrases(text, {
    '공식 MBTI 검사': REPORT_PHRASE_REPLACEMENTS['공식 MBTI 검사'],
    'MBTI 진단': REPORT_PHRASE_REPLACEMENTS['MBTI 진단'],
    'MBTI 심리검사': REPORT_PHRASE_REPLACEMENTS['MBTI 심리검사'],
  });
}

export function softenDeterministicCopy(text: string): string {
  return replaceAllPhrases(text, REPORT_PHRASE_REPLACEMENTS);
}

export function applyReportGuardrails(text: string): ReportGuardrailResult {
  const violationsBefore = findForbiddenReportPhrases(text);
  const guardedText = softenDeterministicCopy(preventOfficialMbtiCopy(text));
  const violationsAfter = findForbiddenReportPhrases(guardedText);

  return {
    text: guardedText,
    changed: guardedText !== text,
    violationsBefore,
    violationsAfter,
  };
}
