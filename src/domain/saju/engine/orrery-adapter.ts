import { Solar } from 'lunar-typescript';
import type { Branch, JasiMethod, Stem } from '@/lib/saju/types';
import type {
  SajuCurrentLuck,
  SajuDataV1,
  SajuMajorLuckCycle,
  TenGodCode,
} from './saju-data-v1';

export type OrreryAdapterStatus = 'draft' | 'mapped';
export type OrreryPillarSlot = 'hour' | 'day' | 'month' | 'year';
export type OrreryGender = 'M' | 'F';
export type OrreryJasiMethod = 'split' | 'unified';

export interface SajuOrreryExtension {
  status: OrreryAdapterStatus;
  coverage: SajuOrreryCoverage;
  input: OrreryBirthInputSnapshot;
  pillars: Record<OrreryPillarSlot, OrreryPillarDetail | null>;
  daewoon: OrreryDaewoonItem[];
  currentLuck: OrreryCurrentLuckSnapshot | null;
  relations: OrreryRelation[] | null;
  specialSals: OrrerySpecialSals | null;
  gongmang: OrreryGongmang | null;
  jwabeop: OrreryJwaEntry[][] | null;
  injongbeop: OrreryInjongEntry[] | null;
  notes: string[];
}

export interface SajuOrreryCoverage {
  pillars: boolean;
  hiddenStems: boolean;
  daewoon: boolean;
  currentLuck: boolean;
  relations: boolean;
  specialSals: boolean;
  gongmang: boolean;
  jwabeop: boolean;
  injongbeop: boolean;
}

export interface OrreryBirthInputSnapshot {
  year: number;
  month: number;
  day: number;
  hour: number | null;
  minute: number | null;
  gender: OrreryGender | null;
  unknownTime: boolean;
  jasiMethod: OrreryJasiMethod | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

export interface OrreryPillarDetail {
  slot: OrreryPillarSlot;
  ganzi: string;
  stem: Stem;
  branch: Branch;
  stemSipsin: string | null;
  branchSipsin: string | null;
  unseong: string | null;
  sinsal: string | null;
  jigang: string;
  hiddenStems: OrreryHiddenStem[];
}

export interface OrreryHiddenStem {
  stem: Stem;
  tenGod: TenGodCode | null;
  order: number;
}

export interface OrreryDaewoonItem {
  index: number;
  ganzi: string;
  startAge: number | null;
  endAge: number | null;
  stemSipsin: string | null;
  branchSipsin: string | null;
  unseong: string | null;
  sinsal: string | null;
  isGongmang: boolean | null;
  notes: string[];
}

export interface OrreryLuckDescriptor {
  ganzi: string;
  year: number | null;
  month: number | null;
  notes: string[];
}

export interface OrreryCurrentLuckSnapshot {
  currentMajorLuck: OrreryDaewoonItem | null;
  saewoon: OrreryLuckDescriptor | null;
  wolwoon: OrreryLuckDescriptor | null;
}

export interface OrreryRelation {
  category: 'pair' | 'triple' | 'directional';
  label: string;
  source: string;
  target: string | null;
  detail: string | null;
}

export interface OrrerySpecialSals {
  yangin: number[] | null;
  baekho: boolean | null;
  goegang: boolean | null;
  dohwa: number[] | null;
  cheonul: number[] | null;
  cheonduk: number[] | null;
  wolduk: number[] | null;
  munchang: number[] | null;
  hongyeom: boolean | null;
  geumyeo: number[] | null;
}

export interface OrreryGongmang {
  branches: [string, string] | null;
  pillarSlots: OrreryPillarSlot[];
}

export interface OrreryJwaEntry {
  stem: Stem;
  tenGod: TenGodCode | null;
  unseong: string | null;
}

export interface OrreryInjongEntry {
  category: string;
  yangStem: Stem | null;
  unseong: string | null;
}

const BRANCH_SEQUENCE: Branch[] = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const STEM_SEQUENCE: Stem[] = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const PILLAR_ORDER: OrreryPillarSlot[] = ['hour', 'day', 'month', 'year'];
const PILLAR_LABEL: Record<OrreryPillarSlot, string> = {
  hour: '시주',
  day: '일주',
  month: '월주',
  year: '년주',
};

const STEM_ELEMENT_INDEX: Record<Stem, number> = {
  '甲': 0,
  '乙': 0,
  '丙': 1,
  '丁': 1,
  '戊': 2,
  '己': 2,
  '庚': 3,
  '辛': 3,
  '壬': 4,
  '癸': 4,
};

const STEM_POLARITY: Record<Stem, boolean> = {
  '甲': true,
  '乙': false,
  '丙': true,
  '丁': false,
  '戊': true,
  '己': false,
  '庚': true,
  '辛': false,
  '壬': true,
  '癸': false,
};

const GENERATES: Record<number, number> = {
  0: 1,
  1: 2,
  2: 3,
  3: 4,
  4: 0,
};

const CONTROLS: Record<number, number> = {
  0: 2,
  1: 3,
  2: 4,
  3: 0,
  4: 1,
};

const STEM_COMBINATIONS = new Map<string, string>(
  [
    ['甲-己', '토'],
    ['乙-庚', '금'],
    ['丙-辛', '수'],
    ['丁-壬', '목'],
    ['戊-癸', '화'],
  ] as const
);

const STEM_CLASHES = new Set<string>(['甲-庚', '乙-辛', '丙-壬', '丁-癸']);

const BRANCH_SIX_HARMONIES = new Map<string, string>(
  [
    ['子-丑', '토'],
    ['寅-亥', '목'],
    ['卯-戌', '화'],
    ['辰-酉', '금'],
    ['巳-申', '수'],
    ['午-未', '토'],
  ] as const
);

const BRANCH_CLASHES = new Set<string>(['子-午', '丑-未', '寅-申', '卯-酉', '辰-戌', '巳-亥']);
const BRANCH_HARMS = new Set<string>(['子-未', '丑-午', '寅-巳', '卯-辰', '申-亥', '酉-戌']);
const BRANCH_BREAKS = new Set<string>(['子-酉', '卯-午', '辰-丑', '未-戌', '寅-亥', '巳-申']);
// 2026-05-15 PR 6 — 원진(怨嗔) 6 쌍 신규 산출. 사주아이가 적극 활용하는 명리 신호.
// 자미(子-未) / 축오(丑-午) / 인유(寅-酉) / 묘신(卯-申) / 진해(辰-亥) / 사술(巳-戌).
// sortBranchKey 정렬 결과 기준 (BRANCH_ORDER alphabetical).
const BRANCH_WONJIN = new Set<string>(['子-未', '丑-午', '寅-酉', '卯-申', '辰-亥', '巳-戌']);
const BRANCH_PUNISHMENTS = new Set<string>([
  '寅-巳',
  '巳-申',
  '寅-申',
  '丑-未',
  '未-戌',
  '丑-戌',
  '子-卯',
  '辰-辰',
  '午-午',
  '酉-酉',
  '亥-亥',
]);

const HALF_HARMONY_GROUPS: Array<{ pairs: string[]; detail: string }> = [
  { pairs: ['申-子', '子-辰'], detail: '수 반합' },
  { pairs: ['亥-卯', '卯-未'], detail: '목 반합' },
  { pairs: ['寅-午', '午-戌'], detail: '화 반합' },
  { pairs: ['巳-酉', '酉-丑'], detail: '금 반합' },
];

const TRIPLE_HARMONIES: Array<{ branches: Branch[]; detail: string }> = [
  { branches: ['申', '子', '辰'], detail: '수 삼합' },
  { branches: ['亥', '卯', '未'], detail: '목 삼합' },
  { branches: ['寅', '午', '戌'], detail: '화 삼합' },
  { branches: ['巳', '酉', '丑'], detail: '금 삼합' },
];

const DIRECTIONAL_COMBINATIONS: Array<{ branches: Branch[]; detail: string }> = [
  { branches: ['亥', '子', '丑'], detail: '수 방합' },
  { branches: ['寅', '卯', '辰'], detail: '목 방합' },
  { branches: ['巳', '午', '未'], detail: '화 방합' },
  { branches: ['申', '酉', '戌'], detail: '금 방합' },
];

const DOHWA_GROUPS: Array<{ roots: Branch[]; target: Branch }> = [
  { roots: ['申', '子', '辰'], target: '酉' },
  { roots: ['寅', '午', '戌'], target: '卯' },
  { roots: ['巳', '酉', '丑'], target: '午' },
  { roots: ['亥', '卯', '未'], target: '子' },
] ;

const YANGIN_BY_DAY_STEM: Record<Stem, Branch> = {
  '甲': '卯',
  '乙': '辰',
  '丙': '午',
  '丁': '未',
  '戊': '午',
  '己': '未',
  '庚': '酉',
  '辛': '戌',
  '壬': '子',
  '癸': '丑',
};

const CHEONUL_BY_DAY_STEM: Record<Stem, Branch[]> = {
  '甲': ['丑', '未'],
  '乙': ['子', '申'],
  '丙': ['亥', '酉'],
  '丁': ['亥', '酉'],
  '戊': ['丑', '未'],
  '己': ['子', '申'],
  '庚': ['寅', '午'],
  '辛': ['寅', '午'],
  '壬': ['卯', '巳'],
  '癸': ['卯', '巳'],
};

const MUNCHANG_BY_DAY_STEM: Record<Stem, Branch> = {
  '甲': '巳',
  '乙': '午',
  '丙': '申',
  '丁': '酉',
  '戊': '申',
  '己': '酉',
  '庚': '亥',
  '辛': '子',
  '壬': '寅',
  '癸': '卯',
};

const GOEGANG_DAY_PILLARS = new Set(['庚辰', '庚戌', '壬辰', '戊戌']);
const BAEKHO_PILLARS = new Set(['甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑']);

const CHEONDEOK_BY_MONTH_BRANCH: Record<Branch, { stem?: Stem; branch?: Branch }> = {
  '子': { branch: '巳' },
  '丑': { stem: '庚' },
  '寅': { stem: '丁' },
  '卯': { branch: '申' },
  '辰': { stem: '壬' },
  '巳': { stem: '辛' },
  '午': { branch: '亥' },
  '未': { stem: '甲' },
  '申': { stem: '癸' },
  '酉': { branch: '寅' },
  '戌': { stem: '丙' },
  '亥': { stem: '乙' },
};

const WOLDEOK_BY_MONTH_BRANCH: Record<Branch, Stem> = {
  '子': '壬',
  '丑': '庚',
  '寅': '丙',
  '卯': '甲',
  '辰': '壬',
  '巳': '庚',
  '午': '丙',
  '未': '甲',
  '申': '壬',
  '酉': '庚',
  '戌': '丙',
  '亥': '甲',
};

const HONGYEOM_BY_DAY_STEM: Record<Stem, Branch> = {
  '甲': '午',
  '乙': '午',
  '丙': '寅',
  '丁': '未',
  '戊': '辰',
  '己': '辰',
  '庚': '戌',
  '辛': '酉',
  '壬': '子',
  '癸': '申',
};

const GEUMYEO_BY_DAY_STEM: Record<Stem, Branch> = {
  '甲': '辰',
  '乙': '巳',
  '丙': '未',
  '丁': '申',
  '戊': '未',
  '己': '申',
  '庚': '戌',
  '辛': '亥',
  '壬': '丑',
  '癸': '寅',
};

const BRANCH_MAIN_STEM: Record<Branch, Stem> = {
  '子': '癸',
  '丑': '己',
  '寅': '甲',
  '卯': '乙',
  '辰': '戊',
  '巳': '丙',
  '午': '丁',
  '未': '己',
  '申': '庚',
  '酉': '辛',
  '戌': '戊',
  '亥': '壬',
};

const HANJA_TO_TEN_GOD: Record<string, TenGodCode> = {
  比肩: '비견',
  劫財: '겁재',
  劫财: '겁재',
  食神: '식신',
  傷官: '상관',
  伤官: '상관',
  偏財: '편재',
  偏财: '편재',
  正財: '정재',
  正财: '정재',
  七殺: '편관',
  七杀: '편관',
  偏官: '편관',
  正官: '정관',
  偏印: '편인',
  正印: '정인',
};

export function buildOrreryReferenceExtension(data: SajuDataV1): SajuOrreryExtension {
  const eightChar = createEightCharFromInput(data);
  const pillars = buildPillarDetails(eightChar, data);
  const gongmang = buildGongmang(eightChar, pillars);
  const relations = buildRelations(pillars);
  const specialSals = buildSpecialSals(pillars, data.dayMaster.stem);
  const daewoon = mapDaewoon(eightChar, data.dayMaster.stem, data.majorLuck, gongmang);
  const currentLuck = mapCurrentLuck(data.currentLuck, daewoon);
  const coverage: SajuOrreryCoverage = {
    pillars: true,
    hiddenStems: true,
    daewoon: daewoon.length > 0,
    currentLuck: currentLuck !== null,
    relations: relations.length > 0,
    specialSals: specialSals !== null,
    gongmang: gongmang !== null,
    jwabeop: false,
    injongbeop: false,
  };

  return {
    status: hasMappedCoreCoverage(coverage) ? 'mapped' : 'draft',
    coverage,
    input: {
      year: data.input.birth.year,
      month: data.input.birth.month,
      day: data.input.birth.day,
      hour: data.input.birth.hour,
      minute: data.input.birth.minute,
      gender: toOrreryGender(data.input.gender),
      unknownTime: !data.input.hourKnown,
      jasiMethod: toOrreryJasiMethod(data.input.jasiMethod),
      latitude: data.input.latitude ?? null,
      longitude: data.input.longitude ?? null,
      timezone: data.input.timezone,
    },
    pillars,
    daewoon,
    currentLuck,
    relations,
    specialSals,
    gongmang,
    jwabeop: null,
    injongbeop: null,
    notes: [
      '4주, 지장간, 지지 십신, 12운성, 공망, 대운, 합충형파해를 reference 단계로 채웠습니다.',
      '강약·격국·용신 리포트는 여전히 현재 앱 말투 레이어가 맡고 있습니다.',
      '양인·백호·괴강·도화·천을·천덕·월덕·문창·홍염·금여 기준도 함께 정리했습니다.',
    ],
  };
}

function createEightCharFromInput(data: SajuDataV1) {
  const correctedBirth = data.input.birthTimeCorrection?.adjustedBirth;
  const hour = correctedBirth ? correctedBirth.hour : data.input.hourKnown ? data.input.birth.hour ?? 12 : 12;
  const minute = correctedBirth ? correctedBirth.minute : data.input.hourKnown ? data.input.birth.minute ?? 30 : 0;
  const solar = Solar.fromYmdHms(
    correctedBirth?.year ?? data.input.birth.year,
    correctedBirth?.month ?? data.input.birth.month,
    correctedBirth?.day ?? data.input.birth.day,
    hour,
    minute,
    0
  );
  const eightChar = solar.getLunar().getEightChar();
  eightChar.setSect(toEightCharSect(data.input.jasiMethod));
  return eightChar;
}

function buildPillarDetails(
  eightChar: ReturnType<typeof createEightCharFromInput>,
  data: SajuDataV1
): Record<OrreryPillarSlot, OrreryPillarDetail | null> {
  const dayStem = data.dayMaster.stem;
  const year = toOrreryPillar('year', dayStem, {
    ganzi: eightChar.getYear(),
    stem: ensureStem(eightChar.getYearGan()),
    branch: ensureBranch(eightChar.getYearZhi()),
    stemSipsin: normalizeTenGodLabel(eightChar.getYearShiShenGan()),
    branchSipsins: eightChar.getYearShiShenZhi().map(normalizeTenGodLabel),
    hideGan: eightChar.getYearHideGan().map(ensureStem),
    unseong: eightChar.getYearDiShi(),
  });
  const month = toOrreryPillar('month', dayStem, {
    ganzi: eightChar.getMonth(),
    stem: ensureStem(eightChar.getMonthGan()),
    branch: ensureBranch(eightChar.getMonthZhi()),
    stemSipsin: normalizeTenGodLabel(eightChar.getMonthShiShenGan()),
    branchSipsins: eightChar.getMonthShiShenZhi().map(normalizeTenGodLabel),
    hideGan: eightChar.getMonthHideGan().map(ensureStem),
    unseong: eightChar.getMonthDiShi(),
  });
  const day = toOrreryPillar('day', dayStem, {
    ganzi: eightChar.getDay(),
    stem: ensureStem(eightChar.getDayGan()),
    branch: ensureBranch(eightChar.getDayZhi()),
    stemSipsin: '비견',
    branchSipsins: eightChar.getDayShiShenZhi().map(normalizeTenGodLabel),
    hideGan: eightChar.getDayHideGan().map(ensureStem),
    unseong: eightChar.getDayDiShi(),
  });

  if (!data.input.hourKnown) {
    return { hour: null, day, month, year };
  }

  const hour = toOrreryPillar('hour', dayStem, {
    ganzi: eightChar.getTime(),
    stem: ensureStem(eightChar.getTimeGan()),
    branch: ensureBranch(eightChar.getTimeZhi()),
    stemSipsin: normalizeTenGodLabel(eightChar.getTimeShiShenGan()),
    branchSipsins: eightChar.getTimeShiShenZhi().map(normalizeTenGodLabel),
    hideGan: eightChar.getTimeHideGan().map(ensureStem),
    unseong: eightChar.getTimeDiShi(),
  });

  return { hour, day, month, year };
}

function toOrreryPillar(
  slot: OrreryPillarSlot,
  dayMasterStem: Stem,
  source: {
    ganzi: string;
    stem: Stem;
    branch: Branch;
    stemSipsin: TenGodCode | null;
    branchSipsins: Array<TenGodCode | null>;
    hideGan: Stem[];
    unseong: string;
  }
): OrreryPillarDetail {
  return {
    slot,
    ganzi: source.ganzi,
    stem: source.stem,
    branch: source.branch,
    stemSipsin: slot === 'day' ? '本元' : source.stemSipsin,
    branchSipsin: source.branchSipsins[0] ?? getBranchPrimaryTenGod(dayMasterStem, source.branch),
    unseong: source.unseong,
    sinsal: null,
    jigang: source.hideGan.join(''),
    hiddenStems: source.hideGan.map((stem, index) => ({
      stem,
      tenGod: source.branchSipsins[index] ?? getTenGodHangul(dayMasterStem, stem),
      order: index + 1,
    })),
  };
}

function buildGongmang(
  eightChar: ReturnType<typeof createEightCharFromInput>,
  pillars: Record<OrreryPillarSlot, OrreryPillarDetail | null>
): OrreryGongmang | null {
  const xunKong = eightChar.getDayXunKong();
  const branches = [...xunKong].filter(isBranch);
  if (branches.length < 2) return null;

  const targets = branches.slice(0, 2) as [Branch, Branch];
  const pillarSlots = PILLAR_ORDER.filter((slot) => {
    if (slot === 'day') return false;
    const pillar = pillars[slot];
    return pillar ? branches.includes(pillar.branch) : false;
  });

  return {
    branches: targets,
    pillarSlots,
  };
}

function buildRelations(
  pillars: Record<OrreryPillarSlot, OrreryPillarDetail | null>
): OrreryRelation[] {
  const active = PILLAR_ORDER.flatMap((slot) => {
    const pillar = pillars[slot];
    return pillar ? [{ slot, pillar }] : [];
  });
  const relations: OrreryRelation[] = [];

  for (let i = 0; i < active.length; i += 1) {
    for (let j = i + 1; j < active.length; j += 1) {
      const left = active[i];
      const right = active[j];
      const stemKey = sortStemKey(left.pillar.stem, right.pillar.stem);
      const branchKey = sortBranchKey(left.pillar.branch, right.pillar.branch);
      const source = `${PILLAR_LABEL[left.slot]} ${left.pillar.ganzi}`;
      const target = `${PILLAR_LABEL[right.slot]} ${right.pillar.ganzi}`;

      const stemCombine = STEM_COMBINATIONS.get(stemKey);
      if (stemCombine) {
        relations.push({
          category: 'pair',
          label: '천간합',
          source,
          target,
          detail: `${stemCombine} 기운으로 묶이는 관계`,
        });
      }

      if (STEM_CLASHES.has(stemKey)) {
        relations.push({
          category: 'pair',
          label: '천간충',
          source,
          target,
          detail: '천간에서 정면으로 부딪히는 관계',
        });
      }

      const branchCombine = BRANCH_SIX_HARMONIES.get(branchKey);
      if (branchCombine) {
        relations.push({
          category: 'pair',
          label: '육합',
          source,
          target,
          detail: `${branchCombine} 기운으로 합하는 관계`,
        });
      }

      if (BRANCH_CLASHES.has(branchKey)) {
        relations.push({
          category: 'pair',
          label: '충',
          source,
          target,
          detail: '정면으로 부딪히는 지지 충 관계',
        });
      }

      if (BRANCH_PUNISHMENTS.has(branchKey)) {
        relations.push({
          category: 'pair',
          label: '형',
          source,
          target,
          detail: '긴장과 압박이 누적되기 쉬운 형 관계',
        });
      }

      if (BRANCH_BREAKS.has(branchKey)) {
        relations.push({
          category: 'pair',
          label: '파',
          source,
          target,
          detail: '기운이 깨지거나 틈이 나는 파 관계',
        });
      }

      if (BRANCH_HARMS.has(branchKey)) {
        relations.push({
          category: 'pair',
          label: '해',
          source,
          target,
          detail: '겉으로는 약해 보여도 피로를 남기기 쉬운 해 관계',
        });
      }

      // 2026-05-15 PR 6 — 원진(怨嗔) 산출. 이유 없는 서운함·날카로운 말싸움이 생기기 쉬운 결.
      if (BRANCH_WONJIN.has(branchKey)) {
        relations.push({
          category: 'pair',
          label: '원진',
          source,
          target,
          detail: '이유 없는 서운함·날카로운 말싸움이 누적되기 쉬운 원진 관계',
        });
      }

      for (const group of HALF_HARMONY_GROUPS) {
        if (group.pairs.includes(branchKey)) {
          relations.push({
            category: 'pair',
            label: '반합',
            source,
            target,
            detail: group.detail,
          });
        }
      }
    }
  }

  const activeBranches = active.map(({ pillar }) => pillar.branch);

  for (const group of TRIPLE_HARMONIES) {
    if (group.branches.every((branch) => activeBranches.includes(branch))) {
      relations.push({
        category: 'triple',
        label: '삼합',
        source: group.branches.join(''),
        target: null,
        detail: group.detail,
      });
    }
  }

  for (const group of DIRECTIONAL_COMBINATIONS) {
    if (group.branches.every((branch) => activeBranches.includes(branch))) {
      relations.push({
        category: 'directional',
        label: '방합',
        source: group.branches.join(''),
        target: null,
        detail: group.detail,
      });
    }
  }

  return relations;
}

function buildSpecialSals(
  pillars: Record<OrreryPillarSlot, OrreryPillarDetail | null>,
  dayStem: Stem
): OrrerySpecialSals | null {
  const active = PILLAR_ORDER.map((slot) => pillars[slot]);
  const branches = active.map((pillar) => pillar?.branch ?? null);
  const stems = active.map((pillar) => pillar?.stem ?? null);
  const dayPillar = pillars.day;
  const yearPillar = pillars.year;
  const monthPillar = pillars.month;
  if (!dayPillar || !yearPillar || !monthPillar) return null;

  const dohwaTargets = new Set<Branch>();
  for (const group of DOHWA_GROUPS) {
    if (group.roots.includes(dayPillar.branch) || group.roots.includes(yearPillar.branch)) {
      dohwaTargets.add(group.target);
    }
  }

  const cheondeokTarget = CHEONDEOK_BY_MONTH_BRANCH[monthPillar.branch];

  return {
    yangin: findBranchPositions(branches, [YANGIN_BY_DAY_STEM[dayStem]]),
    baekho: active.some((pillar) => (pillar ? BAEKHO_PILLARS.has(pillar.ganzi) : false)),
    goegang: GOEGANG_DAY_PILLARS.has(dayPillar.ganzi),
    dohwa: findBranchPositions(branches, [...dohwaTargets]),
    cheonul: findBranchPositions(branches, CHEONUL_BY_DAY_STEM[dayStem]),
    cheonduk: active.flatMap((pillar, index) => {
      if (!pillar) return [];
      if (cheondeokTarget.stem && pillar.stem === cheondeokTarget.stem) return [index];
      if (cheondeokTarget.branch && pillar.branch === cheondeokTarget.branch) return [index];
      return [];
    }),
    wolduk: findStemPositions(stems, WOLDEOK_BY_MONTH_BRANCH[monthPillar.branch]),
    munchang: findBranchPositions(branches, [MUNCHANG_BY_DAY_STEM[dayStem]]),
    hongyeom: branches.includes(HONGYEOM_BY_DAY_STEM[dayStem]),
    geumyeo: findBranchPositions(branches, [GEUMYEO_BY_DAY_STEM[dayStem]]),
  };
}

function mapDaewoon(
  eightChar: ReturnType<typeof createEightCharFromInput>,
  dayMasterStem: Stem,
  majorLuck: SajuMajorLuckCycle[] | null,
  gongmang: OrreryGongmang | null
): OrreryDaewoonItem[] {
  if (!majorLuck) return [];

  return majorLuck.map((cycle, index, allCycles) => {
    const nextCycle = allCycles[index + 1];
    const stem = parseStem(cycle.ganzi);
    const branch = parseBranch(cycle.ganzi);

    return {
      index: cycle.index,
      ganzi: cycle.ganzi,
      startAge: cycle.startAge,
      endAge:
        cycle.endAge ??
        (nextCycle?.startAge != null ? nextCycle.startAge - 1 : inferFallbackEndAge(cycle.startAge)),
      stemSipsin: stem ? getTenGodHangul(dayMasterStem, stem) : null,
      branchSipsin: branch ? getBranchPrimaryTenGod(dayMasterStem, branch) : null,
      unseong: branch ? getDiShiForBranch(eightChar, branch) : null,
      sinsal: null,
      isGongmang: branch ? Boolean(gongmang?.branches?.includes(branch)) : null,
      notes: cycle.notes,
    };
  });
}

function mapCurrentLuck(
  currentLuck: SajuCurrentLuck | null,
  daewoon: OrreryDaewoonItem[]
): OrreryCurrentLuckSnapshot | null {
  if (!currentLuck) return null;

  return {
    currentMajorLuck:
      daewoon.find((item) => item.ganzi === currentLuck.currentMajorLuck?.ganzi) ?? null,
    saewoon: currentLuck.saewoon
      ? {
          ganzi: currentLuck.saewoon.ganzi,
          year: currentLuck.saewoon.year,
          month: currentLuck.saewoon.month,
          notes: currentLuck.saewoon.notes,
        }
      : null,
    wolwoon: currentLuck.wolwoon
      ? {
          ganzi: currentLuck.wolwoon.ganzi,
          year: currentLuck.wolwoon.year,
          month: currentLuck.wolwoon.month,
          notes: currentLuck.wolwoon.notes,
        }
      : null,
  };
}

function findBranchPositions(
  branches: Array<Branch | null>,
  targets: Branch[]
): number[] {
  return branches.flatMap((branch, index) =>
    branch && targets.includes(branch) ? [index] : []
  );
}

function findStemPositions(
  stems: Array<Stem | null>,
  target: Stem
): number[] {
  return stems.flatMap((stem, index) => (stem === target ? [index] : []));
}

function inferFallbackEndAge(startAge: number | null): number | null {
  if (startAge == null) return null;
  return startAge + 9;
}

function ensureStem(value: string): Stem {
  if (!isStem(value)) {
    throw new Error(`orrery reference stem을 해석하지 못했습니다: ${value}`);
  }

  return value;
}

function ensureBranch(value: string): Branch {
  if (!isBranch(value)) {
    throw new Error(`orrery reference branch를 해석하지 못했습니다: ${value}`);
  }

  return value;
}

function parseStem(ganzi: string): Stem | null {
  const candidate = ganzi.charAt(0);
  return isStem(candidate) ? candidate : null;
}

function parseBranch(ganzi: string): Branch | null {
  const candidate = ganzi.charAt(1);
  return isBranch(candidate) ? candidate : null;
}

function isStem(value: string): value is Stem {
  return value in STEM_ELEMENT_INDEX;
}

function isBranch(value: string): value is Branch {
  return BRANCH_SEQUENCE.includes(value as Branch);
}

function normalizeTenGodLabel(value: string): TenGodCode | null {
  return HANJA_TO_TEN_GOD[value] ?? null;
}

function getDiShiForBranch(
  eightChar: ReturnType<typeof createEightCharFromInput>,
  branch: Branch
) {
  return eightChar.getDiShi(BRANCH_SEQUENCE.indexOf(branch));
}

function sortStemKey(left: Stem, right: Stem) {
  return STEM_SEQUENCE.indexOf(left) <= STEM_SEQUENCE.indexOf(right)
    ? `${left}-${right}`
    : `${right}-${left}`;
}

function sortBranchKey(left: Branch, right: Branch) {
  return BRANCH_SEQUENCE.indexOf(left) <= BRANCH_SEQUENCE.indexOf(right)
    ? `${left}-${right}`
    : `${right}-${left}`;
}

function getBranchPrimaryTenGod(dayMasterStem: Stem, branch: Branch): TenGodCode | null {
  return getTenGodHangul(dayMasterStem, BRANCH_MAIN_STEM[branch]);
}

function getTenGodHangul(dayMasterStem: Stem, targetStem: Stem): TenGodCode {
  const masterElement = STEM_ELEMENT_INDEX[dayMasterStem];
  const targetElement = STEM_ELEMENT_INDEX[targetStem];
  const samePolarity = STEM_POLARITY[dayMasterStem] === STEM_POLARITY[targetStem];

  if (masterElement === targetElement) {
    return samePolarity ? '비견' : '겁재';
  }

  if (GENERATES[masterElement] === targetElement) {
    return samePolarity ? '식신' : '상관';
  }

  if (CONTROLS[masterElement] === targetElement) {
    return samePolarity ? '편재' : '정재';
  }

  if (CONTROLS[targetElement] === masterElement) {
    return samePolarity ? '편관' : '정관';
  }

  return samePolarity ? '편인' : '정인';
}

function toOrreryGender(gender: SajuDataV1['input']['gender']): OrreryGender | null {
  if (gender === 'male') return 'M';
  if (gender === 'female') return 'F';
  return null;
}

function toOrreryJasiMethod(
  jasiMethod: JasiMethod | null | undefined
): OrreryJasiMethod | null {
  if (jasiMethod === 'split' || jasiMethod === 'unified') {
    return jasiMethod;
  }

  return null;
}

function toEightCharSect(jasiMethod: JasiMethod | null | undefined) {
  return jasiMethod === 'split' ? 1 : 2;
}

function hasMappedCoreCoverage(coverage: SajuOrreryCoverage) {
  return (
    coverage.pillars &&
    coverage.hiddenStems &&
    coverage.daewoon &&
    coverage.currentLuck &&
    coverage.relations &&
    coverage.gongmang
  );
}
