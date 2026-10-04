// 2026-10-04 인플루언서(파트너) 전용 신년운세 — 설계: docs/superpowers/specs/2026-10-04-influencer-landing-design.md
import type { SupabaseClient } from '@supabase/supabase-js';

export const PARTNER_PACKAGE_ID = 'taste_new_year_2027_partner';
export const PARTNER_COOKIE = 'ganji_partner';
export const PARTNER_COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export interface PartnerTerms {
  code: string;
  name: string;
  discountPercent: number;
  commissionPercent: number;
}

export function normalizePartnerCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase();
  return /^[a-z0-9]{3,20}$/.test(code) ? code : null;
}

/** 표시(resolveChargeForUser)와 주문(createPaymentOrder)이 같은 함수를 쓴다 — 화면 금액 = order.amount. */
export function applyPartnerPrice(listAmount: number, terms: PartnerTerms) {
  const discountWon = Math.floor((listAmount * terms.discountPercent) / 100);
  return { chargeAmount: listAmount - discountWon, discountWon, percent: terms.discountPercent };
}

/** 조회 실패(마이그레이션 미적용 포함)는 '파트너 없음' — 체크아웃을 깨지 않는다. */
export async function getActivePartner(service: SupabaseClient, raw: string | null | undefined): Promise<PartnerTerms | null> {
  const code = normalizePartnerCode(raw);
  if (!code) return null;
  const { data, error } = await service
    .from('partners')
    .select('code, name, discount_percent, commission_percent, active')
    .eq('code', code)
    .maybeSingle();
  if (error || !data || !data.active) return null;
  return { code: data.code, name: data.name, discountPercent: data.discount_percent, commissionPercent: data.commission_percent };
}
