export const PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE =
  'personality_compatibility_mini' as const;
export const PERSONALITY_COMPATIBILITY_MINI_PACKAGE_ID =
  'taste_personality_compatibility_mini' as const;
export const PERSONALITY_COMPATIBILITY_MINI_NAME = '달빛 성향궁합 깊이보기';
export const PERSONALITY_COMPATIBILITY_MINI_PRICE = 990;
export const PERSONALITY_COMPATIBILITY_MINI_SCOPE_PREFIX = 'personality-compatibility';

export const PERSONALITY_COMPATIBILITY_MINI_INCLUDED_SUBSCRIPTION_PLANS = [] as readonly string[];
export const PERSONALITY_COMPATIBILITY_MINI_MEMBERSHIP_POLICY = 'not_included' as const;

export function isPersonalityCompatibilityMiniProductId(
  productId: unknown
): productId is typeof PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE {
  return productId === PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE;
}

function hashString(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36);
}

export function buildPersonalityCompatibilityScopeKey(fingerprint: string) {
  const normalized = fingerprint.trim();
  return `${PERSONALITY_COMPATIBILITY_MINI_SCOPE_PREFIX}:${hashString(normalized)}`;
}

export function buildPersonalityCompatibilityResultHref(scope?: string | null) {
  const params = new URLSearchParams({
    paid: PERSONALITY_COMPATIBILITY_MINI_PRODUCT_CODE,
  });

  if (scope) params.set('scope', scope);
  return `/compatibility/personality/result?${params.toString()}`;
}

export function buildPersonalityCompatibilityPaymentFailedHref(scope?: string | null) {
  const params = new URLSearchParams({ payment: 'failed' });
  if (scope) params.set('scope', scope);
  return `/compatibility/personality/result?${params.toString()}`;
}
