import { getPackage, type PaymentPackage } from '@/lib/payments/catalog';
import { PARTNER_PACKAGE_ID, type PartnerTerms } from './partner';

/** 파트너 쿠키가 살아 있을 때만 신년운세를 파트너판으로 바꾼다. 없거나 비활성이면 일반 상품(32,000원 청구 방지). */
export function resolveCheckoutPackage(base: PaymentPackage, partner: PartnerTerms | null): PaymentPackage {
  if (!partner || base.id !== 'taste_new_year_2027') return base;
  return getPackage(PARTNER_PACKAGE_ID) ?? base;
}
