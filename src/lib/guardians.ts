// 2026-08-25 전면 개편 Phase 2 — 수호신 배정 로직.
//   콘셉트(guardian-characters-spec.md): "내 띠의 수호신이 읽어주는 사주" —
//   생년 입력 시 자기 띠의 수호신이 전담 해설자로 배정된다.
//
//   띠 판정은 연도 % 12 계산이 아니라 **사주 엔진의 연주(年柱) 지지**에서 파생한다.
//   입춘 경계(양력 2월 초 출생의 전년도 띠)를 엔진이 이미 정확히 처리하므로
//   여기서 달력을 다시 구현하지 않는다 — 지지 한자 → ZodiacKey 매핑이 전부다.

import { ZODIAC, type ZodiacKey } from '@/components/gangi/zodiac-data';

export interface GuardianProfile {
  key: ZodiacKey;
  /** 지지 한자 (子…亥) — 캐릭터가 든 인장 현판의 글자와 동일. */
  han: string;
  /** 띠 동물 한글 (쥐…돼지). */
  animalKo: string;
  /** 해설 톤 한 줄 — 스펙 §3 성격 키워드(기민함·우직함…)와 연동. */
  persona: string;
  /** 캐릭터 이미지 경로 (2026-08-25 힉스필드 2차분, jpg 단일 소스). */
  image: string;
}

/** 스펙 §3 "성격 키워드(풀이 톤과 연동)" 를 사용자에게 보이는 한 줄로 옮긴 것. */
const GUARDIAN_PERSONA: Record<ZodiacKey, string> = {
  rat: '기민한 눈으로 기회의 결을 짚어드려요',
  ox: '서두르지 않고 우직하게 흐름을 읽어드려요',
  tiger: '결단이 필요한 대목을 또렷하게 짚어드려요',
  rabbit: '섬세한 마음결까지 살펴 읽어드려요',
  dragon: '큰 흐름을 내려다보며 짚어드려요',
  snake: '겉으로 안 보이는 결을 직관으로 읽어드려요',
  horse: '활기차게, 나아갈 길부터 짚어드려요',
  sheep: '온화하게, 관계의 결을 함께 살펴드려요',
  monkey: '수를 내다보는 전략가의 눈으로 읽어드려요',
  rooster: '때를 정확히 짚는 눈으로 읽어드려요',
  dog: '곁을 지키는 마음으로 꼼꼼히 살펴드려요',
  pig: '복이 드는 길목을 넉넉하게 짚어드려요',
};

const BRANCH_TO_KEY: ReadonlyMap<string, ZodiacKey> = new Map(
  (Object.entries(ZODIAC) as [ZodiacKey, (typeof ZODIAC)[ZodiacKey]][]).map(
    ([key, meta]) => [meta.han, key]
  )
);

export function guardianForZodiac(key: ZodiacKey): GuardianProfile {
  const meta = ZODIAC[key];
  return {
    key,
    han: meta.han,
    animalKo: meta.ko,
    persona: GUARDIAN_PERSONA[key],
    image: `/images/gangi/guardians/${key}.jpg`,
  };
}

/**
 * 연주 지지(한자) → 수호신. 사주 결과의 `sajuData.pillars.year.branch` 를 그대로 받는다.
 * 지지가 아니면 null — 호출부는 배정 UI 를 생략하면 된다(깨진 수호신 카드 금지).
 */
export function guardianFromYearBranch(branch: string): GuardianProfile | null {
  const key = BRANCH_TO_KEY.get(branch);
  return key ? guardianForZodiac(key) : null;
}
