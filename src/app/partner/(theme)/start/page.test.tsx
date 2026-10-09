// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => ({ value: 'abc12' }) }) }));
vi.mock('@/lib/supabase/server', () => ({ hasSupabaseServiceEnv: true, createServiceClient: vi.fn(async () => ({})) }));
vi.mock('@/lib/partners/partner', async (orig) => ({ ...(await orig<typeof import('@/lib/partners/partner')>()), getActivePartner: vi.fn() }));
vi.mock('./partner-birth-form', () => ({ PartnerBirthFormView: () => <form data-testid="birth-form" /> }));

import { getActivePartner } from '@/lib/partners/partner';
import Page from './page';

describe('/partner/start', () => {
  beforeEach(() => vi.clearAllMocks());

  it('파트너 없음 → 이용 불가 안내, 입력 폼 없음', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce(null);
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('지금은 이용할 수 없는 링크입니다.');
    expect(html).not.toContain('birth-form');
  });

  it('파트너 있음 → 입력 폼, 한자 없음', async () => {
    vi.mocked(getActivePartner).mockResolvedValueOnce({ code: 'abc12', name: 'A', discountPercent: 40, commissionPercent: 30 });
    const html = renderToStaticMarkup(await Page());
    expect(html).toContain('birth-form');
    expect(html).not.toMatch(/[一-鿿]/);
  });
});
