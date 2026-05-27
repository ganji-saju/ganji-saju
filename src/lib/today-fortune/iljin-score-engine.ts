// 2026-05-15 PR 3 — 운세톡톡 벤치마크 (일진_점수산출_알고리즘_정교화.md):
// 일진 점수 산출 8영역 엔진. 원칙 50점에서 다음을 누적:
//   ① 일간 vs 일진 천간 (십성 작용)  가중치 1.5x
//   ② 사주 지지 vs 일진 지지 (합/충/형/해/파/원진)  가중치 1.5x
//   ③ 일진 오행이 용신/기신인지  가중치 1.3x
//   ④ 신살 발동 (천을귀인/양인/백호 등)  가중치 1.0x
//   ⑤ 사주 원국 부족 오행 보충 여부  가중치 1.0x
//   ⑥ 일주 강약 조절 작용  가중치 0.8x
//   ⑦ 12운성 일치  가중치 0.6x
//   ⑧ 특수 조합 (식신생재/재생관/관인상생)  가중치 1.2x
//
// 최종 점수: clamp(50 + sum, 5, 95). 7단계 등급 (🌟✨😊🙂😐😕⚠️).

import {
  BRANCH_TO_ELEMENT,
  STEM_TO_ELEMENT,
  calculateSipsung,
  getTwelveStage,
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

export type IljinScoreGrade = '최고' | '매우 좋음' | '좋음' | '무난' | '보통' | '주의' | '매우 주의';

export interface IljinScoreBreakdown {
  cheongan: number;
  jiji: number;
  ohaeng: number;
  sinsal: number;
  balance: number;
  regulation: number;
  unsung: number;
  special: number;
}

export interface IljinScoreResult {
  totalScore: number;
  grade: IljinScoreGrade;
  gradeEmoji: string;
  gradeMessage: string;
  breakdown: IljinScoreBreakdown;
  dominantSipsung: SipSung;
}

export interface SajuOriginInput {
  dayMaster: Stem;
  dayMasterElement: Elem;
  yearStem: Stem;
  yearBranch: Branch;
  monthStem: Stem;
  monthBranch: Branch;
  dayBranch: Branch;
  hourStem: Stem | null;
  hourBranch: Branch | null;
  /** 사주 전체 8글자 (천간+지지) 의 오행별 percentage. */
  elementPercentages: Record<Elem, number>;
  /** 신강/신약 라벨 (없으면 null). */
  strengthLabel: string | null;
  /** 용신 오행 (없으면 dayMasterElement 폴백). */
  yongsinElement: Elem | null;
  /** 기신 오행 (없으면 dominant 폴백). */
  kishinElement: Elem | null;
  /** 사주 원국에 도화·역마 등 신살이 이미 있는지 (간단 탐지용). */
}

export interface IljinInput {
  todayStem: Stem;
  todayBranch: Branch;
}

// === Score 1: 천간 (십성) ===
function scoreCheongan(saju: SajuOriginInput, iljin: IljinInput): { score: number; sipsung: SipSung } {
  const sipsung = calculateSipsung(saju.dayMaster, iljin.todayStem);
  const baseScores: Record<SipSung, number> = {
    비견: 0,
    겁재: -10,
    식신: +10,
    상관: +5,
    편재: +10,
    정재: +10,
    편관: -5,
    정관: +10,
    편인: +5,
    정인: +10,
  };
  let score = baseScores[sipsung];

  const strong = isStrong(saju.strengthLabel);
  const weak = isWeak(saju.strengthLabel);
  if (strong) {
    if (['식신', '상관', '편재', '정재', '편관', '정관'].includes(sipsung)) score += 5;
    if (['비견', '겁재', '편인', '정인'].includes(sipsung)) score -= 5;
  } else if (weak) {
    if (['비견', '겁재', '편인', '정인'].includes(sipsung)) score += 5;
    if (['식신', '상관', '편재', '정재', '편관', '정관'].includes(sipsung)) score -= 5;
  }

  if (isStemHap(saju.dayMaster, iljin.todayStem)) score += 5;
  if (isStemChung(saju.dayMaster, iljin.todayStem)) score -= 8;

  // 가중치 1.5x.
  return { score: clamp(score * 1.5, -22.5, 22.5), sipsung };
}

// === Score 2: 지지 (합/충/형/해/파/원진) ===
function scoreJiji(saju: SajuOriginInput, iljin: IljinInput): number {
  const positions: Array<{ branch: Branch | null; weight: number }> = [
    { branch: saju.yearBranch, weight: 1.0 },
    { branch: saju.monthBranch, weight: 1.2 },
    { branch: saju.dayBranch, weight: 1.3 },
    { branch: saju.hourBranch, weight: 0.9 },
  ];

  let score = 0;
  for (const pos of positions) {
    if (!pos.branch) continue;
    let local = 0;
    if (isSamhap(pos.branch, iljin.todayBranch)) local += 10;
    else if (isBanghap(pos.branch, iljin.todayBranch)) local += 8;
    else if (isYukhap(pos.branch, iljin.todayBranch)) local += 6;

    if (isBranchChung(pos.branch, iljin.todayBranch)) local -= 12;
    if (isBranchHyung(pos.branch, iljin.todayBranch)) local -= 8;
    if (isJahyung(pos.branch, iljin.todayBranch)) local -= 6;
    if (isBranchWonjin(pos.branch, iljin.todayBranch)) local -= 7;
    if (isBranchPa(pos.branch, iljin.todayBranch)) local -= 4;
    if (isBranchHae(pos.branch, iljin.todayBranch)) local -= 5;

    score += local * pos.weight;
  }

  return clamp(score, -22.5, 22.5);
}

// === Score 3: 일진 오행 vs 용신/기신 ===
function scoreOhaengYongsin(saju: SajuOriginInput, iljin: IljinInput): number {
  const yongsin = saju.yongsinElement;
  const kishin = saju.kishinElement;
  const iljinStemEl = STEM_TO_ELEMENT[iljin.todayStem];
  const iljinBranchEl = BRANCH_TO_ELEMENT[iljin.todayBranch];

  let score = 0;
  if (yongsin) {
    if (iljinStemEl === yongsin) score += 10;
    if (iljinBranchEl === yongsin) score += 8;
  }
  if (kishin) {
    if (iljinStemEl === kishin) score -= 10;
    if (iljinBranchEl === kishin) score -= 8;
  }

  return clamp(score * 1.3, -19.5, 19.5);
}

// === Score 4: 신살 발동 (간이판) ===
// 천을귀인·문창귀인·도화·역마·양인·백호·공망 등을 일진 지지·천간 바탕으로 간이 탐지.
// 정밀 신살은 별도 엔진 필요. 여기선 사용자 체감이 큰 7개만.
function scoreSinsal(saju: SajuOriginInput, iljin: IljinInput): number {
  let score = 0;
  // 천을귀인 (일간 → 길지). 甲戊庚=丑未, 乙己=子申, 丙丁=亥酉, 壬癸=巳卯, 辛=寅午.
  const TIANYI: Record<Stem, Branch[]> = {
    甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
    乙: ['子', '申'], 己: ['子', '申'],
    丙: ['亥', '酉'], 丁: ['亥', '酉'],
    壬: ['巳', '卯'], 癸: ['巳', '卯'],
    辛: ['寅', '午'],
  };
  if (TIANYI[saju.dayMaster].includes(iljin.todayBranch)) score += 15;

  // 도화 (일지 원칙): 申子辰→酉, 寅午戌→卯, 巳酉丑→午, 亥卯未→子.
  const DOHWA: Record<string, Branch> = {
    申子辰: '酉', 寅午戌: '卯', 巳酉丑: '午', 亥卯未: '子',
  };
  for (const key of Object.keys(DOHWA)) {
    if (key.includes(saju.dayBranch) && iljin.todayBranch === DOHWA[key]) {
      score += 3;
      break;
    }
  }

  // 역마 (일지/연지 원칙): 申子辰→寅, 寅午戌→申, 巳酉丑→亥, 亥卯未→巳.
  const YEOKMA: Record<string, Branch> = {
    申子辰: '寅', 寅午戌: '申', 巳酉丑: '亥', 亥卯未: '巳',
  };
  for (const key of Object.keys(YEOKMA)) {
    if ((key.includes(saju.dayBranch) || key.includes(saju.yearBranch)) && iljin.todayBranch === YEOKMA[key]) {
      score += 3;
      break;
    }
  }

  // 양인 (일간 원칙, 양간만): 甲卯, 丙午, 戊午, 庚酉, 壬子.
  const YANGIN: Record<Stem, Branch | null> = {
    甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子',
    乙: null, 丁: null, 己: null, 辛: null, 癸: null,
  };
  if (YANGIN[saju.dayMaster] === iljin.todayBranch) score -= 8;

  // 백호 (일진 ganzi 가 갑진/을미/병술/정축/무진/임술/계축 중 하나).
  const BAEKHO_GANZI = new Set([
    '甲辰', '乙未', '丙戌', '丁丑', '戊辰', '壬戌', '癸丑',
  ]);
  if (BAEKHO_GANZI.has(`${iljin.todayStem}${iljin.todayBranch}`)) score -= 12;

  // 공망 (일주 ganzi 순별). 간단판: 정확도는 일주별 공망표 필요.
  // 여기선 사주 일주 vs 일진 ganzi 가 同旬에서 빠진 지지인지 간이 판정 — 우선 패스.

  return clamp(score, -15, 15);
}

// === Score 5: 부족 오행 보충 / 과다 오행 가중 ===
function scoreOhaengBalance(saju: SajuOriginInput, iljin: IljinInput): number {
  const els: Elem[] = [STEM_TO_ELEMENT[iljin.todayStem], BRANCH_TO_ELEMENT[iljin.todayBranch]];
  let score = 0;
  for (const el of els) {
    const pct = saju.elementPercentages[el] ?? 0;
    if (pct === 0) score += 8; // 부재 보충
    else if (pct < 10) score += 4; // 약함 보충
    else if (pct >= 40) score -= 6; // 과다 가중
  }
  return clamp(score, -10, 15);
}

// === Score 6: 일주 강약 조절 ===
function scoreRegulation(saju: SajuOriginInput, iljin: IljinInput, sipsung: SipSung): number {
  const strong = isStrong(saju.strengthLabel);
  const weak = isWeak(saju.strengthLabel);
  // 설기·극 = 식상·재성·관성. 지원 = 비겁·인성.
  const seolgiOrGeuk = ['식신', '상관', '편재', '정재', '편관', '정관'].includes(sipsung);
  const jiwon = ['비견', '겁재', '편인', '정인'].includes(sipsung);

  let score = 0;
  if (strong) {
    if (seolgiOrGeuk) score += 10;
    else if (jiwon) score -= 8;
  } else if (weak) {
    if (jiwon) score += 10;
    else if (seolgiOrGeuk) score -= 8;
  }
  return clamp(score * 0.8, -8, 12);
}

// === Score 7: 12운성 ===
function scoreTwelveUnsung(saju: SajuOriginInput, iljin: IljinInput): number {
  const stage = getTwelveStage(saju.dayMaster, iljin.todayBranch);
  const scoreMap: Record<string, number> = {
    장생: 6, 목욕: 2, 관대: 5, 건록: 7, 제왕: 6,
    쇠: -3, 병: -5, 사: -7, 묘: -4, 절: -6, 태: 2, 양: 4,
  };
  return clamp((scoreMap[stage] ?? 0) * 0.6, -6, 9);
}

// === Score 8: 특수 조합 ===
function scoreSpecial(saju: SajuOriginInput, iljin: IljinInput, sipsung: SipSung): number {
  let score = 0;
  const iljinStemEl = STEM_TO_ELEMENT[iljin.todayStem];
  const iljinBranchEl = BRANCH_TO_ELEMENT[iljin.todayBranch];
  const dmEl = saju.dayMasterElement;

  // 식신생재: 일진 천간이 식신/상관 + 지지가 재성 오행 (일간이 극하는 오행).
  if (['식신', '상관'].includes(sipsung)) {
    const wealthEl = ELEMENT_CONTROLS[dmEl];
    if (iljinBranchEl === wealthEl) score += 12;
  }
  // 재생관: 일진 천간이 재성 + 지지가 관성.
  if (['편재', '정재'].includes(sipsung)) {
    const officialEl = ELEMENT_CONTROLS_REVERSE[dmEl];
    if (iljinBranchEl === officialEl) score += 10;
  }
  // 관인상생: 일진 천간이 관성 + 지지가 인성.
  if (['편관', '정관'].includes(sipsung)) {
    const resourceEl = ELEMENT_GENERATES_REVERSE[dmEl];
    if (iljinBranchEl === resourceEl) score += 10;
  }

  return clamp(score, 0, 18);
}

const ELEMENT_GENERATES: Record<Elem, Elem> = {
  목: '화', 화: '토', 토: '금', 금: '수', 수: '목',
};
const ELEMENT_CONTROLS: Record<Elem, Elem> = {
  목: '토', 화: '금', 토: '수', 금: '목', 수: '화',
};
// 역방향: dmEl 을 극하는 오행 = 관성 오행.
const ELEMENT_CONTROLS_REVERSE: Record<Elem, Elem> = {
  목: '금', 화: '수', 토: '목', 금: '화', 수: '토',
};
// 역방향: dmEl 을 생하는 오행 = 인성 오행.
const ELEMENT_GENERATES_REVERSE: Record<Elem, Elem> = {
  목: '수', 화: '목', 토: '화', 금: '토', 수: '금',
};

function isStrong(label: string | null): boolean {
  if (!label) return false;
  return label.includes('신강') || label.includes('매우 신강') || label === '강';
}
function isWeak(label: string | null): boolean {
  if (!label) return false;
  return label.includes('신약') || label.includes('매우 신약') || label === '약';
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getGrade(score: number): { grade: IljinScoreGrade; emoji: string; message: string } {
  if (score >= 90) return { grade: '최고', emoji: '🌟', message: '흐름이 매우 잘 받쳐주는 기운, 큰 도전도 차근차근 시도하기 좋은 날' };
  if (score >= 80) return { grade: '매우 좋음', emoji: '✨', message: '흐름이 매우 좋은 날, 적극적으로 움직이세요' };
  if (score >= 70) return { grade: '좋음', emoji: '😊', message: '전반적으로 순조로운 하루' };
  if (score >= 60) return { grade: '무난', emoji: '🙂', message: '큰 변동 없이 안정적인 날' };
  if (score >= 45) return { grade: '보통', emoji: '😐', message: '평범한 하루, 평소처럼 하세요' };
  if (score >= 30) return { grade: '주의', emoji: '😕', message: '신중함이 필요한 날, 큰 결정은 피하세요' };
  return { grade: '매우 주의', emoji: '⚠️', message: '조심해야 할 날, 수성(守城)의 자세를' };
}

export function calculateIljinScore(saju: SajuOriginInput, iljin: IljinInput): IljinScoreResult {
  const { score: cheongan, sipsung } = scoreCheongan(saju, iljin);
  const jiji = scoreJiji(saju, iljin);
  const ohaeng = scoreOhaengYongsin(saju, iljin);
  const sinsal = scoreSinsal(saju, iljin);
  const balance = scoreOhaengBalance(saju, iljin);
  const regulation = scoreRegulation(saju, iljin, sipsung);
  const unsung = scoreTwelveUnsung(saju, iljin);
  const special = scoreSpecial(saju, iljin, sipsung);

  const breakdown: IljinScoreBreakdown = {
    cheongan: Math.round(cheongan),
    jiji: Math.round(jiji),
    ohaeng: Math.round(ohaeng),
    sinsal: Math.round(sinsal),
    balance: Math.round(balance),
    regulation: Math.round(regulation),
    unsung: Math.round(unsung),
    special: Math.round(special),
  };

  const sum =
    breakdown.cheongan +
    breakdown.jiji +
    breakdown.ohaeng +
    breakdown.sinsal +
    breakdown.balance +
    breakdown.regulation +
    breakdown.unsung +
    breakdown.special;

  const totalScore = clamp(50 + sum, 5, 95);
  const g = getGrade(totalScore);

  return {
    totalScore: Math.round(totalScore),
    grade: g.grade,
    gradeEmoji: g.emoji,
    gradeMessage: g.message,
    breakdown,
    dominantSipsung: sipsung,
  };
}
