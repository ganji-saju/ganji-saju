// 2026-05-19 — 사주 챕터 본문 (deterministic builder 출력 + 향후 LLM 출력) 의
//   톤·표기 검증 함수. report-llm-spec.md §6 (L3.5 후처리 검증) 를 구현.
//
// 사용 시나리오:
//  1. 현재 — buildLifetimeReport 의 9 cycle 본문이 한자 / X과 라벨 / 영어 단어
//     / 단정 표현 0건임을 자동 검증 (회귀 차단).
//  2. 향후 — saju-lifetime-service 의 LLM 출력을 검증해 fail 시 재생성 또는
//     deterministic fallback 사용.

import { MYEONGRI_TERMS_FOR_VALIDATION } from './terminology';

export type ChapterValidationRule =
  | 'hanja'
  | 'x-과-label'
  | 'english'
  | 'absolute'
  | 'cross-chapter'
  | 'punch-copy-duplication'
  // 2026-05-20 V2-5 PR M (검증 4-A 항목 6 보강 — report-llm-spec.md §6 5종 검증 완성):
  | 'gyeol-frequency'      // "결" 빈도 — 챕터당 5회 초과 시 fail (사이트 정체성 단어 남용 차단)
  | 'sentence-length'      // 한 문장 길이 — 65자 초과 시 fail (가독성 가드)
  | 'vague-comfort'        // 막연한 위로 — 데이터 근거 없는 "괜찮을 거예요" 패턴 차단
  // 2026-05-20 V2-5 PR N (검증 4-A 항목 4 보강 — 8번째 금지 규칙):
  | 'myeongri-jargon-repetition';  // 명리 술어 반복 — 같은 술어 챕터당 2회 이상 등장 시 fail (spec §3 룰 7 "한 단락에 한 번만")

export interface ChapterValidationFailure {
  rule: ChapterValidationRule;
  detail: string;
  excerpt?: string;
}

export interface ChapterValidationResult {
  passed: boolean;
  failures: ChapterValidationFailure[];
}

export interface ValidateChapterOptions {
  /** 1-indexed 챕터 번호. cross-chapter 검증 시 본인 위치 식별용. */
  chapterId?: number;
  /** 같은 리포트 안의 모든 챕터 본문 (있으면 cross-chapter 룰 활성). */
  allChapters?: string[];
  /** 중복 등장 차단할 punch-copy 한 줄 목록 (있으면 punch-copy-duplication 룰 활성). */
  punchLines?: string[];
  /**
   * 2026-05-20 V2-5 PR M — 특정 룰만 skip. LLM 출력엔 모든 룰 적용 (기본).
   * deterministic builder 본문 invariant 테스트는 점진 도입을 위해 ['sentence-length',
   * 'gyeol-frequency', 'vague-comfort'] 등 신규 룰을 opt-out 가능. 향후 deterministic
   * 본문 다듬기 PR 마다 하나씩 제거.
   */
  skipRules?: ChapterValidationRule[];
}

/**
 * 옛 "X과/와 Y" 두 단어 오행 라벨 — 본문에 들어가면 한국어 조사 충돌.
 * 2026-05-20 export: deterministic fallback 빌더(build-lifetime-report 등) 의
 *   회귀 가드 테스트에서 동일 룰을 공유하기 위해 노출.
 */
export const FORBIDDEN_OLD_ELEMENT_LABELS = [
  '시작과 추진',
  '열정과 표현',
  '안정과 중심',
  '결단과 마무리',
  '지혜와 유연',
];

/**
 * 사이트 정체성 (안심하고 보기 정책) 과 충돌하는 단정·자극·공포 표현.
 *
 * 2026-05-20 확장: 진단서 P0 ⑥ 잔존 패턴 점검에서 발견된 추가 자극어 보강.
 *   - '역대급', '평생 후회', '폭발할', '망설일 시간', '한 번의 대박':
 *     CHAPTER_PATTERN_TEMPLATES.fomoAd/secret 카테고리 fallback 잔존이 원인.
 * 2026-05-20 export: deterministic fallback 빌더 회귀 가드 테스트 공유.
 */
export const FORBIDDEN_ABSOLUTE_PHRASES = [
  '반드시',
  '절대',
  '대흉',
  '암흑기',
  '텅장',
  '비책',
  '운명을 내 편',
  '역대급',
  '평생 후회',
  '폭발할',
  '망설일 시간',
  '한 번의 대박',
];

const HANJA_PATTERN = /[一-鿿]/;
const ENGLISH_WORD_PATTERN = /\b[a-zA-Z]{2,}\b/g;

/**
 * "결" 빈도 한도 — 챕터당 최대 N회. 진단서 §3 ③ "한 섹션당 최대 2회" 기준에
 *   섹션 ≈ 챕터 본문 한 단락 (3~5 문장) 으로 매핑.
 *
 * 자연스러운 *복합 명사* ("결단", "결정", "결과", "결혼", "결제" 등) 는
 * 카운트 X. *단독 "결" + 조사 / 구두점 / 공백 / 문장 끝* 만 카운트.
 *
 * 패턴: "결" 뒤가 조사 (한글 1자 조사 19종) 이거나, 비한글 (공백·구두점·끝) 일 때.
 */
const GYEOL_MAX_PER_CHAPTER = 5;
const GYEOL_STANDALONE_PATTERN =
  /결(?:(?:이|가|을|를|은|는|의|에|와|과|도|만|로|라|들|에서|에는|에도|에만|이라|이라는|이다|입니다)(?=[\s.,!?。、]|$|[^가-힣])|(?=[\s.,!?。、]|$|[^가-힣]))/gu;

/**
 * 한 문장 길이 한도 — 65자 (60자 안팎 spec 의 5자 buffer).
 *   문장 분리는 마침표/물음표/느낌표 + 줄바꿈 기준.
 */
const SENTENCE_LENGTH_MAX = 65;

/**
 * 막연한 위로 패턴 — *데이터 근거 없는* 위로 표현. 진단서 §3 ⑧ 규칙.
 *   spec 정신: 위로 자체는 OK 지만 "괜찮을 거예요" 같이 *결 분석 없는* 빈 위로 차단.
 *   진정한 위로 ("이 흐름이 안정되면 회복돼요") 는 *결 근거 + 시점* 이라 통과.
 */
const VAGUE_COMFORT_PHRASES = [
  '괜찮을 거예요',
  '잘 될 거예요',
  '잘될 거예요',
  '걱정 마세요',
  '걱정마세요',
  '걱정 안 하셔도',
  '걱정 안하셔도',
  '걱정할 일은 없',
  '안심하세요',
  '괜찮습니다',
];

/**
 * 명리 술어 반복 한도 — 같은 술어가 한 챕터에 N회 이상 등장 시 fail.
 *   spec §3 룰 7 "한 단락에 한 번만" 의 챕터 단위 변환.
 *   = 2 이면 *2회 이상* fail, 즉 1회까지 OK.
 */
const MYEONGRI_TERM_MAX_PER_CHAPTER = 1;

/**
 * 명리 술어가 *단독 사용* 인지 판정하는 정규식 빌더.
 *   "정인" 매치 — "정인격" 은 매치 X (격이 한글 word boundary 침범).
 *   한글 word boundary 가 없으므로 negative lookbehind/lookahead 로 대체.
 */
function buildMyeongriPattern(term: string): RegExp {
  return new RegExp(`(?<![가-힣])${term}(?![가-힣])`, 'gu');
}

/**
 * 챕터 본문이 사이트 톤 룰을 만족하는지 검증.
 *
 * 단일 챕터 검증 (rules 1~4): body 만 전달.
 * 다중 챕터 검증 (rules 5~6): allChapters + chapterId 함께 전달.
 */
export function validateChapterBody(
  body: string,
  options: ValidateChapterOptions = {}
): ChapterValidationResult {
  const failures: ChapterValidationFailure[] = [];
  const skip = new Set(options.skipRules ?? []);

  // 1. 한자 0건 (사주팔자 카드 외 본문)
  if (!skip.has('hanja')) {
    const hanjaMatch = body.match(HANJA_PATTERN);
    if (hanjaMatch) {
      failures.push({
        rule: 'hanja',
        detail: '본문에 한자 노출',
        excerpt: hanjaMatch[0],
      });
    }
  }

  // 2. 옛 "X과/와 Y" 오행 라벨 0건
  if (!skip.has('x-과-label')) {
    for (const label of FORBIDDEN_OLD_ELEMENT_LABELS) {
      if (body.includes(label)) {
        failures.push({
          rule: 'x-과-label',
          detail: `옛 오행 라벨 사용 — 자연 비유로 (새싹/햇살/흙/쇠/물 의 결)`,
          excerpt: label,
        });
      }
    }
  }

  // 3. 영어 단어 0건 (한자/숫자/percent 제외, ASCII 2자 이상)
  if (!skip.has('english')) {
    const englishMatches = body.match(ENGLISH_WORD_PATTERN);
    if (englishMatches && englishMatches.length > 0) {
      failures.push({
        rule: 'english',
        detail: '영어 단어 노출',
        excerpt: englishMatches.join(', '),
      });
    }
  }

  // 4. 단정·공포 표현 0건
  if (!skip.has('absolute')) {
    for (const phrase of FORBIDDEN_ABSOLUTE_PHRASES) {
      if (body.includes(phrase)) {
        failures.push({
          rule: 'absolute',
          detail: '안심하고 보기 정책과 충돌하는 단정·자극 표현',
          excerpt: phrase,
        });
      }
    }
  }

  // 5. cross-chapter 중복 — 본문 첫 문장이 다른 챕터와 정확히 일치하면 fail
  if (!skip.has('cross-chapter') && options.allChapters && typeof options.chapterId === 'number') {
    const myIndex = options.chapterId - 1;
    const firstSentence = firstSentenceOf(body);
    if (firstSentence) {
      for (let i = 0; i < options.allChapters.length; i++) {
        if (i === myIndex) continue;
        const otherFirst = firstSentenceOf(options.allChapters[i] ?? '');
        if (otherFirst && otherFirst === firstSentence) {
          failures.push({
            rule: 'cross-chapter',
            detail: `챕터 ${options.chapterId} 첫 문장이 챕터 ${i + 1} 과 일치`,
            excerpt: firstSentence,
          });
        }
      }
    }
  }

  // 6. punch-copy 중복 — 같은 한 줄이 자기 챕터에 등장하면서 다른 챕터에도 등장 시 fail
  if (
    !skip.has('punch-copy-duplication') &&
    options.allChapters &&
    options.punchLines &&
    typeof options.chapterId === 'number'
  ) {
    const myIndex = options.chapterId - 1;
    for (const punch of options.punchLines) {
      if (!body.includes(punch)) continue;
      const others = options.allChapters.filter(
        (chapter, idx) => idx !== myIndex && chapter.includes(punch)
      );
      if (others.length > 0) {
        failures.push({
          rule: 'punch-copy-duplication',
          detail: `punch-copy '${punch}' 가 ${others.length + 1}개 챕터에 등장 — 최대 1개 허용`,
          excerpt: punch,
        });
      }
    }
  }

  // 7. "결" 빈도 — 챕터당 최대 5회 (진단서 §3 ③, 사이트 정체성 단어 남용 차단)
  if (!skip.has('gyeol-frequency')) {
    const gyeolMatches = body.match(GYEOL_STANDALONE_PATTERN);
    if (gyeolMatches && gyeolMatches.length > GYEOL_MAX_PER_CHAPTER) {
      failures.push({
        rule: 'gyeol-frequency',
        detail: `"결" 단어 ${gyeolMatches.length}회 등장 — 챕터당 최대 ${GYEOL_MAX_PER_CHAPTER}회 권장`,
        excerpt: `${gyeolMatches.length}회`,
      });
    }
  }

  // 8. 문장 길이 — 한 문장 65자 초과 시 fail (가독성 가드, 60자 안팎 spec)
  if (!skip.has('sentence-length')) {
    const sentences = body
      .split(/(?<=[.?!])\s+|\n+/u)
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sentence of sentences) {
      const lenWithoutPunct = sentence.replace(/[.?!]+$/u, '').length;
      if (lenWithoutPunct > SENTENCE_LENGTH_MAX) {
        failures.push({
          rule: 'sentence-length',
          detail: `문장 ${lenWithoutPunct}자 — ${SENTENCE_LENGTH_MAX}자 초과. 끊어 읽기 단위 권장`,
          excerpt: sentence.slice(0, 40) + (sentence.length > 40 ? '…' : ''),
        });
        break;
      }
    }
  }

  // 9. 막연한 위로 — 데이터 근거 없는 빈 위로 표현 차단 (진단서 §3 ⑧)
  if (!skip.has('vague-comfort')) {
    for (const phrase of VAGUE_COMFORT_PHRASES) {
      if (body.includes(phrase)) {
        failures.push({
          rule: 'vague-comfort',
          detail: `근거 없는 위로 표현 — 결·신호·시점 정보 동반 권장`,
          excerpt: phrase,
        });
      }
    }
  }

  // 10. 명리 술어 반복 — 같은 술어 챕터당 2회 이상 등장 시 fail
  //   spec §3 룰 7 "명리 술어 사용 시 한 단락에 한 번만 + 일상어 풀이 함께".
  //   카탈로그 나열 금지 — 같은 술어 반복은 카탈로그 신호.
  if (!skip.has('myeongri-jargon-repetition')) {
    // 긴 술어 우선 매칭 (정인격 > 정인) — substring 중복 카운트 회피
    const sortedTerms = [...MYEONGRI_TERMS_FOR_VALIDATION].sort(
      (a, b) => b.length - a.length
    );
    // 매치 시 해당 영역을 "소비" — 다음 술어 매치 시 중복 카운트 X
    let remaining = body;
    const counts = new Map<string, number>();
    for (const term of sortedTerms) {
      const pattern = buildMyeongriPattern(term);
      const matches = remaining.match(pattern);
      if (matches && matches.length > 0) {
        counts.set(term, matches.length);
        // 카운트 후 매치 영역 제거 (substring 중복 카운트 차단)
        remaining = remaining.replace(pattern, '');
      }
    }
    for (const [term, count] of counts.entries()) {
      if (count > MYEONGRI_TERM_MAX_PER_CHAPTER) {
        failures.push({
          rule: 'myeongri-jargon-repetition',
          detail: `명리 술어 "${term}" ${count}회 등장 — 한 챕터당 최대 ${MYEONGRI_TERM_MAX_PER_CHAPTER}회 (spec §3 룰 7). 두 번째 이후는 일상어 풀이로 치환 권장.`,
          excerpt: `${term} × ${count}`,
        });
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

function firstSentenceOf(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^[^.?!\n]+/);
  return (match ? match[0] : trimmed).trim();
}
