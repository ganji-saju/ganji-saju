export type Stem = '甲' | '乙' | '丙' | '丁' | '戊' | '己' | '庚' | '辛' | '壬' | '癸';
export type Branch = '子' | '丑' | '寅' | '卯' | '辰' | '巳' | '午' | '未' | '申' | '酉' | '戌' | '亥';
export type Element = '목' | '화' | '토' | '금' | '수';
export type YinYang = '양' | '음';
export type JasiMethod = 'split' | 'unified';
export type SolarTimeMode = 'standard' | 'longitude';

export interface BirthLocation {
  code?: string;
  label: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface Pillar {
  stem: Stem;
  branch: Branch;
  stemElement: Element;
  branchElement: Element;
  yinYang: YinYang;
}

export interface SajuResult {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar | null;
  elements: Record<Element, number>;  // 오행 개수
  dominantElement: Element;
  weakestElement: Element;
  dayMaster: Stem;  // 일간
}

export interface BirthInput {
  name?: string;
  year: number;
  month: number;
  day: number;
  hour?: number;   // 0~23, undefined이면 시주 없음
  minute?: number;
  unknownTime?: boolean;
  jasiMethod?: JasiMethod;
  gender?: 'male' | 'female';
  birthLocation?: BirthLocation | null;
  solarTimeMode?: SolarTimeMode;
}

// 2026-05-15 PR 1 — 사주아이 벤치마크 reference: 사용자의 "현재 상황" 3개 입력.
// BirthInput 과 분리 (사주 계산 캐시 키에 영향 X). personalizationContext.promptFacts
// 에 phrase 로 주입되어 풀이 본문에 자연스럽게 호명되도록.
export type RelationshipStatus = 'single' | 'dating' | 'married' | 'separated';
export type OccupationCategory =
  | 'employee'         // 직장인
  | 'self-employed'    // 자영업/프리랜서
  | 'student'          // 학생
  | 'homemaker'        // 주부
  | 'job-seeking'      // 구직중
  | 'other';
export type ConcernCategory =
  | 'business'         // 새로운 사업/이직
  | 'romance'          // 결혼/연애
  | 'family'           // 자녀/가족
  | 'health'           // 건강/멘탈
  | 'wealth'           // 재물/투자
  | 'other';

export interface UserSituation {
  relationshipStatus?: RelationshipStatus | null;
  occupation?: OccupationCategory | null;
  currentConcern?: ConcernCategory | null;
  /** 자유 입력 — 'other' 선택 시 caller 가 채움 (max 80자, 안전성 위해 길이 제한 권장). */
  concernNote?: string | null;
}
