/**
 * 결제 동의 — server-only DB helper. Phase 3-C-1 (2026-05-18).
 *
 * client-safe 규칙 (getRequiredConsentKinds / getConsentItems / findMissingConsents) 는
 * src/shared/payments/consent-rules.ts 분리.
 */

import { getCurrentPolicyVersion, recordUserConsent } from '@/lib/policies';
import type { PolicyKind } from '@/shared/policies/types';
import type { PaymentPackage } from '@/lib/payments/catalog';

// client-safe 규칙 re-export (기존 caller 호환).
export {
  findMissingConsents,
  getConsentItems,
  getRequiredConsentKinds,
  type ConsentItemMeta,
} from '@/shared/payments/consent-rules';

/**
 * 결제 시점 동의 기록 — 각 필수 정책의 활성 PolicyVersion 을 fetch 후 user_policy_consents 에 insert.
 * 정책 본문이 admin 입력 전이면 (활성 version 없음) 해당 정책 동의 skip (graceful).
 *
 * @returns 실제 insert 된 PolicyVersion ID 배열 (감사 로그 용)
 */
export async function recordConsentsForPayment(input: {
  userId: string;
  pkg: PaymentPackage;
  acceptedKinds: PolicyKind[];
  orderId?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<string[]> {
  const recorded: string[] = [];
  for (const kind of input.acceptedKinds) {
    const version = await getCurrentPolicyVersion(kind);
    if (!version) continue;
    await recordUserConsent({
      userId: input.userId,
      policyVersionId: version.id,
      consentMethod: 'payment_explicit',
      productId: input.pkg.id,
      orderId: input.orderId ?? null,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
    });
    recorded.push(version.id);
  }
  return recorded;
}
