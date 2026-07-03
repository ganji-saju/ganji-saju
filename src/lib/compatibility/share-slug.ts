// 궁합 공개 공유 slug — 2026-07-03 (docs/superpowers/specs/2026-07-03-share-snapshot-design.md).
// 형식: `{relationship}--{selfSlug}--{partnerSlug}`
//   - selfSlug/partnerSlug 는 기존 toSlug(BirthInput) 산출물(사주 공개 slug 와 동일 패턴,
//     해시 토큰 검증 포함). 단일 slug 는 '-' 단일 구분자 + non-empty part 로만 조립되므로
//     '--' 는 내부에 등장할 수 없어 복합 구분자로 안전하다.
//   - 표시 이름은 query(?a=&b=)로 별도 전달(이 모듈 범위 밖).
// 순수 모듈 — 서버·클라이언트(직접입력 결과) 양쪽에서 사용.
import { COMPATIBILITY_RELATIONSHIPS, type CompatibilityRelationshipSlug } from '@/content/moonlight';
import { fromSlug, toSlug } from '@/lib/saju/pillars';
import type { BirthInput } from '@/lib/saju/types';

const DELIMITER = '--';

export interface CompatibilityShareData {
  relationship: CompatibilityRelationshipSlug;
  self: BirthInput;
  partner: BirthInput;
}

export function buildCompatibilityShareSlug(
  relationship: CompatibilityRelationshipSlug,
  self: BirthInput,
  partner: BirthInput
): string {
  return [relationship, toSlug(self), toSlug(partner)].join(DELIMITER);
}

export function parseCompatibilityShareSlug(slug: string): CompatibilityShareData | null {
  const parts = slug.split(DELIMITER);
  if (parts.length !== 3) return null;
  const [relationship, selfSlug, partnerSlug] = parts;
  if (!COMPATIBILITY_RELATIONSHIPS.some((item) => item.slug === relationship)) return null;
  const self = fromSlug(selfSlug);
  if (!self) return null;
  const partner = fromSlug(partnerSlug);
  if (!partner) return null;
  return { relationship: relationship as CompatibilityRelationshipSlug, self, partner };
}
