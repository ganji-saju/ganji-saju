export const SAJU_PERSONALITY_MINI_PRODUCT_CODE = 'saju_personality_mini' as const;
export const SAJU_PERSONALITY_MINI_PACKAGE_ID = 'taste_saju_personality_mini' as const;
export const SAJU_PERSONALITY_MINI_NAME = '달빛 성향사주 깊이보기' as const;
export const SAJU_PERSONALITY_MINI_PRICE = 990 as const;
export const SAJU_PERSONALITY_MINI_SCOPE_PREFIX = 'saju-personality' as const;
export const SAJU_PERSONALITY_MINI_INCLUDED_SUBSCRIPTION_PLANS = [] as const;
export const SAJU_PERSONALITY_MINI_MEMBERSHIP_POLICY = 'policy_pending' as const;

function hashScopeFingerprint(fingerprint: string) {
  let hash = 2166136261;

  for (let index = 0; index < fingerprint.length; index += 1) {
    hash ^= fingerprint.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function isSajuPersonalityMiniProductId(
  value: unknown
): value is typeof SAJU_PERSONALITY_MINI_PRODUCT_CODE {
  return value === SAJU_PERSONALITY_MINI_PRODUCT_CODE;
}

export function buildSajuPersonalityScopeKey(fingerprint: string) {
  const normalized = fingerprint.trim() || 'anonymous-saju-personality-result';
  return `${SAJU_PERSONALITY_MINI_SCOPE_PREFIX}:${hashScopeFingerprint(normalized)}`;
}

export function buildSajuPersonalityResultHref(scope?: string | null) {
  const params = new URLSearchParams({
    paid: SAJU_PERSONALITY_MINI_PRODUCT_CODE,
  });

  if (scope) params.set('scope', scope);

  return `/saju/personality/result?${params.toString()}`;
}

export function buildSajuPersonalityPaymentFailedHref(scope?: string | null) {
  const params = new URLSearchParams({
    payment: 'failed',
  });

  if (scope) params.set('scope', scope);

  return `/saju/personality/result?${params.toString()}`;
}
