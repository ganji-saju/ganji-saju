// 새 도메인(인플루언서 랜딩) 호스트 판정·경로 전환. 도메인은 env 로 — 코드 수정 없이 붙이고 뗄 수 있게.
import { isBotUserAgent } from '@/lib/analytics/visit-filters';
import { normalizePartnerCode } from './partner';

export function isPartnerHost(hostname: string): boolean {
  const hosts = (process.env.PARTNER_SITE_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  return hosts.includes(hostname.toLowerCase());
}

const PASS_THROUGH_EXACT = ['/terms', '/privacy'];
const PASS_THROUGH_PREFIX = ['/_next/', '/images/', '/favicon'];

export function partnerLandingRewritePath(pathname: string): string | null {
  if (PASS_THROUGH_EXACT.includes(pathname) || PASS_THROUGH_PREFIX.some((p) => pathname.startsWith(p))) return null;
  const code = normalizePartnerCode(pathname.replace(/^\//, ''));
  return `/partner-landing/${code ?? '_'}`;
}

/** 방문 집계 대상인가 — 봇·미리보기 크롤러는 제외(판정은 방문 지표와 같은 isBotUserAgent). */
export function shouldCountPartnerVisit(userAgent: string | null): boolean {
  return !isBotUserAgent(userAgent);
}
