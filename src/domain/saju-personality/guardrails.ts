export const FORBIDDEN_REPORT_PHRASES = [
  '공식 MBTI 검사',
  'MBTI 진단',
  'MBTI 심리검사',
  '무조건',
  '반드시',
  '절대',
  '최악',
  '파멸',
  '평생 안 된다',
  '질병이 생긴다',
  '투자하면 돈을 번다',
  '이 직업만 맞다',
] as const;

export const RECOMMENDED_REPORT_PHRASES = [
  '16유형 성향',
  '성향 체크',
  '참고용 자기이해 콘텐츠',
  '이런 경향이 있습니다',
  '도움이 될 수 있습니다',
  '조절하면 좋습니다',
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
  '평생 안 된다': '오래 반복되면 답답함이 커질 수 있습니다',
  '질병이 생긴다': '몸과 마음의 신호를 살피는 것이 도움이 될 수 있습니다',
  '투자하면 돈을 번다': '돈과 관련된 결정은 실제 정보와 전문가 조언을 함께 확인하는 것이 좋습니다',
  '이 직업만 맞다': '잘 맞는 일의 조건을 살펴볼 수 있습니다',
};

const SOFTENING_REPLACEMENTS: Record<string, string> = {
  확실히: '그럴 가능성이 비교적 선명하게',
  '100%': '참고상',
  '운명이다': '그런 흐름으로 느껴질 수 있습니다',
  '정답이다': '도움이 될 수 있는 선택지입니다',
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
  return replaceAllPhrases(
    replaceAllPhrases(text, REPORT_PHRASE_REPLACEMENTS),
    SOFTENING_REPLACEMENTS
  );
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
