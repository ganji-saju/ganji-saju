// 2026-06-05 #2 (보관함 탭 무반응) — 필터값이 데이터에 배선되지 않아 어떤 탭을 눌러도 목록이
//   동일했다. 카테고리 분류 + 동적 탭(데이터 있는 탭만 노출)을 위한 순수 로직.
//   2026-06-05 후속 — 타로 결과 보관함 저장(tarot_result_snapshots) 추가로 'tarot' 카테고리 편입.
export type VaultCategory = 'saju' | 'today' | 'gunghap' | 'tarot';
export type VaultFilterKey = 'all' | VaultCategory;

export const VAULT_FILTERS: ReadonlyArray<{ key: VaultFilterKey; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'saju', label: '사주' },
  { key: 'today', label: '오늘운세' },
  { key: 'gunghap', label: '궁합' },
  { key: 'tarot', label: '타로' },
];

export function isVaultFilterKey(value: string | null | undefined): value is VaultFilterKey {
  return (
    value === 'all' ||
    value === 'saju' ||
    value === 'today' ||
    value === 'gunghap' ||
    value === 'tarot'
  );
}

export function normalizeVaultFilter(value: string | null | undefined): VaultFilterKey {
  return isVaultFilterKey(value) ? value : 'all';
}

/**
 * 보관함 항목(구매 결과)의 카테고리. readings(명식)는 호출부에서 'saju' 로 취급한다.
 * today-detail → 오늘운세, love-question → 궁합, 그 외 사주 파생 상품은 모두 saju.
 */
export function vaultCategoryForProductId(productId: string): VaultCategory {
  if (productId === 'today-detail') return 'today';
  if (productId === 'love-question') return 'gunghap';
  if (productId === 'tarot-daily') return 'tarot';
  return 'saju';
}

/** '전체' + 데이터가 존재하는 카테고리 탭만 정의 순서대로 노출(사용자 결정: 데이터 있는 탭만). */
export function visibleVaultFilters(
  presentCategories: Iterable<VaultCategory>
): Array<{ key: VaultFilterKey; label: string }> {
  const present = new Set(presentCategories);
  return VAULT_FILTERS.filter(
    (filter) => filter.key === 'all' || present.has(filter.key as VaultCategory)
  );
}
