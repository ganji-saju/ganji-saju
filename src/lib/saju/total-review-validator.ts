// 2026-05-21 — 사주 총평 LLM 출력 후처리 검증. saju-total-review-llm-spec.md §7 (10 항목).
//   chapter-validator 와 동일 정신이나 *총평 고유* 규칙(일일 톤·컨텍스트 반영·단락 중복·
//   문장 수) 추가. 세 함수:
//     - validateTotalReview: 전체 출력 §7 10항목 (ok/reasons).
//     - validateTotalReviewSection: 섹션 단위 hard 룰 (generate-total-review 재시도 게이트).
//     - hasHardTotalReviewViolation: 한자/금지어/일일톤/자극어 — 서비스 fallback 게이트.
import type {
  TotalReviewOutput,
  TotalReviewSectionId,
} from '@/server/ai/total-review/total-review-types';

const HANJA_RE = /[一-鿿]/g;

// spec §7 의 bannedTerms. (§3 보다 짧은 §7 코드 기준 — 본문 노출 0건 대상)
const BANNED_MYEONGRI_TERMS = [
  '천간', '지지', '일간', '일주', '월주', '시주', '연주', '시지', '월지', '연지',
  '격국', '식신격', '정인격', '편관격', '용신', '신강', '신약', '대운', '세운', '월운',
  '비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인',
  '원진', '공망', '신살', '양인', '도화', '역마', '화개',
  '장생', '목욕', '관대', '건록', '제왕',
];

// spec §7 dailyTonePatterns — 일일 톤 누출 (총평의 핵심 가드)
const DAILY_TONE_PATTERNS: RegExp[] = [
  /오늘은/,
  /이번\s*주/,
  /[가-힣]+ 날입니다/,
  /오늘의 흐름/,
];

// spec §7 clickbait — 자극·단정 표현
const CLICKBAIT_ABSOLUTE = [
  '대박', '비책', '암흑기', '텅장', '꿀팁', '반드시', '절대', '확실히',
];

// naming-policy.md §12 — 어휘 정책 금지 패턴 (모두 0건이어야 함).
//   일반 "X의 결" 은 "결과/결정/결혼" 복합어 오탐을 피하려 trailing "과" 를 제외(은/이/를/을/와/공백/끝만).
const NAMING_POLICY_FORBIDDEN_PATTERNS: RegExp[] = [
  /(새싹|햇살|흙|쇠|물)의\s*결/g,
  /(새싹|햇살)\s+(기운|결|흐름)/g,
  /결단과|안정과|열정과|시작과|지혜과/g,
  /(표현|생각|절제|직관|돌봄|관찰|베푸는|밀어붙이는)의\s*기운/g,
  /(돌봄|표현|기준|단단함)의\s*결/g,
  /(표현|돌봄|재물|관계|기준)형\s*사주/g,
  /[가-힣]+의\s*결(?=[은이를을와\s]|$)/g,
  // 오행은 "X 기운"으로만 — "목의 기운/금의 기운" 등 "의" 형태 금지 (naming-policy §2, spec §7 #4-B)
  /(목|화|토|금|수)의\s*기운/g,
];

// 직업 컨텍스트(한글 라벨) → 단락 2 에 등장해야 할 키워드 후보 (spec §7 item 7)
const OCCUPATION_KEYWORDS: Record<string, string[]> = {
  직장인: ['직장', '업무', '회사', '일하'],
  '구직 중': ['구직', '면접', '취업', '일자리'],
  '자영업/프리랜서': ['사업', '운영', '매출', '프리랜서', '계약', '가게'],
  학생: ['학업', '공부', '학교', '진로'],
  '가정 살림': ['살림', '가정', '집안'],
  '기타 활동': [],
};

// chapter-validator 의 GYEOL_STANDALONE_PATTERN 동등 — 복합명사(결단/결과/결혼) 제외, 단독 "결"만.
const GYEOL_STANDALONE_PATTERN =
  /결(?:(?:이|가|을|를|은|는|의|에|와|과|도|만|로|라|들|에서|에는|에도|에만|이라|이라는|이다|입니다)(?=[\s.,!?。、]|$|[^가-힣])|(?=[\s.,!?。、]|$|[^가-힣]))/gu;

export interface TotalReviewValidationContext {
  relationshipStatus?: string | null;
  occupationStatus?: string | null;
  concern?: string | null;
  userName?: string | null;
}

export interface TotalReviewValidationResult {
  ok: boolean;
  reasons: string[];
}

/** 한자/금지 명리어/일일 톤/자극어 — 어디서든 출력 폐기 사유.
 *  naming-policy 단일 소스 — 오행 가이드(Phase 5) 등 다른 LLM 검증기에서도 재사용. */
export function hardTextReasons(text: string, where: string): string[] {
  const reasons: string[] = [];
  const hanja = text.match(HANJA_RE);
  if (hanja?.length) {
    reasons.push(`${where} 한자 누출: ${[...new Set(hanja)].join(', ')}`);
  }
  for (const term of BANNED_MYEONGRI_TERMS) {
    if (text.includes(term)) reasons.push(`${where} 금지 용어: ${term}`);
  }
  for (const pattern of DAILY_TONE_PATTERNS) {
    const m = text.match(pattern);
    if (m) reasons.push(`${where} 일일 톤 누출: ${m[0]}`);
  }
  for (const word of CLICKBAIT_ABSOLUTE) {
    if (text.includes(word)) reasons.push(`${where} 자극/단정 표현: ${word}`);
  }
  for (const pattern of NAMING_POLICY_FORBIDDEN_PATTERNS) {
    const m = text.match(pattern);
    if (m) reasons.push(`${where} 어휘 정책 위반(naming-policy §12): ${m[0]}`);
  }
  return reasons;
}

/** 단독 "결" 빈도(복합명사 결단/결과/결혼 제외) — naming-policy §9. 재사용 export. */
export function countGyeol(text: string): number {
  return (text.match(GYEOL_STANDALONE_PATTERN) ?? []).length;
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 섹션 단위 hard 검증 — generate-total-review 의 재시도 게이트.
 * 구조(필수 필드/카드 수) + hard 텍스트 룰만. 컨텍스트/문장수 등 cross-section 룰은 제외.
 */
export function validateTotalReviewSection(
  sectionId: TotalReviewSectionId,
  value: unknown
): TotalReviewValidationResult {
  const reasons: string[] = [];

  if (sectionId === 'one_line_summary') {
    const summary = (value as { one_line_summary?: unknown })?.one_line_summary;
    if (typeof summary !== 'string' || !summary.trim()) {
      return { ok: false, reasons: ['one_line_summary 누락 또는 비문자열'] };
    }
    reasons.push(...hardTextReasons(summary, '한 줄 요약'));
    const len = summary.trim().length;
    if (len < 12 || len > 90) reasons.push(`한 줄 요약 길이 ${len}자 (12~90 권장)`);
    return { ok: reasons.length === 0, reasons };
  }

  if (sectionId === 'main_narrative') {
    const narrative = (value as { main_narrative?: Record<string, unknown> })
      ?.main_narrative;
    const keys = [
      'paragraph_1_who_you_are',
      'paragraph_2_strong_environment',
      'paragraph_3_weak_zone',
      'paragraph_4_now',
    ] as const;
    if (!narrative || typeof narrative !== 'object') {
      return { ok: false, reasons: ['main_narrative 누락'] };
    }
    for (const key of keys) {
      const para = narrative[key];
      if (typeof para !== 'string' || !para.trim()) {
        reasons.push(`${key} 누락 또는 비문자열`);
        continue;
      }
      reasons.push(...hardTextReasons(para, key));
    }
    return { ok: reasons.length === 0, reasons };
  }

  // lifetime_keys
  const keysArr = (value as { lifetime_keys?: unknown })?.lifetime_keys;
  if (!Array.isArray(keysArr)) {
    return { ok: false, reasons: ['lifetime_keys 누락 또는 비배열'] };
  }
  if (keysArr.length !== 3) reasons.push(`평생 활용 항목 수 ${keysArr.length} (목표 3)`);
  keysArr.forEach((card, i) => {
    const c = card as { title?: unknown; subtitle?: unknown; body?: unknown };
    for (const field of ['title', 'subtitle', 'body'] as const) {
      const v = c?.[field];
      if (typeof v !== 'string' || !v.trim()) {
        reasons.push(`카드 ${i + 1} ${field} 누락`);
        continue;
      }
      reasons.push(...hardTextReasons(v, `카드 ${i + 1} ${field}`));
    }
  });
  return { ok: reasons.length === 0, reasons };
}

/**
 * 전체 출력 검증 — spec §7 의 10 항목.
 */
export function validateTotalReview(
  output: TotalReviewOutput,
  context: TotalReviewValidationContext = {}
): TotalReviewValidationResult {
  const reasons: string[] = [];
  const paragraphs = [
    output.main_narrative.paragraph_1_who_you_are,
    output.main_narrative.paragraph_2_strong_environment,
    output.main_narrative.paragraph_3_weak_zone,
    output.main_narrative.paragraph_4_now,
  ];
  const fullText = [
    output.one_line_summary,
    ...paragraphs,
    ...output.lifetime_keys.flatMap((k) => [k.title, k.subtitle, k.body]),
  ].join('\n');

  // 1·2·3·5 (한자 / 금지어 / 일일 톤 / 자극어) — 전체 텍스트
  reasons.push(...hardTextReasons(fullText, '본문'));

  // 4. "결" 빈도 — naming-policy §9: 요약·카드 0회, 본문 단락당 최대 1회
  paragraphs.forEach((p, i) => {
    const count = countGyeol(p);
    if (count > 1) reasons.push(`단락 ${i + 1} '결' 과다: ${count}회 (단락당 최대 1회)`);
  });
  if (countGyeol(output.one_line_summary) > 0) {
    reasons.push(`한 줄 요약 '결' 사용 — 요약엔 0회 (대안: 사주/성향/흐름)`);
  }
  output.lifetime_keys.forEach((k, i) => {
    const cardGyeol = countGyeol(k.title) + countGyeol(k.subtitle) + countGyeol(k.body);
    if (cardGyeol > 0) reasons.push(`카드 ${i + 1} '결' 사용 — 카드엔 0회`);
  });

  // 6. 이름 호명 ≤ 2 (userName 제공 시)
  if (context.userName) {
    const namePattern = new RegExp(
      `${context.userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s?님`,
      'g'
    );
    const nameCount = (fullText.match(namePattern) ?? []).length;
    if (nameCount > 2) reasons.push(`이름 호명 과다: ${nameCount}회`);
  }

  // 7. 컨텍스트 반영 (단락 2 직업 / 단락 4 고민)
  if (context.occupationStatus) {
    const keywords = OCCUPATION_KEYWORDS[context.occupationStatus] ?? [];
    if (
      keywords.length > 0 &&
      !keywords.some((k) => output.main_narrative.paragraph_2_strong_environment.includes(k))
    ) {
      reasons.push(`단락 2 직업 컨텍스트(${context.occupationStatus}) 미반영`);
    }
  }
  if (context.concern) {
    const parts = context.concern.split('·');
    if (!parts.some((p) => output.main_narrative.paragraph_4_now.includes(p))) {
      reasons.push(`단락 4 고민 컨텍스트(${context.concern}) 미반영`);
    }
  }

  // 8. 단락 간 동일 문장
  const sentences = paragraphs
    .flatMap((p, i) => splitSentences(p).map((s) => ({ paragraph: i + 1, sentence: s })))
    .filter((x) => x.sentence.length > 20);
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      if (
        sentences[i].paragraph !== sentences[j].paragraph &&
        sentences[i].sentence === sentences[j].sentence
      ) {
        reasons.push(`단락 ${sentences[i].paragraph}·${sentences[j].paragraph} 동일 문장`);
      }
    }
  }

  // 9. 본문 문장 수 25~35
  const totalSentences = paragraphs.reduce((sum, p) => sum + splitSentences(p).length, 0);
  if (totalSentences < 25 || totalSentences > 35) {
    reasons.push(`본문 문장 수 ${totalSentences} (목표 25~35)`);
  }

  // 10. 평생 활용 3개
  if (output.lifetime_keys.length !== 3) {
    reasons.push(`평생 활용 항목 수 ${output.lifetime_keys.length} (목표 3)`);
  }

  return { ok: reasons.length === 0, reasons };
}

/** 한자/금지어/일일톤/자극어 — 출력을 deterministic fallback 으로 교체해야 하는 치명 위반. */
export function hasHardTotalReviewViolation(output: TotalReviewOutput): boolean {
  const fullText = [
    output.one_line_summary,
    output.main_narrative.paragraph_1_who_you_are,
    output.main_narrative.paragraph_2_strong_environment,
    output.main_narrative.paragraph_3_weak_zone,
    output.main_narrative.paragraph_4_now,
    ...output.lifetime_keys.flatMap((k) => [k.title, k.subtitle, k.body]),
  ].join('\n');
  return hardTextReasons(fullText, '').length > 0;
}
