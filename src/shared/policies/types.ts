/**
 * 정책 버저닝 — client-safe types + 상수 (Phase 3-B, 2026-05-18).
 *
 * 본 모듈은 서버 의존 (supabase) 없이 client / server 양쪽에서 import 가능.
 * 실제 DB fetch 는 server-only src/lib/policies.ts 에서.
 */

export const POLICY_KINDS = [
  'terms',
  'privacy',
  'refund',
  'digital-content',
  'subscription',
  'coin',
  'appointment',
  'ai-disclaimer',
  'commerce-disclosure',
] as const;

export type PolicyKind = (typeof POLICY_KINDS)[number];

export type PolicyContentFormat = 'markdown' | 'html' | 'plaintext';

export type ConsentMethod =
  | 'signup_implicit'
  | 'signup_explicit'
  | 'reconsent_modal'
  | 'payment_explicit'
  | 'admin_proxy';

export interface PolicyVersion {
  id: string;
  kind: PolicyKind;
  version: string;
  effectiveDate: string;
  content: string;
  contentFormat: PolicyContentFormat;
  contentHash: string;
  requiresReconsent: boolean;
  changelog: string | null;
  createdAt: string;
  createdBy: string | null;
}

/** 사용자 노출용 정책 한글 라벨. */
export const POLICY_LABELS: Record<PolicyKind, string> = {
  terms: '이용약관',
  privacy: '개인정보처리방침',
  refund: '환불·청약철회 정책',
  'digital-content': '디지털 콘텐츠 제공·철회 안내',
  subscription: '정기결제·구독 정책',
  coin: '코인 정책',
  appointment: '예약상담 정책',
  'ai-disclaimer': 'AI 상담·운세 콘텐츠 한계 고지',
  'commerce-disclosure': '사업자·통신판매 통합 고지',
};

/** 각 정책의 공개 URL. */
export const POLICY_URLS: Record<PolicyKind, string> = {
  terms: '/terms',
  privacy: '/privacy',
  refund: '/refund-policy',
  'digital-content': '/digital-content-policy',
  subscription: '/subscription-policy',
  coin: '/coin-policy',
  appointment: '/appointment-policy',
  'ai-disclaimer': '/ai-disclaimer',
  'commerce-disclosure': '/commerce-disclosure',
};
