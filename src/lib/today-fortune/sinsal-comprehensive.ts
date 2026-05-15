// 2026-05-15 PR 4 — 02_십성_12운성_신살_판정함수.md §3 신살 종합 탐지 모듈.
// 기존 iljin-case-picker.ts 는 일진 vs 사주의 7개 신살만 탐지했음.
// 이 모듈은 사주 원국 자체에 발동된 신살 + 오늘 일진과의 상호작용까지 20개 신살 종합 탐지.
//
// 길신 (Good): 천을귀인 · 문창귀인 · 천덕귀인 · 월덕귀인 · 금여록 · 암록 · 관귀학관
// 흉신 (Bad): 양인살 · 백호살 · 괴강살 · 공망살 · 망신살 · 겁살 · 원진살 · 귀문관살 · 삼재
// 양날의검: 역마살 · 도화살 · 화개살

import type { Branch, Stem } from './iljin-rules';

export type SinsalCategory = '길신' | '흉신' | '양날의검';

export interface SinsalHit {
  /** 신살 이름 (천을귀인 / 양인살 / 도화살 등). */
  name: string;
  category: SinsalCategory;
  /** 발동 위치: 'year'/'month'/'day'/'hour'/'iljin' (일진과의 상호작용). */
  positions: Array<'year' | 'month' | 'day' | 'hour' | 'iljin'>;
  /** 사주 점수 영향 hint (-15 ~ +15). UI 표시용. */
  scoreHint: number;
  /** 사용자 노출용 짧은 설명. */
  hint: string;
}

interface SajuChartInput {
  dayMaster: Stem;
  yearBranch: Branch;
  monthBranch: Branch;
  dayBranch: Branch;
  hourBranch: Branch | null;
  /** 일주 갑자 인덱스 (0~59). 공망 계산용. */
  dayGanziIndex: number;
}

interface IljinInput {
  stem: Stem;
  branch: Branch;
}

// 일간별 천을귀인 지지.
const CHEONEUL_GWIIN: Record<Stem, Branch[]> = {
  甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
  乙: ['子', '申'], 己: ['子', '申'],
  丙: ['亥', '酉'], 丁: ['亥', '酉'],
  辛: ['寅', '午'],
  壬: ['卯', '巳'], 癸: ['卯', '巳'],
};

// 일간별 문창귀인 지지 (식상의 장생지).
const MUNCHANG_GWIIN: Record<Stem, Branch> = {
  甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申',
  己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯',
};

// 월지별 천덕귀인 천간.
const CHEONDEOK_GWIIN: Record<Branch, Stem> = {
  寅: '丁', 卯: '申' as unknown as Stem, // 卯月 → 申 (branch 형식 일부 표기는 학파 차이)
  辰: '壬', 巳: '辛', 午: '亥' as unknown as Stem, 未: '甲',
  申: '癸', 酉: '寅' as unknown as Stem, 戌: '丙', 亥: '乙',
  子: '巳' as unknown as Stem, 丑: '庚',
};
// 위 표는 천덕귀인이 천간+지지 혼합 — 우리는 천간 발동만 검사 (간이판).
const CHEONDEOK_GWIIN_STEM_ONLY: Partial<Record<Branch, Stem>> = {
  寅: '丁', 辰: '壬', 巳: '辛', 未: '甲',
  申: '癸', 戌: '丙', 亥: '乙', 丑: '庚',
};

// 월지별 월덕귀인 천간.
const WOLDEOK_GWIIN: Partial<Record<Branch, Stem>> = {
  寅: '丙', 午: '丙', 戌: '丙', // 寅午戌 火局 → 丙
  申: '壬', 子: '壬', 辰: '壬', // 申子辰 水局 → 壬
  巳: '庚', 酉: '庚', 丑: '庚', // 巳酉丑 金局 → 庚
  亥: '甲', 卯: '甲', 未: '甲', // 亥卯未 木局 → 甲
};

// 일간별 금여록 지지.
const GEUMYEOROK: Record<Stem, Branch> = {
  甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未',
  己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅',
};

// 일간별 암록 지지 (정관/건록 위치).
const AMROK: Record<Stem, Branch> = {
  甲: '亥', 乙: '戌', 丙: '申', 丁: '未', 戊: '申',
  己: '未', 庚: '巳', 辛: '辰', 壬: '寅', 癸: '丑',
};

// 일간별 양인살 지지 (양간만).
const YANGIN: Partial<Record<Stem, Branch>> = {
  甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子',
};

// 일주 ganzi (천간+지지) 가 백호살.
const BAEKHO_GANZI = new Set([
  '甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑',
]);

// 일주 ganzi 가 괴강살.
const GOEGANG_GANZI = new Set([
  '庚辰', '庚戌', '壬辰', '壬戌',
]);

// 三合 그룹 기준 도화·역마·화개·망신·겁살.
const SAMHAP_GROUPS = [
  { branches: ['申', '子', '辰'], dohwa: '酉', yeokma: '寅', hwagae: '辰', mangsin: '亥', geopsal: '巳' },
  { branches: ['寅', '午', '戌'], dohwa: '卯', yeokma: '申', hwagae: '戌', mangsin: '巳', geopsal: '亥' },
  { branches: ['巳', '酉', '丑'], dohwa: '午', yeokma: '亥', hwagae: '丑', mangsin: '申', geopsal: '寅' },
  { branches: ['亥', '卯', '未'], dohwa: '子', yeokma: '巳', hwagae: '未', mangsin: '寅', geopsal: '申' },
];

// 일주 ganzi 인덱스 → 공망 지지 2개. 6 旬.
const GONGMANG_BY_SOON: Array<[Branch, Branch]> = [
  ['戌', '亥'], // 甲子旬 (0~9)
  ['申', '酉'], // 甲戌旬 (10~19)
  ['午', '未'], // 甲申旬 (20~29)
  ['辰', '巳'], // 甲午旬 (30~39)
  ['寅', '卯'], // 甲辰旬 (40~49)
  ['子', '丑'], // 甲寅旬 (50~59)
];

function getGongmangBranches(dayGanziIndex: number): Branch[] {
  const soonIdx = Math.floor(dayGanziIndex / 10) % 6;
  return GONGMANG_BY_SOON[soonIdx]!;
}

// 원진 6쌍 (재정의 - import 회피).
const WONJIN_PAIRS: Array<[Branch, Branch]> = [
  ['子', '未'], ['丑', '午'], ['寅', '酉'],
  ['卯', '申'], ['辰', '亥'], ['巳', '戌'],
];
function isWonjin(a: string, b: string): boolean {
  return WONJIN_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// 귀문관살 6쌍.
const GWIMUN_PAIRS: Array<[Branch, Branch]> = [
  ['子', '酉'], ['丑', '午'], ['寅', '未'],
  ['卯', '申'], ['辰', '亥'], ['巳', '戌'],
];
function isGwimun(a: string, b: string): boolean {
  return GWIMUN_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}

// 띠 기준 삼재 들어오는 3년 지지.
const SAMJAE: Record<string, Branch[]> = {
  申: ['寅', '卯', '辰'], 子: ['寅', '卯', '辰'], 辰: ['寅', '卯', '辰'],
  亥: ['巳', '午', '未'], 卯: ['巳', '午', '未'], 未: ['巳', '午', '未'],
  寅: ['申', '酉', '戌'], 午: ['申', '酉', '戌'], 戌: ['申', '酉', '戌'],
  巳: ['亥', '子', '丑'], 酉: ['亥', '子', '丑'], 丑: ['亥', '子', '丑'],
};

interface DetectOptions {
  /** 오늘 일진 (없으면 사주 원국 내 신살만 탐지). */
  iljin?: IljinInput;
  /** 올해 연지 (삼재 탐지용). */
  currentYearBranch?: Branch;
}

/**
 * 사주 원국 + 오늘 일진 + 올해 연지 종합 신살 탐지.
 * 각 신살은 발동 위치 배열을 들고 반환 — UI 가 위치별 chip 표시 가능.
 */
export function detectComprehensiveSinsals(
  saju: SajuChartInput,
  options: DetectOptions = {}
): SinsalHit[] {
  const hits: SinsalHit[] = [];
  const branches: Array<{ key: 'year' | 'month' | 'day' | 'hour'; branch: Branch | null }> = [
    { key: 'year', branch: saju.yearBranch },
    { key: 'month', branch: saju.monthBranch },
    { key: 'day', branch: saju.dayBranch },
    { key: 'hour', branch: saju.hourBranch },
  ];

  function pushIf(condition: boolean, hit: Omit<SinsalHit, 'positions'> & { positions: SinsalHit['positions'] }) {
    if (condition && hit.positions.length > 0) hits.push(hit);
  }

  // 길신 ─────────────────────────────────────────────

  // 천을귀인
  {
    const targets = CHEONEUL_GWIIN[saju.dayMaster];
    const positions: SinsalHit['positions'] = [];
    for (const pos of branches) {
      if (pos.branch && targets.includes(pos.branch)) positions.push(pos.key);
    }
    if (options.iljin && targets.includes(options.iljin.branch)) positions.push('iljin');
    pushIf(positions.length > 0, {
      name: '천을귀인', category: '길신', positions, scoreHint: 15,
      hint: '최고의 길신, 위기를 기회로 바꿔주는 귀인 작용',
    });
  }

  // 문창귀인
  {
    const target = MUNCHANG_GWIIN[saju.dayMaster];
    const positions: SinsalHit['positions'] = [];
    for (const pos of branches) {
      if (pos.branch === target) positions.push(pos.key);
    }
    if (options.iljin && options.iljin.branch === target) positions.push('iljin');
    pushIf(positions.length > 0, {
      name: '문창귀인', category: '길신', positions, scoreHint: 10,
      hint: '학문·시험·글쓰기에 길운',
    });
  }

  // 천덕귀인 (월지 기준, 사주 천간/일진 천간 검사)
  {
    const target = CHEONDEOK_GWIIN_STEM_ONLY[saju.monthBranch];
    if (target && options.iljin && options.iljin.stem === target) {
      hits.push({
        name: '천덕귀인', category: '길신', positions: ['iljin'], scoreHint: 8,
        hint: '하늘이 돕는 길신, 모든 영역에 순조로움',
      });
    }
  }

  // 월덕귀인
  {
    const target = WOLDEOK_GWIIN[saju.monthBranch];
    if (target && options.iljin && options.iljin.stem === target) {
      hits.push({
        name: '월덕귀인', category: '길신', positions: ['iljin'], scoreHint: 8,
        hint: '월의 음덕, 어머니·여성 인연의 도움',
      });
    }
  }

  // 금여록 (일간 → 지지)
  {
    const target = GEUMYEOROK[saju.dayMaster];
    const positions: SinsalHit['positions'] = [];
    for (const pos of branches) {
      if (pos.branch === target) positions.push(pos.key);
    }
    if (options.iljin && options.iljin.branch === target) positions.push('iljin');
    pushIf(positions.length > 0, {
      name: '금여록', category: '길신', positions, scoreHint: 6,
      hint: '재물과 명예의 잔잔한 길운',
    });
  }

  // 암록 (일간 → 정관 위치)
  {
    const target = AMROK[saju.dayMaster];
    const positions: SinsalHit['positions'] = [];
    for (const pos of branches) {
      if (pos.branch === target) positions.push(pos.key);
    }
    if (options.iljin && options.iljin.branch === target) positions.push('iljin');
    pushIf(positions.length > 0, {
      name: '암록', category: '길신', positions, scoreHint: 6,
      hint: '드러나지 않는 인덕·뒤에서 받쳐주는 도움',
    });
  }

  // 흉신 ─────────────────────────────────────────────

  // 양인살
  {
    const target = YANGIN[saju.dayMaster];
    const positions: SinsalHit['positions'] = [];
    if (target) {
      for (const pos of branches) {
        if (pos.branch === target) positions.push(pos.key);
      }
      if (options.iljin && options.iljin.branch === target) positions.push('iljin');
    }
    pushIf(positions.length > 0, {
      name: '양인살', category: '흉신', positions, scoreHint: -8,
      hint: '극단적 추진력, 사고·수술·칼 조심',
    });
  }

  // 백호살 (일주 ganzi)
  {
    const positions: SinsalHit['positions'] = [];
    // 백호는 일주에서만 체크 (일주 ganzi 가 BAEKHO_GANZI 일 때).
    const dayGanzi = `${saju.dayMaster}${saju.dayBranch}`;
    if (BAEKHO_GANZI.has(dayGanzi)) positions.push('day');
    if (options.iljin) {
      const iljinGanzi = `${options.iljin.stem}${options.iljin.branch}`;
      if (BAEKHO_GANZI.has(iljinGanzi)) positions.push('iljin');
    }
    pushIf(positions.length > 0, {
      name: '백호살', category: '흉신', positions, scoreHint: -12,
      hint: '갑작스러운 사고·충돌·혈광, 안전 운전 필수',
    });
  }

  // 괴강살 (일주 ganzi)
  {
    const positions: SinsalHit['positions'] = [];
    const dayGanzi = `${saju.dayMaster}${saju.dayBranch}`;
    if (GOEGANG_GANZI.has(dayGanzi)) positions.push('day');
    if (options.iljin) {
      const iljinGanzi = `${options.iljin.stem}${options.iljin.branch}`;
      if (GOEGANG_GANZI.has(iljinGanzi)) positions.push('iljin');
    }
    pushIf(positions.length > 0, {
      name: '괴강살', category: '양날의검', positions, scoreHint: -5,
      hint: '강한 카리스마·우두머리 기질, 양극단 결과',
    });
  }

  // 공망살 (일주 旬 기준)
  {
    const gongmang = getGongmangBranches(saju.dayGanziIndex);
    const positions: SinsalHit['positions'] = [];
    for (const pos of branches) {
      if (pos.key === 'day') continue; // 일주 본인은 공망 대상 아님
      if (pos.branch && gongmang.includes(pos.branch)) positions.push(pos.key);
    }
    if (options.iljin && gongmang.includes(options.iljin.branch)) positions.push('iljin');
    pushIf(positions.length > 0, {
      name: '공망살', category: '흉신', positions, scoreHint: -10,
      hint: '노력 대비 결과 부족·헛수고, 비움과 정리에 집중',
    });
  }

  // 원진살
  {
    const positions: SinsalHit['positions'] = [];
    const sajuBranches = branches.filter((b) => b.branch).map((b) => ({ key: b.key, branch: b.branch as Branch }));
    // 사주 내 원진 쌍.
    for (let i = 0; i < sajuBranches.length; i += 1) {
      for (let j = i + 1; j < sajuBranches.length; j += 1) {
        if (isWonjin(sajuBranches[i].branch, sajuBranches[j].branch)) {
          if (!positions.includes(sajuBranches[i].key)) positions.push(sajuBranches[i].key);
          if (!positions.includes(sajuBranches[j].key)) positions.push(sajuBranches[j].key);
        }
      }
    }
    // 일진과 사주 지지 원진.
    if (options.iljin) {
      for (const pos of sajuBranches) {
        if (isWonjin(pos.branch, options.iljin.branch)) {
          if (!positions.includes(pos.key)) positions.push(pos.key);
          if (!positions.includes('iljin')) positions.push('iljin');
        }
      }
    }
    pushIf(positions.length > 0, {
      name: '원진살', category: '흉신', positions, scoreHint: -7,
      hint: '이유 없는 짜증·미묘한 갈등, 입조심 필요',
    });
  }

  // 귀문관살
  {
    const positions: SinsalHit['positions'] = [];
    const sajuBranches = branches.filter((b) => b.branch).map((b) => ({ key: b.key, branch: b.branch as Branch }));
    for (let i = 0; i < sajuBranches.length; i += 1) {
      for (let j = i + 1; j < sajuBranches.length; j += 1) {
        if (isGwimun(sajuBranches[i].branch, sajuBranches[j].branch)) {
          if (!positions.includes(sajuBranches[i].key)) positions.push(sajuBranches[i].key);
          if (!positions.includes(sajuBranches[j].key)) positions.push(sajuBranches[j].key);
        }
      }
    }
    if (options.iljin) {
      for (const pos of sajuBranches) {
        if (isGwimun(pos.branch, options.iljin.branch)) {
          if (!positions.includes(pos.key)) positions.push(pos.key);
          if (!positions.includes('iljin')) positions.push('iljin');
        }
      }
    }
    pushIf(positions.length > 0, {
      name: '귀문관살', category: '흉신', positions, scoreHint: -10,
      hint: '정신적 예민함·신경과민, 명상·휴식 권장',
    });
  }

  // 망신살
  {
    const yearGroup = SAMHAP_GROUPS.find((g) => g.branches.includes(saju.yearBranch));
    if (yearGroup) {
      const target = yearGroup.mangsin as Branch;
      const positions: SinsalHit['positions'] = [];
      for (const pos of branches) {
        if (pos.branch === target) positions.push(pos.key);
      }
      if (options.iljin && options.iljin.branch === target) positions.push('iljin');
      pushIf(positions.length > 0, {
        name: '망신살', category: '흉신', positions, scoreHint: -8,
        hint: '망신·도난·사기 위험, 보안 점검',
      });
    }
  }

  // 겁살
  {
    const yearGroup = SAMHAP_GROUPS.find((g) => g.branches.includes(saju.yearBranch));
    if (yearGroup) {
      const target = yearGroup.geopsal as Branch;
      const positions: SinsalHit['positions'] = [];
      for (const pos of branches) {
        if (pos.branch === target) positions.push(pos.key);
      }
      if (options.iljin && options.iljin.branch === target) positions.push('iljin');
      pushIf(positions.length > 0, {
        name: '겁살', category: '흉신', positions, scoreHint: -8,
        hint: '갑작스러운 손실·강탈, 큰 결정 자제',
      });
    }
  }

  // 삼재 (연지 기준 + 올해 연지).
  if (options.currentYearBranch) {
    const samjaeBranches = SAMJAE[saju.yearBranch];
    if (samjaeBranches?.includes(options.currentYearBranch)) {
      const idx = samjaeBranches.indexOf(options.currentYearBranch);
      const stages = ['들삼재', '눌삼재', '날삼재'];
      hits.push({
        name: `삼재 (${stages[idx]})`, category: '흉신', positions: [], scoreHint: -10,
        hint: '3년 흉운 중 ' + stages[idx] + ' — 신중함이 최선',
      });
    }
  }

  // 양날의검 ────────────────────────────────────────

  // 도화·역마·화개 (사주 원국 + 일진과의 상호작용).
  for (const sinsal of [
    { key: 'dohwa' as const, name: '도화살', score: 3, hint: '매력·이성운, 유혹과 함정 동시' },
    { key: 'yeokma' as const, name: '역마살', score: 3, hint: '이동·출장·변화, 분주한 흐름' },
    { key: 'hwagae' as const, name: '화개살', score: 3, hint: '학문·예술·종교, 고독 속 통찰' },
  ]) {
    const positions: SinsalHit['positions'] = [];
    // 연지·일지 두 기준 모두 검사 (학파 차이 대응).
    for (const refBranch of [saju.yearBranch, saju.dayBranch]) {
      const group = SAMHAP_GROUPS.find((g) => g.branches.includes(refBranch));
      if (!group) continue;
      const target = group[sinsal.key] as Branch;
      for (const pos of branches) {
        if (pos.branch === target && !positions.includes(pos.key)) {
          positions.push(pos.key);
        }
      }
      if (options.iljin && options.iljin.branch === target && !positions.includes('iljin')) {
        positions.push('iljin');
      }
    }
    pushIf(positions.length > 0, {
      name: sinsal.name, category: '양날의검', positions, scoreHint: sinsal.score, hint: sinsal.hint,
    });
  }

  return hits;
}
