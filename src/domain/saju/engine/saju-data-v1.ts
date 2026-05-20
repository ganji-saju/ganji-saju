import type {
  BirthInput,
  Branch,
  Element,
  JasiMethod,
  Pillar as LegacyPillar,
  SajuResult as LegacySajuResult,
  Stem,
  SolarTimeMode,
  YinYang,
} from '@/lib/saju/types';
import type { SajuDataV2 } from './saju-data-v2-upgrade';
import { Solar } from 'lunar-typescript';
import { calculateSaju } from '@/lib/saju/pillars';
import {
  buildBirthTimeCorrection,
  DEFAULT_BIRTH_TIMEZONE,
  type BirthTimeCorrection,
} from '@/lib/saju/birth-location';
import {
  buildOrreryReferenceExtension,
  type SajuOrreryExtension,
} from './orrery-adapter';

export const SAJU_DATA_V1 = 'saju-data/v1' as const;
export const SAJU_RULE_SET_V1 = 'moonlight-rules/v1' as const;

export type SajuDataVersion = typeof SAJU_DATA_V1;
export type SajuComputationSource =
  | 'legacy-typescript'
  | 'rule-based-typescript'
  | 'python-engine'
  | 'orrery-reference';
export type SajuCompleteness = 'seed' | 'partial' | 'complete';

export type SajuPendingSection =
  | 'tenGods'
  | 'strength'
  | 'pattern'
  | 'yongsin'
  | 'majorLuck'
  | 'currentLuck';

export type TenGodCode =
  | '비견'
  | '겁재'
  | '식신'
  | '상관'
  | '편재'
  | '정재'
  | '편관'
  | '정관'
  | '편인'
  | '정인';

export type FiveElementState = 'strong' | 'balanced' | 'weak' | 'missing';
export type StrengthLevel = '신강' | '중화' | '신약';
export type PatternCategory = '정격' | '변격' | '특수격';
export type YongsinMethod =
  | '조후용신'
  | '억부용신'
  | '희기신보정'
  | 'legacy-placeholder';
export type YongsinConfidence = '높음' | '중간' | '낮음';
export type YongsinCandidateRole = 'primary' | 'support' | 'reference';
export type SajuSymbolType = 'stem' | 'branch' | 'element';
type SeasonKey = 'spring' | 'summer' | 'autumn' | 'winter' | 'earth';
type LocalDatePart = 'year' | 'month' | 'day' | 'hour' | 'minute';

interface LocalDateTimeSnapshot {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const STEM_ELEMENTS: Record<Stem, Element> = {
  '甲': '목',
  '乙': '목',
  '丙': '화',
  '丁': '화',
  '戊': '토',
  '己': '토',
  '庚': '금',
  '辛': '금',
  '壬': '수',
  '癸': '수',
};

const ELEMENT_HANJA: Record<Element, string> = {
  목: '木',
  화: '火',
  토: '土',
  금: '金',
  수: '水',
};

const ELEMENT_PLAIN_EFFECT: Record<Element, string> = {
  목: '막힌 흐름을 틔우고 새 방향을 세우는',
  화: '차가운 기운을 데우고 표현력을 살리는',
  토: '흩어진 기운을 붙잡아 현실감과 안정감을 만드는',
  금: '복잡한 흐름을 정리하고 기준을 세우는',
  수: '과열된 흐름을 식히고 생각을 깊게 만드는',
};

const ELEMENT_PRACTICAL_ACTIONS: Record<Element, string[]> = {
  목: ['새 계획을 작게 시작하기', '걷기와 스트레칭으로 몸의 흐름 열기', '배움과 성장 루틴 만들기'],
  화: ['햇빛을 쬐며 활동량 올리기', '말과 표현을 숨기지 않기', '작은 성취를 빠르게 확인하기'],
  토: ['생활 리듬을 일정하게 고정하기', '돈과 일정을 장부처럼 정리하기', '약속과 책임 범위를 분명히 하기'],
  금: ['우선순위와 기준을 글로 적기', '불필요한 관계와 일을 덜어내기', '정리·편집·검토 시간을 확보하기'],
  수: ['수면과 회복 시간을 먼저 확보하기', '결정 전 자료를 모아 차분히 검토하기', '물가 산책이나 조용한 환경을 활용하기'],
};

const YONGSIN_TERM_EXPLANATIONS = [
  {
    term: '용신',
    hanja: '用神',
    meaning: '명식이 균형을 잡기 위해 가장 먼저 빌려 쓰는 핵심 기운입니다.',
  },
  {
    term: '희신',
    hanja: '喜神',
    meaning: '용신을 도와 결과를 편하게 만드는 보조 기운입니다.',
  },
  {
    term: '기신',
    hanja: '忌神',
    meaning: '이미 과하거나 균형을 흐릴 수 있어 조심해서 써야 하는 기운입니다.',
  },
  {
    term: '조후',
    hanja: '調候',
    meaning: '계절의 춥고 더움, 마르고 습함을 먼저 맞추는 판단입니다.',
  },
  {
    term: '억부',
    hanja: '抑扶',
    meaning: '일간이 너무 강하면 덜어내고 약하면 도와주는 강약 판단입니다.',
  },
] as const;

const DAY_MASTER_METAPHORS: Record<Stem, string> = {
  '甲': '큰 나무',
  '乙': '덩굴과 화초',
  '丙': '한낮의 태양',
  '丁': '촛불과 등불',
  '戊': '넓은 대지',
  '己': '기름진 밭흙',
  '庚': '단단한 광석',
  '辛': '세공된 보석',
  '壬': '큰 강과 바다',
  '癸': '이슬과 비',
};

const DAY_MASTER_DESCRIPTIONS: Record<Stem, string> = {
  '甲': '곧게 자라는 큰 나무처럼 원칙과 추진력이 분명한 성향입니다.',
  '乙': '바람을 타는 덩굴처럼 유연하고 섬세하게 관계를 읽는 성향입니다.',
  '丙': '햇빛처럼 밝게 드러나며 주변을 움직이게 하는 표현력이 강합니다.',
  '丁': '작은 불씨처럼 집중력과 지속력이 좋아 한 분야를 깊게 파고듭니다.',
  '戊': '넓은 땅처럼 안정감과 책임감이 강하고 중심을 잡는 힘이 있습니다.',
  '己': '잘 다듬어진 흙처럼 현실 감각과 조정 능력이 뛰어난 편입니다.',
  '庚': '광석을 다루듯 판단이 분명하고 결단이 빠른 편입니다.',
  '辛': '보석을 세공하듯 정교함과 예민한 안목이 살아 있는 성향입니다.',
  '壬': '큰 물줄기처럼 포용력과 확장성이 좋고 흐름을 크게 읽습니다.',
  '癸': '이슬비처럼 세밀하고 직관적으로 분위기를 감지하는 성향입니다.',
};

const BRANCH_HIDDEN_STEMS: Record<Branch, Stem[]> = {
  '子': ['癸'],
  '丑': ['己', '癸', '辛'],
  '寅': ['甲', '丙', '戊'],
  '卯': ['乙'],
  '辰': ['戊', '乙', '癸'],
  '巳': ['丙', '戊', '庚'],
  '午': ['丁', '己'],
  '未': ['己', '丁', '乙'],
  '申': ['庚', '壬', '戊'],
  '酉': ['辛'],
  '戌': ['戊', '辛', '丁'],
  '亥': ['壬', '甲'],
};

const SEASON_BY_BRANCH: Record<Branch, SeasonKey> = {
  '寅': 'spring',
  '卯': 'spring',
  '辰': 'earth',
  '巳': 'summer',
  '午': 'summer',
  '未': 'earth',
  '申': 'autumn',
  '酉': 'autumn',
  '戌': 'earth',
  '亥': 'winter',
  '子': 'winter',
  '丑': 'earth',
};

const SEASON_MAIN_ELEMENT: Record<SeasonKey, Element> = {
  spring: '목',
  summer: '화',
  autumn: '금',
  winter: '수',
  earth: '토',
};

const ELEMENT_SEQUENCE: Element[] = ['목', '화', '토', '금', '수'];
const TEN_GOD_KEYS: TenGodCode[] = ['비견', '겁재', '식신', '상관', '편재', '정재', '편관', '정관', '편인', '정인'];
const HIDDEN_STEM_WEIGHTS = [0.7, 0.4, 0.2];
const DEFAULT_HIDDEN_STEM_WEIGHT = HIDDEN_STEM_WEIGHTS[HIDDEN_STEM_WEIGHTS.length - 1] ?? 0.2;
const DAY_STEM_SCORE = 1.2;
const BRANCH_SCORE = 1.0;
const UNKNOWN_HOUR = 12;
const UNKNOWN_MINUTE = 0;
const KNOWN_MINUTE = 30;
const EIGHT_CHAR_SECT = 2;
const MAJOR_LUCK_COUNT = 10;
type SeasonalYongsinKey = `${Element}-${SeasonKey}`;

const GENERATED_BY_MAP: Record<Element, Element> = {
  목: '화',
  화: '토',
  토: '금',
  금: '수',
  수: '목',
};

const GENERATOR_OF_MAP: Record<Element, Element> = {
  목: '수',
  화: '목',
  토: '화',
  금: '토',
  수: '금',
};

const CONTROLLED_BY_MAP: Record<Element, Element> = {
  목: '토',
  화: '금',
  토: '수',
  금: '목',
  수: '화',
};

const CONTROLLER_OF_MAP: Record<Element, Element> = {
  목: '금',
  화: '수',
  토: '목',
  금: '화',
  수: '토',
};

export interface SajuDataV1 {
  schemaVersion: SajuDataVersion;
  input: SajuInputSnapshot;
  metadata: SajuComputationMetadata;
  pillars: SajuPillars;
  dayMaster: SajuDayMaster;
  fiveElements: SajuFiveElements;
  tenGods: SajuTenGodSummary | null;
  strength: SajuStrength | null;
  pattern: SajuPattern | null;
  yongsin: SajuYongsin | null;
  majorLuck: SajuMajorLuckCycle[] | null;
  currentLuck: SajuCurrentLuck | null;
  extensions: SajuDataExtensions | null;
}

export interface SajuInputSnapshot {
  calendar: 'solar';
  timezone: string;
  location: string | null;
  locationCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  solarTimeMode?: SolarTimeMode;
  birthTimeCorrection?: BirthTimeCorrection | null;
  jasiMethod?: JasiMethod | null;
  birth: {
    year: number;
    month: number;
    day: number;
    hour: number | null;
    minute: number | null;
  };
  gender: 'male' | 'female' | null;
  hourKnown: boolean;
}

export interface SajuComputationMetadata {
  source: SajuComputationSource;
  engineVersion: string;
  ruleSetVersion: string;
  calculatedAt: string;
  completeness: SajuCompleteness;
  pendingSections: SajuPendingSection[];
}

export interface SajuHiddenStem {
  stem: Stem;
  element: Element;
  order: number;
  tenGod: TenGodCode | null;
}

// 2026-05-15 PR 6 — 12운성(十二運星) — 일간 기준 지지의 생애 주기.
// 장생/목욕/관대/건록/제왕/쇠/병/사/묘/절/태/양 12 단계.
// 사주아이 reference: "목욕지에 해당하니 사회적으로 주목받고…" 처럼 적극 활용.
export type TwelveStage =
  | '장생' | '목욕' | '관대' | '건록' | '제왕' | '쇠'
  | '병' | '사' | '묘' | '절' | '태' | '양';

export interface SajuPillar {
  stem: Stem;
  branch: Branch;
  ganzi: string;
  stemElement: Element;
  branchElement: Element;
  yinYang: YinYang;
  /** 천간 십신. 일주 천간(일간)은 null */
  stemTenGod: TenGodCode | null;
  hiddenStems: SajuHiddenStem[];
  /** 2026-05-15 PR 6 — 일간 기준 이 지지의 12운성. 미산출 시 null. */
  twelveStage?: TwelveStage | null;
}

export interface SajuPillars {
  year: SajuPillar;
  month: SajuPillar;
  day: SajuPillar;
  hour: SajuPillar | null;
}

export interface SajuDayMaster {
  stem: Stem;
  element: Element;
  yinYang: YinYang;
  metaphor: string | null;
  description: string | null;
}

export interface SajuFiveElementValue {
  count: number;
  score: number;
  percentage: number;
  state: FiveElementState;
}

export interface SajuFiveElements {
  byElement: Record<Element, SajuFiveElementValue>;
  dominant: Element;
  weakest: Element;
  totalCount: number;
  totalScore: number;
}

export interface SajuTenGodSummary {
  byType: Record<TenGodCode, number>;
  dominant: TenGodCode | null;
}

export interface SajuStrength {
  level: StrengthLevel;
  score: number;
  rationale: string[];
}

export interface SajuPatternCandidate {
  stem: Stem;
  tenGod: TenGodCode | null;
  name: string;
  /** 본기(60) / 중기(30) / 여기(15) + 투출 보너스(+30) + 협력 보너스(+15). */
  score: number;
  source: '본기' | '중기' | '여기';
  /** 천간(연·일·시) 에 같은 stem 이 드러나면 true. */
  tougchul: boolean;
  /** 다른 지지 hidden stems 에 같은 stem 이 존재하는 자리 (예: ['年支','日支']). */
  supportingPillars: string[];
}

export interface SajuPattern {
  name: string;
  category: PatternCategory | null;
  tenGod: TenGodCode | null;
  rationale: string[];
  /** 2026-05-15 P1 추가 — 격국 결정 confidence. 본기 + 투출 = 확정, 본기 단독 = 보통, 중기/여기 = 낮음. */
  confidence: '확정' | '보통' | '낮음';
  /** 채택된 격국 글자가 천간(연/일/시) 에 투출됐는지. */
  tougchul: boolean;
  /** 협력하는 다른 지지 슬롯 라벨. */
  supportingPillars: string[];
  /** 본기/중기/여기 후보 multi-rank (score desc). */
  candidates: SajuPatternCandidate[];
}

export interface SajuSymbolRef {
  type: SajuSymbolType;
  value: string;
  label: string;
}

export interface SajuYongsinTerm {
  term: string;
  hanja: string;
  meaning: string;
}

export interface SajuYongsinCandidate {
  method: YongsinMethod;
  role: YongsinCandidateRole;
  primary: SajuSymbolRef;
  secondary: SajuSymbolRef[];
  kiyshin: SajuSymbolRef[];
  score: number;
  rationale: string[];
  plainSummary: string;
  technicalSummary: string;
}

export interface SajuYongsin {
  primary: SajuSymbolRef;
  secondary: SajuSymbolRef[];
  kiyshin: SajuSymbolRef[];
  method: YongsinMethod;
  rationale: string[];
  candidates?: SajuYongsinCandidate[];
  confidence?: YongsinConfidence;
  plainSummary?: string;
  technicalSummary?: string;
  practicalActions?: string[];
  terms?: SajuYongsinTerm[];
}

export interface SajuMajorLuckCycle {
  index: number;
  ganzi: string;
  startAge: number | null;
  endAge: number | null;
  notes: string[];
}

export interface SajuLuckDescriptor {
  ganzi: string;
  year: number | null;
  month: number | null;
  notes: string[];
}

export interface SajuCurrentLuck {
  currentMajorLuck: SajuMajorLuckCycle | null;
  saewoon: SajuLuckDescriptor | null;
  wolwoon: SajuLuckDescriptor | null;
}

export interface SajuDataExtensions {
  orrery?: SajuOrreryExtension | null;
}

export const SAJU_V1_PENDING_FROM_LEGACY: SajuPendingSection[] = [
  'tenGods',
  'strength',
  'pattern',
  'yongsin',
  'majorLuck',
  'currentLuck',
];

export function seedSajuDataV1FromLegacy(
  input: BirthInput,
  legacy: LegacySajuResult,
  options?: {
    timezone?: string;
    location?: string | null;
    calculatedAt?: string;
    engineVersion?: string;
  }
): SajuDataV1 {
  const calculatedAt = options?.calculatedAt ?? new Date().toISOString();
  const birthTimeCorrection = buildBirthTimeCorrection(input);
  const timezone = input.birthLocation?.timezone ?? options?.timezone ?? DEFAULT_BIRTH_TIMEZONE;

  const seed: SajuDataV1 = {
    schemaVersion: SAJU_DATA_V1,
    input: {
      calendar: 'solar',
      timezone,
      location: input.birthLocation?.label ?? options?.location ?? null,
      locationCode: input.birthLocation?.code ?? null,
      latitude: input.birthLocation?.latitude ?? null,
      longitude: input.birthLocation?.longitude ?? null,
      solarTimeMode: input.solarTimeMode ?? 'standard',
      birthTimeCorrection,
      jasiMethod: input.jasiMethod ?? null,
      birth: {
        year: input.year,
        month: input.month,
        day: input.day,
        hour: input.unknownTime ? null : input.hour ?? null,
        minute: input.unknownTime ? null : input.minute ?? null,
      },
      gender: input.gender ?? null,
      hourKnown: input.unknownTime ? false : input.hour !== undefined,
    },
    metadata: {
      source: 'legacy-typescript',
      engineVersion: options?.engineVersion ?? 'legacy-typescript-v0',
      ruleSetVersion: SAJU_RULE_SET_V1,
      calculatedAt,
      completeness: 'seed',
      pendingSections: [...SAJU_V1_PENDING_FROM_LEGACY],
    },
    pillars: {
      year: toSajuPillar(legacy.year),
      month: toSajuPillar(legacy.month),
      day: toSajuPillar(legacy.day),
      hour: legacy.hour ? toSajuPillar(legacy.hour) : null,
    },
    dayMaster: {
      stem: legacy.dayMaster,
      element: legacy.day.stemElement,
      yinYang: legacy.day.yinYang,
      metaphor: null,
      description: null,
    },
    fiveElements: toFiveElements(legacy),
    tenGods: null,
    strength: null,
    pattern: null,
    yongsin: null,
    majorLuck: null,
    currentLuck: null,
    extensions: null,
  };

  return enrichSajuDataV1(seed);
}

export function calculateSajuDataV1(
  input: BirthInput,
  options?: {
    timezone?: string;
    location?: string | null;
    calculatedAt?: string;
    engineVersion?: string;
  }
): SajuDataV1 {
  const legacy = calculateSaju(input);
  return seedSajuDataV1FromLegacy(input, legacy, {
    ...options,
    engineVersion: options?.engineVersion ?? 'legacy-typescript-v1-seed',
  });
}

export function normalizeToSajuDataV1(
  input: BirthInput,
  value: unknown,
  options?: {
    timezone?: string;
    location?: string | null;
    calculatedAt?: string;
    engineVersion?: string;
  }
): SajuDataV1 {
  if (isSajuDataV1(value)) {
    const normalized = ensureMetadataDefaults(value);
    return shouldPreserveSajuDataV1(normalized) ? normalized : enrichSajuDataV1(normalized);
  }

  if (isLegacySajuResult(value)) {
    return seedSajuDataV1FromLegacy(input, value, options);
  }

  return calculateSajuDataV1(input, options);
}

export function deriveLegacySajuResult(data: SajuDataV1 | SajuDataV2): LegacySajuResult {
  const elements = Object.fromEntries(
    (Object.entries(data.fiveElements.byElement) as [Element, SajuFiveElementValue][]).map(
      ([element, value]) => [element, value.count]
    )
  ) as Record<Element, number>;

  return {
    year: toLegacyPillar(data.pillars.year),
    month: toLegacyPillar(data.pillars.month),
    day: toLegacyPillar(data.pillars.day),
    hour: data.pillars.hour ? toLegacyPillar(data.pillars.hour) : null,
    elements,
    dominantElement: data.fiveElements.dominant,
    weakestElement: data.fiveElements.weakest,
    dayMaster: data.dayMaster.stem,
  };
}

function toSajuPillar(pillar: LegacyPillar): SajuPillar {
  return {
    stem: pillar.stem,
    branch: pillar.branch,
    ganzi: `${pillar.stem}${pillar.branch}`,
    stemElement: pillar.stemElement,
    branchElement: pillar.branchElement,
    yinYang: pillar.yinYang,
    stemTenGod: null, // enrichPillar에서 채워짐
    hiddenStems: [],
  };
}

function toFiveElements(legacy: LegacySajuResult): SajuFiveElements {
  const totalCount = Object.values(legacy.elements).reduce((sum, count) => sum + count, 0);
  const highest = Math.max(...Object.values(legacy.elements));
  const lowest = Math.min(...Object.values(legacy.elements));

  const byElement = Object.fromEntries(
    (Object.entries(legacy.elements) as [Element, number][]).map(([element, count]) => [
      element,
      {
        count,
        score: count,
        percentage: totalCount > 0 ? Math.round((count / totalCount) * 1000) / 10 : 0,
        state: classifyElement(count, highest, lowest),
      },
    ])
  ) as Record<Element, SajuFiveElementValue>;

  return {
    byElement,
    dominant: legacy.dominantElement,
    weakest: legacy.weakestElement,
    totalCount,
    totalScore: totalCount,
  };
}

function enrichSajuDataV1(base: SajuDataV1): SajuDataV1 {
  const dayMasterStem = base.dayMaster.stem;
  const pillars = enrichPillars(base.pillars, dayMasterStem);
  const fiveElements = calculateFiveElements(pillars);
  const tenGods = calculateTenGodSummary(pillars, dayMasterStem);
  const strength = calculateStrength(pillars, dayMasterStem, fiveElements);
  const pattern = calculatePattern(pillars, dayMasterStem);
  const yongsin = calculateYongsin(pillars, base.dayMaster.element, fiveElements, strength);
  const computedLuck = calculateLuckData(base.input, base.metadata.calculatedAt);
  const majorLuck = computedLuck.majorLuck ?? base.majorLuck;
  const currentLuck = computedLuck.currentLuck ?? base.currentLuck;
  const pendingSections = getPendingSections({
    ...base,
    tenGods,
    strength,
    pattern,
    yongsin,
    majorLuck,
    currentLuck,
  });

  const next: SajuDataV1 = {
    ...base,
    metadata: {
      ...base.metadata,
      source: 'orrery-reference',
      engineVersion: 'orrery-reference-v1',
      ruleSetVersion: base.metadata.ruleSetVersion ?? SAJU_RULE_SET_V1,
      completeness: pendingSections.length === 0 ? 'complete' : 'partial',
      pendingSections,
    },
    pillars,
    dayMaster: {
      ...base.dayMaster,
      metaphor: DAY_MASTER_METAPHORS[dayMasterStem],
      description: DAY_MASTER_DESCRIPTIONS[dayMasterStem],
    },
    fiveElements,
    tenGods,
    strength,
    pattern,
    yongsin,
    majorLuck,
    currentLuck,
  };

  return {
    ...next,
    extensions: {
      ...(next.extensions ?? {}),
      orrery: buildOrreryReferenceExtension(next),
    },
  };
}

function ensureMetadataDefaults(value: SajuDataV1): SajuDataV1 {
  if (value.metadata.ruleSetVersion) return value;
  return {
    ...value,
    metadata: {
      ...value.metadata,
      ruleSetVersion: SAJU_RULE_SET_V1,
    },
  };
}

function classifyElement(
  count: number,
  highest: number,
  lowest: number
): FiveElementState {
  if (count === 0) return 'missing';
  if (count === highest) return 'strong';
  if (count === lowest) return 'weak';
  return 'balanced';
}

function toLegacyPillar(pillar: SajuPillar): LegacyPillar {
  return {
    stem: pillar.stem,
    branch: pillar.branch,
    stemElement: pillar.stemElement,
    branchElement: pillar.branchElement,
    yinYang: pillar.yinYang,
  };
}

function isSajuDataV1(value: unknown): value is SajuDataV1 {
  return (
    isRecord(value) &&
    value.schemaVersion === SAJU_DATA_V1 &&
    isRecord(value.input) &&
    isRecord(value.pillars) &&
    isRecord(value.fiveElements) &&
    isRecord(value.metadata)
  );
}

function isLegacySajuResult(value: unknown): value is LegacySajuResult {
  return (
    isRecord(value) &&
    isRecord(value.year) &&
    isRecord(value.month) &&
    isRecord(value.day) &&
    isRecord(value.elements) &&
    typeof value.dayMaster === 'string' &&
    typeof value.dominantElement === 'string' &&
    typeof value.weakestElement === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasEnrichedPillarData(value: SajuDataV1) {
  const pillars = [
    value.pillars.year,
    value.pillars.month,
    value.pillars.day,
    value.pillars.hour,
  ].filter((pillar): pillar is SajuPillar => Boolean(pillar));

  return pillars.every(
    (pillar) =>
      Object.prototype.hasOwnProperty.call(pillar, 'stemTenGod') &&
      Array.isArray(pillar.hiddenStems)
  );
}

function hasEnrichedYongsinData(value: SajuDataV1) {
  return Boolean(
    value.yongsin?.candidates?.length &&
      value.yongsin.confidence &&
      value.yongsin.plainSummary &&
      value.yongsin.technicalSummary
  );
}

function shouldPreserveSajuDataV1(value: SajuDataV1) {
  if (value.metadata.source === 'python-engine') {
    return hasEnrichedPillarData(value);
  }

  if (
    value.metadata.source === 'rule-based-typescript' ||
    value.metadata.source === 'orrery-reference'
  ) {
    return Boolean(
      value.tenGods &&
        value.strength &&
        value.pattern &&
        value.yongsin &&
        value.majorLuck &&
        value.currentLuck &&
        value.extensions?.orrery &&
        hasEnrichedYongsinData(value) &&
        hasEnrichedPillarData(value)
    );
  }

  return value.metadata.completeness === 'complete' && hasEnrichedPillarData(value) && hasEnrichedYongsinData(value);
}

function getPendingSections(base: SajuDataV1): SajuPendingSection[] {
  const pending: SajuPendingSection[] = [];

  if (!base.tenGods) pending.push('tenGods');
  if (!base.strength) pending.push('strength');
  if (!base.pattern) pending.push('pattern');
  if (!base.yongsin) pending.push('yongsin');
  if (!base.majorLuck) pending.push('majorLuck');
  if (!base.currentLuck) pending.push('currentLuck');

  return pending;
}

function enrichPillars(pillars: SajuPillars, dayMasterStem: Stem): SajuPillars {
  return {
    year: enrichPillar(pillars.year, dayMasterStem, false),
    month: enrichPillar(pillars.month, dayMasterStem, false),
    day: enrichPillar(pillars.day, dayMasterStem, true),
    hour: pillars.hour ? enrichPillar(pillars.hour, dayMasterStem, false) : null,
  };
}

// 2026-05-15 PR 6 — 12운성(十二運星) 매트릭스.
// 행: 일간(천간 10개) · 열: 지지(12개) · 셀: 12운성 단계.
// 표준 명리: 양간(甲丙戊庚壬)은 순행, 음간(乙丁己辛癸)은 역행.
// 각 일간의 장생지점 → 인오신해유진/유사인해/술/축... 표준 매핑 사용.
const TWELVE_STAGE_ORDER: TwelveStage[] = [
  '장생', '목욕', '관대', '건록', '제왕', '쇠',
  '병', '사', '묘', '절', '태', '양',
];
const BRANCH_INDEX: Record<Branch, number> = {
  '子': 0, '丑': 1, '寅': 2, '卯': 3, '辰': 4, '巳': 5,
  '午': 6, '未': 7, '申': 8, '酉': 9, '戌': 10, '亥': 11,
};
// 각 일간의 장생(starting point)이 위치하는 지지 + 순행/역행.
const TWELVE_STAGE_START: Record<Stem, { startBranch: Branch; direction: 1 | -1 }> = {
  '甲': { startBranch: '亥', direction: 1 },  // 양목 — 亥 장생 순행
  '乙': { startBranch: '午', direction: -1 }, // 음목 — 午 장생 역행
  '丙': { startBranch: '寅', direction: 1 },  // 양화 — 寅 장생 순행
  '丁': { startBranch: '酉', direction: -1 }, // 음화 — 酉 장생 역행
  '戊': { startBranch: '寅', direction: 1 },  // 양토 — 丙과 동행
  '己': { startBranch: '酉', direction: -1 }, // 음토 — 丁과 동행
  '庚': { startBranch: '巳', direction: 1 },  // 양금 — 巳 장생 순행
  '辛': { startBranch: '子', direction: -1 }, // 음금 — 子 장생 역행
  '壬': { startBranch: '申', direction: 1 },  // 양수 — 申 장생 순행
  '癸': { startBranch: '卯', direction: -1 }, // 음수 — 卯 장생 역행
};

// 2026-05-15 PR 6 — 일간 + 지지로 12운성 계산. 다른 모듈(빌더)에서도 활용 가능하도록 export.
export function getTwelveStage(dayMasterStem: Stem, branch: Branch): TwelveStage {
  const { startBranch, direction } = TWELVE_STAGE_START[dayMasterStem];
  const startIndex = BRANCH_INDEX[startBranch];
  const branchIndex = BRANCH_INDEX[branch];
  // direction=1: 장생부터 시계방향(子→丑→寅...)
  // direction=-1: 역방향(子→亥→戌...)
  const offset = ((branchIndex - startIndex) * direction + 12) % 12;
  return TWELVE_STAGE_ORDER[offset] ?? '장생';
}

function enrichPillar(pillar: SajuPillar, dayMasterStem: Stem, isDayMaster: boolean): SajuPillar {
  const hiddenStems = BRANCH_HIDDEN_STEMS[pillar.branch].map((stem, index) => ({
    stem,
    element: STEM_ELEMENTS[stem],
    order: index + 1,
    tenGod: getTenGod(dayMasterStem, stem),
  }));

  return {
    ...pillar,
    stemTenGod: isDayMaster ? null : getTenGod(dayMasterStem, pillar.stem),
    hiddenStems,
    // 2026-05-15 PR 6 — 일간 기준 이 지지의 12운성.
    twelveStage: getTwelveStage(dayMasterStem, pillar.branch),
  };
}

function calculateFiveElements(pillars: SajuPillars): SajuFiveElements {
  const counts = initializeElementRecord(0);
  const scores = initializeElementRecord(0);

  for (const pillar of [pillars.year, pillars.month, pillars.day, pillars.hour]) {
    if (!pillar) continue;

    counts[pillar.stemElement] += 1;
    counts[pillar.branchElement] += 1;

    scores[pillar.stemElement] += DAY_STEM_SCORE;
    scores[pillar.branchElement] += BRANCH_SCORE;

    pillar.hiddenStems.forEach((hiddenStem, index) => {
      scores[hiddenStem.element] += HIDDEN_STEM_WEIGHTS[index] ?? DEFAULT_HIDDEN_STEM_WEIGHT;
    });
  }

  const totalCount = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const totalScore = round1(Object.values(scores).reduce((sum, score) => sum + score, 0));
  const scoreValues = Object.values(scores);
  const highest = Math.max(...scoreValues);
  const lowest = Math.min(...scoreValues);
  const dominant = pickExtremum(scores, 'max');
  const weakest = pickExtremum(scores, 'min');

  return {
    byElement: Object.fromEntries(
      ELEMENT_SEQUENCE.map((element) => [
        element,
        {
          count: counts[element],
          score: round1(scores[element]),
          percentage: totalScore > 0 ? round1((scores[element] / totalScore) * 100) : 0,
          state: classifyElementScore(scores[element], highest, lowest),
        },
      ])
    ) as Record<Element, SajuFiveElementValue>,
    dominant,
    weakest,
    totalCount,
    totalScore,
  };
}

function calculateTenGodSummary(pillars: SajuPillars, dayMasterStem: Stem): SajuTenGodSummary {
  const byType = Object.fromEntries(TEN_GOD_KEYS.map((key) => [key, 0])) as Record<TenGodCode, number>;

  addTenGodScore(byType, getTenGod(dayMasterStem, pillars.year.stem), 1);
  addTenGodScore(byType, getTenGod(dayMasterStem, pillars.month.stem), 1);
  addTenGodScore(byType, getTenGod(dayMasterStem, pillars.hour?.stem ?? null), 1);

  for (const pillar of [pillars.year, pillars.month, pillars.day, pillars.hour]) {
    if (!pillar) continue;
    pillar.hiddenStems.forEach((hiddenStem, index) => {
      addTenGodScore(byType, hiddenStem.tenGod, HIDDEN_STEM_WEIGHTS[index] ?? DEFAULT_HIDDEN_STEM_WEIGHT);
    });
  }

  const dominant = (Object.entries(byType) as [TenGodCode, number][])
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    byType: Object.fromEntries(
      TEN_GOD_KEYS.map((key) => [key, round1(byType[key])])
    ) as Record<TenGodCode, number>,
    dominant,
  };
}

function calculateStrength(
  pillars: SajuPillars,
  dayMasterStem: Stem,
  fiveElements: SajuFiveElements
): SajuStrength {
  const dayMasterElement = STEM_ELEMENTS[dayMasterStem];
  const resourceElement = generatorOf(dayMasterElement);
  const outputElement = generatedBy(dayMasterElement);
  const wealthElement = controlledBy(dayMasterElement);
  const officerElement = controllerOf(dayMasterElement);
  const monthSeason = SEASON_BY_BRANCH[pillars.month.branch];
  const seasonElement = SEASON_MAIN_ELEMENT[monthSeason];
  const seasonBonus = getSeasonBonus(dayMasterElement, resourceElement, outputElement, wealthElement, officerElement, seasonElement);
  const rootCount = getRootCount(pillars, dayMasterStem, dayMasterElement);
  const supportScore =
    fiveElements.byElement[dayMasterElement].score +
    fiveElements.byElement[resourceElement].score * 0.85 +
    rootCount * 0.65;
  const drainScore =
    fiveElements.byElement[outputElement].score * 0.7 +
    fiveElements.byElement[wealthElement].score * 0.8 +
    fiveElements.byElement[officerElement].score * 1.0;
  const score = clampScore(50 + seasonBonus + (supportScore - drainScore) * 6);
  const level: StrengthLevel = score >= 67 ? '신강' : score <= 43 ? '신약' : '중화';
  const rationale = [
    buildSeasonRationale(monthSeason, dayMasterElement, seasonElement, seasonBonus),
    `일간(${dayMasterStem})을 돕는 ${formatElementLabel(dayMasterElement)}·${formatElementLabel(resourceElement)} 점수는 ${round1(supportScore)}점, 설기·재성·관성 쪽 소모 점수는 ${round1(drainScore)}점입니다.`,
    `뿌리로 잡히는 지지·지장간은 ${round1(rootCount)}개 수준으로 계산되어 ${level}으로 판정했습니다.`,
  ];

  return {
    level,
    score,
    rationale,
  };
}

// 2026-05-15 P1 — 격국 알고리즘 강화.
// 기존: 월지 본기 1순위만 보고 단정.
// 신규: 본기/중기/여기 각각 평가 + 천간 투출(透出) 보너스 + 협력 지지 보너스로 multi-rank.
// "본기 + 투출" 격국이 가장 강한 신호. 본기만 채택은 보통, 중기/여기로 떨어지면 낮음.
function calculatePattern(pillars: SajuPillars, dayMasterStem: Stem): SajuPattern {
  const PILLAR_LABELS: Record<'year' | 'month' | 'day' | 'hour', { stem: string; branch: string }> = {
    year: { stem: '年干', branch: '年支' },
    month: { stem: '月干', branch: '月支' },
    day: { stem: '日干', branch: '日支' },
    hour: { stem: '時干', branch: '時支' },
  };
  const TOUGCHUL_PILLARS: Array<'year' | 'month' | 'hour'> = ['year', 'month', 'hour']; // 일간은 본인이므로 제외
  const OTHER_BRANCH_PILLARS: Array<'year' | 'day' | 'hour'> = ['year', 'day', 'hour']; // 월지 제외

  // 1) 월지 본기/중기/여기 hidden stems 수집.
  const hiddenStems = pillars.month.hiddenStems;
  const sources: Array<'본기' | '중기' | '여기'> = ['본기', '중기', '여기'];
  const baseScores: Record<'본기' | '중기' | '여기', number> = {
    본기: 60,
    중기: 30,
    여기: 15,
  };

  // 2) 각 hidden stem 후보별로 투출/협력 검사 + 점수.
  const candidates: SajuPatternCandidate[] = hiddenStems
    .slice(0, 3)
    .map((hiddenStem, index) => {
      const source = sources[index] ?? '여기';
      const stem = hiddenStem.stem;
      // 투출 검사: 일간 외 천간(연·월·시) 에 같은 stem 이 보이면 투출.
      const tougchulSlots = TOUGCHUL_PILLARS.filter((slot) => pillars[slot]?.stem === stem);
      const tougchul = tougchulSlots.length > 0;
      // 협력 검사: 월지 외 다른 지지 hidden stems 에 같은 stem 이 보이면 협력.
      const supportingPillars = OTHER_BRANCH_PILLARS.filter((slot) =>
        pillars[slot]?.hiddenStems?.some((hs) => hs.stem === stem)
      ).map((slot) => PILLAR_LABELS[slot].branch);
      // 천간 투출 자리도 같이 라벨화.
      const tougchulLabels = tougchulSlots.map((slot) => PILLAR_LABELS[slot].stem);
      const score =
        baseScores[source] +
        (tougchul ? 30 : 0) +
        Math.min(supportingPillars.length, 2) * 15;

      const tenGod = hiddenStem.tenGod ?? getTenGod(dayMasterStem, stem);
      return {
        stem,
        tenGod,
        name: getPatternName(tenGod),
        score,
        source,
        tougchul,
        supportingPillars: [...tougchulLabels, ...supportingPillars],
      } satisfies SajuPatternCandidate;
    });

  // 3) score desc 정렬 후 1순위 채택.
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];

  // 4) hidden stems 가 비어있는 케이스 → 월지 stem 으로 fallback (기존 동작 보존).
  if (!top) {
    const fallbackStem = pillars.month.stem;
    const fallbackTenGod = getTenGod(dayMasterStem, fallbackStem);
    return {
      name: getPatternName(fallbackTenGod),
      category:
        fallbackTenGod === '비견' || fallbackTenGod === '겁재' ? '특수격' : '정격',
      tenGod: fallbackTenGod,
      rationale: [
        `${pillars.month.branch} 월지의 hidden stems 가 비어 있어 월간(${fallbackStem})을 기준으로 ${fallbackTenGod} 격국으로 잡았습니다.`,
      ],
      confidence: '낮음',
      tougchul: false,
      supportingPillars: [],
      candidates: [],
    };
  }

  // 5) confidence: 본기 + 투출 = 확정 / 본기 단독 = 보통 / 중기·여기 = 낮음.
  const confidence: SajuPattern['confidence'] =
    top.source === '본기' && top.tougchul
      ? '확정'
      : top.source === '본기'
        ? '보통'
        : '낮음';

  const category: PatternCategory | null =
    top.tenGod === '비견' || top.tenGod === '겁재' ? '특수격' : '정격';

  const rationale: string[] = [
    `${pillars.month.branch} 월지의 ${top.source}(${top.stem})를 일간(${dayMasterStem}) 기준 십신으로 환산하면 ${top.tenGod} → ${top.name}.`,
  ];
  if (top.tougchul) {
    rationale.push(
      `${top.stem}이(가) ${top.supportingPillars.filter((p) => /干$/.test(p)).join(' · ')}에 투출되어 격국이 분명하게 드러납니다.`
    );
  }
  if (top.supportingPillars.filter((p) => /支$/.test(p)).length > 0) {
    rationale.push(
      `${top.supportingPillars.filter((p) => /支$/.test(p)).join(' · ')}에 같은 ${top.stem} 기운이 협력해 격국을 보강합니다.`
    );
  }
  if (confidence === '낮음' && top.source !== '본기') {
    rationale.push(
      `본기보다 ${top.source}가 더 강하게 작동해 ${top.name}로 잡았습니다. 변격 가능성을 함께 봅니다.`
    );
  }

  return {
    name: top.name,
    category,
    tenGod: top.tenGod,
    rationale,
    confidence,
    tougchul: top.tougchul,
    supportingPillars: top.supportingPillars,
    candidates,
  };
}

function calculateYongsin(
  pillars: SajuPillars,
  dayMasterElement: Element,
  fiveElements: SajuFiveElements,
  strength: SajuStrength
): SajuYongsin {
  const monthSeason = SEASON_BY_BRANCH[pillars.month.branch];
  const seasonalOverride = getSeasonalYongsin(dayMasterElement, monthSeason);
  const candidates = [
    seasonalOverride
      ? buildSeasonalYongsinCandidate({
          monthBranch: pillars.month.branch,
          monthSeason,
          seasonalOverride,
          score: 88,
        })
      : null,
    buildBalanceYongsinCandidate(dayMasterElement, strength),
    buildElementBalanceYongsinCandidate(fiveElements),
  ].filter((candidate): candidate is Omit<SajuYongsinCandidate, 'role'> => Boolean(candidate));
  const ranked = rankYongsinCandidates(candidates);
  const primaryCandidate = ranked[0];

  if (!primaryCandidate) {
    const fallback = toElementSymbolRef(fiveElements.weakest);
    return {
      primary: fallback,
      secondary: [toElementSymbolRef(generatorOf(fiveElements.weakest))],
      kiyshin: [toElementSymbolRef(fiveElements.dominant)],
      method: '희기신보정',
      rationale: ['용신 후보 계산값이 비어 있어 가장 약한 오행을 임시 보완 축으로 잡았습니다.'],
      candidates: [],
      confidence: '낮음',
      plainSummary: buildYongsinPlainSummary(fallback.value as Element),
      technicalSummary: '후보 계산값이 비어 있어 오행 균형 기준을 임시 적용했습니다.',
      practicalActions: ELEMENT_PRACTICAL_ACTIONS[fiveElements.weakest],
      terms: [...YONGSIN_TERM_EXPLANATIONS],
    };
  }

  const secondary = uniqueSymbolRefs([
    ...primaryCandidate.secondary,
    ...ranked
      .slice(1)
      .filter((candidate) => candidate.primary.value !== primaryCandidate.primary.value)
      .slice(0, 1)
      .map((candidate) => candidate.primary),
  ]).slice(0, 2);
  const confidence = getYongsinConfidence(ranked);
  const comparisonLine = buildYongsinComparisonLine(ranked);
  const primaryElement = primaryCandidate.primary.value as Element;

  return {
    primary: primaryCandidate.primary,
    secondary,
    kiyshin: primaryCandidate.kiyshin,
    method: primaryCandidate.method,
    rationale: [
      ...primaryCandidate.rationale,
      comparisonLine,
    ],
    candidates: ranked,
    confidence,
    plainSummary: buildYongsinPlainSummary(primaryElement, secondary),
    technicalSummary: buildYongsinTechnicalSummary(primaryCandidate, ranked, confidence),
    practicalActions: ELEMENT_PRACTICAL_ACTIONS[primaryElement],
    terms: [...YONGSIN_TERM_EXPLANATIONS],
  };
}

function buildSeasonalYongsinCandidate({
  monthBranch,
  monthSeason,
  seasonalOverride,
  score,
}: {
  monthBranch: Branch;
  monthSeason: SeasonKey;
  seasonalOverride: { primary: Element; secondary: Element[]; kiyshin: Element[]; reason: string };
  score: number;
}): Omit<SajuYongsinCandidate, 'role'> {
  const primary = toElementSymbolRef(seasonalOverride.primary);

  return {
    primary,
    secondary: seasonalOverride.secondary.map(toElementSymbolRef),
    kiyshin: seasonalOverride.kiyshin.map(toElementSymbolRef),
    method: '조후용신',
    score,
    rationale: [
      seasonalOverride.reason,
      `${monthBranch}월은 ${formatSeasonLabel(monthSeason)}이라 조후를 먼저 보고 ${primary.label}을(를) 후보로 올렸습니다.`,
    ],
    plainSummary: `${primary.label}은 계절의 치우침을 먼저 맞추는 후보입니다.`,
    technicalSummary: `조후(調候) 기준: ${formatSeasonLabel(monthSeason)}의 온도·습도 치우침을 ${primary.label}로 조절합니다.`,
  };
}

function buildBalanceYongsinCandidate(
  dayMasterElement: Element,
  strength: SajuStrength
): Omit<SajuYongsinCandidate, 'role'> {
  if (strength.level === '신강') {
    const output = generatedBy(dayMasterElement);
    const officer = controllerOf(dayMasterElement);
    const primary = toElementSymbolRef(output);

    return {
      primary,
      secondary: [toElementSymbolRef(officer)],
      kiyshin: [toElementSymbolRef(dayMasterElement), toElementSymbolRef(generatorOf(dayMasterElement))],
      method: '억부용신',
      score: clampScore(70 + Math.abs(strength.score - 50) * 0.32),
      rationale: [
        `일간이 신강(${strength.score}점)으로 계산되어 기운을 덜어내는 설기(${formatElementLabel(output)})와 관성(${formatElementLabel(officer)})을 후보로 올렸습니다.`,
      ],
      plainSummary: `${primary.label}은 강한 기운을 밖으로 풀어 균형을 잡는 후보입니다.`,
      technicalSummary: `억부(抑扶) 기준: 신강 명식이므로 일간을 더 돕기보다 설기·관성 방향을 봅니다.`,
    };
  }

  if (strength.level === '신약') {
    const resource = generatorOf(dayMasterElement);
    const primary = toElementSymbolRef(resource);

    return {
      primary,
      secondary: [toElementSymbolRef(dayMasterElement)],
      kiyshin: [toElementSymbolRef(generatedBy(dayMasterElement)), toElementSymbolRef(controllerOf(dayMasterElement))],
      method: '억부용신',
      score: clampScore(70 + Math.abs(strength.score - 50) * 0.32),
      rationale: [
        `일간이 신약(${strength.score}점)으로 계산되어 일간을 돕는 인성(${formatElementLabel(resource)})과 비겁(${formatElementLabel(dayMasterElement)})을 후보로 올렸습니다.`,
      ],
      plainSummary: `${primary.label}은 약한 일간을 받쳐 균형을 잡는 후보입니다.`,
      technicalSummary: `억부(抑扶) 기준: 신약 명식이므로 일간을 생하고 지탱하는 인성·비겁 방향을 봅니다.`,
    };
  }

  const weakest = dayMasterElement;
  const primary = toElementSymbolRef(weakest);

  return {
    primary,
    secondary: [toElementSymbolRef(generatorOf(weakest))],
    kiyshin: [toElementSymbolRef(generatedBy(weakest))],
    method: '억부용신',
    score: 62,
    rationale: [
      `일간 강약이 중화(${strength.score}점)에 가까워 억부 기준은 강하게 단정하지 않고 일간 자체를 보조 후보로만 둡니다.`,
    ],
    plainSummary: `${primary.label}은 일간의 기본 체력을 유지하는 보조 후보입니다.`,
    technicalSummary: '억부(抑扶) 기준: 신강·신약 어느 한쪽으로 강하게 치우치지 않아 참고 후보로만 봅니다.',
  };
}

function buildElementBalanceYongsinCandidate(
  fiveElements: SajuFiveElements
): Omit<SajuYongsinCandidate, 'role'> {
  const weakest = fiveElements.weakest;
  const primary = toElementSymbolRef(weakest);
  const dominantScore = fiveElements.byElement[fiveElements.dominant].score;
  const weakestScore = fiveElements.byElement[weakest].score;
  const gap = Math.max(0, dominantScore - weakestScore);

  return {
    primary,
    secondary: [toElementSymbolRef(generatorOf(weakest))],
    kiyshin: [toElementSymbolRef(fiveElements.dominant)],
    method: '희기신보정',
    score: clampScore(58 + gap * 5),
    rationale: [
      `오행 분포에서 ${formatElementLabel(weakest)} 점수는 ${round1(weakestScore)}점으로 가장 약하고, ${formatElementLabel(fiveElements.dominant)} 점수는 ${round1(dominantScore)}점으로 가장 강합니다.`,
    ],
    plainSummary: `${primary.label}은 부족한 축을 채워 전체 균형을 맞추는 후보입니다.`,
    technicalSummary: '희기신 보정 기준: 가장 약한 오행과 그 오행을 생하는 기운을 보완 후보로 봅니다.',
  };
}

function rankYongsinCandidates(
  candidates: Omit<SajuYongsinCandidate, 'role'>[]
): SajuYongsinCandidate[] {
  return [...candidates]
    .sort((a, b) => b.score - a.score)
    .map((candidate, index) => ({
      ...candidate,
      role: index === 0 ? 'primary' : index === 1 ? 'support' : 'reference',
    }));
}

function uniqueSymbolRefs(symbols: SajuSymbolRef[]) {
  const seen = new Set<string>();
  return symbols.filter((symbol) => {
    if (seen.has(symbol.value)) return false;
    seen.add(symbol.value);
    return true;
  });
}

function getYongsinConfidence(candidates: SajuYongsinCandidate[]): YongsinConfidence {
  const [first, second] = candidates;
  if (!first) return '낮음';
  if (!second) return first.score >= 80 ? '높음' : '중간';

  const scoreGap = first.score - second.score;
  const hasMethodConflict = first.primary.value !== second.primary.value;
  if (hasMethodConflict && scoreGap <= 6) return '낮음';
  if (hasMethodConflict && scoreGap <= 12) return '중간';
  return first.score >= 82 ? '높음' : '중간';
}

function buildYongsinPlainSummary(primaryElement: Element, secondary: SajuSymbolRef[] = []) {
  const secondaryLabel = secondary.length > 0
    ? ` · 보조 ${secondary.map((symbol) => symbol.label).join(' · ')}`
    : '';

  return `용신 메모: ${formatElementLabel(primaryElement)}${secondaryLabel}`;
}

function buildYongsinTechnicalSummary(
  primaryCandidate: SajuYongsinCandidate,
  ranked: SajuYongsinCandidate[],
  confidence: YongsinConfidence
) {
  const methodFlow = ranked
    .slice(0, 3)
    .map((candidate) => `${candidate.method} ${candidate.score}점`)
    .join(' / ');

  return `전문적으로는 ${primaryCandidate.method}을 1순위로 두되, ${methodFlow}을 함께 대조했습니다. 현재 판정 신뢰도는 ${confidence}입니다.`;
}

function buildYongsinComparisonLine(candidates: SajuYongsinCandidate[]) {
  if (candidates.length <= 1) {
    return '비교 가능한 보조 후보가 적어 현재 후보를 참고값으로 표시합니다.';
  }

  const [first, second] = candidates;
  return `후보 비교: ${first.method} ${first.primary.label} ${first.score}점, ${second.method} ${second.primary.label} ${second.score}점으로 계산했습니다.`;
}

function getTenGod(dayMasterStem: Stem, targetStem: Stem | null): TenGodCode | null {
  if (!targetStem) return null;

  const masterElement = STEM_ELEMENTS[dayMasterStem];
  const targetElement = STEM_ELEMENTS[targetStem];
  const samePolarity = isYang(dayMasterStem) === isYang(targetStem);

  if (masterElement === targetElement) {
    return samePolarity ? '비견' : '겁재';
  }

  if (generatedBy(masterElement) === targetElement) {
    return samePolarity ? '식신' : '상관';
  }

  if (controlledBy(masterElement) === targetElement) {
    return samePolarity ? '편재' : '정재';
  }

  if (controllerOf(masterElement) === targetElement) {
    return samePolarity ? '편관' : '정관';
  }

  return samePolarity ? '편인' : '정인';
}

function generatedBy(element: Element): Element {
  return GENERATED_BY_MAP[element];
}

function generatorOf(element: Element): Element {
  return GENERATOR_OF_MAP[element];
}

function controlledBy(element: Element): Element {
  return CONTROLLED_BY_MAP[element];
}

function controllerOf(element: Element): Element {
  return CONTROLLER_OF_MAP[element];
}

function initializeElementRecord(value: number): Record<Element, number> {
  return {
    목: value,
    화: value,
    토: value,
    금: value,
    수: value,
  };
}

function pickExtremum(record: Record<Element, number>, mode: 'max' | 'min'): Element {
  return ELEMENT_SEQUENCE.reduce((picked, current) => {
    if (mode === 'max') {
      return record[current] > record[picked] ? current : picked;
    }

    return record[current] < record[picked] ? current : picked;
  }, ELEMENT_SEQUENCE[0]);
}

function classifyElementScore(
  score: number,
  highest: number,
  lowest: number
): FiveElementState {
  if (score <= 0) return 'missing';
  if (Math.abs(score - highest) < 0.001) return 'strong';
  if (Math.abs(score - lowest) < 0.001) return 'weak';
  return 'balanced';
}

function addTenGodScore(
  byType: Record<TenGodCode, number>,
  key: TenGodCode | null,
  weight: number
) {
  if (!key) return;
  byType[key] += weight;
}

function getRootCount(
  pillars: SajuPillars,
  dayMasterStem: Stem,
  dayMasterElement: Element
) {
  let roots = 0;

  for (const pillar of [pillars.year, pillars.month, pillars.day, pillars.hour]) {
    if (!pillar) continue;

    if (pillar.branchElement === dayMasterElement) roots += 1;
    for (const hiddenStem of pillar.hiddenStems) {
      if (hiddenStem.stem === dayMasterStem) {
        roots += 1;
      } else if (hiddenStem.element === dayMasterElement) {
        roots += 0.5;
      }
    }
  }

  return roots;
}

function getSeasonBonus(
  dayMasterElement: Element,
  resourceElement: Element,
  outputElement: Element,
  wealthElement: Element,
  officerElement: Element,
  seasonElement: Element
) {
  if (seasonElement === dayMasterElement) return 18;
  if (seasonElement === resourceElement) return 10;
  if (seasonElement === outputElement) return -6;
  if (seasonElement === wealthElement) return -8;
  if (seasonElement === officerElement) return -10;
  return 0;
}

function buildSeasonRationale(
  monthSeason: SeasonKey,
  dayMasterElement: Element,
  seasonElement: Element,
  seasonBonus: number
) {
  const direction =
    seasonBonus > 0
      ? '일간을 돕는 계절 보정'
      : seasonBonus < 0
        ? '일간을 누르는 계절 보정'
        : '중립적인 계절 보정';

  return `${formatSeasonLabel(monthSeason)}(${formatElementLabel(seasonElement)})에 태어나 ${direction}이 적용되었습니다. 일간 기준 핵심 오행은 ${formatElementLabel(dayMasterElement)}입니다.`;
}

function getPatternName(tenGod: TenGodCode | null) {
  switch (tenGod) {
    case '비견':
      return '건록격';
    case '겁재':
      return '양인격';
    case '편관':
      return '편관격';
    case '정관':
      return '정관격';
    case '편재':
      return '편재격';
    case '정재':
      return '정재격';
    case '식신':
      return '식신격';
    case '상관':
      return '상관격';
    case '편인':
      return '편인격';
    case '정인':
      return '정인격';
    default:
      return '격국 미확정';
  }
}

function getSeasonalYongsin(dayMasterElement: Element, monthSeason: SeasonKey) {
  const key = `${dayMasterElement}-${monthSeason}` as SeasonalYongsinKey;
  const overrides: Partial<
    Record<
      SeasonalYongsinKey,
      { primary: Element; secondary: Element[]; kiyshin: Element[]; reason: string }
    >
  > = {
    '목-spring': {
      primary: '화',
      secondary: ['금'],
      kiyshin: ['목', '수'],
      reason: '봄 목기는 왕하기 쉬워 화로 발현하고 금으로 다듬는 편이 균형에 유리합니다.',
    },
    '화-summer': {
      primary: '수',
      secondary: ['금'],
      kiyshin: ['화', '목'],
      reason: '한여름 화기는 과열되기 쉬워 수로 식히고 금으로 기운을 정리하는 편이 좋습니다.',
    },
    '토-earth': {
      primary: '목',
      secondary: ['수'],
      kiyshin: ['토', '화'],
      reason: '토기가 무거워지기 쉬운 계절이라 목으로 소통시키고 수로 적당히 윤택을 더하는 편이 좋습니다.',
    },
    '금-autumn': {
      primary: '화',
      secondary: ['목'],
      kiyshin: ['금', '토'],
      reason: '가을 금기는 차고 단단해지기 쉬워 화로 단련하고 목으로 쓰임을 넓히는 편이 유리합니다.',
    },
    '수-winter': {
      primary: '화',
      secondary: ['목'],
      kiyshin: ['수', '금'],
      reason: '겨울 수기는 냉해지기 쉬워 화로 온기를 보태고 목으로 순환을 돕는 편이 좋습니다.',
    },
  };

  return overrides[key] ?? null;
}

function calculateLuckData(
  input: SajuInputSnapshot,
  calculatedAt: string
): Pick<SajuDataV1, 'majorLuck' | 'currentLuck'> {
  const currentDateTime = getLocalDateTime(calculatedAt, input.timezone);
  const currentSolar = Solar.fromYmdHms(
    currentDateTime.year,
    currentDateTime.month,
    currentDateTime.day,
    currentDateTime.hour,
    currentDateTime.minute,
    0
  );
  const currentEightChar = currentSolar.getLunar().getEightChar();
  currentEightChar.setSect(EIGHT_CHAR_SECT);

  const saewoon = {
    ganzi: currentEightChar.getYear(),
    year: currentDateTime.year,
    month: null,
    notes: [`${currentDateTime.year}년 기준 세운입니다.`],
  } satisfies SajuLuckDescriptor;
  const wolwoon = {
    ganzi: currentEightChar.getMonth(),
    year: currentDateTime.year,
    month: currentDateTime.month,
    notes: [
      `${currentDateTime.year}년 ${currentDateTime.month}월 기준 월운입니다.`,
      '절입 기준 월간지를 사용했습니다.',
    ],
  } satisfies SajuLuckDescriptor;

  const genderValue = toYunGender(input.gender);
  if (genderValue === null) {
    return {
      majorLuck: null,
      currentLuck: {
        currentMajorLuck: null,
        saewoon,
        wolwoon,
      },
    };
  }

  const birthSolar = getBirthSolar(input);
  const birthEightChar = birthSolar.getLunar().getEightChar();
  const birthSect = toEightCharSect(input.jasiMethod);
  birthEightChar.setSect(birthSect);

  const yun = birthEightChar.getYun(genderValue, birthSect);
  const rawMajorLuck = yun
    .getDaYun(MAJOR_LUCK_COUNT + 1)
    .filter((cycle) => cycle.getIndex() > 0)
    .slice(0, MAJOR_LUCK_COUNT);
  const majorLuck = rawMajorLuck.map((cycle) => toMajorLuckCycle(cycle, yun.isForward()));
  const currentMajorRaw =
    rawMajorLuck.find(
      (cycle) =>
        currentDateTime.year >= cycle.getStartYear() && currentDateTime.year <= cycle.getEndYear()
    ) ?? null;
  const currentLiuNian =
    currentMajorRaw?.getLiuNian().find((yearFlow) => yearFlow.getYear() === currentDateTime.year) ??
    null;

  return {
    majorLuck,
    currentLuck: {
      currentMajorLuck: currentMajorRaw
        ? toMajorLuckCycle(currentMajorRaw, yun.isForward())
        : null,
      saewoon:
        currentLiuNian === null
          ? saewoon
          : {
              ...saewoon,
              ganzi: currentLiuNian.getGanZhi(),
              notes: [
                `${currentLiuNian.getYear()}년 세운입니다.`,
                `현재 대운 기준 나이는 ${currentLiuNian.getAge()}세로 계산되었습니다.`,
              ],
            },
      wolwoon,
    },
  };
}

function toMajorLuckCycle(
  cycle: {
    getIndex(): number;
    getGanZhi(): string;
    getStartYear(): number;
    getEndYear(): number;
    getStartAge(): number;
    getEndAge(): number;
  },
  isForward: boolean
): SajuMajorLuckCycle {
  return {
    index: cycle.getIndex(),
    ganzi: cycle.getGanZhi(),
    startAge: cycle.getStartAge(),
    endAge: cycle.getEndAge(),
    notes: [
      `${cycle.getStartYear()}년부터 ${cycle.getEndYear()}년까지의 흐름입니다.`,
      `${cycle.getStartAge()}세부터 ${cycle.getEndAge()}세까지 적용됩니다.`,
      `${isForward ? '순행' : '역행'} 대운 기준입니다.`,
      '절기 일수 미세보정 전 기본 계산값입니다.',
    ],
  };
}

function getBirthSolar(input: SajuInputSnapshot) {
  const correctedBirth = input.birthTimeCorrection?.adjustedBirth;
  const hour = correctedBirth
    ? correctedBirth.hour
    : input.hourKnown
      ? input.birth.hour ?? UNKNOWN_HOUR
      : UNKNOWN_HOUR;
  const minute = correctedBirth
    ? correctedBirth.minute
    : input.hourKnown
      ? input.birth.minute ?? KNOWN_MINUTE
      : UNKNOWN_MINUTE;

  return Solar.fromYmdHms(
    correctedBirth?.year ?? input.birth.year,
    correctedBirth?.month ?? input.birth.month,
    correctedBirth?.day ?? input.birth.day,
    hour,
    minute,
    0
  );
}

function toEightCharSect(jasiMethod?: JasiMethod | null) {
  return jasiMethod === 'split' ? 1 : EIGHT_CHAR_SECT;
}

function toYunGender(gender: SajuInputSnapshot['gender']): 0 | 1 | null {
  if (gender === 'male') return 1;
  if (gender === 'female') return 0;
  return null;
}

function getLocalDateTime(
  calculatedAt: string,
  timeZone: string
): LocalDateTimeSnapshot {
  const parsed = new Date(calculatedAt);
  const sourceDate = Number.isNaN(parsed.getTime()) ? new Date() : parsed;

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    });
    const parts: Partial<Record<LocalDatePart, number>> = {};

    for (const part of formatter.formatToParts(sourceDate)) {
      if (
        part.type === 'year' ||
        part.type === 'month' ||
        part.type === 'day' ||
        part.type === 'hour' ||
        part.type === 'minute'
      ) {
        parts[part.type] = Number.parseInt(part.value, 10);
      }
    }

    if (
      parts.year !== undefined &&
      parts.month !== undefined &&
      parts.day !== undefined &&
      parts.hour !== undefined &&
      parts.minute !== undefined
    ) {
      return {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hour: parts.hour,
        minute: parts.minute,
      };
    }
  } catch {
    // Fall back to the UTC timestamp if the stored time zone is unavailable.
  }

  return {
    year: sourceDate.getUTCFullYear(),
    month: sourceDate.getUTCMonth() + 1,
    day: sourceDate.getUTCDate(),
    hour: sourceDate.getUTCHours(),
    minute: sourceDate.getUTCMinutes(),
  };
}

function toElementSymbolRef(element: Element): SajuSymbolRef {
  return {
    type: 'element',
    value: element,
    label: formatElementLabel(element),
  };
}

function formatElementLabel(element: Element) {
  // 2026-05-20 V2-5 PR V — 사용자 본문 노출 label 한자 제거 + 자연 한국어 표기.
  //   이전 `'金 (금)'` 가 narrative 본문 + 조사 fallback 깨짐 (`을(를)`) 원인.
  //   ELEMENT_INFO 의 표준 표기 ("금 기운") 와 일치.
  //   value 는 한글 1글자 그대로 유지 (deterministic lookup 호환).
  const NATURAL_LABEL: Record<Element, string> = {
    목: '목 기운',
    화: '화 기운',
    토: '토 기운',
    금: '금 기운',
    수: '수 기운',
  };
  return NATURAL_LABEL[element] ?? `${element} 기운`;
}

function formatSeasonLabel(season: SeasonKey) {
  return {
    spring: '봄철',
    summer: '여름철',
    autumn: '가을철',
    winter: '겨울철',
    earth: '토왕절',
  }[season];
}

function isYang(stem: Stem) {
  return ['甲', '丙', '戊', '庚', '壬'].includes(stem);
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function clampScore(value: number) {
  return Math.max(5, Math.min(95, Math.round(value)));
}
