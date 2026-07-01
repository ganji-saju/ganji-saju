/**
 * 결제 동의 규칙 (client-safe) — Phase 3-C-1 (2026-05-18).
 *
 * client / server 양쪽 사용. server-only DB 호출 (recordConsentsForPayment) 는
 * src/lib/payments/consent.ts 에 분리.
 */

import { POLICY_LABELS, type PolicyKind } from '@/shared/policies/types';
import type { PaymentPackage } from '@/lib/payments/catalog';

/**
 * 결제 종류별 필수 동의 PolicyKind.
 * - 공통: terms, privacy, refund
 * - managed subscription: + subscription
 * - credits: + coin
 * - one-time credit packs with kind='subscription' but no subscriptionPlan: + coin
 * - lifetime_report / taste_product / bundle: + digital-content
 */
export function getRequiredConsentKinds(pkg: PaymentPackage): PolicyKind[] {
  const common: PolicyKind[] = ['terms', 'privacy', 'refund'];
  switch (pkg.kind) {
    case 'subscription':
      return pkg.subscriptionPlan ? [...common, 'subscription'] : [...common, 'coin'];
    case 'credits':
      return [...common, 'coin'];
    case 'lifetime_report':
    case 'taste_product':
    case 'bundle':
      return [...common, 'digital-content'];
    default:
      return common;
  }
}

export interface ConsentItemMeta {
  kind: PolicyKind;
  label: string;
  description: string;
}

export function getConsentItems(pkg: PaymentPackage): ConsentItemMeta[] {
  const items: ConsentItemMeta[] = [
    {
      kind: 'terms',
      label: `${POLICY_LABELS.terms} 확인 및 동의`,
      description: '결제 진행을 위한 기본 이용 조건입니다.',
    },
    {
      kind: 'privacy',
      label: `${POLICY_LABELS.privacy} 확인 및 동의`,
      description: '결제 처리에 필요한 정보의 수집·이용에 대한 동의입니다.',
    },
    {
      kind: 'refund',
      label: `${POLICY_LABELS.refund} 확인`,
      description: '환불 가능 조건과 청약철회 제한을 확인하셨습니다.',
    },
  ];

  switch (pkg.kind) {
    case 'subscription':
      if (pkg.subscriptionPlan) {
        items.push({
          kind: 'subscription',
          label: '정기결제·구독 정책 확인 및 동의',
          description:
            '매월 자동결제, 무료체험 종료 후 유료 전환일, 해지 방법을 확인하셨습니다.',
        });
      } else {
        items.push({
          kind: 'coin',
          label: '재화(전) 정책 확인 및 동의',
          description:
            '유료/무료 재화 구분, 사용한 재화 환불 제한, 재화 유효기간을 확인하셨습니다.',
        });
      }
      break;
    case 'credits':
      items.push({
        kind: 'coin',
        label: '재화(전) 정책 확인 및 동의',
        description:
          '유료/무료 재화 구분, 사용한 재화 환불 제한, 재화 유효기간을 확인하셨습니다.',
      });
      break;
    case 'lifetime_report':
    case 'taste_product':
    case 'bundle':
      items.push({
        kind: 'digital-content',
        label: '디지털 콘텐츠 제공·철회 안내 확인 및 동의',
        description:
          '결과 생성 또는 콘텐츠 제공 개시 후 청약철회가 제한될 수 있음을 확인하셨습니다.',
      });
      break;
  }

  return items;
}

/** @returns 누락된 PolicyKind 배열 (빈 배열이면 검증 통과) */
export function findMissingConsents(
  pkg: PaymentPackage,
  acceptedKinds: PolicyKind[]
): PolicyKind[] {
  const required = getRequiredConsentKinds(pkg);
  const set = new Set(acceptedKinds);
  return required.filter((k) => !set.has(k));
}
