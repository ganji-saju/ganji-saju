// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: 'abc12' }) }),
  headers: async () => new Headers({ host: 'ganjisaju.kr' }),
}));
vi.mock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); }) }));
vi.mock('@/lib/supabase/server', () => ({ hasSupabaseServiceEnv: true, createServiceClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/partners/partner', async (orig) => ({ ...(await orig<typeof import('@/lib/partners/partner')>()), getActivePartner: vi.fn() }));
vi.mock('@/lib/new-year-access', () => ({ resolveNewYearAccess: vi.fn() }));
vi.mock('@/lib/coupons/coupon-charge', () => ({ couponEnvForHost: () => 'production', resolveChargeForUser: vi.fn() }));
vi.mock('@/lib/payments/provider', () => ({ getPaymentProvider: () => 'nicepay' }));
vi.mock('@/components/membership/toss-membership-checkout', () => ({
  default: (p: { packageId: string; amount: number; product?: string; slug?: string; entrySource?: string }) => (
    <div data-testid="pay" data-package={p.packageId} data-amount={p.amount} data-product={p.product} data-slug={p.slug} data-from={p.entrySource} />
  ),
}));

import { getActivePartner } from '@/lib/partners/partner';
import { resolveNewYearAccess } from '@/lib/new-year-access';
import { resolveChargeForUser } from '@/lib/coupons/coupon-charge';
import Page from './page';

const partner = { code: 'abc12', name: 'A', discountPercent: 40, commissionPercent: 30 };
const user = { id: 'u1' };
const quote = { listAmount: 32000, discountWon: 12800, chargeAmount: 19200, percent: 40, couponCode: null, reason: null, claim: null, memberPercent: 0, partner };
const render = async (slug?: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ slug }) }));

describe('/partner/checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActivePartner).mockResolvedValue(partner);
    vi.mocked(resolveNewYearAccess).mockResolvedValue({ reading: {}, user, hasAccess: false, isOwner: true } as never);
    vi.mocked(resolveChargeForUser).mockResolvedValue(quote as never);
  });

  it('정상 → 32,000원 취소선 · 19,200원(40%) · 파트너판 결제 버튼 · 결제 주체 안내', async () => {
    const html = await render('s1');
    expect(html).toContain('32,000원');
    expect(html).toContain('19,200원');
    expect(html).toContain('40%');
    expect(html).toContain('data-package="taste_new_year_2027_partner"');
    expect(html).toContain('data-amount="19200"');
    expect(html).toContain('data-product="new-year"');
    expect(html).toContain('data-slug="s1"');
    expect(html).toContain('data-from="partner"');
    expect(html).toContain('결제·풀이 제공: 간지사주(푸꼬컴퍼니)');
    expect(html).toContain('aria-hidden="true" class="h-40"');
    expect(html).not.toMatch(/[一-鿿]/);
  });

  it('파트너 없음 → 안내만, 결제 버튼 없음', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce(null);
    const html = await render('s1');
    expect(html).toContain('지금은 이용할 수 없는 링크입니다.');
    expect(html).not.toContain('data-testid="pay"');
  });

  it('계산 결과에 파트너가 빠지면(정가 청구 위험) 결제 버튼 없음', async () => {
    vi.mocked(resolveChargeForUser).mockResolvedValueOnce({ ...quote, partner: null, chargeAmount: 32000, discountWon: 0, percent: 0 } as never);
    const html = await render('s1');
    expect(html).not.toContain('data-testid="pay"');
    expect(html).not.toContain('32,000원 결제');
  });

  it('slug 없음 → 입력 화면', async () => {
    await expect(render()).rejects.toThrow('REDIRECT /partner/start');
  });

  it('사주 없음 → 입력 화면', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading: null, user: null, hasAccess: false, isOwner: false } as never);
    await expect(render('s1')).rejects.toThrow('REDIRECT /partner/start');
  });

  it('비로그인 → 올해운 노트 로그인(next=결제 페이지)', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading: {}, user: null, hasAccess: false, isOwner: false } as never);
    await expect(render('s1')).rejects.toThrow(`REDIRECT /partner/login?next=${encodeURIComponent('/partner/checkout?slug=s1')}`);
  });

  it('남의 사주 → 결제 버튼 없이 다시 입력 안내', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading: {}, user, hasAccess: false, isOwner: false } as never);
    const html = await render('s1');
    expect(html).toContain('href="/partner/start"');
    expect(html).not.toContain('data-testid="pay"');
  });

  it('이미 구매 → 풀이 보러 가기(간지사주 신년운세 화면)', async () => {
    vi.mocked(resolveNewYearAccess).mockResolvedValueOnce({ reading: {}, user, hasAccess: true, isOwner: true } as never);
    const html = await render('s1');
    expect(html).toContain('이미 받은 운세가 있어요');
    expect(html).toContain('href="/saju/s1/new-year/2027"');
    expect(html).not.toContain('data-testid="pay"');
  });
});
