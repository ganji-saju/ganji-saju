// 2026-05-21 — 사주 총평 점수 시스템 Phase 1 (계산 엔진) 타입. phase-1-task.md §2.
//   순수 계산 입출력 타입만. UI/LLM 의존 없음.

export type Ohaeng = '목' | '화' | '토' | '금' | '수';

/** 점수 시스템 입력 */
export interface SajuData {
  // 8글자 (4기둥)
  yeonju: { gan: string; ji: string };
  wolju: { gan: string; ji: string };
  ilju: { gan: string; ji: string };
  siju: { gan: string; ji: string };

  // 파생 정보
  cheongan: string[]; // 4개 천간
  jiji: string[]; // 4개 지지
  allEightChars: string[]; // 8글자 모두

  // 명리 분석 결과
  ilgan: string; // 일간 (천간 1자)
  kyeokguk: string; // 격국 (예: '식신격')
  yongsin: string; // 용신 (오행 1자)
  yongsin_secondary?: string; // 보조 용신
  ganguk: '신강' | '신약' | '중화';

  // 신살
  gilsinList: string[]; // 작동하는 길신 목록
  hyungsalList: string[]; // 작동하는 흉살 목록
  hasGongmang: boolean;
}

/** 점수 시스템 출력 */
export interface SajuScore {
  total: number; // 0~100
  breakdown: {
    F1: number; // 일주 본질 (0~20)
    F2: number; // 격국 작동도 (0~20)
    F3: number; // 용신·기신 (0~20)
    F4: number; // 오행 균형 (0~20)
    F5: number; // 합충·신살 (5~20)
  };
  label: ScoreLabel;
  ohaengChart: OhaengChartData;
  computedAt: string;
  formulaVersion: string;
}

export interface ScoreLabel {
  level: 'excellent' | 'good' | 'neutral' | 'mindful' | 'potential';
  title: string;
  subtitle: string;
  description: string;
  disclaimer: string;
  color: {
    bg: string;
    bgSoft: string;
    text: string;
    textOnDark: string;
    ring: string;
    gradient: string;
  };
}

export interface OhaengChartData {
  counts: Record<Ohaeng, number>;
  total: 8;
  labels: Record<Ohaeng, string>; // "목 기운" 등 (naming-policy §2)
  meanings: Record<Ohaeng, string>;
  colors: Record<Ohaeng, string>;
  lack: Ohaeng[];
  excess: Ohaeng[];
  balanceScore: number; // F4 값
  guidanceText?: string; // Phase 5에서 LLM이 채움
}

export type ValidationResult = {
  ok: boolean;
  reasons: string[];
};
