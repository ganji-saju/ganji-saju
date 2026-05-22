// 2026-05-20 Phase 8-C — 12지 (鼠丑寅卯辰巳午未申酉戌亥) 의 전통 호환 매트릭스.
//   삼합 (三合, best partners 3개 group) + 육합 (六合, good pair 1개) + 육충 (六沖, clash 1개).
//   /zodiac/[slug] detail 페이지의 §궁합 좋은 띠 / §조심할 띠 section 에 사용.
//
//   전통 출처: 명리학 십이지 기본 합·충 — 한국명리연구의 표준 패턴.
//   각 띠는 ideal 4개 (삼합 2 + 육합 1 + 자기 자신은 제외하면서 보조 1) +
//   beware 1개 (육충) 로 표현.

// 2026-05-20 — slug 시스템: URL routable 한 free-content-pages.ts 의 ZODIAC_FORTUNES.slug 사용.
//   ('goat' 는 12지 표준 영문 'sheep' 대신 free-content-pages 의 routable slug 와 맞춤.)
export type ZodiacFortuneSlug =
  | 'rat'
  | 'ox'
  | 'tiger'
  | 'rabbit'
  | 'dragon'
  | 'snake'
  | 'horse'
  | 'goat'
  | 'monkey'
  | 'rooster'
  | 'dog'
  | 'pig';

export interface ZodiacRelation {
  /** 합·맞음 (삼합 + 육합) — 동업·결혼·중요 관계에서 합이 잘 맞는 띠. */
  idealMatches: ReadonlyArray<ZodiacFortuneSlug>;
  /** 충·부딪힘 (육충) — 거리를 두거나 표현 톤을 조심해야 하는 띠. */
  bewareMatches: ReadonlyArray<ZodiacFortuneSlug>;
  /** 한 줄 호환 요약 (UI surface 용). */
  matchSummary: string;
  /** 한 줄 충·도전 요약. */
  bewareSummary: string;
}

/**
 * 12지 전통 호환 매트릭스.
 *
 * 삼합 (三合):
 *   申子辰 (원숭이·쥐·용) / 亥卯未 (돼지·토끼·양) /
 *   寅午戌 (호랑이·말·개) / 巳酉丑 (뱀·닭·소)
 *
 * 육합 (六合):
 *   子丑(쥐·소) / 寅亥(호랑이·돼지) / 卯戌(토끼·개) /
 *   辰酉(용·닭) / 巳申(뱀·원숭이) / 午未(말·양)
 *
 * 육충 (六沖, 갈등 페어):
 *   子午(쥐·말) / 丑未(소·양) / 寅申(호랑이·원숭이) /
 *   卯酉(토끼·닭) / 辰戌(용·개) / 巳亥(뱀·돼지)
 */
export const ZODIAC_RELATIONS: Record<ZodiacFortuneSlug, ZodiacRelation> = {
  rat: {
    // 申子辰 (원숭이·쥐·용) — 자기 제외 → 원숭이/용. 子丑 (쥐·소) → 소. 보조: 돼지 (해자축 방합).
    idealMatches: ['monkey', 'dragon', 'ox', 'pig'],
    bewareMatches: ['horse'],
    matchSummary: '원숭이·용·소와 합이 잘 맞아 함께 일할 때 흐름이 빠릅니다.',
    bewareSummary: '말띠와는 추진 속도와 표현 톤이 달라 충돌이 잦을 수 있습니다.',
  },
  ox: {
    // 巳酉丑 (뱀·닭·소) — 자기 제외 → 뱀/닭. 子丑 (쥐·소) → 쥐. 보조: 돼지 (해자축 방합).
    idealMatches: ['snake', 'rooster', 'rat', 'pig'],
    bewareMatches: ['goat'],
    matchSummary: '뱀·닭·쥐와 안정적 동맹을 이루며 차분히 결과를 만듭니다.',
    bewareSummary: '양띠와는 기질이 다른 속도라 함께 결정할 때 마찰이 생깁니다.',
  },
  tiger: {
    // 寅午戌 (호랑이·말·개) — 자기 제외 → 말/개. 寅亥 (호랑이·돼지) → 돼지. 보조: 토끼 (인묘진 방합).
    idealMatches: ['horse', 'dog', 'pig', 'rabbit'],
    bewareMatches: ['monkey'],
    matchSummary: '말·개·돼지와 의기투합이 강해 함께 추진력을 키울 수 있습니다.',
    bewareSummary: '원숭이띠와는 주도권 다툼이 일어나기 쉬워 거리 조절이 필요합니다.',
  },
  rabbit: {
    // 亥卯未 (돼지·토끼·양) — 자기 제외 → 돼지/양. 卯戌 (토끼·개) → 개. 보조: 호랑이 (인묘진 방합).
    idealMatches: ['pig', 'goat', 'dog', 'tiger'],
    bewareMatches: ['rooster'],
    matchSummary: '돼지·양·개와 따뜻한 관계를 이루며 감정 흐름이 잘 맞습니다.',
    bewareSummary: '닭띠와는 표현 방식이 달라 작은 말에 서로 상처받기 쉽습니다.',
  },
  dragon: {
    // 申子辰 (원숭이·쥐·용) — 자기 제외 → 원숭이/쥐. 辰酉 (용·닭) → 닭. 보조: 뱀 (사오미 가까운 자리).
    idealMatches: ['monkey', 'rat', 'rooster', 'snake'],
    bewareMatches: ['dog'],
    matchSummary: '원숭이·쥐·닭과 함께할 때 큰 그림을 그리고 실행이 빨라집니다.',
    bewareSummary: '개띠와는 가치관 충돌이 잦아 큰 결정에서 마찰이 생깁니다.',
  },
  snake: {
    // 巳酉丑 (뱀·닭·소) — 자기 제외 → 닭/소. 巳申 (뱀·원숭이) → 원숭이. 보조: 용 (이웃 자리).
    idealMatches: ['rooster', 'ox', 'monkey', 'dragon'],
    bewareMatches: ['pig'],
    matchSummary: '닭·소·원숭이와 차분한 전략을 같이 설계하기 좋은 관계입니다.',
    bewareSummary: '돼지띠와는 결정 속도와 위험감수 성향이 달라 서로 답답합니다.',
  },
  horse: {
    // 寅午戌 (호랑이·말·개) — 자기 제외 → 호랑이/개. 午未 (말·양) → 양. 보조: 뱀 (사오미 방합).
    idealMatches: ['tiger', 'dog', 'goat', 'snake'],
    bewareMatches: ['rat'],
    matchSummary: '호랑이·개·양과 활기찬 협업이 잘 이루어집니다.',
    bewareSummary: '쥐띠와는 우선순위가 정반대라 충돌이 잦아질 수 있습니다.',
  },
  goat: {
    // 亥卯未 (돼지·토끼·양) — 자기 제외 → 돼지/토끼. 午未 (말·양) → 말. 보조: 뱀 (사오미 방합).
    idealMatches: ['pig', 'rabbit', 'horse', 'snake'],
    bewareMatches: ['ox'],
    matchSummary: '돼지·토끼·말과 정서적 교감이 깊어 신뢰가 빨리 쌓입니다.',
    bewareSummary: '소띠와는 결정 방식이 달라 함께 진행할 때 어긋남이 자주 보입니다.',
  },
  monkey: {
    // 申子辰 (원숭이·쥐·용) — 자기 제외 → 쥐/용. 巳申 (뱀·원숭이) → 뱀. 보조: 닭 (신유술 방합).
    idealMatches: ['rat', 'dragon', 'snake', 'rooster'],
    bewareMatches: ['tiger'],
    matchSummary: '쥐·용·뱀·닭과 함께할 때 아이디어와 실행이 빠르게 굴러갑니다.',
    bewareSummary: '호랑이띠와는 자존심 줄다리기가 길어져 합의가 늦어집니다.',
  },
  rooster: {
    // 巳酉丑 (뱀·닭·소) — 자기 제외 → 뱀/소. 辰酉 (용·닭) → 용. 보조: 원숭이 (신유술 방합).
    idealMatches: ['snake', 'ox', 'dragon', 'monkey'],
    bewareMatches: ['rabbit'],
    matchSummary: '뱀·소·용·원숭이와 함께 일하면 기준이 또렷해지고 마무리가 깔끔합니다.',
    bewareSummary: '토끼띠와는 디테일 vs 큰 그림 차이로 평가 충돌이 생기기 쉽습니다.',
  },
  dog: {
    // 寅午戌 (호랑이·말·개) — 자기 제외 → 호랑이/말. 卯戌 (토끼·개) → 토끼. 보조: 돼지 (해자축 가까움).
    idealMatches: ['tiger', 'horse', 'rabbit', 'pig'],
    bewareMatches: ['dragon'],
    matchSummary: '호랑이·말·토끼·돼지와 함께할 때 신뢰가 빠르게 쌓입니다.',
    bewareSummary: '용띠와는 추진 방향이 정반대로 부딪히기 쉬워 거리감이 필요합니다.',
  },
  pig: {
    // 亥卯未 (돼지·토끼·양) — 자기 제외 → 토끼/양. 寅亥 (호랑이·돼지) → 호랑이. 보조: 쥐 (해자축 방합).
    idealMatches: ['rabbit', 'goat', 'tiger', 'rat'],
    bewareMatches: ['snake'],
    matchSummary: '토끼·양·호랑이·쥐와 깊은 신뢰를 쌓기 좋은 흐름입니다.',
    bewareSummary: '뱀띠와는 위험 감수 방식이 정반대라 함께 결정하기 어렵습니다.',
  },
};
