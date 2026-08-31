// 2026-08-31 — 멤버십 열람 범위 = 본인 + 등록 가족 사주(등록 상한: 멤버 5명).
//   배경: 활성 구독이면 아무 사주든 깊은풀이가 계정 단위로 전부 열리던 blanket 을
//   "가족 사주 5명까지" 마케팅 카피와 일치하게 좁힌다(대표 결정 2026-08-31).
//   판정은 이용권과 같은 원칙(사주 정체성 = 4기둥+성별, reading-identity.ts)이라
//   이름·분·입력 경로 차이는 흡수하고, 생시가 실제로 다르면(기둥이 다르면) 매칭되지 않는다.
import {
  getUserProfileById,
  hasCoreBirthProfile,
  listFamilyProfilesForUser,
  toBirthInputFromProfile,
  type FamilyProfile,
  type UserProfile,
} from '@/lib/profile';
import { createClient, hasSupabaseServerEnv } from '@/lib/supabase/server';
import { sajuIdentityKey } from './reading-identity';
import { toSlug } from './pillars';
import type { BirthInput } from './types';

function profileIdentityAndSlug(profile: UserProfile | FamilyProfile) {
  // 한 프로필의 파생 실패(비정상 데이터로 toSlug throw 등)가 나머지 가족 칩까지
  // 죽이지 않게 프로필 단위로 흡수한다.
  try {
    if (!hasCoreBirthProfile(profile)) return null;
    const input = toBirthInputFromProfile(profile);
    const identity = sajuIdentityKey(input);
    if (!identity) return null;
    return { identity, slug: toSlug(input) };
  } catch {
    return null;
  }
}

/** 본인 + 가족 프로필의 사주 정체성 키 집합(출생정보 미완성 항목은 제외). */
export async function listMemberFamilyIdentityKeys(userId: string): Promise<Set<string>> {
  const [own, family] = await Promise.all([
    getUserProfileById(userId),
    listFamilyProfilesForUser(userId),
  ]);
  const keys = new Set<string>();
  for (const profile of [own, ...family]) {
    const derived = profileIdentityAndSlug(profile);
    if (derived) keys.add(derived.identity);
  }
  return keys;
}

/** 현재 보는 사주가 멤버십 열람 범위(본인·가족)에 드는지. 계산 불가·미등록은 false. */
export async function isReadingInMemberFamily(
  userId: string,
  input: BirthInput
): Promise<boolean> {
  const identity = sajuIdentityKey(input);
  if (!identity) return false;
  const keys = await listMemberFamilyIdentityKeys(userId);
  return keys.has(identity);
}

export interface FamilySajuNavLink {
  id: string;
  label: string;
  relationship: string;
  slug: string;
  identity: string;
  /**
   * 화면이 "OOO님"으로 호명할 사람 이름. 칩 라벨과 분리한 이유: 본인 칩 라벨은
   * displayName 이 비면 '내 사주' 플레이스홀더라 호명에 쓰면 "내 사주님"이 된다.
   */
  personName: string | null;
}

/**
 * 사주 화면 "가족 사주 바로가기" 링크 목록(본인 포함, 출생정보 완성분만).
 *   비로그인·env 부재·가족 0명이면 빈 배열 — 호출부는 길이로 렌더 분기.
 */
export async function getViewerFamilySajuNav(): Promise<FamilySajuNavLink[]> {
  if (!hasSupabaseServerEnv) return [];
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user) return [];

    const [own, family] = await Promise.all([
      getUserProfileById(user.id),
      listFamilyProfilesForUser(user.id),
    ]);

    const links: FamilySajuNavLink[] = [];
    const ownDerived = profileIdentityAndSlug(own);
    if (ownDerived) {
      links.push({
        id: 'own',
        label: own.displayName || '내 사주',
        relationship: '본인',
        personName: own.displayName?.trim() || null,
        ...ownDerived,
      });
    }
    for (const profile of family) {
      const derived = profileIdentityAndSlug(profile);
      if (!derived) continue;
      links.push({
        id: profile.id,
        label: profile.label,
        relationship: profile.relationship,
        personName: profile.label.trim() || null,
        ...derived,
      });
    }
    return links;
  } catch {
    return [];
  }
}

/**
 * 사주 정체성(4기둥+성별)이 등록된 본인·가족과 일치하면 그 사람 이름을 돌려준다.
 *   배경(2026-08-31 제보): 가족 칩의 slug 는 이름을 해시로만 담아(#722 관례) /saju/[slug] 가
 *   slug 복원 시 이름을 잃고 '달빛이' 폴백으로 떨어졌다. input.name 이 이미 있으면 그게 우선.
 */
export async function resolveFamilySubjectName(input: BirthInput): Promise<string | null> {
  const named = input.name?.trim();
  if (named) return named;
  const identity = sajuIdentityKey(input);
  if (!identity) return null;
  const nav = await getViewerFamilySajuNav();
  return nav.find((member) => member.identity === identity)?.personName ?? null;
}
