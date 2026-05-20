// 2026-05-19 — 사주 챕터 본문 (deterministic builder 출력 + 향후 LLM 출력) 의
//   톤·표기 검증 함수. report-llm-spec.md §6 (L3.5 후처리 검증) 를 구현.
//
// 사용 시나리오:
//  1. 현재 — buildLifetimeReport 의 9 cycle 본문이 한자 / X과 라벨 / 영어 단어
//     / 단정 표현 0건임을 자동 검증 (회귀 차단).
//  2. 향후 — saju-lifetime-service 의 LLM 출력을 검증해 fail 시 재생성 또는
//     deterministic fallback 사용.

export type ChapterValidationRule =
  | 'hanja'
  | 'x-과-label'
  | 'english'
  | 'absolute'
  | 'cross-chapter'
  | 'punch-copy-duplication';

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

  // 1. 한자 0건 (사주팔자 카드 외 본문)
  const hanjaMatch = body.match(HANJA_PATTERN);
  if (hanjaMatch) {
    failures.push({
      rule: 'hanja',
      detail: '본문에 한자 노출',
      excerpt: hanjaMatch[0],
    });
  }

  // 2. 옛 "X과/와 Y" 오행 라벨 0건
  for (const label of FORBIDDEN_OLD_ELEMENT_LABELS) {
    if (body.includes(label)) {
      failures.push({
        rule: 'x-과-label',
        detail: `옛 오행 라벨 사용 — 자연 비유로 (새싹/햇살/흙/쇠/물 의 결)`,
        excerpt: label,
      });
    }
  }

  // 3. 영어 단어 0건 (한자/숫자/percent 제외, ASCII 2자 이상)
  const englishMatches = body.match(ENGLISH_WORD_PATTERN);
  if (englishMatches && englishMatches.length > 0) {
    failures.push({
      rule: 'english',
      detail: '영어 단어 노출',
      excerpt: englishMatches.join(', '),
    });
  }

  // 4. 단정·공포 표현 0건
  for (const phrase of FORBIDDEN_ABSOLUTE_PHRASES) {
    if (body.includes(phrase)) {
      failures.push({
        rule: 'absolute',
        detail: '안심하고 보기 정책과 충돌하는 단정·자극 표현',
        excerpt: phrase,
      });
    }
  }

  // 5. cross-chapter 중복 — 본문 첫 문장이 다른 챕터와 정확히 일치하면 fail
  if (options.allChapters && typeof options.chapterId === 'number') {
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

  return { passed: failures.length === 0, failures };
}

function firstSentenceOf(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^[^.?!\n]+/);
  return (match ? match[0] : trimmed).trim();
}
