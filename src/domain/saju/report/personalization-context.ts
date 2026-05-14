import type {
  Element,
  Branch,
  Stem,
  UserSituation,
} from '@/lib/saju/types';
import type {
  SajuDataV1,
  SajuSymbolRef,
  StrengthLevel,
  TenGodCode,
} from '@/domain/saju/engine/saju-data-v1';
import sixtyGapjaCore from '@/data/saju/sixty-gapja-core.json';

export const SAJU_PERSONALIZATION_CONTEXT_V1 = 'saju-personalization/v1' as const;

export type TenGodGroup = '비겁' | '식상' | '재성' | '관성' | '인성';

export interface SixtyGapjaCoreProfile {
  code: string;
  hanja: string;
  title: string;
  core: string;
  strengths: string[];
  watchPoints: string[];
  actionCue: string;
}

export interface SajuPersonalizationContext {
  schemaVersion: typeof SAJU_PERSONALIZATION_CONTEXT_V1;
  dayGanziCode: string;
  dayGanziHanja: string;
  sixtyGapja: SixtyGapjaCoreProfile | null;
  fiveElementRatio: Record<Element, number>;
  tenGodDistribution: Record<TenGodGroup, number>;
  strengthJudgement: {
    일간강약: StrengthLevel | null;
    월령득기: boolean;
  };
  yongsinKiyshin: {
    용신: Element | null;
    희신: Element | null;
    기신: Element | null;
  };
  currentLuck: {
    현재대운: string | null;
    진행년수: number | null;
  };
  /** 2026-05-15 PR 1: 사용자가 입력한 현재 상황(연애/직업/고민). 풀이 본문에 호명되도록 promptFacts 끝에 phrase 로 주입. */
  userSituation: UserSituation | null;
  promptFacts: string[];
}

const STEM_TO_KOREAN: Record<Stem, string> = {
  甲: '갑',
  乙: '을',
  丙: '병',
  丁: '정',
  戊: '무',
  己: '기',
  庚: '경',
  辛: '신',
  壬: '임',
  癸: '계',
};

const BRANCH_TO_KOREAN: Record<Branch, string> = {
  子: '자',
  丑: '축',
  寅: '인',
  卯: '묘',
  辰: '진',
  巳: '사',
  午: '오',
  未: '미',
  申: '신',
  酉: '유',
  戌: '술',
  亥: '해',
};

const TEN_GOD_GROUPS: Record<TenGodCode, TenGodGroup> = {
  비견: '비겁',
  겁재: '비겁',
  식신: '식상',
  상관: '식상',
  편재: '재성',
  정재: '재성',
  편관: '관성',
  정관: '관성',
  편인: '인성',
  정인: '인성',
};

const ELEMENTS: Element[] = ['목', '화', '토', '금', '수'];
const TEN_GOD_GROUP_ORDER: TenGodGroup[] = ['비겁', '식상', '재성', '관성', '인성'];

const MONTH_BRANCH_SEASON_ELEMENT: Record<Branch, Element> = {
  寅: '목',
  卯: '목',
  辰: '토',
  巳: '화',
  午: '화',
  未: '토',
  申: '금',
  酉: '금',
  戌: '토',
  亥: '수',
  子: '수',
  丑: '토',
};

const GENERATOR_OF: Record<Element, Element> = {
  목: '수',
  화: '목',
  토: '화',
  금: '토',
  수: '금',
};

const sixtyGapjaProfiles = sixtyGapjaCore as Record<string, SixtyGapjaCoreProfile>;

function roundNumber(value: number) {
  return Math.round(value * 10) / 10;
}

function buildDayGanziCode(stem: Stem, branch: Branch) {
  return `${STEM_TO_KOREAN[stem]}${BRANCH_TO_KOREAN[branch]}`;
}

function buildFiveElementRatio(data: SajuDataV1): Record<Element, number> {
  return Object.fromEntries(
    ELEMENTS.map((element) => [
      element,
      roundNumber(data.fiveElements.byElement[element]?.percentage ?? 0),
    ])
  ) as Record<Element, number>;
}

function buildTenGodDistribution(data: SajuDataV1): Record<TenGodGroup, number> {
  const distribution = Object.fromEntries(
    TEN_GOD_GROUP_ORDER.map((group) => [group, 0])
  ) as Record<TenGodGroup, number>;

  if (!data.tenGods) return distribution;

  for (const [tenGod, value] of Object.entries(data.tenGods.byType) as [TenGodCode, number][]) {
    distribution[TEN_GOD_GROUPS[tenGod]] += value;
  }

  return Object.fromEntries(
    TEN_GOD_GROUP_ORDER.map((group) => [group, roundNumber(distribution[group])])
  ) as Record<TenGodGroup, number>;
}

function hasMonthSeasonSupport(data: SajuDataV1) {
  const monthSeasonElement = MONTH_BRANCH_SEASON_ELEMENT[data.pillars.month.branch];
  const dayMasterElement = data.dayMaster.element;

  return (
    monthSeasonElement === dayMasterElement ||
    monthSeasonElement === GENERATOR_OF[dayMasterElement]
  );
}

function toElementValue(symbol: SajuSymbolRef | null | undefined): Element | null {
  if (!symbol) return null;
  if (ELEMENTS.includes(symbol.value as Element)) return symbol.value as Element;
  const matched = ELEMENTS.find((element) => symbol.label.includes(`(${element})`));
  return matched ?? null;
}

function getCurrentMajorLuckLabel(data: SajuDataV1) {
  const ganzi = data.currentLuck?.currentMajorLuck?.ganzi ?? null;
  return ganzi ? `${ganzi}대운` : null;
}

function getMajorLuckProgressYears(data: SajuDataV1) {
  const currentMajorLuck = data.currentLuck?.currentMajorLuck;
  const startAge = currentMajorLuck?.startAge;
  const birthYear = data.input.birth.year;

  if (startAge === null || startAge === undefined || !birthYear) return null;

  const currentAge = Math.max(0, new Date().getFullYear() - birthYear + 1);
  return Math.max(0, currentAge - startAge + 1);
}

function compactStrings(parts: Array<string | null | undefined>) {
  return parts.filter((part): part is string => Boolean(part?.trim()));
}

// 2026-05-15 PR 1 — UserSituation 의 enum 값을 풀이 본문에 호명할 수 있는 한국어 phrase 로 변환.
const RELATIONSHIP_LABELS: Record<NonNullable<UserSituation['relationshipStatus']>, string> = {
  single: '솔로',
  dating: '연애 중',
  married: '기혼',
  separated: '이별 후 정리 중',
};
const OCCUPATION_LABELS: Record<NonNullable<UserSituation['occupation']>, string> = {
  employee: '직장인',
  'self-employed': '자영업/프리랜서',
  student: '학생',
  homemaker: '가정 살림',
  'job-seeking': '구직 중',
  other: '기타 활동',
};
const CONCERN_LABELS: Record<NonNullable<UserSituation['currentConcern']>, string> = {
  business: '새로운 사업/이직',
  romance: '결혼/연애',
  family: '자녀/가족',
  health: '건강/멘탈',
  wealth: '재물/투자',
  other: '본인 직접 입력',
};

function buildUserSituationFacts(userSituation: UserSituation | null | undefined): string[] {
  if (!userSituation) return [];
  const facts: string[] = [];
  const status = userSituation.relationshipStatus;
  const occupation = userSituation.occupation;
  const concern = userSituation.currentConcern;
  const note = userSituation.concernNote?.trim();
  if (status) {
    facts.push(`현재 관계: ${RELATIONSHIP_LABELS[status]}`);
  }
  if (occupation) {
    facts.push(`현재 일: ${OCCUPATION_LABELS[occupation]}`);
  }
  if (concern) {
    const label = CONCERN_LABELS[concern];
    facts.push(note && concern === 'other' ? `요즘 고민: ${note.slice(0, 80)}` : `요즘 고민: ${label}`);
  } else if (note) {
    facts.push(`요즘 고민: ${note.slice(0, 80)}`);
  }
  return facts;
}

export function buildSajuPersonalizationContext(
  data: SajuDataV1,
  userSituation: UserSituation | null = null
): SajuPersonalizationContext {
  const dayGanziCode = buildDayGanziCode(data.pillars.day.stem, data.pillars.day.branch);
  const sixtyGapja = sixtyGapjaProfiles[dayGanziCode] ?? null;
  const fiveElementRatio = buildFiveElementRatio(data);
  const tenGodDistribution = buildTenGodDistribution(data);
  const primaryYongsin = toElementValue(data.yongsin?.primary);
  const firstSupport = toElementValue(data.yongsin?.secondary[0]);
  const firstKiyshin = toElementValue(data.yongsin?.kiyshin[0]);
  const currentMajorLuck = getCurrentMajorLuckLabel(data);

  return {
    schemaVersion: SAJU_PERSONALIZATION_CONTEXT_V1,
    dayGanziCode,
    dayGanziHanja: data.pillars.day.ganzi,
    sixtyGapja,
    fiveElementRatio,
    tenGodDistribution,
    strengthJudgement: {
      일간강약: data.strength?.level ?? null,
      월령득기: hasMonthSeasonSupport(data),
    },
    yongsinKiyshin: {
      용신: primaryYongsin,
      희신: firstSupport,
      기신: firstKiyshin,
    },
    currentLuck: {
      현재대운: currentMajorLuck,
      진행년수: getMajorLuckProgressYears(data),
    },
    userSituation: userSituation ?? null,
    promptFacts: compactStrings([
      `일주코드: ${dayGanziCode}${sixtyGapja ? ` · ${sixtyGapja.title}` : ''}`,
      `오행비율: ${ELEMENTS.map((element) => `${element} ${fiveElementRatio[element]}%`).join(', ')}`,
      `십성분포: ${TEN_GOD_GROUP_ORDER.map((group) => `${group} ${tenGodDistribution[group]}`).join(', ')}`,
      data.strength?.level
        ? `강약판단: ${data.strength.level} · 월령득기 ${hasMonthSeasonSupport(data) ? '예' : '아니오'}`
        : null,
      primaryYongsin
        ? `용신기신: 용신 ${primaryYongsin}${firstSupport ? `, 희신 ${firstSupport}` : ''}${firstKiyshin ? `, 기신 ${firstKiyshin}` : ''}`
        : null,
      currentMajorLuck ? `대운현황: ${currentMajorLuck}` : null,
      sixtyGapja?.core,
      sixtyGapja?.actionCue,
      // 2026-05-15 PR 1: 사용자 입력 현재 상황을 promptFacts 끝에 phrase 로 주입.
      // LLM prompt + 룰 베이스 어디서든 호명 가능.
      ...buildUserSituationFacts(userSituation),
    ]),
  };
}
