// 2026-05-15 PR 3 — 운세톡톡 벤치마크 (일진_점수산출_알고리즘_정교화.md 부록):
// 명리 관계 룰 완전 정리. 천간합/충, 지지 삼합/육합/방합/충/형/해/파/원진/자형.
// 일진 점수 산출 + 메시지 케이스 탐지에 함께 사용된다.

export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type Elem = '목' | '화' | '토' | '금' | '수';

// 천간 → 오행
export const STEM_TO_ELEMENT: Record<Stem, Elem> = {
  甲: '목', 乙: '목', 丙: '화', 丁: '화', 戊: '토',
  己: '토', 庚: '금', 辛: '금', 壬: '수', 癸: '수',
};

// 천간 → 음양 (양:true, 음:false)
export const STEM_TO_YANG: Record<Stem, boolean> = {
  甲: true, 乙: false, 丙: true, 丁: false, 戊: true,
  己: false, 庚: true, 辛: false, 壬: true, 癸: false,
};

// 지지 → 오행
export const BRANCH_TO_ELEMENT: Record<Branch, Elem> = {
  子: '수', 丑: '토', 寅: '목', 卯: '목', 辰: '토', 巳: '화',
  午: '화', 未: '토', 申: '금', 酉: '금', 戌: '토', 亥: '수',
};

// 천간합 5쌍 → 化 오행 (sipsung 분석에 사용).
const STEM_HAP_PAIRS: Array<[Stem, Stem, Elem]> = [
  ['甲', '己', '토'],
  ['乙', '庚', '금'],
  ['丙', '辛', '수'],
  ['丁', '壬', '목'],
  ['戊', '癸', '화'],
];

export function isStemHap(a: string, b: string): boolean {
  return STEM_HAP_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// 천간충 4쌍 (戊·己 제외).
const STEM_CHUNG_PAIRS: Array<[Stem, Stem]> = [
  ['甲', '庚'],
  ['乙', '辛'],
  ['丙', '壬'],
  ['丁', '癸'],
];

export function isStemChung(a: string, b: string): boolean {
  return STEM_CHUNG_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// 지지 삼합 (4그룹).
export const SAMHAP_GROUPS: Array<{ element: Elem; branches: Branch[] }> = [
  { element: '수', branches: ['申', '子', '辰'] },
  { element: '화', branches: ['寅', '午', '戌'] },
  { element: '금', branches: ['巳', '酉', '丑'] },
  { element: '목', branches: ['亥', '卯', '未'] },
];

export function isSamhap(a: string, b: string): boolean {
  if (a === b) return false;
  return SAMHAP_GROUPS.some((g) => g.branches.includes(a as Branch) && g.branches.includes(b as Branch));
}

// 지지 육합 (6쌍).
const YUKHAP_PAIRS: Array<[Branch, Branch]> = [
  ['子', '丑'],
  ['寅', '亥'],
  ['卯', '戌'],
  ['辰', '酉'],
  ['巳', '申'],
  ['午', '未'],
];

export function isYukhap(a: string, b: string): boolean {
  return YUKHAP_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// 지지 방합 (4계절).
const BANGHAP_GROUPS: Array<{ element: Elem; branches: Branch[] }> = [
  { element: '목', branches: ['寅', '卯', '辰'] }, // 봄
  { element: '화', branches: ['巳', '午', '未'] }, // 여름
  { element: '금', branches: ['申', '酉', '戌'] }, // 가을
  { element: '수', branches: ['亥', '子', '丑'] }, // 겨울
];

export function isBanghap(a: string, b: string): boolean {
  if (a === b) return false;
  return BANGHAP_GROUPS.some((g) => g.branches.includes(a as Branch) && g.branches.includes(b as Branch));
}

// 지지 충 (6쌍).
const BRANCH_CHUNG_PAIRS: Array<[Branch, Branch]> = [
  ['子', '午'],
  ['丑', '未'],
  ['寅', '申'],
  ['卯', '酉'],
  ['辰', '戌'],
  ['巳', '亥'],
];

export function isBranchChung(a: string, b: string): boolean {
  return BRANCH_CHUNG_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// 지지 형 (寅巳申 / 丑戌未 삼형, 子卯 상형, 辰辰·午午·酉酉·亥亥 자형).
const HYUNG_SAMHYUNG: Branch[][] = [
  ['寅', '巳', '申'],
  ['丑', '戌', '未'],
];
const HYUNG_SANGHYUNG: Array<[Branch, Branch]> = [['子', '卯']];
const HYUNG_JAHYUNG = new Set<Branch>(['辰', '午', '酉', '亥']);

export function isBranchHyung(a: string, b: string): boolean {
  if (a === b && HYUNG_JAHYUNG.has(a as Branch)) return true;
  for (const tri of HYUNG_SAMHYUNG) {
    if (tri.includes(a as Branch) && tri.includes(b as Branch) && a !== b) return true;
  }
  return HYUNG_SANGHYUNG.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

export function isJahyung(a: string, b: string): boolean {
  return a === b && HYUNG_JAHYUNG.has(a as Branch);
}

// 지지 해 (6쌍).
const BRANCH_HAE_PAIRS: Array<[Branch, Branch]> = [
  ['子', '未'],
  ['丑', '午'],
  ['寅', '巳'],
  ['卯', '辰'],
  ['申', '亥'],
  ['酉', '戌'],
];

export function isBranchHae(a: string, b: string): boolean {
  return BRANCH_HAE_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// 지지 파 (6쌍).
const BRANCH_PA_PAIRS: Array<[Branch, Branch]> = [
  ['子', '酉'],
  ['丑', '辰'],
  ['寅', '亥'],
  ['卯', '午'],
  ['巳', '申'],
  ['戌', '未'],
];

export function isBranchPa(a: string, b: string): boolean {
  return BRANCH_PA_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// 지지 원진 (6쌍).
const BRANCH_WONJIN_PAIRS: Array<[Branch, Branch]> = [
  ['子', '未'],
  ['丑', '午'],
  ['寅', '酉'],
  ['卯', '申'],
  ['辰', '亥'],
  ['巳', '戌'],
];

export function isBranchWonjin(a: string, b: string): boolean {
  return BRANCH_WONJIN_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// 십성 계산 — 일간 vs 다른 천간 → 비견/겁재/식신/상관/편재/정재/편관/정관/편인/정인.
export type SipSung =
  | '비견' | '겁재' | '식신' | '상관' | '편재'
  | '정재' | '편관' | '정관' | '편인' | '정인';

// 오행 상생 관계: 목→화→토→금→수→목 순. dayMaster 가 X 를 생/극 하는지 판정.
const ELEMENT_GENERATES: Record<Elem, Elem> = {
  목: '화', 화: '토', 토: '금', 금: '수', 수: '목',
};
const ELEMENT_CONTROLS: Record<Elem, Elem> = {
  목: '토', 화: '금', 토: '수', 금: '목', 수: '화',
};

export function calculateSipsung(dayMaster: Stem, otherStem: Stem): SipSung {
  const dmEl = STEM_TO_ELEMENT[dayMaster];
  const otEl = STEM_TO_ELEMENT[otherStem];
  const dmYang = STEM_TO_YANG[dayMaster];
  const otYang = STEM_TO_YANG[otherStem];
  const sameYinYang = dmYang === otYang;

  if (dmEl === otEl) return sameYinYang ? '비견' : '겁재';
  if (ELEMENT_GENERATES[dmEl] === otEl) return sameYinYang ? '식신' : '상관';
  if (ELEMENT_CONTROLS[dmEl] === otEl) return sameYinYang ? '편재' : '정재';
  if (ELEMENT_CONTROLS[otEl] === dmEl) return sameYinYang ? '편관' : '정관';
  // 나머지 = 일간을 생함 (otEl → dmEl).
  return sameYinYang ? '편인' : '정인';
}

// 12운성 — 일간 천간이 특정 지지에서 어떤 단계에 있는지.
// 일진_점수산출_알고리즘_정교화.md 4-8 의 12 단계.
type TwelveStage =
  | '장생' | '목욕' | '관대' | '건록' | '제왕' | '쇠'
  | '병' | '사' | '묘' | '절' | '태' | '양';

const TWELVE_STAGE_ORDER: TwelveStage[] = [
  '장생', '목욕', '관대', '건록', '제왕', '쇠',
  '병', '사', '묘', '절', '태', '양',
];

// 일간별 장생지 (12운성 시작점).
const STEM_TO_CHANGSAENG: Record<Stem, Branch> = {
  甲: '亥', 丙: '寅', 戊: '寅', 庚: '巳', 壬: '申',
  乙: '午', 丁: '酉', 己: '酉', 辛: '子', 癸: '卯',
};

const BRANCH_ORDER: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

export function getTwelveStage(dayMaster: Stem, branch: Branch): TwelveStage {
  const start = STEM_TO_CHANGSAENG[dayMaster];
  const startIdx = BRANCH_ORDER.indexOf(start);
  const targetIdx = BRANCH_ORDER.indexOf(branch);
  // 양간 (甲丙戊庚壬): 순행. 음간 (乙丁己辛癸): 역행.
  const yang = STEM_TO_YANG[dayMaster];
  let offset: number;
  if (yang) {
    offset = (targetIdx - startIdx + 12) % 12;
  } else {
    offset = (startIdx - targetIdx + 12) % 12;
  }
  return TWELVE_STAGE_ORDER[offset]!;
}
