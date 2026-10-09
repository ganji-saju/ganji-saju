// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'user-agent': 'Mozilla/5.0 (iPhone)' }) }));
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: vi.fn(async () => ({ rpc: vi.fn(async () => ({})) })) }));
vi.mock('@/lib/partners/partner', async (orig) => ({ ...(await orig<typeof import('@/lib/partners/partner')>()), getActivePartner: vi.fn() }));
vi.mock('@/lib/payments/price-resolver', () => ({ resolvePackagePrice: vi.fn(async () => 32000) }));

import { getActivePartner } from '@/lib/partners/partner';
import Page, { metadata } from './page';

const render = async () => renderToStaticMarkup(await Page({ params: Promise.resolve({ code: 'abc12' }) }));

describe('올해운 노트 랜딩', () => {
  beforeEach(() => vi.clearAllMocks());

  it('B안 문구 · 32,000→19,200(40%) · 구매 버튼 · 결제 주체 안내 · 테마 셸', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce({ code: 'abc12', name: 'A', discountPercent: 40, commissionPercent: 30 });
    const html = await render();
    for (const text of ['내년 내 운, 미리 열어볼까요?', '생년월일만 넣으면 2027년 한 해가 달별로 정리돼요.', '2027 운세 열기', '32,000원', '19,200원', '40% 할인', '결제·풀이 제공: 간지사주(푸꼬컴퍼니)']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('/partner/go?code=abc12');
    expect(html).toContain('--note-bg:#FBF7F0');
    expect(html).not.toMatch(/[一-鿿]/);
  });

  it('없는 코드 → 안내만, 구매 버튼 없음', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce(null);
    const html = await render();
    expect(html).toContain('지금은 이용할 수 없는 링크입니다.');
    expect(html).not.toContain('/partner/go');
  });

  it('탭 제목에 간지사주 템플릿이 붙지 않는다', () => {
    expect(metadata.title).toEqual({ absolute: '올해운 노트 — 2027 운세' });
    expect(metadata.openGraph?.siteName).toBe('올해운 노트');
    expect(metadata.openGraph?.title).toBe('올해운 노트 — 2027 운세');
    expect(metadata.twitter?.title).toBe('올해운 노트 — 2027 운세');
    expect(JSON.stringify(metadata)).not.toContain('간지사주');
  });
});
