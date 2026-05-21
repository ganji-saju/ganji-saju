// 2026-05-21 — 점수 시스템 명리 헬퍼. phase-1-task.md §3.
//   십성→천간은 100개 테이블 대신 *오행·음양 관계식*으로 계산(오류·중복 방지).
//   격국 손상/보호·종격·용신 손상은 §14 MVP 단순 룰 (정밀화는 후속).
import type { Ohaeng, SajuData } from './types';

// ── 오행/음양 기본 맵 ─────────────────────────────────────────────────────────
const CHEONGAN_OHAENG: Record<string, Ohaeng> = {
  갑: '목', 을: '목', 병: '화', 정: '화', 무: '토',
  기: '토', 경: '금', 신: '금', 임: '수', 계: '수',
};

const JIJI_OHAENG: Record<string, Ohaeng> = {
  인: '목', 묘: '목', 사: '화', 오: '화',
  진: '토', 술: '토', 축: '토', 미: '토',
  신: '금', 유: '금', 자: '수', 해: '수',
};

const STEM_YINYANG: Record<string, '양' | '음'> = {
  갑: '양', 을: '음', 병: '양', 정: '음', 무: '양',
  기: '음', 경: '양', 신: '음', 임: '양', 계: '음',
};

const STEM_BY_OH_YY: Record<Ohaeng, Record<'양' | '음', string>> = {
  목: { 양: '갑', 음: '을' },
  화: { 양: '병', 음: '정' },
  토: { 양: '무', 음: '기' },
  금: { 양: '경', 음: '신' },
  수: { 양: '임', 음: '계' },
};

// 상생(生): 목→화→토→금→수→목
const GENERATES: Record<Ohaeng, Ohaeng> = { 목: '화', 화: '토', 토: '금', 금: '수', 수: '목' };
// 나를 생하는 오행 (인성)
const GENERATED_BY: Record<Ohaeng, Ohaeng> = { 목: '수', 화: '목', 토: '화', 금: '토', 수: '금' };
// 상극(剋): 목→토→수→화→금→목 (내가 극하는 = 재성)
const CONTROLS: Record<Ohaeng, Ohaeng> = { 목: '토', 토: '수', 수: '화', 화: '금', 금: '목' };
// 나를 극하는 오행 (관성 / 용신의 기신)
const CONTROLS_ME: Record<Ohaeng, Ohaeng> = { 목: '금', 화: '수', 토: '목', 금: '화', 수: '토' };

export function ganOhaeng(char: string): Ohaeng | undefined {
  return CHEONGAN_OHAENG[char] ?? JIJI_OHAENG[char];
}

// ── 3-1. 12운성 매핑 (phase-1-task.md §3-1 테이블 그대로) ──────────────────────
const UNSEONG_TABLE: Record<string, Record<string, string>> = {
  갑: { 해: '장생', 자: '목욕', 축: '관대', 인: '건록', 묘: '제왕', 진: '쇠', 사: '병', 오: '사', 미: '묘', 신: '절', 유: '태', 술: '양' },
  을: { 오: '장생', 사: '목욕', 진: '관대', 묘: '건록', 인: '제왕', 축: '쇠', 자: '병', 해: '사', 술: '묘', 유: '절', 신: '태', 미: '양' },
  병: { 인: '장생', 묘: '목욕', 진: '관대', 사: '건록', 오: '제왕', 미: '쇠', 신: '병', 유: '사', 술: '묘', 해: '절', 자: '태', 축: '양' },
  정: { 유: '장생', 신: '목욕', 미: '관대', 오: '건록', 사: '제왕', 진: '쇠', 묘: '병', 인: '사', 축: '묘', 자: '절', 해: '태', 술: '양' },
  무: { 인: '장생', 묘: '목욕', 진: '관대', 사: '건록', 오: '제왕', 미: '쇠', 신: '병', 유: '사', 술: '묘', 해: '절', 자: '태', 축: '양' },
  기: { 유: '장생', 신: '목욕', 미: '관대', 오: '건록', 사: '제왕', 진: '쇠', 묘: '병', 인: '사', 축: '묘', 자: '절', 해: '태', 술: '양' },
  경: { 사: '장생', 오: '목욕', 미: '관대', 신: '건록', 유: '제왕', 술: '쇠', 해: '병', 자: '사', 축: '묘', 인: '절', 묘: '태', 진: '양' },
  신: { 자: '장생', 해: '목욕', 술: '관대', 유: '건록', 신: '제왕', 미: '쇠', 오: '병', 사: '사', 진: '묘', 묘: '절', 인: '태', 축: '양' },
  임: { 신: '장생', 유: '목욕', 술: '관대', 해: '건록', 자: '제왕', 축: '쇠', 인: '병', 묘: '사', 진: '묘', 사: '절', 오: '태', 미: '양' },
  계: { 묘: '장생', 인: '목욕', 축: '관대', 자: '건록', 해: '제왕', 술: '쇠', 유: '병', 신: '사', 미: '묘', 오: '절', 사: '태', 진: '양' },
};

export function get12Unseong(ilgan: string, ji: string): string {
  return UNSEONG_TABLE[ilgan]?.[ji] ?? '미정';
}

// ── 3-2. 오행 카운트 (본기 기준, 지장간 무시 MVP) ──────────────────────────────
export function countOhaeng(eightChars: string[]): Record<Ohaeng, number> {
  const counts: Record<Ohaeng, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  for (const char of eightChars) {
    const oh = ganOhaeng(char);
    if (oh) counts[oh] += 1;
  }
  return counts;
}

// ── 3-3. 십성→천간 (관계식 계산) + 격국 분석 ──────────────────────────────────
type Sipseong =
  | '비견' | '겁재' | '식신' | '상관' | '편재'
  | '정재' | '편관' | '정관' | '편인' | '정인';

/** 일간 기준 특정 십성에 해당하는 천간 글자. (오행 + 음양으로 결정) */
export function getSipseongGan(ilgan: string, sipseong: string): string {
  const ilganOh = CHEONGAN_OHAENG[ilgan];
  const ilganYY = STEM_YINYANG[ilgan];
  if (!ilganOh || !ilganYY) return '';
  const opp: '양' | '음' = ilganYY === '양' ? '음' : '양';

  const spec: Record<Sipseong, { oh: Ohaeng; yy: '양' | '음' }> = {
    비견: { oh: ilganOh, yy: ilganYY },
    겁재: { oh: ilganOh, yy: opp },
    식신: { oh: GENERATES[ilganOh], yy: ilganYY },
    상관: { oh: GENERATES[ilganOh], yy: opp },
    편재: { oh: CONTROLS[ilganOh], yy: ilganYY },
    정재: { oh: CONTROLS[ilganOh], yy: opp },
    편관: { oh: CONTROLS_ME[ilganOh], yy: ilganYY },
    정관: { oh: CONTROLS_ME[ilganOh], yy: opp },
    편인: { oh: GENERATED_BY[ilganOh], yy: ilganYY },
    정인: { oh: GENERATED_BY[ilganOh], yy: opp },
  };
  const target = spec[sipseong as Sipseong];
  if (!target) return '';
  return STEM_BY_OH_YY[target.oh][target.yy];
}

/** 격국명("식신격") → 격국용신 천간. */
export function getKyeokguYongsin(kyeokguk: string, ilgan: string): string {
  const sipseong = kyeokguk.replace('격', '');
  return getSipseongGan(ilgan, sipseong);
}

/** 격국용신이 충/극으로 손상되었는지 (MVP: 격국용신 오행을 극하는 글자 2개+ → 손상). */
export function checkKyeokguDamage(saju: SajuData): boolean {
  const ky = getKyeokguYongsin(saju.kyeokguk, saju.ilgan);
  const kyOh = CHEONGAN_OHAENG[ky];
  if (!kyOh) return false;
  const attacker = CONTROLS_ME[kyOh]; // 격국용신을 극하는 오행
  const counts = countOhaeng(saju.allEightChars);
  return counts[attacker] >= 2;
}

/** 격국 보호 글자(격국용신을 생하는 오행)가 천간에 있는지 (MVP). */
export function checkKyeokguProtection(saju: SajuData): boolean {
  const ky = getKyeokguYongsin(saju.kyeokguk, saju.ilgan);
  const kyOh = CHEONGAN_OHAENG[ky];
  if (!kyOh) return false;
  const protector = GENERATED_BY[kyOh]; // 격국용신을 생하는 오행
  return saju.cheongan.some((g) => CHEONGAN_OHAENG[g] === protector);
}

/** 종격(從格) 같은 특수격 판정 (MVP: 신약 + 한 오행 5개+ + 일간 생조 오행 1개 이하). */
export function isSpecialKyeokguk(saju: SajuData): boolean {
  if (saju.ganguk !== '신약') return false;
  const counts = countOhaeng(saju.allEightChars);
  const maxCount = Math.max(...Object.values(counts));
  if (maxCount < 5) return false;
  const ilganOh = CHEONGAN_OHAENG[saju.ilgan];
  if (!ilganOh) return false;
  const supportOh = GENERATED_BY[ilganOh]; // 일간을 생하는 오행
  return counts[supportOh] <= 1;
}

// ── 3-4. 용신 관련 ────────────────────────────────────────────────────────────
export function countYongsinInSaju(yongsin: string, eightChars: string[]): number {
  let count = 0;
  for (const char of eightChars) {
    if (ganOhaeng(char) === yongsin) count += 1;
  }
  return count;
}

export function isYongsin(gan: string, yongsin: string): boolean {
  return CHEONGAN_OHAENG[gan] === yongsin;
}

/** 용신을 극하는 오행 (기신). */
export function getGisinOhaeng(yongsin: string): Ohaeng {
  return CONTROLS_ME[yongsin as Ohaeng] ?? '토';
}

/** 용신이 손상되었는지 (MVP: 기신 오행 개수가 용신 오행 개수보다 많으면 손상). */
export function checkYongsinDamage(saju: SajuData): boolean {
  const counts = countOhaeng(saju.allEightChars);
  const gisin = getGisinOhaeng(saju.yongsin);
  const yongsinCount = counts[saju.yongsin as Ohaeng] ?? 0;
  return counts[gisin] > yongsinCount;
}

/** 기신이 사주 내에서 우세한지 (기신 4개+). */
export function checkGisinDominance(saju: SajuData): boolean {
  const gisin = getGisinOhaeng(saju.yongsin);
  const counts = countOhaeng(saju.allEightChars);
  return counts[gisin] >= 4;
}

// ── 3-5. 합/충/형/원진 분석 ───────────────────────────────────────────────────
export interface JijiInteractions {
  samhap: number;
  yukap: number;
  chung: number;
  hyeong: number;
  wonjin: number;
}

const SAMHAP_GROUPS: string[][] = [
  ['인', '오', '술'], ['신', '자', '진'], ['사', '유', '축'], ['해', '묘', '미'],
];
const YUKAP_PAIRS: [string, string][] = [
  ['자', '축'], ['인', '해'], ['묘', '술'], ['진', '유'], ['사', '신'], ['오', '미'],
];
const CHUNG_PAIRS: [string, string][] = [
  ['자', '오'], ['축', '미'], ['인', '신'], ['묘', '유'], ['진', '술'], ['사', '해'],
];
// 삼형(길이 3) / 상형(길이 2) / 자형(같은 글자 2개)
const HYEONG_TRIPLES: string[][] = [['인', '사', '신'], ['축', '술', '미']];
const HYEONG_PAIRS: [string, string][] = [['자', '묘']];
const JAHYEONG: string[] = ['진', '오', '유', '해'];
const WONJIN_PAIRS: [string, string][] = [
  ['자', '미'], ['축', '오'], ['인', '유'], ['묘', '신'], ['진', '해'], ['사', '술'],
];

function countOf(jiji: string[], char: string): number {
  return jiji.filter((j) => j === char).length;
}

export function analyzeJijiInteractions(jiji: string[]): JijiInteractions {
  const has = (c: string) => jiji.includes(c);

  const samhap = SAMHAP_GROUPS.filter((grp) => grp.every(has)).length;
  const yukap = YUKAP_PAIRS.filter(([a, b]) => has(a) && has(b)).length;
  const chung = CHUNG_PAIRS.filter(([a, b]) => has(a) && has(b)).length;
  const wonjin = WONJIN_PAIRS.filter(([a, b]) => has(a) && has(b)).length;

  let hyeong = 0;
  hyeong += HYEONG_TRIPLES.filter((grp) => grp.every(has)).length;
  hyeong += HYEONG_PAIRS.filter(([a, b]) => has(a) && has(b)).length;
  hyeong += JAHYEONG.filter((c) => countOf(jiji, c) >= 2).length;

  return { samhap, yukap, chung, hyeong, wonjin };
}

// ── 3-6. 신살 카운트 ──────────────────────────────────────────────────────────
export function countGilsin(saju: SajuData, gilsinList: string[]): number {
  return saju.gilsinList.filter((g) => gilsinList.includes(g)).length;
}

export function countHyungsal(saju: SajuData, hyungsalList: string[]): number {
  return saju.hyungsalList.filter((h) => hyungsalList.includes(h)).length;
}
