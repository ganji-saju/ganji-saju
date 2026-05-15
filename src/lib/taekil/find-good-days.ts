// 2026-05-15 — 택일(擇日) 길일 산출 라이브러리.
// 사용자 사주 원국 + 다음 N 일의 일진 → 각 날짜의 8영역 점수 + 목적별 가중치 보정
// → 상위 K 길일 반환.
//
// 인프라 재사용:
//   - PR #105: iljin-score-engine (8영역 점수 산출 + 7등급)
//   - PR #106: sinsal-comprehensive (16종 신살 탐지)
//   - lunar-typescript Solar — 날짜별 일진 ganzi 계산.

import { Solar } from 'lunar-typescript';
import {
  calculateIljinScore,
  type IljinScoreResult,
  type SajuOriginInput,
} from '@/lib/today-fortune/iljin-score-engine';
import {
  detectComprehensiveSinsals,
  type SinsalHit,
} from '@/lib/today-fortune/sinsal-comprehensive';
import type { Branch, Stem } from '@/lib/today-fortune/iljin-rules';

export type TaekilPurpose =
  | 'wedding' // 결혼·약혼
  | 'open' // 개업·오픈
  | 'move' // 이사·입주
  | 'contract' // 계약·서명
  | 'trip' // 여행·출발
  | 'etc'; // 기타

export const TAEKIL_PURPOSES: Array<{ key: TaekilPurpose; label: string; emoji: string; hint: string }> = [
  { key: 'wedding', label: '결혼·약혼', emoji: '💑', hint: '정관·정인이 안정적이고 충·원진을 피한 날' },
  { key: 'open', label: '개업·오픈', emoji: '🏪', hint: '식신·편재·장생이 강하고 백호·공망을 피한 날' },
  { key: 'move', label: '이사·입주', emoji: '🏡', hint: '역마·장생이 살아나고 충·형을 피한 날' },
  { key: 'contract', label: '계약·서명', emoji: '📝', hint: '정관·문창귀인이 살아나고 형·원진을 피한 날' },
  { key: 'trip', label: '여행·출발', emoji: '✈️', hint: '역마가 살아나고 충·형을 피한 날' },
  { key: 'etc', label: '기타 중요한 날', emoji: '✨', hint: '천을귀인·길신 위주, 흉신을 피한 날' },
];

interface PurposeWeight {
  /** 발동 시 가점 신살. */
  positiveSinsal: string[];
  /** 발동 시 감점 신살. */
  negativeSinsal: string[];
  /** 8영역 중 가중 강화 (multiplier). */
  emphasize: Partial<Record<keyof IljinScoreResult['breakdown'], number>>;
}

const PURPOSE_WEIGHTS: Record<TaekilPurpose, PurposeWeight> = {
  wedding: {
    positiveSinsal: ['천을귀인', '월덕귀인', '천덕귀인', '도화살'],
    negativeSinsal: ['양인살', '백호살', '원진살', '귀문관살', '공망살'],
    emphasize: { ohaeng: 1.3, sinsal: 1.4, regulation: 1.2 },
  },
  open: {
    positiveSinsal: ['천을귀인', '문창귀인', '금여록', '암록'],
    negativeSinsal: ['공망살', '백호살', '망신살', '겁살'],
    emphasize: { special: 1.5, ohaeng: 1.3, sinsal: 1.3 },
  },
  move: {
    positiveSinsal: ['역마살', '천을귀인'],
    negativeSinsal: ['양인살', '백호살', '원진살', '겁살'],
    emphasize: { jiji: 1.4, sinsal: 1.3 },
  },
  contract: {
    positiveSinsal: ['천을귀인', '문창귀인', '암록'],
    negativeSinsal: ['양인살', '원진살', '귀문관살', '망신살'],
    emphasize: { cheongan: 1.3, special: 1.3 },
  },
  trip: {
    positiveSinsal: ['역마살', '천을귀인'],
    negativeSinsal: ['백호살', '양인살'],
    emphasize: { jiji: 1.3 },
  },
  etc: {
    positiveSinsal: ['천을귀인', '문창귀인'],
    negativeSinsal: ['백호살', '양인살', '공망살'],
    emphasize: {},
  },
};

export interface TaekilDayResult {
  isoDate: string; // YYYY-MM-DD
  weekday: number; // 0(일)~6(토)
  iljinGanzi: string; // "丁酉"
  iljinKorean: string; // "정유"
  rawScore: number; // 8영역 합산 (clamp 50±)
  adjustedScore: number; // 목적별 가중 보정 후 최종 점수
  grade: '최고' | '매우 좋음' | '좋음' | '무난' | '보통' | '주의' | '매우 주의';
  gradeEmoji: string;
  positiveSinsals: string[]; // 목적에 좋게 작용한 발동 신살
  negativeSinsals: string[]; // 목적에 부담스럽게 작용한 발동 신살
  reasonHint: string; // UI 한 줄 이유
}

interface FindOptions {
  /** 사주 원국 input — iljin-score-engine 의 SajuOriginInput 그대로. */
  saju: SajuOriginInput;
  /** 검색 시작일 (기본: 오늘). */
  startDate?: Date;
  /** 검색 일 수 (기본: 60일). */
  daysToScan?: number;
  /** 목적 (가중치 보정). */
  purpose: TaekilPurpose;
  /** 반환 개수 (기본: 7개). */
  topK?: number;
  /** 결과 일자 인덱스 산출용 — 일주 ganzi index. 공망 등 계산에 필요. */
  dayGanziIndex: number;
}

const KOR_STEM: Record<string, string> = {
  甲: '갑', 乙: '을', 丙: '병', 丁: '정', 戊: '무',
  己: '기', 庚: '경', 辛: '신', 壬: '임', 癸: '계',
};
const KOR_BRANCH: Record<string, string> = {
  子: '자', 丑: '축', 寅: '인', 卯: '묘', 辰: '진', 巳: '사',
  午: '오', 未: '미', 申: '신', 酉: '유', 戌: '술', 亥: '해',
};

function ganziToKorean(ganzi: string): string {
  return (KOR_STEM[ganzi.charAt(0)] ?? '') + (KOR_BRANCH[ganzi.charAt(1)] ?? '');
}

function getGradeFromScore(score: number): TaekilDayResult['grade'] {
  if (score >= 90) return '최고';
  if (score >= 80) return '매우 좋음';
  if (score >= 70) return '좋음';
  if (score >= 60) return '무난';
  if (score >= 45) return '보통';
  if (score >= 30) return '주의';
  return '매우 주의';
}

function getGradeEmoji(grade: TaekilDayResult['grade']): string {
  return {
    최고: '🌟',
    '매우 좋음': '✨',
    좋음: '😊',
    무난: '🙂',
    보통: '😐',
    주의: '😕',
    '매우 주의': '⚠️',
  }[grade];
}

/**
 * 다음 N일 중 목적에 가장 적합한 길일 K개 산출.
 *
 * 알고리즘:
 * 1. 각 후보 일자에 대해 lunar-typescript 로 일진 ganzi 추출.
 * 2. iljin-score-engine 으로 8영역 점수 산출.
 * 3. detectComprehensiveSinsals 로 신살 발동 탐지.
 * 4. 목적별 PURPOSE_WEIGHTS:
 *    - positiveSinsal 발동 시 +8 (각 신살당)
 *    - negativeSinsal 발동 시 -10
 *    - emphasize 항목 점수에 multiplier
 * 5. clamp(0, 100) 후 정렬 → 상위 K 반환.
 */
export function findGoodDays(opts: FindOptions): TaekilDayResult[] {
  const start = opts.startDate ?? new Date();
  const days = opts.daysToScan ?? 60;
  const purpose = opts.purpose;
  const weights = PURPOSE_WEIGHTS[purpose];
  const topK = opts.topK ?? 7;

  const results: TaekilDayResult[] = [];

  for (let i = 0; i < days; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = date.getDay();

    let dayGanzi: string;
    try {
      const solar = Solar.fromYmdHms(year, month, day, 12, 0, 0);
      dayGanzi = solar.getLunar().getEightChar().getDay();
    } catch {
      continue;
    }
    const stem = dayGanzi.charAt(0) as Stem;
    const branch = dayGanzi.charAt(1) as Branch;
    if (!stem || !branch) continue;

    // 8영역 점수.
    const iljin: IljinScoreResult = calculateIljinScore(opts.saju, {
      todayStem: stem,
      todayBranch: branch,
    });

    // 신살 탐지.
    let positiveSinsals: string[] = [];
    let negativeSinsals: string[] = [];
    try {
      const hits: SinsalHit[] = detectComprehensiveSinsals(
        {
          dayMaster: opts.saju.dayMaster,
          yearBranch: opts.saju.yearBranch,
          monthBranch: opts.saju.monthBranch,
          dayBranch: opts.saju.dayBranch,
          hourBranch: opts.saju.hourBranch,
          dayGanziIndex: opts.dayGanziIndex,
        },
        { iljin: { stem, branch } }
      );
      for (const hit of hits) {
        if (!hit.positions.includes('iljin')) continue;
        if (weights.positiveSinsal.includes(hit.name)) positiveSinsals.push(hit.name);
        if (weights.negativeSinsal.includes(hit.name)) negativeSinsals.push(hit.name);
      }
    } catch {
      // 신살 계산 실패해도 진행.
    }

    // 가중 보정.
    let adjusted = iljin.totalScore;
    for (const [key, mult] of Object.entries(weights.emphasize) as Array<
      [keyof IljinScoreResult['breakdown'], number]
    >) {
      const componentRaw = iljin.breakdown[key];
      const additionalBoost = componentRaw * (mult - 1);
      adjusted += additionalBoost;
    }
    adjusted += positiveSinsals.length * 8;
    adjusted -= negativeSinsals.length * 10;
    adjusted = Math.max(0, Math.min(100, Math.round(adjusted)));

    const grade = getGradeFromScore(adjusted);
    const reasonHint = buildReasonHint(purpose, iljin.dominantSipsung, positiveSinsals, negativeSinsals);

    results.push({
      isoDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      weekday,
      iljinGanzi: dayGanzi,
      iljinKorean: ganziToKorean(dayGanzi),
      rawScore: iljin.totalScore,
      adjustedScore: adjusted,
      grade,
      gradeEmoji: getGradeEmoji(grade),
      positiveSinsals,
      negativeSinsals,
      reasonHint,
    });
  }

  // 정렬 + 상위 K. 점수 동률은 이른 날짜 우선.
  results.sort((a, b) => {
    if (b.adjustedScore !== a.adjustedScore) return b.adjustedScore - a.adjustedScore;
    return a.isoDate.localeCompare(b.isoDate);
  });
  return results.slice(0, topK);
}

function buildReasonHint(
  purpose: TaekilPurpose,
  sipsung: string,
  positives: string[],
  negatives: string[]
): string {
  const purposeLabel = TAEKIL_PURPOSES.find((p) => p.key === purpose)?.label ?? '';
  if (negatives.length > 0) {
    return `${negatives[0]} 발동 — ${purposeLabel}에 부담 가능`;
  }
  if (positives.length > 0) {
    return `${positives[0]} 발동 — ${purposeLabel}에 길운`;
  }
  // 평범한 날 — 십성 위주.
  return `${sipsung} 작용 · ${purposeLabel}에 무난`;
}
