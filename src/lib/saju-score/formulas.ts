// 2026-05-21 — F1~F5 점수 계산 함수. phase-1-task.md §4 / saju-score-spec.md §2-2~§2-6.
import type { SajuData } from './types';
import {
  get12Unseong,
  countOhaeng,
  getKyeokguYongsin,
  checkKyeokguDamage,
  checkKyeokguProtection,
  isSpecialKyeokguk,
  countYongsinInSaju,
  isYongsin,
  checkYongsinDamage,
  checkGisinDominance,
  analyzeJijiInteractions,
  countGilsin,
  countHyungsal,
} from './helpers';

// === F1: 일주 본질 강도 (max 20) ===
export function calculateF1(ilju: { gan: string; ji: string }): number {
  const unseong = get12Unseong(ilju.gan, ilju.ji);

  const baseScores: Record<string, number> = {
    제왕: 20, 건록: 19, 관대: 17, 장생: 16,
    양: 15, 태: 14, 목욕: 13,
    쇠: 12, 병: 10, 묘: 8, 사: 7, 절: 5,
  };

  let score = baseScores[unseong] ?? 10;

  const specialIljus = {
    yanginIlju: ['병오', '임자', '무오', '갑인'],
    baekhoIlju: ['갑진', '을미', '병술', '정축', '무진', '임술', '계축'],
    goekgangIlju: ['경진', '경술', '임진', '임술', '무진', '무술'],
  };

  const iljuKey = ilju.gan + ilju.ji;
  if (specialIljus.yanginIlju.includes(iljuKey)) score += 2;
  if (specialIljus.baekhoIlju.includes(iljuKey)) score -= 2;
  if (specialIljus.goekgangIlju.includes(iljuKey)) score += 1;

  return Math.min(20, Math.max(0, score));
}

// === F2: 격국 작동도 (max 20) ===
export function calculateF2(saju: SajuData): number {
  let score = 0;

  // 2026-05-21 분포 튜닝(§14): 평균 60.9→66 목표로 정격 12→15 / 편격 10→13 상향
  //   (상위는 cap20 에 걸려 mid 케이스만 상승 → 평균 견인, max 불변).
  const isJeonggyeok = ['정인격', '정관격', '정재격', '식신격'].includes(saju.kyeokguk);
  score += isJeonggyeok ? 15 : 13;

  const kyeokguYongsin = getKyeokguYongsin(saju.kyeokguk, saju.ilgan);
  if (kyeokguYongsin && saju.cheongan.includes(kyeokguYongsin)) {
    score += 5;
  }

  if (!checkKyeokguDamage(saju)) score += 3;
  if (checkKyeokguProtection(saju)) score += 2;

  if (isSpecialKyeokguk(saju)) {
    score = Math.max(score, 15);
  }

  return Math.min(20, Math.max(0, score));
}

// === F3: 용신·기신 균형 (max 20) ===
export function calculateF3(saju: SajuData): number {
  let score = 0;

  // 2026-05-21 분포 튜닝(§14): 용신 글자 가중치 5→6 (cap 10→12) — 평균 64→66 상향.
  const yongsinCount = countYongsinInSaju(saju.yongsin, saju.allEightChars);
  score += Math.min(yongsinCount * 6, 12);

  const yongsinInCheongan = saju.cheongan.some((g) => isYongsin(g, saju.yongsin));
  if (yongsinInCheongan) score += 3;

  const yongsinNearIlju =
    isYongsin(saju.wolju.gan, saju.yongsin) || isYongsin(saju.siju.gan, saju.yongsin);
  if (yongsinNearIlju) score += 2;

  if (!checkYongsinDamage(saju)) score += 3;
  if (!checkGisinDominance(saju)) score += 2;

  return Math.min(20, Math.max(0, score));
}

// === F4: 오행 균형도 (max 20) ===
export function calculateF4(saju: SajuData): number {
  const counts = countOhaeng(saju.allEightChars);
  const total = 8;

  const presentOhaengCount = Object.values(counts).filter((c) => c > 0).length;

  let score = 0;
  switch (presentOhaengCount) {
    case 5: score = 12; break;
    case 4: score = 9; break;
    case 3: score = 6; break;
    case 2: score = 3; break;
    case 1: score = 1; break;
  }

  const maxCount = Math.max(...Object.values(counts));
  if (maxCount >= 5) score -= 5;
  else if (maxCount === 4) score -= 3;
  else if (maxCount === 3) score -= 1;

  const mean = total / 5;
  const variance =
    Object.values(counts).reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / 5;
  const stdDev = Math.sqrt(variance);

  if (stdDev < 1.0) score += 3;
  else if (stdDev < 1.5) score += 2;
  else if (stdDev < 2.0) score += 1;

  return Math.min(20, Math.max(0, score));
}

// === F5: 합충·신살 우호도 (5~20) ===
export function calculateF5(saju: SajuData): number {
  // 2026-05-21 분포 튜닝(§14): 중립 베이스 12→14 (평균 상향).
  let score = 14;

  const gilsinList = ['천을귀인', '천덕귀인', '월덕귀인', '문창귀인', '학당귀인'];
  const gilsinCount = countGilsin(saju, gilsinList);
  score += gilsinCount * 2;

  const hyungsalList = ['양인살', '백호살', '괴강살', '겁살', '망신살'];
  const hyungsalCount = countHyungsal(saju, hyungsalList);
  score -= hyungsalCount * 1.5;

  const interactions = analyzeJijiInteractions(saju.jiji);
  score += interactions.samhap * 3;
  score += interactions.yukap * 2;
  score -= interactions.chung * 2;
  score -= interactions.hyeong * 1.5;
  score -= interactions.wonjin * 1;

  if (saju.hasGongmang) score -= 1;

  // 2026-05-21 분포 튜닝(§14): 최저 5→8 상향 (하단 케이스 완화 → 평균 65+ 도달, 신약 가혹 완화).
  return Math.min(20, Math.max(8, score));
}
