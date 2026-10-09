// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({ hasSupabaseServerEnv: true, createClient: vi.fn(async () => ({ auth: { getUser } })) }));
vi.mock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); }) }));

import Page from './page';

const render = async (next?: string) => renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ next }) }));
const NEXT = '/partner/checkout?slug=s1';

describe('/partner/login', () => {
  beforeEach(() => getUser.mockReset());

  it('비로그인 → 카카오·구글 시작 주소에 next 를 실어 보냄, 이메일 로그인은 작은 링크', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const html = await render(NEXT);
    const encoded = encodeURIComponent(NEXT);
    expect(html).toContain(`/api/auth/kakao/start?next=${encoded}`);
    expect(html).toContain(`/api/auth/google/start?next=${encoded}`);
    expect(html).toContain(`/login?next=${encoded}`);
    expect(html).not.toMatch(/[一-鿿]/);
  });

  it('이미 로그인 → next 로 바로 이동', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } });
    await expect(render(NEXT)).rejects.toThrow(`REDIRECT ${NEXT}`);
  });

  it('바깥 주소 next 는 /partner/start 로 바꿔 싣는다', async () => {
    getUser.mockResolvedValueOnce({ data: { user: null } });
    const html = await render('//evil.com');
    expect(html).toContain(`/api/auth/kakao/start?next=${encodeURIComponent('/partner/start')}`);
  });
});
