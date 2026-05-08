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
