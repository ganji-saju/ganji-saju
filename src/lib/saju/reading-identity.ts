// 2026-06-22 — 사주 정체성 키.
//   이용권(score-total·score-factor 등)이 'reading 입력 문자열(readingKey=toSlug)'에 묶이면
//   같은 사람이라도 경로/분 정밀도가 다른 입력이 별도 readingKey 가 돼 이용권이 안 이어진다
//   (번들 score-factor ↔ 사주 점수 게이트 grandfather 불발 → 이중과금. 실측 인시던트).
//   해결: 이용권 매칭을 '실제 사주(4기둥 간지 + 성별)' 정체성으로 한다. 같은 팔자 = 같은 키 →
//   분/해시/경로 차이에 불변, 생성 순서 무관. 절기 경계처럼 분이 기둥을 바꾸면 올바르게 다른 키.
import { calculateSaju, fromSlug } from './pillars';
import type { BirthInput, Pillar } from './types';

function pillarToken(pillar: Pillar | null): string {
  return pillar ? `${pillar.stem}${pillar.branch}` : '∅';
}

/** 4기둥(간지) + 성별로 사주를 식별하는 안정 키. 계산 불가 시 null(방어적). */
export function sajuIdentityKey(input: BirthInput): string | null {
  try {
    const saju = calculateSaju(input);
    return [
      pillarToken(saju.year),
      pillarToken(saju.month),
      pillarToken(saju.day),
      pillarToken(saju.hour),
      input.gender ?? 'unknown_gender',
    ].join('|');
  } catch {
    return null;
  }
}

/** readingKey(toSlug 결과)를 BirthInput 으로 되돌려 사주 정체성 키 산출. 파싱/계산 불가 시 null. */
export function sajuIdentityFromReadingKey(readingKey: string | null | undefined): string | null {
  const trimmed = readingKey?.trim();
  if (!trimmed) return null;
  const input = fromSlug(trimmed);
  if (!input) return null;
  return sajuIdentityKey(input);
}

/**
 * 저장된 readingKey 가 현재 reading 과 같은 사주(=같은 이용권)인지 판정.
 *   정확일치 우선, 실패 시 사주 정체성(4기둥+성별)으로 매칭 → 이름 해시·분·경로 차이를 흡수한다.
 *   생년월일/시가 실제로 다르면(기둥이 다르면) 정체성이 달라 매칭되지 않는다(오탐 방지).
 *   (score-total·score-factor 가 쓰던 패턴을 lifetime/year-core/monthly 공용으로 추출.)
 */
export function readingKeyMatchesCurrentSaju(
  storedReadingKey: string | null | undefined,
  currentReadingKeys: Array<string | null | undefined>,
  currentIdentity: string | null
): boolean {
  const stored = storedReadingKey?.trim();
  if (!stored) return false;
  for (const current of currentReadingKeys) {
    if (current && current.trim() === stored) return true;
  }
  return currentIdentity !== null && sajuIdentityFromReadingKey(stored) === currentIdentity;
}
