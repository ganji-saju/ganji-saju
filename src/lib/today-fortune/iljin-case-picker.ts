// 2026-05-15 PR 3 — 일진메시지_라이브러리_250문장.md §사용 알고리즘:
// 사용자 사주 + 오늘 일진 → 발동 케이스 식별 + 우선순위 정렬 + 상위 N개 선택.

import type { SajuOriginInput } from './iljin-score-engine';
import type { IljinCaseId, MessageVariables } from './iljin-message-library';
import { pickVariant, substituteVariables } from './iljin-message-library';
import {
  BRANCH_TO_ELEMENT,
  STEM_TO_ELEMENT,
  calculateSipsung,
  isBanghap,
  isBranchChung,
  isBranchHae,
  isBranchHyung,
  isBranchPa,
  isBranchWonjin,
  isJahyung,
  isSamhap,
  isStemChung,
  isStemHap,
  isYukhap,
  type Branch,
  type Elem,
  type SipSung,
  type Stem,
} from './iljin-rules';

const SIPSUNG_TO_CASE: Record<SipSung, IljinCaseId> = {
  비견: 'S01_BIGYEON',
  겁재: 'S02_GEOPJAE',
  식신: 'S03_SIKSHIN',
  상관: 'S04_SANGGWAN',
  편재: 'S05_PYEONJAE',
  정재: 'S06_JEONGJAE',
  편관: 'S07_PYEONGWAN',
  정관: 'S08_JEONGGWAN',
  편인: 'S09_PYEONIN',
  정인: 'S10_JEONGIN',
};

// 우선순위 (강한 길흉 신호 우선).
export const PRIORITY: IljinCaseId[] = [
  'S30_TIANYI', // 천을귀인
  'S38_YONGSIN_IN',
  'S39_KISHIN_IN',
  'S15_BRANCH_CHUNG',
  'S32_BAEKHO',
  'S12_SAMHAP',
  'S17_WONJIN',
  'S16_BRANCH_HYUNG',
  'S36_SHORTAGE_FILLED',
  'S37_EXCESS_AMPLIFIED',
  'S31_MUNCHANG',
  'S41_SIKSHIN_SAENG_JAE',
  'S26_YANGIN',
  'S34_GONGMANG',
  'S35_MANGSIN',
  'S11_CHEONGAN_HAP',
  'S13_YUKHAP',
  'S14_BANGHAP',
  'S19_HAE',
  'S18_PA',
  'S20_JAHYUNG',
  'S21_CHEONGAN_CHUNG',
  'S22_CHEONGAN_GEUK',
  'S23_CHEONGAN_SAENG',
  'S24_CHEONGAN_SEOL',
  'S25_FAMILY_HAP',
  'S27_YEOKMA',
  'S28_DOHWA',
  'S29_HWAGAE',
  'S33_GOEGANG',
  'S40_JOHU_BALANCED',
  'S42_JAESAENG_GWAN',
  'S43_GWANIN_SAENG',
  'S44_INSEONG_OVER',
  'S45_JAESEONG_OVER',
  'S46_BIGEOP_OVER',
  'S47_SIKSANG_OVER',
  'S48_GWANSEONG_OVER',
  'S49_DAY_PILLAR_SAME',
  'S01_BIGYEON',
  'S02_GEOPJAE',
  'S03_SIKSHIN',
  'S04_SANGGWAN',
  'S05_PYEONJAE',
  'S06_JEONGJAE',
  'S07_PYEONGWAN',
  'S08_JEONGGWAN',
  'S09_PYEONIN',
  'S10_JEONGIN',
  'S50_PEACE',
];

const TIANYI: Record<Stem, Branch[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  壬: ['巳', '卯'], 癸: ['巳', '卯'],
  辛: ['寅', '午'],
};

const MUNCHANG: Record<Stem, Branch> = {
  甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申',
  己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
};

const YANGIN: Record<Stem, Branch | null> = {
  甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子',
  乙: null, 丁: null, 己: null, 辛: null, 癸: null,
};

const BAEKHO_GANZI = new Set([
  '甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑',
]);

export function detectTriggeredCases(
  saju: SajuOriginInput,
  iljinStem: Stem,
  iljinBranch: Branch
): IljinCaseId[] {
  const triggered = new Set<IljinCaseId>();
  const sipsung = calculateSipsung(saju.dayMaster, iljinStem);
  triggered.add(SIPSUNG_TO_CASE[sipsung]);

  // 천간합/충/생/설 — sipsung 으로 이미 일부 커버되나 명시.
  if (isStemHap(saju.dayMaster, iljinStem)) triggered.add('S11_CHEONGAN_HAP');
  if (isStemChung(saju.dayMaster, iljinStem)) triggered.add('S21_CHEONGAN_CHUNG');
  if (['편관', '정관'].includes(sipsung)) triggered.add('S22_CHEONGAN_GEUK');
  if (['편인', '정인'].includes(sipsung)) triggered.add('S23_CHEONGAN_SAENG');
  if (['식신', '상관'].includes(sipsung)) triggered.add('S24_CHEONGAN_SEOL');

  // 지지 관계 — 사주 4개 지지 vs 일진 지지.
  const branches: Array<{ branch: Branch | null; isYearOrHour: boolean }> = [
    { branch: saju.yearBranch, isYearOrHour: true },
    { branch: saju.monthBranch, isYearOrHour: false },
    { branch: saju.dayBranch, isYearOrHour: false },
    { branch: saju.hourBranch, isYearOrHour: true },
  ];
  for (const pos of branches) {
    if (!pos.branch) continue;
    if (isSamhap(pos.branch, iljinBranch)) triggered.add('S12_SAMHAP');
    if (isYukhap(pos.branch, iljinBranch)) triggered.add('S13_YUKHAP');
    if (isBanghap(pos.branch, iljinBranch)) triggered.add('S14_BANGHAP');
    if (isBranchChung(pos.branch, iljinBranch)) triggered.add('S15_BRANCH_CHUNG');
    if (isBranchHyung(pos.branch, iljinBranch)) triggered.add('S16_BRANCH_HYUNG');
    if (isJahyung(pos.branch, iljinBranch)) triggered.add('S20_JAHYUNG');
    if (isBranchWonjin(pos.branch, iljinBranch)) triggered.add('S17_WONJIN');
    if (isBranchPa(pos.branch, iljinBranch)) triggered.add('S18_PA');
    if (isBranchHae(pos.branch, iljinBranch)) triggered.add('S19_HAE');
    if (pos.isYearOrHour && (isSamhap(pos.branch, iljinBranch) || isYukhap(pos.branch, iljinBranch))) {
      triggered.add('S25_FAMILY_HAP');
    }
  }

  // 신살.
  if (TIANYI[saju.dayMaster].includes(iljinBranch)) triggered.add('S30_TIANYI');
  if (MUNCHANG[saju.dayMaster] === iljinBranch) triggered.add('S31_MUNCHANG');
  if (YANGIN[saju.dayMaster] === iljinBranch) triggered.add('S26_YANGIN');
  if (BAEKHO_GANZI.has(`${iljinStem}${iljinBranch}`)) triggered.add('S32_BAEKHO');

  // 도화 — 일지 원칙 三合 그룹.
  const dohwaMap: Record<string, Branch> = { 申子辰: '酉', 寅午戌: '卯', 巳酉丑: '午', 亥卯未: '子' };
  for (const key of Object.keys(dohwaMap)) {
    if (key.includes(saju.dayBranch) && iljinBranch === dohwaMap[key]) {
      triggered.add('S28_DOHWA');
      break;
    }
  }
  // 역마 — 일지/연지 원칙.
  const yeokmaMap: Record<string, Branch> = { 申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳' };
  for (const key of Object.keys(yeokmaMap)) {
    if ((key.includes(saju.dayBranch) || key.includes(saju.yearBranch)) && iljinBranch === yeokmaMap[key]) {
      triggered.add('S27_YEOKMA');
      break;
    }
  }
  // 화개 — 일지/연지 三合 의 마지막 지지.
  const hwagaeMap: Record<string, Branch> = { 申子辰: '辰', 寅午戌: '戌', 巳酉丑: '丑', 亥卯未: '未' };
  for (const key of Object.keys(hwagaeMap)) {
    if ((key.includes(saju.dayBranch) || key.includes(saju.yearBranch)) && iljinBranch === hwagaeMap[key]) {
      triggered.add('S29_HWAGAE');
      break;
    }
  }

  // 오행 부족/과다 보충/가중.
  const iljinEls: Elem[] = [STEM_TO_ELEMENT[iljinStem], BRANCH_TO_ELEMENT[iljinBranch]];
  for (const el of iljinEls) {
    const pct = saju.elementPercentages[el] ?? 0;
    if (pct < 10) triggered.add('S36_SHORTAGE_FILLED');
    if (pct >= 40) triggered.add('S37_EXCESS_AMPLIFIED');
  }

  // 용신/기신.
  if (saju.yongsinElement && iljinEls.includes(saju.yongsinElement)) triggered.add('S38_YONGSIN_IN');
  if (saju.kishinElement && iljinEls.includes(saju.kishinElement)) triggered.add('S39_KISHIN_IN');

  // 특수 조합.
  if (['식신', '상관'].includes(sipsung)) {
    // 식상 + 지지가 재성 = 식신생재.
    const wealthMap: Record<Elem, Elem> = { 목: '토', 화: '금', 토: '수', 금: '목', 수: '화' };
    if (BRANCH_TO_ELEMENT[iljinBranch] === wealthMap[saju.dayMasterElement]) {
      triggered.add('S41_SIKSHIN_SAENG_JAE');
    }
  }
  if (['편재', '정재'].includes(sipsung)) {
    const officialMap: Record<Elem, Elem> = { 목: '금', 화: '수', 토: '목', 금: '화', 수: '토' };
    if (BRANCH_TO_ELEMENT[iljinBranch] === officialMap[saju.dayMasterElement]) {
      triggered.add('S42_JAESAENG_GWAN');
    }
  }
  if (['편관', '정관'].includes(sipsung)) {
    const resourceMap: Record<Elem, Elem> = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
    if (BRANCH_TO_ELEMENT[iljinBranch] === resourceMap[saju.dayMasterElement]) {
      triggered.add('S43_GWANIN_SAENG');
    }
  }

  // 일진과 일주 동주.
  if (iljinStem === saju.dayMaster && iljinBranch === saju.dayBranch) {
    triggered.add('S49_DAY_PILLAR_SAME');
  }

  // 평운 — 다른 강한 신호가 없을 때만.
  if (triggered.size === 1) {
    triggered.add('S50_PEACE');
  }

  return Array.from(triggered);
}

export interface PickedMessages {
  caseIds: IljinCaseId[];
  messages: string[];
}

/**
 * 발동 케이스 중 우선순위 상위 N개를 선택해 변수 치환된 메시지 반환.
 * @param topN 기본 3개. 1=총론용, 3=총론+보조 2개.
 */
export function pickIljinMessages(
  saju: SajuOriginInput,
  iljinStem: Stem,
  iljinBranch: Branch,
  vars: MessageVariables,
  seedSuffix: string,
  topN = 3
): PickedMessages {
  const triggered = detectTriggeredCases(saju, iljinStem, iljinBranch);
  const sorted = triggered
    .slice()
    .sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  const top = sorted.slice(0, topN);
  const messages = top.map((id) => {
    const tpl = pickVariant(id, `${id}::${seedSuffix}`);
    return substituteVariables(tpl, vars);
  });
  return { caseIds: top, messages };
}
